/**
 * Centralized Cache for Scrapers
 * Unified caching with configurable TTL per platform
 */

import { PlatformId } from './api-config';

interface CacheEntry<T> {
    data: T;
    expires: number;
    createdAt: number;
}

// Platform-specific TTL (in milliseconds)
const CACHE_TTL: Record<PlatformId | 'default', number> = {
    youtube: 24 * 60 * 60 * 1000,    // 24 hours (YouTube URLs expire)
    tiktok: 3 * 24 * 60 * 60 * 1000, // 3 days
    douyin: 3 * 24 * 60 * 60 * 1000, // 3 days
    instagram: 120 * 60 * 1000,        // 2 hour (stories expire fast)
    facebook: 60 * 60 * 1000,        // 1 hour (stories expire)
    twitter: 3 * 24 * 60 * 60 * 1000,// 3 days
    weibo: 3 * 24 * 60 * 60 * 1000,  // 3 days
    default: 3 * 24 * 60 * 60 * 1000,// 3 days
};

// In-memory cache store
const cache = new Map<string, CacheEntry<unknown>>();

// Stats
let hits = 0;
let misses = 0;

/**
 * Generate cache key from platform and URL
 */
export function getCacheKey(platform: PlatformId, url: string): string {
    // Normalize URL for consistent caching
    const normalized = url.toLowerCase().split('?')[0].replace(/\/$/, '');
    return `${platform}:${normalized}`;
}

/**
 * Get cached data
 */
export function getCache<T>(platform: PlatformId, url: string): T | null {
    const key = getCacheKey(platform, url);
    const entry = cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
        misses++;
        return null;
    }
    
    if (Date.now() > entry.expires) {
        cache.delete(key);
        misses++;
        return null;
    }
    
    hits++;
    return entry.data;
}

/**
 * Set cache data
 */
export function setCache<T>(platform: PlatformId, url: string, data: T, customTtl?: number): void {
    const key = getCacheKey(platform, url);
    const ttl = customTtl ?? CACHE_TTL[platform] ?? CACHE_TTL.default;
    
    cache.set(key, {
        data,
        expires: Date.now() + ttl,
        createdAt: Date.now(),
    });
}

/**
 * Check if URL is cached
 */
export function hasCache(platform: PlatformId, url: string): boolean {
    return getCache(platform, url) !== null;
}

/**
 * Clear cache for specific platform or all
 */
export function clearCache(platform?: PlatformId): number {
    if (!platform) {
        const count = cache.size;
        cache.clear();
        return count;
    }
    
    let count = 0;
    for (const key of cache.keys()) {
        if (key.startsWith(`${platform}:`)) {
            cache.delete(key);
            count++;
        }
    }
    return count;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: string;
    byPlatform: Record<string, number>;
} {
    const byPlatform: Record<string, number> = {};
    
    for (const key of cache.keys()) {
        const platform = key.split(':')[0];
        byPlatform[platform] = (byPlatform[platform] || 0) + 1;
    }
    
    const total = hits + misses;
    const hitRate = total > 0 ? ((hits / total) * 100).toFixed(1) + '%' : '0%';
    
    return {
        size: cache.size,
        hits,
        misses,
        hitRate,
        byPlatform,
    };
}

/**
 * Cleanup expired entries (call periodically)
 */
export function cleanupCache(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of cache.entries()) {
        if (now > (entry as CacheEntry<unknown>).expires) {
            cache.delete(key);
            cleaned++;
        }
    }
    
    return cleaned;
}

// Auto-cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
    setInterval(cleanupCache, 10 * 60 * 1000);
}
