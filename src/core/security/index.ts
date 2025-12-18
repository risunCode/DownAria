/**
 * Core Security Module
 * ====================
 * Centralized security utilities for the application.
 * 
 * This module consolidates:
 * - lib/utils/security.ts (main security functions)
 * - lib/utils/api-security.ts (API-specific, mostly deprecated)
 * - lib/utils/admin-auth.ts (admin authentication)
 * 
 * Usage:
 *   import { encrypt, decrypt, isValidSocialUrl, verifyAdminSession } from '@/core/security';
 */

// ═══════════════════════════════════════════════════════════════
// RE-EXPORTS FROM EXISTING MODULES
// ═══════════════════════════════════════════════════════════════

// Main security utilities
export {
    // Sanitization
    escapeHtml,
    sanitizeObject,

    // URL Validation (SSRF Prevention)
    isValidSocialUrl,

    // Cookie Validation
    isValidCookie,

    // Encryption
    encrypt,
    decrypt,

    // API Key Hashing
    hashApiKey,

    // Token Generation
    generateSecureToken,

    // Log Masking
    maskSensitiveData,
    maskCookie,

    // Request Validation
    validateRequestBody,
    detectAttackPatterns,

    // IP Extraction
    getClientIP,
} from '@/lib/utils/security';

// Admin Authentication
export {
    verifySession,
    verifyAdminSession,
} from '@/lib/utils/admin-auth';

// Rate Limiting (from api-security - will be deprecated)
export {
    checkRateLimit,
} from '@/lib/utils/api-security';

// ═══════════════════════════════════════════════════════════════
// UNIFIED RATE LIMITER (New Implementation)
// ═══════════════════════════════════════════════════════════════

export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetIn: number;
}

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

// Rate limit configurations for different contexts
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
    // Public API (per IP)
    public: { maxRequests: 15, windowMs: 60 * 1000 },

    // Authenticated via API Key (per key)
    apiKey: { maxRequests: 100, windowMs: 60 * 1000 },

    // Auth endpoints (stricter)
    auth: { maxRequests: 10, windowMs: 60 * 1000 },

    // Admin endpoints
    admin: { maxRequests: 60, windowMs: 60 * 1000 },

    // Middleware global limit
    global: { maxRequests: 60, windowMs: 60 * 1000 },
};

// Unified rate limit store
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries periodically
const CLEANUP_THRESHOLD = 1000;

function cleanupExpiredEntries(): void {
    const now = Date.now();
    if (rateLimitStore.size > CLEANUP_THRESHOLD) {
        for (const [key, entry] of rateLimitStore) {
            if (entry.resetAt < now) {
                rateLimitStore.delete(key);
            }
        }
    }
}

/**
 * Unified Rate Limiter
 * @param identifier - Unique identifier (IP address, API key, etc.)
 * @param context - Rate limit context (uses predefined configs)
 * @param customConfig - Optional custom configuration
 */
export function rateLimit(
    identifier: string,
    context: keyof typeof RATE_LIMIT_CONFIGS = 'public',
    customConfig?: Partial<RateLimitConfig>
): RateLimitResult {
    const config = { ...RATE_LIMIT_CONFIGS[context], ...customConfig };
    const now = Date.now();
    const key = `${context}:${identifier}`;

    cleanupExpiredEntries();

    const entry = rateLimitStore.get(key);

    // New window
    if (!entry || entry.resetAt < now) {
        rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
        return { allowed: true, remaining: config.maxRequests - 1, resetIn: config.windowMs };
    }

    // Exceeded limit
    if (entry.count >= config.maxRequests) {
        return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
    }

    // Increment
    entry.count++;
    return {
        allowed: true,
        remaining: config.maxRequests - entry.count,
        resetIn: entry.resetAt - now
    };
}

/**
 * Reset rate limit for an identifier
 */
export function resetRateLimit(identifier: string, context: string = 'public'): void {
    rateLimitStore.delete(`${context}:${identifier}`);
}

/**
 * Get current rate limit status without consuming
 */
export function getRateLimitStatus(
    identifier: string,
    context: keyof typeof RATE_LIMIT_CONFIGS = 'public'
): { count: number; remaining: number; resetIn: number } | null {
    const config = RATE_LIMIT_CONFIGS[context];
    const key = `${context}:${identifier}`;
    const entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < Date.now()) {
        return null;
    }

    return {
        count: entry.count,
        remaining: config.maxRequests - entry.count,
        resetIn: entry.resetAt - Date.now(),
    };
}
