/**
 * Core Security Module
 * Centralized security: validation, encryption, auth, rate limiting
 * Rate limiting: Redis > Memory fallback
 */

import { redis } from '@/lib/redis';

// Security utilities
export {
    escapeHtml, sanitizeObject,
    isValidSocialUrl, isValidCookie,
    encrypt, decrypt,
    hashApiKey, generateSecureToken,
    maskSensitiveData, maskCookie,
    validateRequestBody, detectAttackPatterns,
    getClientIP,
} from '@/lib/utils/security';

// Admin auth
export { verifySession, verifyAdminSession, verifyAdminToken } from '@/lib/utils/admin-auth';

// Rate limiting types & config
export interface RateLimitConfig { maxRequests: number; windowMs: number; }
export interface RateLimitResult { allowed: boolean; remaining: number; resetIn: number; }

export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
    public: { maxRequests: 15, windowMs: 60_000 },
    apiKey: { maxRequests: 100, windowMs: 60_000 },
    auth: { maxRequests: 10, windowMs: 60_000 },
    admin: { maxRequests: 60, windowMs: 60_000 },
    global: { maxRequests: 60, windowMs: 60_000 },
    playground: { maxRequests: 5, windowMs: 120_000 },
};

// In-memory fallback
const memStore = new Map<string, { count: number; resetAt: number }>();

function memCleanup() {
    if (memStore.size > 500) {
        const now = Date.now();
        for (const [k, v] of memStore) if (v.resetAt < now) memStore.delete(k);
    }
}

function memRateLimit(key: string, cfg: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    memCleanup();
    const entry = memStore.get(key);
    if (!entry || entry.resetAt < now) {
        memStore.set(key, { count: 1, resetAt: now + cfg.windowMs });
        return { allowed: true, remaining: cfg.maxRequests - 1, resetIn: cfg.windowMs };
    }
    if (entry.count >= cfg.maxRequests) {
        return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
    }
    entry.count++;
    return { allowed: true, remaining: cfg.maxRequests - entry.count, resetIn: entry.resetAt - now };
}

/**
 * Rate Limiter - Redis-backed with memory fallback
 */
export async function rateLimit(
    id: string,
    ctx: keyof typeof RATE_LIMIT_CONFIGS = 'public',
    custom?: Partial<RateLimitConfig>
): Promise<RateLimitResult> {
    const cfg = { ...RATE_LIMIT_CONFIGS[ctx], ...custom };
    const key = `rl:${ctx}:${id}`;
    const windowSec = Math.ceil(cfg.windowMs / 1000);

    if (!redis) return memRateLimit(key, cfg);

    try {
        // Atomic increment with TTL
        const count = await redis.incr(key);
        
        // Set expiry on first request
        if (count === 1) {
            await redis.expire(key, windowSec);
        }

        // Get TTL for resetIn
        const ttl = await redis.ttl(key);
        const resetIn = ttl > 0 ? ttl * 1000 : cfg.windowMs;

        if (count > cfg.maxRequests) {
            return { allowed: false, remaining: 0, resetIn };
        }

        return { allowed: true, remaining: cfg.maxRequests - count, resetIn };
    } catch {
        return memRateLimit(key, cfg);
    }
}

// Sync version for middleware (memory only)
export function rateLimitSync(
    id: string,
    ctx: keyof typeof RATE_LIMIT_CONFIGS = 'public',
    custom?: Partial<RateLimitConfig>
): RateLimitResult {
    const cfg = { ...RATE_LIMIT_CONFIGS[ctx], ...custom };
    return memRateLimit(`rl:${ctx}:${id}`, cfg);
}

export async function resetRateLimit(id: string, ctx = 'public') {
    const key = `rl:${ctx}:${id}`;
    memStore.delete(key);
    if (redis) await redis.del(key);
}

export async function getRateLimitStatus(id: string, ctx: keyof typeof RATE_LIMIT_CONFIGS = 'public') {
    const cfg = RATE_LIMIT_CONFIGS[ctx];
    const key = `rl:${ctx}:${id}`;

    if (redis) {
        try {
            const [count, ttl] = await Promise.all([
                redis.get<number>(key),
                redis.ttl(key)
            ]);
            if (count && ttl > 0) {
                return { count, remaining: Math.max(0, cfg.maxRequests - count), resetIn: ttl * 1000 };
            }
        } catch { /* fallback to memory */ }
    }

    const entry = memStore.get(key);
    if (entry && entry.resetAt > Date.now()) {
        return { count: entry.count, remaining: cfg.maxRequests - entry.count, resetIn: entry.resetAt - Date.now() };
    }
    return null;
}
