/**
 * Simple client-side rate limiter
 * Prevents abuse by limiting requests per platform
 */

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
    facebook: { maxRequests: 10, windowMs: 60000 },  // 10 req/min
    instagram: { maxRequests: 10, windowMs: 60000 },
    twitter: { maxRequests: 15, windowMs: 60000 },   // 15 req/min
    tiktok: { maxRequests: 20, windowMs: 60000 },    // 20 req/min
    youtube: { maxRequests: 5, windowMs: 60000 },    // 5 req/min (more restrictive)
    weibo: { maxRequests: 10, windowMs: 60000 },
    douyin: { maxRequests: 10, windowMs: 60000 },
    default: { maxRequests: 10, windowMs: 60000 },
};

const rateLimitStore: Record<string, RateLimitEntry> = {};

export function checkRateLimit(platform: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const config = RATE_LIMITS[platform] || RATE_LIMITS.default;
    const key = platform;

    if (!rateLimitStore[key] || now >= rateLimitStore[key].resetAt) {
        rateLimitStore[key] = { count: 0, resetAt: now + config.windowMs };
    }

    const entry = rateLimitStore[key];
    const remaining = Math.max(0, config.maxRequests - entry.count);
    const resetIn = Math.max(0, Math.ceil((entry.resetAt - now) / 1000));

    if (entry.count >= config.maxRequests) {
        return { allowed: false, remaining: 0, resetIn };
    }

    return { allowed: true, remaining: remaining - 1, resetIn };
}

export function consumeRateLimit(platform: string): void {
    const now = Date.now();
    const config = RATE_LIMITS[platform] || RATE_LIMITS.default;
    const key = platform;

    if (!rateLimitStore[key] || now >= rateLimitStore[key].resetAt) {
        rateLimitStore[key] = { count: 1, resetAt: now + config.windowMs };
    } else {
        rateLimitStore[key].count++;
    }
}

export function getRateLimitStatus(platform: string): { remaining: number; resetIn: number } {
    const now = Date.now();
    const config = RATE_LIMITS[platform] || RATE_LIMITS.default;
    const entry = rateLimitStore[platform];

    if (!entry || now >= entry.resetAt) {
        return { remaining: config.maxRequests, resetIn: 0 };
    }

    return {
        remaining: Math.max(0, config.maxRequests - entry.count),
        resetIn: Math.max(0, Math.ceil((entry.resetAt - now) / 1000)),
    };
}
