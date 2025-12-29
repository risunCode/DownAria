/**
 * Client-Side Storage Encryption
 * ==============================
 * XOR cipher + HMAC integrity check for sensitive localStorage data.
 * Uses browser fingerprint as key - unique per browser/device.
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
// FINGERPRINT
// ═══════════════════════════════════════════════════════════════

let cachedFingerprint: string | null = null;

function getFingerprint(): string {
  if (cachedFingerprint) return cachedFingerprint;
  if (typeof window === 'undefined') return 'server-side';
  
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    getCanvasFingerprint(),
  ];
  
  cachedFingerprint = simpleHash(components.join('|'));
  return cachedFingerprint;
}

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('DownAria', 2, 2);
    return canvas.toDataURL().slice(-50);
  } catch {
    return 'canvas-error';
  }
}

function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}

// ═══════════════════════════════════════════════════════════════
// XOR CIPHER + HMAC
// ═══════════════════════════════════════════════════════════════

const ENCRYPTED_PREFIX = 'enc:';

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

function computeHMAC(data: string, key: string): string {
  return simpleHash(key + data + key);
}

function encryptValue(value: string): string {
  const fp = getFingerprint();
  const encrypted = xorCipher(value, fp);
  return `${ENCRYPTED_PREFIX}${encrypted}.${computeHMAC(encrypted, fp)}`;
}

function decryptValue(stored: string): string | null {
  if (!stored.startsWith(ENCRYPTED_PREFIX)) return stored;
  
  const [encrypted, hmac] = stored.slice(ENCRYPTED_PREFIX.length).split('.');
  if (!encrypted || !hmac) return null;
  
  const fp = getFingerprint();
  if (hmac !== computeHMAC(encrypted, fp)) {
    console.warn('[Crypto] HMAC mismatch');
    return null;
  }
  
  return xorDecipher(encrypted, fp);
}

// ═══════════════════════════════════════════════════════════════
// COOKIE STORAGE
// ═══════════════════════════════════════════════════════════════

export function getEncryptedCookies(): CookieStorage {
  if (typeof window === 'undefined') return {};
  
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.COOKIES);
    if (!stored) return {};
    const decrypted = decryptValue(stored);
    return decrypted ? JSON.parse(decrypted) : {};
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
    
    localStorage.setItem(STORAGE_KEYS.COOKIES, encryptValue(JSON.stringify(cleaned)));
  } catch (e) {
    console.warn('[Crypto] Failed to save cookies:', e);
  }
}

export function clearAllCookies(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.COOKIES);
}

// ═══════════════════════════════════════════════════════════════
// GENERIC ENCRYPTION (for backup/restore)
// ═══════════════════════════════════════════════════════════════

export function setEncrypted(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, encryptValue(value));
  } catch {
    localStorage.setItem(key, value);
  }
}

export function getEncrypted(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(key);
    return stored ? decryptValue(stored) : null;
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
  return localStorage.getItem(key)?.startsWith(ENCRYPTED_PREFIX) ?? false;
}
