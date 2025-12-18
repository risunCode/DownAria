/**
 * API Security Utilities
 * - Rate limiting
 * - Cookie validation
 * - IP extraction (re-exported from security.ts)
 * 
 * NOTE: Cache moved to src/lib/services/cache.ts (Supabase only)
 * NOTE: getClientIP is now centralized in security.ts
 */

// Re-export getClientIP from security.ts for backward compatibility
export { getClientIP } from './security';

// ═══════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const RATE_LIMIT = {
    maxRequests: 10,      // max requests per window
    windowMs: 60 * 1000,  // 1 minute window
};

export function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const entry = rateLimitMap.get(identifier);

    // Clean up expired entries periodically
    if (rateLimitMap.size > 1000) {
        for (const [key, val] of rateLimitMap) {
            if (val.resetAt < now) rateLimitMap.delete(key);
        }
    }

    if (!entry || entry.resetAt < now) {
        // New window
        rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
        return { allowed: true, remaining: RATE_LIMIT.maxRequests - 1, resetIn: RATE_LIMIT.windowMs };
    }

    if (entry.count >= RATE_LIMIT.maxRequests) {
        return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
    }

    entry.count++;
    return { allowed: true, remaining: RATE_LIMIT.maxRequests - entry.count, resetIn: entry.resetAt - now };
}

// ═══════════════════════════════════════════════════════════════
// COOKIE SANITIZATION
// ═══════════════════════════════════════════════════════════════

export function sanitizeCookieForLog(cookie?: string): string {
    if (!cookie) return 'none';
    // Only show first 20 chars + length
    const preview = cookie.substring(0, 20);
    return `${preview}... (${cookie.length} chars)`;
}

export function validateCookie(cookie?: string): boolean {
    if (!cookie) return true; // No cookie is valid (optional)
    // Basic validation - should contain key=value pairs
    return /\w+=\w+/.test(cookie) && cookie.length < 10000;
}
