/**
 * API Security & Performance Utilities
 * - Rate limiting
 * - Caching
 * - Request protection
 */

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
// RESPONSE CACHING
// ═══════════════════════════════════════════════════════════════

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const responseCache = new Map<string, CacheEntry<unknown>>();

const CACHE_TTL = 3 * 60 * 60 * 1000; // 3 hours (client handles longer retention)

export function getCached<T>(key: string): T | null {
    const entry = responseCache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
        responseCache.delete(key);
        return null;
    }
    return entry.data;
}

export function setCache<T>(key: string, data: T, ttlMs: number = CACHE_TTL): void {
    // Limit cache size
    if (responseCache.size > 500) {
        const now = Date.now();
        for (const [k, v] of responseCache) {
            if (v.expiresAt < now) responseCache.delete(k);
        }
        // If still too big, clear oldest half
        if (responseCache.size > 400) {
            const keys = Array.from(responseCache.keys()).slice(0, 200);
            keys.forEach(k => responseCache.delete(k));
        }
    }
    responseCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export function getCacheKey(platform: string, url: string): string {
    // Normalize URL for cache key
    const normalized = url.toLowerCase().replace(/\/$/, '').replace(/[?#].*$/, '');
    return `${platform}:${normalized}`;
}

export function clearCache(): number {
    const count = responseCache.size;
    responseCache.clear();
    return count;
}

export function getCacheStats(): { size: number; platforms: Record<string, number> } {
    const platforms: Record<string, number> = {};
    for (const key of responseCache.keys()) {
        const platform = key.split(':')[0];
        platforms[platform] = (platforms[platform] || 0) + 1;
    }
    return { size: responseCache.size, platforms };
}

// ═══════════════════════════════════════════════════════════════
// USER AGENT ROTATION
// ═══════════════════════════════════════════════════════════════

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

export function getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
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

// ═══════════════════════════════════════════════════════════════
// FETCH WITH TIMEOUT
// ═══════════════════════════════════════════════════════════════

export async function fetchWithTimeout(
    url: string, 
    options: RequestInit = {}, 
    timeoutMs: number = 15000
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

// ═══════════════════════════════════════════════════════════════
// SECURE HEADERS
// ═══════════════════════════════════════════════════════════════

export function getSecureHeaders(cookie?: string): HeadersInit {
    const headers: HeadersInit = {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
    };

    if (cookie && validateCookie(cookie)) {
        headers['Cookie'] = cookie;
    }

    return headers;
}

// ═══════════════════════════════════════════════════════════════
// IP EXTRACTION
// ═══════════════════════════════════════════════════════════════

export function getClientIP(request: Request): string {
    // Try various headers
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    
    const realIP = request.headers.get('x-real-ip');
    if (realIP) return realIP;

    // Fallback
    return 'unknown';
}
