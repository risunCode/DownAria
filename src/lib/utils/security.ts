/**
 * Security Utilities
 * - Input validation & sanitization
 * - XSS prevention
 * - SSRF prevention
 * - Data encryption
 */

import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════
// INPUT SANITIZATION
// ═══════════════════════════════════════════════════════════════

// Escape HTML to prevent XSS
export function escapeHtml(str: string): string {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
}

// Sanitize object recursively (escape all string values)
export function sanitizeObject<T>(obj: T): T {
    if (typeof obj === 'string') {
        return escapeHtml(obj) as T;
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeObject) as T;
    }
    if (obj && typeof obj === 'object') {
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[escapeHtml(key)] = sanitizeObject(value);
        }
        return sanitized as T;
    }
    return obj;
}

// ═══════════════════════════════════════════════════════════════
// URL VALIDATION (SSRF Prevention)
// ═══════════════════════════════════════════════════════════════

const ALLOWED_DOMAINS = [
    // Social media
    'facebook.com', 'fb.com', 'fb.watch', 'fbcdn.net',
    'instagram.com', 'cdninstagram.com', 'instagr.am',
    'twitter.com', 'x.com', 't.co', 'twimg.com',
    'tiktok.com', 'tiktokcdn.com', 'musical.ly',
    'youtube.com', 'youtu.be', 'googlevideo.com', 'ytimg.com',
    'weibo.com', 'weibo.cn', 'sinaimg.cn',
    'douyin.com', 'douyincdn.com',
];

const BLOCKED_PATTERNS = [
    /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|0\.)/,  // Private IPs
    /localhost/i,
    /\.local$/i,
    /^file:/i,
    /^ftp:/i,
    /^data:/i,
];

export function isValidSocialUrl(url: string): { valid: boolean; error?: string } {
    if (!url || typeof url !== 'string') {
        return { valid: false, error: 'URL is required' };
    }

    // Length check
    if (url.length > 2000) {
        return { valid: false, error: 'URL too long' };
    }

    // Must start with http/https
    if (!/^https?:\/\//i.test(url)) {
        return { valid: false, error: 'Invalid URL protocol' };
    }

    // Check blocked patterns (SSRF prevention)
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(url)) {
            return { valid: false, error: 'Invalid URL' };
        }
    }

    // Extract hostname
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();

        // Check if domain is allowed
        const isAllowed = ALLOWED_DOMAINS.some(domain =>
            hostname === domain || hostname.endsWith('.' + domain)
        );

        if (!isAllowed) {
            return { valid: false, error: 'Unsupported platform' };
        }

        return { valid: true };
    } catch {
        return { valid: false, error: 'Invalid URL format' };
    }
}

// ═══════════════════════════════════════════════════════════════
// COOKIE VALIDATION
// ═══════════════════════════════════════════════════════════════

export function isValidCookie(cookie: string): { valid: boolean; error?: string } {
    if (!cookie) return { valid: true }; // Optional

    if (typeof cookie !== 'string') {
        return { valid: false, error: 'Cookie must be a string' };
    }

    if (cookie.length > 10000) {
        return { valid: false, error: 'Cookie too long' };
    }

    // Check for suspicious patterns
    const suspicious = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /eval\s*\(/i,
    ];

    for (const pattern of suspicious) {
        if (pattern.test(cookie)) {
            return { valid: false, error: 'Invalid cookie format' };
        }
    }

    return { valid: true };
}

// ═══════════════════════════════════════════════════════════════
// ENCRYPTION (for sensitive data in DB)
// ═══════════════════════════════════════════════════════════════

const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 16;

// Get encryption key - MUST be set in production
function getEncryptionKey(): string {
    const key = process.env.ENCRYPTION_KEY;
    if (!key && process.env.NODE_ENV === 'production') {
        throw new Error('ENCRYPTION_KEY environment variable is required in production');
    }
    return key || 'default-key-for-development-only';
}

/**
 * Encrypt text with AES-256-GCM
 * Format: salt:iv:authTag:encrypted (all hex encoded)
 * Uses random salt per encryption for better security
 */
export function encrypt(text: string): string {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(getEncryptionKey(), salt, 32);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Include salt in output for decryption
    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt text encrypted with encrypt()
 * Supports both new format (salt:iv:authTag:encrypted) and legacy format (iv:authTag:encrypted)
 */
export function decrypt(encryptedText: string): string {
    try {
        const parts = encryptedText.split(':');

        // Support legacy format (without salt) for backward compatibility
        if (parts.length === 3) {
            // Legacy format: iv:authTag:encrypted (using hardcoded salt)
            const [ivHex, authTagHex, encrypted] = parts;
            const iv = Buffer.from(ivHex, 'hex');
            const authTag = Buffer.from(authTagHex, 'hex');
            const key = crypto.scryptSync(getEncryptionKey(), 'salt', 32);

            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        }

        // New format: salt:iv:authTag:encrypted
        const [saltHex, ivHex, authTagHex, encrypted] = parts;
        const salt = Buffer.from(saltHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const key = crypto.scryptSync(getEncryptionKey(), salt, 32);

        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch {
        return '';
    }
}

// ═══════════════════════════════════════════════════════════════
// API KEY HASHING
// ═══════════════════════════════════════════════════════════════

export function hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
}

export function generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
}

// ═══════════════════════════════════════════════════════════════
// LOG MASKING
// ═══════════════════════════════════════════════════════════════

export function maskSensitiveData(data: string, visibleChars = 4): string {
    if (!data || data.length <= visibleChars * 2) return '***';
    return data.slice(0, visibleChars) + '***' + data.slice(-visibleChars);
}

export function maskCookie(cookie: string): string {
    if (!cookie) return '';
    if (cookie.length <= 20) return '***';
    return cookie.slice(0, 10) + '...[' + cookie.length + ' chars]';
}

// ═══════════════════════════════════════════════════════════════
// REQUEST VALIDATION
// ═══════════════════════════════════════════════════════════════

export function validateRequestBody(body: unknown, maxSize = 10000): { valid: boolean; error?: string } {
    if (!body) return { valid: true };

    const str = typeof body === 'string' ? body : JSON.stringify(body);

    if (str.length > maxSize) {
        return { valid: false, error: 'Request body too large' };
    }

    return { valid: true };
}

// Check for common attack patterns in input
export function detectAttackPatterns(input: string): boolean {
    const patterns = [
        /union\s+select/i,
        /;\s*drop\s+table/i,
        /--\s*$/,
        /<script[\s>]/i,
        /javascript:/i,
        /on(error|load|click)\s*=/i,
        /\$\{.*\}/,  // Template injection
        /\{\{.*\}\}/, // Template injection
    ];

    return patterns.some(p => p.test(input));
}

// ═══════════════════════════════════════════════════════════════
// CLIENT IP EXTRACTION (Centralized)
// ═══════════════════════════════════════════════════════════════

/**
 * Extract client IP from request headers
 * Supports both NextRequest and standard Request types
 */
export function getClientIP(request: Request): string {
    // Try x-forwarded-for header (set by proxies/load balancers)
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        // Take first IP in case of multiple proxies
        return forwarded.split(',')[0].trim();
    }

    // Try x-real-ip header (set by some reverse proxies)
    const realIP = request.headers.get('x-real-ip');
    if (realIP) return realIP;

    // Fallback
    return 'unknown';
}
