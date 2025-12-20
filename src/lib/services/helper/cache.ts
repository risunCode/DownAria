/**
 * Centralized Cache for Scrapers
 * Storage: Redis (Upstash) - fast, ephemeral cache
 * Migrated from Supabase for better performance
 * 
 * OPTIMIZATION: Uses canonical content ID from resolved URL
 * Different URL formats pointing to same content share same cache key
 */

import { PlatformId } from './api-config';
import { 
    getResultCache as redisGet, 
    setResultCache as redisSet,
    getResultCacheByKey as redisGetByKey,
    setResultCacheByKey as redisSetByKey,
    clearResultCache as redisClear,
    getResultCacheStats as redisStats,
    getResultCacheKey,
    getResultCacheKeyLegacy
} from '@/lib/redis';

// Re-export getCacheKey for compatibility
export { getResultCacheKey as getCacheKey, getResultCacheKeyLegacy };

/**
 * Get cached result using resolved URL (recommended)
 * @param platform - Platform ID
 * @param resolvedUrl - Resolved/canonical URL for best cache hit rate
 */
export async function getCache<T>(platform: PlatformId, resolvedUrl: string): Promise<T | null> {
    return redisGet<T>(platform, resolvedUrl);
}

/**
 * Get cached result using direct cache key
 */
export async function getCacheByKey<T>(cacheKey: string): Promise<T | null> {
    return redisGetByKey<T>(cacheKey);
}

/**
 * Set cache result using resolved URL (recommended)
 * @param platform - Platform ID  
 * @param resolvedUrl - Resolved/canonical URL for canonical cache key
 * @param data - Data to cache
 */
export async function setCache<T>(platform: PlatformId, resolvedUrl: string, data: T, _customTtl?: number): Promise<void> {
    // Note: customTtl is ignored, Redis uses platform-specific TTL
    await redisSet(platform, resolvedUrl, data);
}

/**
 * Set cache result using direct cache key
 */
export async function setCacheByKey<T>(cacheKey: string, platform: PlatformId, data: T): Promise<void> {
    await redisSetByKey(cacheKey, platform, data);
}

/**
 * Check if cache exists
 */
export async function hasCache(platform: PlatformId, url: string): Promise<boolean> {
    return (await getCache(platform, url)) !== null;
}

/**
 * Clear cache
 * @param platform - Optional platform to clear, if not provided clears all
 */
export async function clearCache(platform?: PlatformId): Promise<number> {
    return redisClear(platform);
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
    size: number;
    hits: number;
    misses: number;
    hitRate: string;
    byPlatform: Record<string, number>;
}> {
    return redisStats();
}

/**
 * Cleanup expired cache (no-op for Redis, TTL handles this)
 */
export async function cleanupCache(): Promise<number> {
    // Redis automatically expires keys based on TTL
    // No manual cleanup needed
    return 0;
}
