/**
 * Centralized Cache for Scrapers
 * Storage: Supabase only (persistent, shared across instances)
 */

import { PlatformId } from './api-config';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { logger } from './logger';

// Platform-specific TTL (in milliseconds)
const CACHE_TTL: Record<PlatformId | 'default', number> = {
    youtube: 24 * 60 * 60 * 1000,    // 24 hours (YouTube URLs expire)
    tiktok: 3 * 24 * 60 * 60 * 1000, // 3 days
    douyin: 3 * 24 * 60 * 60 * 1000, // 3 days
    instagram: 120 * 60 * 1000,      // 2 hours (stories expire fast)
    facebook: 60 * 60 * 1000,        // 1 hour (stories expire)
    twitter: 3 * 24 * 60 * 60 * 1000,// 3 days
    weibo: 3 * 24 * 60 * 60 * 1000,  // 3 days
    default: 3 * 24 * 60 * 60 * 1000,// 3 days
};

// Stats (in-memory, resets on restart)
let hits = 0;
let misses = 0;

// Get DB client
const getDb = () => supabaseAdmin || supabase;

/**
 * Extract content ID from URL for better cache key normalization
 * Facebook share URLs vary: /share/p/xxx, /share/r/xxx, /share/v/xxx
 * All should map to the same cache key
 */
function extractContentId(platform: PlatformId, url: string): string | null {
    if (platform === 'facebook') {
        // Video/Reel ID: /reel/123, /videos/123
        const videoMatch = url.match(/\/(?:reel|videos?)\/(\d+)/);
        if (videoMatch) return `video:${videoMatch[1]}`;
        
        // Share URL: /share/p/xxx, /share/r/xxx, /share/v/xxx
        const shareMatch = url.match(/\/share\/[prv]\/([^/?]+)/);
        if (shareMatch) return `share:${shareMatch[1]}`;
        
        // Post ID: /posts/pfbidXXX or /posts/123
        const postMatch = url.match(/\/posts\/(pfbid[^/?]+|\d+)/);
        if (postMatch) return `post:${postMatch[1]}`;
        
        // Story: /stories/123
        const storyMatch = url.match(/\/stories\/(\d+)/);
        if (storyMatch) return `story:${storyMatch[1]}`;
    }
    
    if (platform === 'instagram') {
        // Post/Reel: /p/xxx, /reel/xxx, /reels/xxx, /tv/xxx
        const igMatch = url.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
        if (igMatch) return igMatch[1];
        
        // Story: /stories/user/123
        const storyMatch = url.match(/\/stories\/[^/]+\/(\d+)/);
        if (storyMatch) return `story:${storyMatch[1]}`;
    }
    
    if (platform === 'twitter') {
        // Tweet: /status/123
        const tweetMatch = url.match(/\/status\/(\d+)/);
        if (tweetMatch) return tweetMatch[1];
    }
    
    if (platform === 'tiktok') {
        // Video: /video/123
        const videoMatch = url.match(/\/video\/(\d+)/);
        if (videoMatch) return videoMatch[1];
    }
    
    if (platform === 'youtube') {
        // Video ID: ?v=xxx (must extract ONLY the video ID, ignore list/index params)
        const vMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (vMatch) return vMatch[1];
        
        // Shorts: /shorts/xxx
        const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
        if (shortsMatch) return shortsMatch[1];
        
        // youtu.be/xxx
        const shortUrlMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (shortUrlMatch) return shortUrlMatch[1];
        
        // Embed: /embed/xxx
        const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
        if (embedMatch) return embedMatch[1];
    }
    
    return null;
}

/**
 * Generate cache key from platform and URL
 * Uses content ID extraction for better normalization
 */
export function getCacheKey(platform: PlatformId, url: string): string {
    // Try to extract content ID for better normalization
    const contentId = extractContentId(platform, url);
    if (contentId) {
        return `${platform}:${contentId}`;
    }
    
    // Fallback: normalize URL
    const normalized = url.toLowerCase().split('?')[0].replace(/\/$/, '');
    return `${platform}:${normalized}`;
}

/**
 * Get cached data from Supabase
 */
export async function getCache<T>(platform: PlatformId, url: string): Promise<T | null> {
    const key = getCacheKey(platform, url);
    const db = getDb();
    
    if (!db) {
        logger.debug('cache', 'Supabase not configured');
        misses++;
        return null;
    }
    
    try {
        const { data, error } = await db
            .from('api_cache')
            .select('data, expires_at')
            .eq('cache_key', key)
            .single();
        
        if (error || !data) {
            misses++;
            return null;
        }
        
        const expiresAt = new Date(data.expires_at).getTime();
        if (Date.now() >= expiresAt) {
            // Expired - delete it async
            db.from('api_cache').delete().eq('cache_key', key).then(() => {});
            misses++;
            return null;
        }
        
        hits++;
        return data.data as T;
    } catch {
        misses++;
        return null;
    }
}

/**
 * Set cache data in Supabase
 */
export async function setCache<T>(platform: PlatformId, url: string, data: T, customTtl?: number): Promise<void> {
    const key = getCacheKey(platform, url);
    const ttl = customTtl ?? CACHE_TTL[platform] ?? CACHE_TTL.default;
    const expiresAt = new Date(Date.now() + ttl);
    const db = getDb();
    
    if (!db) {
        logger.debug('cache', 'Supabase not configured - cache not saved');
        return;
    }
    
    try {
        await db.from('api_cache').upsert({
            cache_key: key,
            platform,
            url,
            data,
            expires_at: expiresAt.toISOString(),
        }, { onConflict: 'cache_key' });
    } catch (e) {
        logger.error('cache', `Failed to save: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
}

/**
 * Check if URL is cached
 */
export async function hasCache(platform: PlatformId, url: string): Promise<boolean> {
    return (await getCache(platform, url)) !== null;
}

/**
 * Clear cache for specific platform or all
 */
export async function clearCache(platform?: PlatformId): Promise<number> {
    const db = getDb();
    if (!db) return 0;
    
    try {
        // Count first
        const countQuery = platform 
            ? db.from('api_cache').select('id', { count: 'exact', head: true }).eq('platform', platform)
            : db.from('api_cache').select('id', { count: 'exact', head: true });
        
        const { count } = await countQuery;
        const total = count || 0;
        
        // Delete
        if (platform) {
            await db.from('api_cache').delete().eq('platform', platform);
        } else {
            await db.from('api_cache').delete().neq('cache_key', '');
        }
        
        return total;
    } catch {
        return 0;
    }
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
    const db = getDb();
    const byPlatform: Record<string, number> = {};
    let size = 0;
    
    if (db) {
        try {
            const { data, error } = await db
                .from('api_cache')
                .select('platform')
                .gt('expires_at', new Date().toISOString());
            
            if (!error && data) {
                size = data.length;
                data.forEach(row => {
                    byPlatform[row.platform] = (byPlatform[row.platform] || 0) + 1;
                });
            }
        } catch {
            // DB error
        }
    }
    
    const total = hits + misses;
    const hitRate = total > 0 ? ((hits / total) * 100).toFixed(1) + '%' : '0%';
    
    return { size, hits, misses, hitRate, byPlatform };
}

/**
 * Cleanup expired entries
 */
export async function cleanupCache(): Promise<number> {
    const db = getDb();
    if (!db) return 0;
    
    try {
        const { count } = await db
            .from('api_cache')
            .select('id', { count: 'exact', head: true })
            .lt('expires_at', new Date().toISOString());
        
        await db.from('api_cache').delete().lt('expires_at', new Date().toISOString());
        return count || 0;
    } catch {
        return 0;
    }
}
