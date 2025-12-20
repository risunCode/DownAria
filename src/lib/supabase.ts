import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Public client (for auth, public queries)
let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    });
}

// Admin client (for server-side admin operations)
let supabaseAdmin: SupabaseClient | null = null;
if (supabaseUrl && serviceRoleKey) {
    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}

export { supabase, supabaseAdmin };

// ═══════════════════════════════════════════════════════════════
// AUTH HELPERS
// ═══════════════════════════════════════════════════════════════

export async function signUp(email: string, password: string, username?: string) {
    if (!supabase) return { error: 'Supabase not configured' };
    
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { username: username?.toLowerCase() }
        }
    });
    
    if (error) return { error: error.message };
    return { data, error: null };
}

export async function signIn(email: string, password: string) {
    if (!supabase) return { error: 'Supabase not configured' };
    
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    
    if (error) return { error: error.message };
    return { data, error: null };
}

export async function signOut() {
    if (!supabase) return { error: 'Supabase not configured' };
    
    const { error } = await supabase.auth.signOut();
    if (error) return { error: error.message };
    return { error: null };
}

export async function resetPassword(email: string) {
    if (!supabase) return { error: 'Supabase not configured' };
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/reset`,
    });
    
    if (error) return { error: error.message };
    return { error: null };
}

export async function updatePassword(newPassword: string) {
    if (!supabase) return { error: 'Supabase not configured' };
    
    const { error } = await supabase.auth.updateUser({
        password: newPassword,
    });
    
    if (error) return { error: error.message };
    return { error: null };
}

export async function getSession() {
    if (!supabase) return null;
    
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

export async function getUser() {
    if (!supabase) return null;
    
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export async function getUserProfile(userId: string) {
    if (!supabase) return null;
    
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) return null;
    return data;
}

export async function isAdmin(userId: string): Promise<boolean> {
    const profile = await getUserProfile(userId);
    return profile?.role === 'admin';
}

// Types
export type Platform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'weibo' | 'youtube';
export type Source = 'web' | 'api' | 'discord' | 'telegram' | 'playground';
export type Quality = 'HD' | 'SD' | 'audio' | 'original' | 'unknown';

export interface DownloadRecord {
    platform: Platform;
    quality: Quality;
    source: Source;
    country: string;
    success: boolean;
    error_type?: string;
}

export interface ErrorRecord {
    platform: Platform;
    source: Source;
    country: string;
    error_type: string;
    error_message: string;
}

// Track download
export async function trackDownload(record: DownloadRecord) {
    if (!supabase) return; // Skip if not configured
    
    try {
        await supabase.from('downloads').insert({
            platform: record.platform,
            quality: record.quality,
            source: record.source,
            country: record.country || 'XX',
            success: record.success,
            error_type: record.error_type || null,
        });
        
        // Track success for admin alerts (resets consecutive failure count)
        if (record.success) {
            import('@/lib/integrations/admin-alerts').then(({ trackSuccess }) => {
                trackSuccess(record.platform);
            }).catch(() => {});
        }
    } catch {
        // Analytics tracking failed silently
    }
}

// Track error
export async function trackError(record: ErrorRecord) {
    if (!supabase) return;
    
    try {
        await supabase.from('errors').insert({
            platform: record.platform,
            source: record.source,
            country: record.country || 'XX',
            error_type: record.error_type,
            error_message: record.error_message.substring(0, 500), // Limit message length
        });
        
        // Trigger admin alert check (fire and forget)
        import('@/lib/integrations/admin-alerts').then(({ trackError: trackAlertError }) => {
            trackAlertError(record.platform, record.error_message).catch(() => {});
        }).catch(() => {});
    } catch {
        // Analytics tracking failed silently
    }
}

// Get country from request headers (Vercel provides this)
export function getCountryFromHeaders(headers: Headers): string {
    return headers.get('x-vercel-ip-country') || 'XX';
}

// Stats queries
export async function getStats(days: number = 7) {
    if (!supabase) return null;
    
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    const { data, error } = await supabase
        .from('downloads')
        .select('platform, source, country, success, created_at')
        .gte('created_at', since.toISOString());
    
    if (error) {
        return null;
    }
    
    return data;
}

export async function getDownloadsByPlatform(days: number = 7) {
    const stats = await getStats(days);
    if (!stats) return {};
    
    const counts: Record<string, number> = {};
    stats.forEach(row => {
        counts[row.platform] = (counts[row.platform] || 0) + 1;
    });
    return counts;
}

export async function getDownloadsByCountry(days: number = 7) {
    const stats = await getStats(days);
    if (!stats) return {};
    
    const counts: Record<string, number> = {};
    stats.forEach(row => {
        counts[row.country] = (counts[row.country] || 0) + 1;
    });
    return counts;
}

export async function getDownloadsBySource(days: number = 7) {
    const stats = await getStats(days);
    if (!stats) return {};
    
    const counts: Record<string, number> = {};
    stats.forEach(row => {
        counts[row.source] = (counts[row.source] || 0) + 1;
    });
    return counts;
}

export async function getSuccessRate(days: number = 7) {
    const stats = await getStats(days);
    if (!stats || stats.length === 0) return { total: 0, success: 0, rate: 0 };
    
    const total = stats.length;
    const success = stats.filter(row => row.success).length;
    return { total, success, rate: Math.round((success / total) * 100) };
}

export async function getRecentErrors(limit: number = 20) {
    if (!supabase) return [];
    
    const { data, error } = await supabase
        .from('errors')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    
    if (error) {
        return [];
    }
    
    return data;
}
