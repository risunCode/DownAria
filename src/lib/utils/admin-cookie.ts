/**
 * Admin Cookie Manager
 * Fetches global cookies set by admin from Supabase
 * Priority: localStorage (user) > Supabase (admin)
 */

import { createClient } from '@supabase/supabase-js';

export type CookiePlatform = 'facebook' | 'instagram' | 'weibo' | 'twitter';

interface AdminCookie {
    platform: string;
    cookie: string;
    enabled: boolean;
    note: string | null;
    updated_at: string;
}

// Supabase client (lazy init)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabase: any = null;

function getSupabase() {
    if (!supabase) {
        const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        // Prefer service role key for admin operations (bypasses RLS)
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) return null;
        supabase = createClient(url, key);
    }
    return supabase;
}

// In-memory cache (5 min TTL)
const cache = new Map<string, { cookie: string | null; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get admin cookie from Supabase
 * Returns null if not found or disabled
 */
export async function getAdminCookie(platform: CookiePlatform): Promise<string | null> {
    // Check cache first
    const cached = cache.get(platform);
    if (cached && cached.expires > Date.now()) {
        return cached.cookie;
    }

    const sb = getSupabase();
    if (!sb) return null;

    try {
        const { data, error } = await sb
            .from('admin_cookies')
            .select('cookie, enabled')
            .eq('platform', platform)
            .single();

        if (error || !data || !data.enabled) {
            cache.set(platform, { cookie: null, expires: Date.now() + CACHE_TTL });
            return null;
        }

        cache.set(platform, { cookie: data.cookie, expires: Date.now() + CACHE_TTL });
        return data.cookie;
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

        if (!error) {
            cache.delete(platform);
        }
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

        if (!error) {
            cache.delete(platform);
        }
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

        if (!error) {
            cache.delete(platform);
        }
        return !error;
    } catch {
        return false;
    }
}

/**
 * Clear cache (force refresh from DB)
 */
export function clearAdminCookieCache(): void {
    cache.clear();
}
