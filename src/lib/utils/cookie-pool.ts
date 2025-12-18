/**
 * Cookie Pool Manager
 * ====================
 * Multi-cookie rotation with health tracking & rate limiting
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy init supabase client
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
    if (!supabase) {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!url || !key) {
            console.warn('[CookiePool] Supabase not configured');
            return null;
        }
        supabase = createClient(url, key);
    }
    return supabase;
}

export type CookieStatus = 'healthy' | 'cooldown' | 'expired' | 'disabled';

export interface PooledCookie {
    id: string;
    platform: string;
    cookie: string;
    label: string | null;
    user_id: string | null;
    status: CookieStatus;
    last_used_at: string | null;
    use_count: number;
    success_count: number;
    error_count: number;
    last_error: string | null;
    cooldown_until: string | null;
    max_uses_per_hour: number;
    enabled: boolean;
    note: string | null;
    created_at: string;
    updated_at: string;
}

export interface CookiePoolStats {
    platform: string;
    total: number;
    enabled_count: number;
    healthy_count: number;
    cooldown_count: number;
    expired_count: number;
    disabled_count: number;
    total_uses: number;
    total_success: number;
    total_errors: number;
}

// Track which cookie was used for current request (for marking success/error)
let lastUsedCookieId: string | null = null;

/**
 * Get best available cookie for platform (rotation)
 * Priority: healthy > least recently used > lowest use count
 */
export async function getRotatingCookie(platform: string): Promise<string | null> {
    const db = getSupabase();
    if (!db) return null;

    try {
        // First, reset any expired cooldowns
        try {
            await db.rpc('reset_expired_cooldowns');
        } catch {
            // Ignore if RPC doesn't exist
        }

        // Get best available cookie
        const { data, error } = await db
            .from('admin_cookie_pool')
            .select('*')
            .eq('platform', platform)
            .eq('enabled', true)
            .in('status', ['healthy'])
            .or('cooldown_until.is.null,cooldown_until.lt.now()')
            .order('last_used_at', { ascending: true, nullsFirst: true })
            .order('use_count', { ascending: true })
            .limit(1)
            .single();

        if (error || !data) {
            // Fallback: try cooldown cookies if no healthy ones
            const { data: fallback } = await db
                .from('admin_cookie_pool')
                .select('*')
                .eq('platform', platform)
                .eq('enabled', true)
                .eq('status', 'cooldown')
                .lt('cooldown_until', new Date().toISOString())
                .order('cooldown_until', { ascending: true })
                .limit(1)
                .single();
            
            if (!fallback) return null;
            
            // Reset cooldown and use
            await db
                .from('admin_cookie_pool')
                .update({ status: 'healthy', cooldown_until: null })
                .eq('id', fallback.id);
            
            lastUsedCookieId = fallback.id;
            return fallback.cookie;
        }

        // Update usage stats
        await db
            .from('admin_cookie_pool')
            .update({
                last_used_at: new Date().toISOString(),
                use_count: data.use_count + 1
            })
            .eq('id', data.id);

        lastUsedCookieId = data.id;
        return data.cookie;
    } catch (e) {
        console.error('[CookiePool] getRotatingCookie error:', e);
        return null;
    }
}

/**
 * Mark last used cookie as successful
 */
export async function markCookieSuccess(): Promise<void> {
    if (!lastUsedCookieId) return;
    const db = getSupabase();
    if (!db) return;
    
    // Simple increment
    const { data } = await db
        .from('admin_cookie_pool')
        .select('success_count')
        .eq('id', lastUsedCookieId)
        .single();
    
    if (data) {
        await db
            .from('admin_cookie_pool')
            .update({ success_count: data.success_count + 1, last_error: null })
            .eq('id', lastUsedCookieId);
    }
}

/**
 * Mark cookie as rate limited (put in cooldown)
 */
export async function markCookieCooldown(minutes: number = 30, error?: string): Promise<void> {
    if (!lastUsedCookieId) return;
    const db = getSupabase();
    if (!db) return;
    
    const cooldownUntil = new Date(Date.now() + minutes * 60000).toISOString();
    
    const { data } = await db
        .from('admin_cookie_pool')
        .select('error_count')
        .eq('id', lastUsedCookieId)
        .single();
    
    await db
        .from('admin_cookie_pool')
        .update({
            status: 'cooldown',
            cooldown_until: cooldownUntil,
            error_count: (data?.error_count || 0) + 1,
            last_error: error || 'Rate limited'
        })
        .eq('id', lastUsedCookieId);
}

/**
 * Mark cookie as expired (needs re-login)
 */
export async function markCookieExpired(error?: string): Promise<void> {
    if (!lastUsedCookieId) return;
    const db = getSupabase();
    if (!db) return;
    
    await db
        .from('admin_cookie_pool')
        .update({
            status: 'expired',
            last_error: error || 'Session expired'
        })
        .eq('id', lastUsedCookieId);
}

/**
 * Get all cookies for a platform
 */
export async function getCookiesByPlatform(platform: string): Promise<PooledCookie[]> {
    const db = getSupabase();
    if (!db) return [];

    const { data } = await db
        .from('admin_cookie_pool')
        .select('*')
        .eq('platform', platform)
        .order('created_at', { ascending: false });
    
    return data || [];
}

/**
 * Get cookie pool stats for all platforms
 */
export async function getCookiePoolStats(): Promise<CookiePoolStats[]> {
    const db = getSupabase();
    if (!db) return [];

    const { data } = await db
        .from('cookie_pool_stats')
        .select('*');
    
    return data || [];
}

/**
 * Add new cookie to pool
 */
export async function addCookieToPool(
    platform: string,
    cookie: string,
    options?: { label?: string; note?: string; max_uses_per_hour?: number }
): Promise<PooledCookie | null> {
    const db = getSupabase();
    if (!db) throw new Error('Database not configured');

    // Extract user ID from cookie
    const userId = extractUserId(cookie, platform);
    
    const { data, error } = await db
        .from('admin_cookie_pool')
        .insert({
            platform,
            cookie,
            user_id: userId,
            label: options?.label,
            note: options?.note,
            max_uses_per_hour: options?.max_uses_per_hour || 60
        })
        .select()
        .single();
    
    if (error) throw new Error(error.message);
    return data;
}

/**
 * Update cookie in pool
 */
export async function updatePooledCookie(
    id: string,
    updates: Partial<Pick<PooledCookie, 'cookie' | 'label' | 'note' | 'enabled' | 'status' | 'max_uses_per_hour'>>
): Promise<PooledCookie | null> {
    const db = getSupabase();
    if (!db) throw new Error('Database not configured');

    // If cookie is updated, re-extract user ID
    if (updates.cookie) {
        const { data: existing } = await db
            .from('admin_cookie_pool')
            .select('platform')
            .eq('id', id)
            .single();
        
        if (existing) {
            (updates as Record<string, unknown>).user_id = extractUserId(updates.cookie, existing.platform);
        }
    }
    
    const { data, error } = await db
        .from('admin_cookie_pool')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    
    if (error) throw new Error(error.message);
    return data;
}

/**
 * Delete cookie from pool
 */
export async function deleteCookieFromPool(id: string): Promise<boolean> {
    const db = getSupabase();
    if (!db) return false;

    const { error } = await db
        .from('admin_cookie_pool')
        .delete()
        .eq('id', id);
    
    return !error;
}

/**
 * Test cookie health
 */
export async function testCookieHealth(id: string): Promise<{ healthy: boolean; error?: string }> {
    const db = getSupabase();
    if (!db) return { healthy: false, error: 'Database not configured' };

    const { data } = await db
        .from('admin_cookie_pool')
        .select('platform, cookie')
        .eq('id', id)
        .single();
    
    if (!data) return { healthy: false, error: 'Cookie not found' };
    
    // Platform-specific health check
    try {
        const testUrl = getTestUrl(data.platform);
        if (!testUrl) return { healthy: true }; // No test available
        
        const res = await fetch(testUrl, {
            headers: { Cookie: data.cookie },
            redirect: 'follow'
        });
        
        const html = await res.text();
        
        // Check for login redirect or error
        if (html.includes('login_form') || html.includes('Log in to Facebook')) {
            await db
                .from('admin_cookie_pool')
                .update({ status: 'expired', last_error: 'Session expired' })
                .eq('id', id);
            return { healthy: false, error: 'Session expired' };
        }
        
        // Update as healthy
        await db
            .from('admin_cookie_pool')
            .update({ status: 'healthy', last_error: null })
            .eq('id', id);
        
        return { healthy: true };
    } catch (e) {
        const error = e instanceof Error ? e.message : 'Test failed';
        return { healthy: false, error };
    }
}

// Helper: Extract user ID from cookie
function extractUserId(cookie: string, platform: string): string | null {
    try {
        // Try JSON format first
        const parsed = JSON.parse(cookie);
        if (Array.isArray(parsed)) {
            const patterns: Record<string, string> = {
                facebook: 'c_user',
                instagram: 'ds_user_id',
                twitter: 'twid',
                weibo: 'SUB'
            };
            const key = patterns[platform];
            const found = parsed.find((c: { name: string }) => c.name === key);
            return found?.value || null;
        }
    } catch {
        // Try string format: name=value; name2=value2
        const patterns: Record<string, RegExp> = {
            facebook: /c_user=(\d+)/,
            instagram: /ds_user_id=(\d+)/,
            twitter: /twid=u%3D(\d+)/,
            weibo: /SUB=([^;]+)/
        };
        const match = cookie.match(patterns[platform]);
        return match?.[1] || null;
    }
    return null;
}

// Helper: Get test URL for platform
function getTestUrl(platform: string): string | null {
    const urls: Record<string, string> = {
        facebook: 'https://www.facebook.com/me',
        instagram: 'https://www.instagram.com/accounts/edit/',
        twitter: 'https://twitter.com/settings/account',
        weibo: 'https://weibo.com/ajax/profile/info'
    };
    return urls[platform] || null;
}
