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

type PlatformId = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'weibo' | 'youtube';

// Default TTL in seconds (fallback if service_config not available)
// Updated: 3 days for all platforms (stable media URLs)
const DEFAULT_CACHE_TTL: Record<PlatformId, number> = {
    facebook: 3 * 24 * 60 * 60,   // 3 days
    instagram: 3 * 24 * 60 * 60,  // 3 days
    twitter: 3 * 24 * 60 * 60,    // 3 days
    tiktok: 3 * 24 * 60 * 60,     // 3 days
    weibo: 3 * 24 * 60 * 60,      // 3 days
    youtube: 3 * 24 * 60 * 60,    // 3 days
};

// Cache for platform TTL from service_config
let ttlCache: { data: Record<PlatformId, number>; loadedAt: number } | null = null;
const TTL_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get cache TTL for platform from service_config
 * Falls back to DEFAULT_CACHE_TTL if not available
 */
async function getCacheTTL(platform: PlatformId): Promise<number> {
    // Check cache first
    if (ttlCache && Date.now() - ttlCache.loadedAt < TTL_CACHE_DURATION) {
        return ttlCache.data[platform] || DEFAULT_CACHE_TTL[platform];
    }

    try {
        // Lazy import to avoid circular deps
        const { getServiceConfig } = await import('@/lib/services/helper/service-config');
        const config = await getServiceConfig();
        
        if (config?.platforms) {
            const ttlData: Record<PlatformId, number> = {
                facebook: config.platforms.facebook?.cacheTime || DEFAULT_CACHE_TTL.facebook,
                instagram: config.platforms.instagram?.cacheTime || DEFAULT_CACHE_TTL.instagram,
                twitter: config.platforms.twitter?.cacheTime || DEFAULT_CACHE_TTL.twitter,
                tiktok: config.platforms.tiktok?.cacheTime || DEFAULT_CACHE_TTL.tiktok,
                weibo: config.platforms.weibo?.cacheTime || DEFAULT_CACHE_TTL.weibo,
                youtube: config.platforms.youtube?.cacheTime || DEFAULT_CACHE_TTL.youtube,
            };
            ttlCache = { data: ttlData, loadedAt: Date.now() };
            return ttlData[platform];
        }
    } catch {
        // Ignore errors, use default
    }

    return DEFAULT_CACHE_TTL[platform];
}

/**
 * Extract CANONICAL content ID from resolved URL
 * This ensures different URL formats pointing to same content use same cache key
 * 
 * Priority: Numeric ID > pfbid > shortcode (platform-specific)
 */
function getCanonicalContentId(platform: PlatformId, url: string): string | null {
    switch (platform) {
        case 'facebook': {
            // Priority 1: Numeric video/reel ID (most canonical)
            const videoId = url.match(/\/(?:videos?|watch|reel)\/(\d+)/i);
            if (videoId) return videoId[1];
            
            // Priority 2: Watch query param
            const watchParam = url.match(/[?&]v=(\d+)/i);
            if (watchParam) return watchParam[1];
            
            // Priority 3: Groups permalink (numeric post ID)
            const groupPermalink = url.match(/\/groups\/\d+\/permalink\/(\d+)/i);
            if (groupPermalink) return groupPermalink[1];
            
            // Priority 4: story_fbid param (numeric)
            const storyFbid = url.match(/story_fbid=(\d+)/i);
            if (storyFbid) return storyFbid[1];
            
            // Priority 5: pfbid (Facebook's public ID format)
            const pfbid = url.match(/pfbid([A-Za-z0-9]+)/i);
            if (pfbid) return `pfbid${pfbid[1]}`;
            
            // Priority 6: Share URL ID (case-sensitive!)
            const shareId = url.match(/\/share\/[prvs]\/([A-Za-z0-9]+)/i);
            if (shareId) return `share:${shareId[1]}`;
            
            // Priority 7: Numeric post ID in path
            const postId = url.match(/\/posts\/(\d+)/i);
            if (postId) return postId[1];
            
            // Priority 8: Story ID
            const storyId = url.match(/\/stories\/[^/]+\/(\d+)/i);
            if (storyId) return `story:${storyId[1]}`;
            
            // Priority 9: Photo ID
            const photoId = url.match(/\/photos?\/[^/]+\/(\d+)/i);
            if (photoId) return `photo:${photoId[1]}`;
            
            return null;
        }
        
        case 'instagram': {
            // Shortcode is canonical for Instagram
            const shortcode = url.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
            if (shortcode) return shortcode[1];
            
            // Story ID
            const storyId = url.match(/\/stories\/[^/]+\/(\d+)/i);
            if (storyId) return `story:${storyId[1]}`;
            
            return null;
        }
        
        case 'twitter': {
            // Tweet ID is always numeric
            const tweetId = url.match(/\/status(?:es)?\/(\d+)/i);
            if (tweetId) return tweetId[1];
            return null;
        }
        
        case 'tiktok': {
            // Video ID is always numeric
            const videoId = url.match(/\/video\/(\d+)/i);
            if (videoId) return videoId[1];
            
            // From full URL format
            const fullUrl = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i);
            if (fullUrl) return fullUrl[1];
            
            return null;
        }
        
        case 'weibo': {
            // Weibo post ID (long numeric)
            const longId = url.match(/\/(\d{16,})/);
            if (longId) return longId[1];
            
            // User:Post format
            const userPost = url.match(/weibo\.(?:com|cn)\/(\d+)\/([A-Za-z0-9]+)/);
            if (userPost) return `${userPost[1]}:${userPost[2]}`;
            
            // Detail page
            const detail = url.match(/\/detail\/(\d+)/i);
            if (detail) return detail[1];
            
            // Status page
            const status = url.match(/\/status\/(\d+)/i);
            if (status) return status[1];
            
            return null;
        }
        
        case 'youtube': {
            // Standard watch URL
            const watchId = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
            if (watchId) return watchId[1];
            
            // Short URL (youtu.be)
            const shortId = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
            if (shortId) return shortId[1];
            
            // Embed URL
            const embedId = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
            if (embedId) return embedId[1];
            
            // Shorts URL
            const shortsId = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
            if (shortsId) return shortsId[1];
            
            return null;
        }
    }
    return null;
}

/**
 * Legacy extractor for backward compatibility (used when URL not yet resolved)
 */
function extractContentIdLegacy(platform: PlatformId, url: string): string | null {
    // For short URLs that can't be parsed, return null to force resolve
    if (/fb\.watch|t\.co\/|vm\.tiktok|vt\.tiktok|instagr\.am|t\.cn\//i.test(url)) {
        return null;
    }
    return getCanonicalContentId(platform, url);
}

/**
 * Get cache key for result (uses canonical ID from resolved URL)
 */
export function getResultCacheKey(platform: PlatformId, url: string): string | null {
    const contentId = getCanonicalContentId(platform, url);
    if (!contentId) return null;
    return `result:${platform}:${contentId}`;
}

/**
 * Get cache key using legacy extractor (for pre-resolve check)
 */
export function getResultCacheKeyLegacy(platform: PlatformId, url: string): string | null {
    const contentId = extractContentIdLegacy(platform, url);
    if (!contentId) return null;
    return `result:${platform}:${contentId}`;
}

/**
 * Get cached result from Redis
 * @param platform - Platform ID
 * @param url - URL (should be resolved URL for best cache hit rate)
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
 * Get cached result using direct cache key
 */
export async function getResultCacheByKey<T>(cacheKey: string): Promise<T | null> {
    if (!redis || !cacheKey) return null;

    try {
        return await redis.get<T>(cacheKey);
    } catch (err) {
        console.error('[Redis] Get result cache by key error:', err);
        return null;
    }
}

/**
 * Set result to Redis cache
 * @param platform - Platform ID
 * @param url - URL (should be resolved URL for canonical cache key)
 * @param data - Data to cache
 */
export async function setResultCache<T>(platform: PlatformId, url: string, data: T): Promise<void> {
    if (!redis) return;

    const key = getResultCacheKey(platform, url);
    if (!key) return;

    const ttl = await getCacheTTL(platform);

    try {
        await redis.set(key, data, { ex: ttl });
    } catch (err) {
        console.error('[Redis] Set result cache error:', err);
    }
}

/**
 * Set result to Redis cache using direct cache key
 */
export async function setResultCacheByKey<T>(cacheKey: string, platform: PlatformId, data: T): Promise<void> {
    if (!redis || !cacheKey) return;

    const ttl = await getCacheTTL(platform);

    try {
        await redis.set(cacheKey, data, { ex: ttl });
    } catch (err) {
        console.error('[Redis] Set result cache by key error:', err);
    }
}

/**
 * Clear result cache from Redis
 * @param platform - Optional platform to clear, if not provided clears all
 * @returns Number of keys cleared
 */
export async function clearResultCache(platform?: PlatformId): Promise<number> {
    if (!redis) return 0;

    try {
        const pattern = platform ? `result:${platform}:*` : 'result:*';
        
        // Scan for keys matching pattern
        let cursor = 0;
        let totalCleared = 0;
        
        do {
            const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
            cursor = Number(nextCursor);
            
            if (keys.length > 0) {
                await redis.del(...keys);
                totalCleared += keys.length;
            }
        } while (cursor !== 0);
        
        return totalCleared;
    } catch (err) {
        console.error('[Redis] Clear result cache error:', err);
        return 0;
    }
}

/**
 * Get result cache statistics from Redis
 */
export async function getResultCacheStats(): Promise<{
    size: number;
    byPlatform: Record<string, number>;
    hits: number;
    misses: number;
    hitRate: string;
}> {
    const byPlatform: Record<string, number> = {};
    let size = 0;

    if (!redis) {
        return { size: 0, byPlatform: {}, hits: 0, misses: 0, hitRate: '0%' };
    }

    try {
        // Scan for all result keys
        let cursor = 0;
        
        do {
            const [nextCursor, keys] = await redis.scan(cursor, { match: 'result:*', count: 100 });
            cursor = Number(nextCursor);
            
            for (const key of keys) {
                size++;
                // Extract platform from key (result:platform:contentId)
                const parts = key.split(':');
                if (parts.length >= 2) {
                    const platform = parts[1];
                    byPlatform[platform] = (byPlatform[platform] || 0) + 1;
                }
            }
        } while (cursor !== 0);
        
        // Note: Redis doesn't track hits/misses natively, we'd need to implement that separately
        // For now, return 0 for hits/misses
        return { size, byPlatform, hits: 0, misses: 0, hitRate: 'N/A' };
    } catch (err) {
        console.error('[Redis] Get cache stats error:', err);
        return { size: 0, byPlatform: {}, hits: 0, misses: 0, hitRate: '0%' };
    }
}

