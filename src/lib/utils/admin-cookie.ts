/**
 * Admin Cookie Manager
 * Fetches global cookies set by admin from Supabase
 * Cookie Pool rotation > Legacy single cookie
 * Cache: Redis > Memory fallback
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getRotatingCookie, markCookieSuccess, markCookieCooldown, markCookieExpired } from './cookie-pool';
import { redis } from '@/lib/redis';

export type CookiePlatform = 'facebook' | 'instagram' | 'weibo' | 'twitter';

export { markCookieSuccess, markCookieCooldown, markCookieExpired };

interface AdminCookie {
    platform: string;
    cookie: string;
    enabled: boolean;
    note: string | null;
    updated_at: string;
}

// Supabase client (lazy init)
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
    if (!supabase) {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) return null;
        supabase = createClient(url, key);
    }
    return supabase;
}

// Cache config
const CACHE_TTL = 300; // 5 minutes in seconds
const memCache = new Map<string, { cookie: string | null; expires: number }>();
const MAX_CACHE_SIZE = 50;

// Cleanup expired entries
function cleanupMemCache() {
    const now = Date.now();
    for (const [key, entry] of memCache.entries()) {
        if (entry.expires < now) memCache.delete(key);
    }
}

async function getCached(key: string): Promise<string | null | undefined> {
    if (redis) {
        try { return await redis.get<string>(key); } catch { /* fallback */ }
    }
    const entry = memCache.get(key);
    if (entry && entry.expires > Date.now()) return entry.cookie;
    if (entry) memCache.delete(key); // Remove expired
    return undefined;
}

async function setCached(key: string, value: string | null): Promise<void> {
    if (redis) {
        try { await redis.set(key, value ?? '', { ex: CACHE_TTL }); return; } catch { /* fallback */ }
    }
    // Cleanup if at capacity
    if (memCache.size >= MAX_CACHE_SIZE) cleanupMemCache();
    if (memCache.size >= MAX_CACHE_SIZE) {
        const oldest = memCache.keys().next().value;
        if (oldest) memCache.delete(oldest);
    }
    memCache.set(key, { cookie: value, expires: Date.now() + CACHE_TTL * 1000 });
}

async function delCached(key: string): Promise<void> {
    memCache.delete(key);
    if (redis) { try { await redis.del(key); } catch { /* ignore */ } }
}

/**
 * Get admin cookie from Cookie Pool (rotating) or legacy single cookie
 */
export async function getAdminCookie(platform: CookiePlatform): Promise<string | null> {
    // Try Cookie Pool first
    try {
        const poolCookie = await getRotatingCookie(platform);
        if (poolCookie) return poolCookie;
    } catch { /* fallback to legacy */ }

    // Check cache
    const cacheKey = `cookie:${platform}`;
    const cached = await getCached(cacheKey);
    if (cached !== undefined) return cached || null;

    // Fetch from DB
    const sb = getSupabase();
    if (!sb) return null;

    try {
        const { data, error } = await sb
            .from('admin_cookies')
            .select('cookie, enabled')
            .eq('platform', platform)
            .single();

        const cookie = (!error && data?.enabled) ? data.cookie : null;
        await setCached(cacheKey, cookie);
        return cookie;
    } catch {
        return null;
    }
}

/**
 * Check if admin has set cookie for platform
 */
export async function hasAdminCookie(platform: CookiePlatform): Promise<boolean> {
    const cookie = await getAdminCookie(platform);
    return cookie !== null;
}

/**
 * Get all admin cookies status (for admin panel)
 */
export async function getAllAdminCookies(): Promise<AdminCookie[]> {
    const sb = getSupabase();
    if (!sb) return [];

    try {
        const { data, error } = await sb
            .from('admin_cookies')
            .select('*')
            .order('platform');

        if (error || !data) return [];
        return data as AdminCookie[];
    } catch {
        return [];
    }
}

/**
 * Set admin cookie (for admin panel)
 */
export async function setAdminCookie(
    platform: CookiePlatform,
    cookie: string,
    note?: string
): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;

    try {
        const { error } = await sb
            .from('admin_cookies')
            .upsert({
                platform,
                cookie,
                enabled: true,
                note: note || null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'platform' });

        if (!error) await delCached(`cookie:${platform}`);
        return !error;
    } catch {
        return false;
    }
}

/**
 * Toggle admin cookie enabled status
 */
export async function toggleAdminCookie(platform: CookiePlatform, enabled: boolean): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;

    try {
        const { error } = await sb
            .from('admin_cookies')
            .update({ enabled, updated_at: new Date().toISOString() })
            .eq('platform', platform);

        if (!error) await delCached(`cookie:${platform}`);
        return !error;
    } catch {
        return false;
    }
}

/**
 * Delete admin cookie
 */
export async function deleteAdminCookie(platform: CookiePlatform): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;

    try {
        const { error } = await sb
            .from('admin_cookies')
            .delete()
            .eq('platform', platform);

        if (!error) await delCached(`cookie:${platform}`);
        return !error;
    } catch {
        return false;
    }
}

export async function clearAdminCookieCache(): Promise<void> {
    memCache.clear();
    if (redis) {
        const platforms: CookiePlatform[] = ['facebook', 'instagram', 'weibo', 'twitter'];
        await Promise.all(platforms.map(p => redis!.del(`cookie:${p}`).catch(() => {})));
    }
}
