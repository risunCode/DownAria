/**
 * Redis Client (Upstash)
 * For rate limiting, caching, and session management
 */

import { Redis } from '@upstash/redis';

// Initialize Redis client (returns null if not configured)
let redis: Redis | null = null;

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

if (url && token) {
    redis = new Redis({ url, token });
}

export { redis };

// Helper to check if Redis is available
export const isRedisAvailable = () => !!redis;

// ═══════════════════════════════════════════════════════════════
// RESULT CACHE - Store scrape results by content ID
// ═══════════════════════════════════════════════════════════════

type PlatformId = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'weibo';

// TTL in seconds
const RESULT_CACHE_TTL: Record<PlatformId, number> = {
    facebook: 60 * 60,        // 1 hour
    instagram: 2 * 60 * 60,   // 2 hours
    twitter: 6 * 60 * 60,     // 6 hours
    tiktok: 12 * 60 * 60,     // 12 hours
    weibo: 6 * 60 * 60,       // 6 hours
};

/**
 * Extract content ID from URL for cache key
 * IMPORTANT: Don't lowercase share IDs as they are case-sensitive!
 */
function extractContentId(platform: PlatformId, url: string): string | null {
    // For Facebook share URLs, preserve case as the ID is case-sensitive
    if (platform === 'facebook') {
        const shareMatch = url.match(/\/share\/[prv]\/([A-Za-z0-9]+)/i);
        if (shareMatch) return `share:${shareMatch[1]}`;
        const videoMatch = url.match(/\/(?:reel|videos?)\/(\d+)/i);
        if (videoMatch) return `video:${videoMatch[1]}`;
        const postMatch = url.match(/\/posts\/(pfbid[A-Za-z0-9]+|\d+)/i);
        if (postMatch) return `post:${postMatch[1]}`;
        const storyMatch = url.match(/\/stories\/(\d+)/i);
        if (storyMatch) return `story:${storyMatch[1]}`;
        // Fallback: use normalized path
        return null;
    }
    if (platform === 'instagram') {
        const igMatch = url.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
        if (igMatch) return igMatch[1];
        const storyMatch = url.match(/\/stories\/[^/]+\/(\d+)/i);
        if (storyMatch) return `story:${storyMatch[1]}`;
    }
    if (platform === 'twitter') {
        const tweetMatch = url.match(/\/status\/(\d+)/i);
        if (tweetMatch) return tweetMatch[1];
    }
    if (platform === 'tiktok') {
        const videoMatch = url.match(/\/video\/(\d+)/i);
        if (videoMatch) return videoMatch[1];
        const shortMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i);
        if (shortMatch) return shortMatch[1];
    }
    if (platform === 'weibo') {
        const weiboMatch = url.match(/\/(\d+)\/([a-zA-Z0-9]+)/);
        if (weiboMatch) return `${weiboMatch[1]}:${weiboMatch[2]}`;
        const shortMatch = url.match(/t\.cn\/([a-zA-Z0-9]+)/i);
        if (shortMatch) return `short:${shortMatch[1]}`;
    }
    return null;
}

/**
 * Get cache key for result
 */
export function getResultCacheKey(platform: PlatformId, url: string): string | null {
    const contentId = extractContentId(platform, url);
    if (!contentId) return null;
    return `result:${platform}:${contentId}`;
}

/**
 * Get cached result from Redis
 */
export async function getResultCache<T>(platform: PlatformId, url: string): Promise<T | null> {
    if (!redis) return null;

    const key = getResultCacheKey(platform, url);
    if (!key) return null;

    try {
        const cached = await redis.get<T>(key);
        return cached;
    } catch (err) {
        console.error('[Redis] Get result cache error:', err);
        return null;
    }
}

/**
 * Set result to Redis cache
 */
export async function setResultCache<T>(platform: PlatformId, url: string, data: T): Promise<void> {
    if (!redis) return;

    const key = getResultCacheKey(platform, url);
    if (!key) return;

    const ttl = RESULT_CACHE_TTL[platform] || 3600;

    try {
        await redis.set(key, data, { ex: ttl });
    } catch (err) {
        console.error('[Redis] Set result cache error:', err);
    }
}

