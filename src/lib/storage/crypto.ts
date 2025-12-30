/**
 * Client-Side Storage Encryption
 * ==============================
 * Simple XOR encryption for localStorage data.
 * Designed for export/import compatibility across browsers.
 * 
 * Security Note: This is NOT meant to be cryptographically secure.
 * It's obfuscation to prevent casual snooping. For true security,
 * use password-based encryption on export/import.
 * 
 * Storage Key: downaria_cookies
 */

import { STORAGE_KEYS } from './settings';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface CookieStorage {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  weibo?: string;
}

// ═══════════════════════════════════════════════════════════════
// SIMPLE HASH & XOR CIPHER
// ═══════════════════════════════════════════════════════════════

function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}

function xorCipher(text: string, key: string): string {
  const result: number[] = [];
  for (let i = 0; i < text.length; i++) {
    result.push(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result.map(b => b.toString(16).padStart(2, '0')).join('');
}

function xorDecipher(hex: string, key: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return bytes.map((b, i) => String.fromCharCode(b ^ key.charCodeAt(i % key.length))).join('');
}

// ═══════════════════════════════════════════════════════════════
// ENCRYPTION KEY (App-level, not fingerprint-based for portability)
// ═══════════════════════════════════════════════════════════════

const APP_KEY = 'DownAria2025!@#$';

function computeHMAC(data: string, key: string): string {
  return simpleHash(key + data + key);
}

const ENCRYPTED_PREFIX = 'enc:';

function encryptValue(value: string): string {
  const encrypted = xorCipher(value, APP_KEY);
  return `${ENCRYPTED_PREFIX}${encrypted}.${computeHMAC(encrypted, APP_KEY)}`;
}

function decryptValue(stored: string): string | null {
  if (!stored.startsWith(ENCRYPTED_PREFIX)) return stored;
  
  const [encrypted, hmac] = stored.slice(ENCRYPTED_PREFIX.length).split('.');
  if (!encrypted || !hmac) return null;
  
  if (hmac !== computeHMAC(encrypted, APP_KEY)) {
    console.warn('[Crypto] HMAC mismatch');
    return null;
  }
  
  return xorDecipher(encrypted, APP_KEY);
}

// ═══════════════════════════════════════════════════════════════
// COOKIE STORAGE (Sync API for simplicity)
// ═══════════════════════════════════════════════════════════════

export function getEncryptedCookies(): CookieStorage {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.COOKIES);
    if (!stored) return {};
    const decrypted = decryptValue(stored);
    if (!decrypted) return {};
    return JSON.parse(decrypted);
  } catch {
    return {};
  }
}

export function setEncryptedCookies(cookies: CookieStorage): void {
  if (typeof window === 'undefined') return;
  
  try {
    const cleaned: CookieStorage = {};
    for (const [key, value] of Object.entries(cookies)) {
      if (value?.trim()) cleaned[key as keyof CookieStorage] = value.trim();
    }
    
    if (Object.keys(cleaned).length === 0) {
      localStorage.removeItem(STORAGE_KEYS.COOKIES);
      return;
    }
    
    const encrypted = encryptValue(JSON.stringify(cleaned));
    localStorage.setItem(STORAGE_KEYS.COOKIES, encrypted);
  } catch (e) {
    console.warn('[Crypto] Failed to save cookies:', e);
  }
}

export function clearAllCookies(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.COOKIES);
}

// ═══════════════════════════════════════════════════════════════
// GENERIC ENCRYPTION (for other sensitive data)
// ═══════════════════════════════════════════════════════════════

export function setEncrypted(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    const encrypted = encryptValue(value);
    localStorage.setItem(key, encrypted);
  } catch {
    localStorage.setItem(key, value);
  }
}

export function getEncrypted(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    return decryptValue(stored);
  } catch {
    return null;
  }
}

export function removeEncrypted(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

export function isEncrypted(key: string): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(key);
  return stored?.startsWith(ENCRYPTED_PREFIX) || false;
}

// ═══════════════════════════════════════════════════════════════
// PASSWORD-BASED ENCRYPTION (for secure export/import)
// ═══════════════════════════════════════════════════════════════

/**
 * Encrypt data with user password for secure export
 * Uses PBKDF2 + AES-GCM via Web Crypto API
 */
export async function encryptWithPassword(data: string, password: string): Promise<string> {
  if (typeof window === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Derive key from password
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(data)
  );
  
  // Combine salt + iv + ciphertext as base64
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data with user password for secure import
 */
export async function decryptWithPassword(encryptedData: string, password: string): Promise<string> {
  if (typeof window === 'undefined' || !crypto.subtle) {
    throw new Error('Web Crypto API not available');
  }
  
  const decoder = new TextDecoder();
  const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);
  
  // Derive key from password
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  
  return decoder.decode(decrypted);
}
