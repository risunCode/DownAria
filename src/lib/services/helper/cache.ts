/**
 * Centralized Cache for Scrapers
 * Storage: Supabase only (persistent, shared across instances)
 */

import { PlatformId } from './api-config';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { logger } from './logger';

const CACHE_TTL: Record<PlatformId | 'default', number> = {
    tiktok: 3 * 24 * 60 * 60 * 1000,
    instagram: 120 * 60 * 1000,
    facebook: 60 * 60 * 1000,
    twitter: 3 * 24 * 60 * 60 * 1000,
    weibo: 3 * 24 * 60 * 60 * 1000,
    default: 3 * 24 * 60 * 60 * 1000,
};

let hits = 0;
let misses = 0;

const getDb = () => supabaseAdmin || supabase;

function extractContentId(platform: PlatformId, url: string): string | null {
    if (platform === 'facebook') {
        const videoMatch = url.match(/\/(?:reel|videos?)\/(\d+)/);
        if (videoMatch) return `video:${videoMatch[1]}`;
        const shareMatch = url.match(/\/share\/[prv]\/([^/?]+)/);
        if (shareMatch) return `share:${shareMatch[1]}`;
        const postMatch = url.match(/\/posts\/(pfbid[^/?]+|\d+)/);
        if (postMatch) return `post:${postMatch[1]}`;
        const storyMatch = url.match(/\/stories\/(\d+)/);
        if (storyMatch) return `story:${storyMatch[1]}`;
    }
    if (platform === 'instagram') {
        const igMatch = url.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
        if (igMatch) return igMatch[1];
        const storyMatch = url.match(/\/stories\/[^/]+\/(\d+)/);
        if (storyMatch) return `story:${storyMatch[1]}`;
    }
    if (platform === 'twitter') {
        const tweetMatch = url.match(/\/status\/(\d+)/);
        if (tweetMatch) return tweetMatch[1];
    }
    if (platform === 'tiktok') {
        const videoMatch = url.match(/\/video\/(\d+)/);
        if (videoMatch) return videoMatch[1];
    }
    return null;
}

export function getCacheKey(platform: PlatformId, url: string): string {
    const contentId = extractContentId(platform, url);
    if (contentId) return `${platform}:${contentId}`;
    const normalized = url.toLowerCase().split('?')[0].replace(/\/$/, '');
    return `${platform}:${normalized}`;
}

export async function getCache<T>(platform: PlatformId, url: string): Promise<T | null> {
    const key = getCacheKey(platform, url);
    const db = getDb();
    if (!db) { misses++; return null; }
    
    try {
        const { data, error } = await db.from('api_cache').select('data, expires_at').eq('cache_key', key).single();
        if (error || !data) { misses++; return null; }
        
        if (Date.now() >= new Date(data.expires_at).getTime()) {
            db.from('api_cache').delete().eq('cache_key', key).then(() => {});
            misses++;
            return null;
        }
        hits++;
        return data.data as T;
    } catch { misses++; return null; }
}

export async function setCache<T>(platform: PlatformId, url: string, data: T, customTtl?: number): Promise<void> {
    const key = getCacheKey(platform, url);
    const ttl = customTtl ?? CACHE_TTL[platform] ?? CACHE_TTL.default;
    const expiresAt = new Date(Date.now() + ttl);
    const db = getDb();
    if (!db) return;
    
    try {
        await db.from('api_cache').upsert({ cache_key: key, platform, url, data, expires_at: expiresAt.toISOString() }, { onConflict: 'cache_key' });
    } catch (e) {
        logger.error('cache', `Failed to save: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
}

export async function hasCache(platform: PlatformId, url: string): Promise<boolean> {
    return (await getCache(platform, url)) !== null;
}

export async function clearCache(platform?: PlatformId): Promise<number> {
    const db = getDb();
    if (!db) return 0;
    try {
        const countQuery = platform 
            ? db.from('api_cache').select('id', { count: 'exact', head: true }).eq('platform', platform)
            : db.from('api_cache').select('id', { count: 'exact', head: true });
        const { count } = await countQuery;
        if (platform) await db.from('api_cache').delete().eq('platform', platform);
        else await db.from('api_cache').delete().neq('cache_key', '');
        return count || 0;
    } catch { return 0; }
}

export async function getCacheStats(): Promise<{ size: number; hits: number; misses: number; hitRate: string; byPlatform: Record<string, number> }> {
    const db = getDb();
    const byPlatform: Record<string, number> = {};
    let size = 0;
    if (db) {
        try {
            const { data, error } = await db.from('api_cache').select('platform').gt('expires_at', new Date().toISOString());
            if (!error && data) {
                size = data.length;
                data.forEach(row => { byPlatform[row.platform] = (byPlatform[row.platform] || 0) + 1; });
            }
        } catch { /* DB error */ }
    }
    const total = hits + misses;
    const hitRate = total > 0 ? ((hits / total) * 100).toFixed(1) + '%' : '0%';
    return { size, hits, misses, hitRate, byPlatform };
}

export async function cleanupCache(): Promise<number> {
    const db = getDb();
    if (!db) return 0;
    try {
        const { count } = await db.from('api_cache').select('id', { count: 'exact', head: true }).lt('expires_at', new Date().toISOString());
        await db.from('api_cache').delete().lt('expires_at', new Date().toISOString());
        return count || 0;
    } catch { return 0; }
}
