/**
 * Client-Side Storage Encryption
 * 
 * Provides obfuscation + integrity check for sensitive localStorage data.
 * NOT cryptographically secure against determined attackers, but raises
 * the bar significantly against casual XSS attacks.
 * 
 * Uses browser fingerprint as key - unique per browser/device.
 */

// ═══════════════════════════════════════════════════════════════
// FINGERPRINT GENERATION
// ═══════════════════════════════════════════════════════════════

/**
 * Generate a simple browser fingerprint as encryption key
 * Combines multiple browser properties for uniqueness
 */
function generateFingerprint(): string {
  if (typeof window === 'undefined') return 'server-side';
  
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    // Canvas fingerprint (simplified)
    getCanvasFingerprint(),
  ];
  
  return simpleHash(components.join('|'));
}

/**
 * Simple canvas fingerprint
 */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('XTFetch', 2, 2);
    
    return canvas.toDataURL().slice(-50);
  } catch {
    return 'canvas-error';
  }
}

/**
 * Simple hash function (djb2)
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}

// Cache fingerprint
let cachedFingerprint: string | null = null;

function getFingerprint(): string {
  if (!cachedFingerprint) {
    cachedFingerprint = generateFingerprint();
  }
  return cachedFingerprint;
}

// ═══════════════════════════════════════════════════════════════
// XOR CIPHER
// ═══════════════════════════════════════════════════════════════

/**
 * Simple XOR cipher - symmetric encryption
 * Returns hex string to avoid encoding issues
 */
function xorCipher(text: string, key: string): string {
  const result: number[] = [];
  for (let i = 0; i < text.length; i++) {
    result.push(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  // Return as hex string to avoid encoding issues
  return result.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Decrypt XOR cipher from hex string
 */
function xorDecipher(hex: string, key: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  let result = '';
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i] ^ key.charCodeAt(i % key.length));
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// HMAC FOR INTEGRITY
// ═══════════════════════════════════════════════════════════════

/**
 * Simple HMAC-like integrity check
 */
function computeHMAC(data: string, key: string): string {
  const combined = key + data + key;
  return simpleHash(combined);
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

const ENCRYPTED_PREFIX = 'enc:';

/**
 * Encrypt and store value in localStorage
 */
export function setEncrypted(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const fingerprint = getFingerprint();
    
    // XOR encrypt (returns hex string)
    const encrypted = xorCipher(value, fingerprint);
    
    // Add HMAC
    const hmac = computeHMAC(encrypted, fingerprint);
    
    // Store with prefix (no base64 needed, already hex)
    localStorage.setItem(key, `${ENCRYPTED_PREFIX}${encrypted}.${hmac}`);
  } catch (e) {
    // Fallback to plain storage if encryption fails
    console.warn('[Crypto] Encryption failed, storing plain:', e);
    localStorage.setItem(key, value);
  }
}

/**
 * Get and decrypt value from localStorage
 * Returns null if tampered or not found
 */
export function getEncrypted(key: string): string | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    
    // Check if encrypted
    if (!stored.startsWith(ENCRYPTED_PREFIX)) {
      // Legacy unencrypted data - return as-is
      return stored;
    }
    
    const data = stored.slice(ENCRYPTED_PREFIX.length);
    const [encrypted, hmac] = data.split('.');
    
    if (!encrypted || !hmac) return null;
    
    const fingerprint = getFingerprint();
    
    // Verify HMAC
    const expectedHmac = computeHMAC(encrypted, fingerprint);
    if (hmac !== expectedHmac) {
      console.warn('[Crypto] HMAC mismatch - data may be tampered or corrupted');
      // Return null and let caller handle (will show empty, user can re-enter)
      return null;
    }
    
    // Decrypt from hex
    const decrypted = xorDecipher(encrypted, fingerprint);
    
    return decrypted;
  } catch (e) {
    console.warn('[Crypto] Decryption failed:', e);
    return null;
  }
}

/**
 * Remove encrypted value
 */
export function removeEncrypted(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

/**
 * Check if value is encrypted
 */
export function isEncrypted(key: string): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(key);
  return stored?.startsWith(ENCRYPTED_PREFIX) ?? false;
}

/**
 * Migrate unencrypted value to encrypted
 * Returns true if migration happened
 */
export function migrateToEncrypted(key: string): boolean {
  if (typeof window === 'undefined') return false;
  
  const stored = localStorage.getItem(key);
  if (!stored || stored.startsWith(ENCRYPTED_PREFIX)) {
    return false; // Nothing to migrate or already encrypted
  }
  
  // Re-save with encryption
  setEncrypted(key, stored);
  return true;
}
