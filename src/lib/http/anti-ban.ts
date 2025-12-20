/**
 * Anti-Ban System - Smart Header Rotation
 * ========================================
 * Rotates browser profiles from database to avoid detection.
 * Falls back to hardcoded profiles if DB unavailable.
 */

import { type PlatformId } from '@/core/config';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface BrowserProfile {
    id: string;
    platform: string;
    label: string;
    user_agent: string;
    sec_ch_ua: string | null;
    sec_ch_ua_platform: string | null;
    sec_ch_ua_mobile: string;
    accept_language: string;
    browser: string;
    device_type: string;
    os: string | null;
    is_chromium: boolean;
    priority: number;
}

interface RotatingHeadersOptions {
    platform?: PlatformId;
    cookie?: string;
    includeReferer?: boolean;
    chromiumOnly?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// FALLBACK PROFILES (used when DB unavailable)
// ═══════════════════════════════════════════════════════════════

const FALLBACK_PROFILES: BrowserProfile[] = [
    {
        id: 'fallback-chrome-win',
        platform: 'all',
        label: 'Chrome 143 Windows',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        sec_ch_ua: '"Google Chrome";v="143", "Chromium";v="143", "Not_A Brand";v="24"',
        sec_ch_ua_platform: '"Windows"',
        sec_ch_ua_mobile: '?0',
        accept_language: 'en-US,en;q=0.9',
        browser: 'chrome',
        device_type: 'desktop',
        os: 'windows',
        is_chromium: true,
        priority: 10,
    },
    {
        id: 'fallback-chrome-mac',
        platform: 'all',
        label: 'Chrome 143 macOS',
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        sec_ch_ua: '"Google Chrome";v="143", "Chromium";v="143", "Not_A Brand";v="24"',
        sec_ch_ua_platform: '"macOS"',
        sec_ch_ua_mobile: '?0',
        accept_language: 'en-US,en;q=0.9',
        browser: 'chrome',
        device_type: 'desktop',
        os: 'macos',
        is_chromium: true,
        priority: 10,
    },
    {
        id: 'fallback-firefox',
        platform: 'all',
        label: 'Firefox 134 Windows',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
        sec_ch_ua: null,
        sec_ch_ua_platform: null,
        sec_ch_ua_mobile: '?0',
        accept_language: 'en-US,en;q=0.5',
        browser: 'firefox',
        device_type: 'desktop',
        os: 'windows',
        is_chromium: false,
        priority: 5,
    },
];

// ═══════════════════════════════════════════════════════════════
// PROFILE CACHE & LOADER
// ═══════════════════════════════════════════════════════════════

let profilesCache: { data: BrowserProfile[]; loadedAt: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let lastProfileId: string | null = null;

/**
 * Load browser profiles from database
 */
async function loadProfilesFromDB(): Promise<BrowserProfile[]> {
    try {
        const { supabase } = await import('@/core/database');
        if (!supabase) return [];

        const { data, error } = await supabase
            .from('browser_profiles')
            .select('*')
            .eq('enabled', true)
            .order('priority', { ascending: false })
            .order('last_used_at', { ascending: true, nullsFirst: true });

        if (error || !data) return [];
        return data as BrowserProfile[];
    } catch {
        return [];
    }
}

/**
 * Get profiles (from cache or DB)
 */
async function getProfiles(): Promise<BrowserProfile[]> {
    // Return cached if fresh
    if (profilesCache && Date.now() - profilesCache.loadedAt < CACHE_TTL) {
        return profilesCache.data;
    }

    // Load from DB
    const dbProfiles = await loadProfilesFromDB();
    
    if (dbProfiles.length > 0) {
        profilesCache = { data: dbProfiles, loadedAt: Date.now() };
        return dbProfiles;
    }

    // Fallback to hardcoded
    return FALLBACK_PROFILES;
}

/**
 * Filter profiles by platform
 */
function filterByPlatform(profiles: BrowserProfile[], platform?: PlatformId, chromiumOnly?: boolean): BrowserProfile[] {
    let filtered = profiles;

    // Filter by platform (specific first, then 'all')
    if (platform) {
        const specific = profiles.filter(p => p.platform === platform);
        filtered = specific.length > 0 ? specific : profiles.filter(p => p.platform === 'all');
    } else {
        filtered = profiles.filter(p => p.platform === 'all');
    }

    // Filter chromium-only if needed
    if (chromiumOnly) {
        const chromium = filtered.filter(p => p.is_chromium);
        if (chromium.length > 0) filtered = chromium;
    }

    return filtered;
}

/**
 * Select profile using weighted random (by priority)
 */
function selectWeightedRandom(profiles: BrowserProfile[]): BrowserProfile {
    if (profiles.length === 0) return FALLBACK_PROFILES[0];
    if (profiles.length === 1) return profiles[0];

    // Avoid same profile twice in a row
    const available = profiles.filter(p => p.id !== lastProfileId);
    const pool = available.length > 0 ? available : profiles;

    // Weighted random by priority
    const totalWeight = pool.reduce((sum, p) => sum + (p.priority || 1), 0);
    let random = Math.random() * totalWeight;

    for (const profile of pool) {
        random -= (profile.priority || 1);
        if (random <= 0) {
            lastProfileId = profile.id;
            return profile;
        }
    }

    lastProfileId = pool[0].id;
    return pool[0];
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API - ASYNC (Recommended)
// ═══════════════════════════════════════════════════════════════

/**
 * Get a random browser profile from database
 */
export async function getRandomProfileAsync(options?: {
    platform?: PlatformId;
    chromiumOnly?: boolean;
}): Promise<BrowserProfile> {
    const profiles = await getProfiles();
    const filtered = filterByPlatform(profiles, options?.platform, options?.chromiumOnly);
    return selectWeightedRandom(filtered);
}

/**
 * Get rotating headers with randomized browser profile (async)
 */
export async function getRotatingHeadersAsync(options: RotatingHeadersOptions = {}): Promise<Record<string, string>> {
    const { platform, cookie, includeReferer = true, chromiumOnly = false } = options;

    // Use Chromium-only for platforms that require Sec-Ch headers
    const useChromium = chromiumOnly || platform === 'facebook' || platform === 'instagram';
    const profile = await getRandomProfileAsync({ platform, chromiumOnly: useChromium });

    const headers: Record<string, string> = {
        'User-Agent': profile.user_agent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': profile.accept_language,
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1',
    };

    // Add Chromium-specific headers
    if (profile.sec_ch_ua) {
        headers['Sec-Ch-Ua'] = profile.sec_ch_ua;
        headers['Sec-Ch-Ua-Mobile'] = profile.sec_ch_ua_mobile || '?0';
        headers['Sec-Ch-Ua-Platform'] = profile.sec_ch_ua_platform || '';
        headers['Sec-Fetch-Dest'] = 'document';
        headers['Sec-Fetch-Mode'] = 'navigate';
        headers['Sec-Fetch-User'] = '?1';
    }

    // Platform-specific headers
    if (platform === 'facebook' && includeReferer) {
        headers['Referer'] = 'https://www.facebook.com/';
        headers['Origin'] = 'https://www.facebook.com';
        headers['Sec-Fetch-Site'] = 'same-origin';
    } else if (platform === 'instagram' && includeReferer) {
        headers['Referer'] = 'https://www.instagram.com/';
        headers['Origin'] = 'https://www.instagram.com';
        headers['Sec-Fetch-Site'] = 'same-origin';
    } else if (profile.sec_ch_ua) {
        headers['Sec-Fetch-Site'] = 'none';
    }

    if (cookie) {
        headers['Cookie'] = cookie;
    }

    // Track usage (fire and forget)
    if (!profile.id.startsWith('fallback-')) {
        markProfileUsed(profile.id).catch(() => {});
    }

    return headers;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API - SYNC (For backward compatibility)
// ═══════════════════════════════════════════════════════════════

/**
 * Get a random browser profile (sync - uses cache or fallback)
 */
export function getRandomProfile(chromiumOnly = false): BrowserProfile {
    const profiles = profilesCache?.data || FALLBACK_PROFILES;
    const filtered = chromiumOnly ? profiles.filter(p => p.is_chromium) : profiles;
    return selectWeightedRandom(filtered.length > 0 ? filtered : FALLBACK_PROFILES);
}

/**
 * Get rotating headers (sync - uses cache or fallback)
 */
export function getRotatingHeaders(options: RotatingHeadersOptions = {}): Record<string, string> {
    const { platform, cookie, includeReferer = true, chromiumOnly = false } = options;

    const useChromium = chromiumOnly || platform === 'facebook' || platform === 'instagram';
    const profile = getRandomProfile(useChromium);

    const headers: Record<string, string> = {
        'User-Agent': profile.user_agent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': profile.accept_language,
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1',
    };

    if (profile.sec_ch_ua) {
        headers['Sec-Ch-Ua'] = profile.sec_ch_ua;
        headers['Sec-Ch-Ua-Mobile'] = profile.sec_ch_ua_mobile || '?0';
        headers['Sec-Ch-Ua-Platform'] = profile.sec_ch_ua_platform || '';
        headers['Sec-Fetch-Dest'] = 'document';
        headers['Sec-Fetch-Mode'] = 'navigate';
        headers['Sec-Fetch-User'] = '?1';
    }

    if (platform === 'facebook' && includeReferer) {
        headers['Referer'] = 'https://www.facebook.com/';
        headers['Origin'] = 'https://www.facebook.com';
        headers['Sec-Fetch-Site'] = 'same-origin';
    } else if (platform === 'instagram' && includeReferer) {
        headers['Referer'] = 'https://www.instagram.com/';
        headers['Origin'] = 'https://www.instagram.com';
        headers['Sec-Fetch-Site'] = 'same-origin';
    } else if (profile.sec_ch_ua) {
        headers['Sec-Fetch-Site'] = 'none';
    }

    if (cookie) headers['Cookie'] = cookie;

    return headers;
}

// ═══════════════════════════════════════════════════════════════
// PROFILE TRACKING
// ═══════════════════════════════════════════════════════════════

/**
 * Mark profile as used (fire and forget)
 */
export async function markProfileUsed(profileId: string): Promise<void> {
    try {
        const { supabase } = await import('@/core/database');
        if (!supabase) return;
        await supabase.rpc('increment_profile_use', { profile_id: profileId });
    } catch { /* ignore */ }
}

/**
 * Mark profile success
 */
export async function markProfileSuccess(profileId: string): Promise<void> {
    try {
        const { supabase } = await import('@/core/database');
        if (!supabase) return;
        await supabase.rpc('mark_profile_success', { profile_id: profileId });
    } catch { /* ignore */ }
}

/**
 * Mark profile error
 */
export async function markProfileError(profileId: string, error: string): Promise<void> {
    try {
        const { supabase } = await import('@/core/database');
        if (!supabase) return;
        await supabase.rpc('mark_profile_error', { profile_id: profileId, error_msg: error });
    } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// REQUEST TIMING
// ═══════════════════════════════════════════════════════════════

/**
 * Get a random delay between requests (human-like timing)
 */
export function getRandomDelay(min = 500, max = 2000): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for a random duration
 */
export async function randomSleep(min = 500, max = 2000): Promise<void> {
    const delay = getRandomDelay(min, max);
    await new Promise(resolve => setTimeout(resolve, delay));
}

// ═══════════════════════════════════════════════════════════════
// RATE LIMIT TRACKING
// ═══════════════════════════════════════════════════════════════

interface RateLimitState {
    lastRequest: number;
    requestCount: number;
    cooldownUntil: number;
}

const rateLimitStates = new Map<string, RateLimitState>();

export function shouldThrottle(platform: string): boolean {
    const state = rateLimitStates.get(platform);
    if (!state) return false;
    if (Date.now() < state.cooldownUntil) return true;
    if (state.cooldownUntil > 0 && Date.now() >= state.cooldownUntil) {
        state.cooldownUntil = 0;
        state.requestCount = 0;
    }
    return false;
}

export function trackRequest(platform: string): void {
    let state = rateLimitStates.get(platform);
    if (!state) {
        state = { lastRequest: 0, requestCount: 0, cooldownUntil: 0 };
        rateLimitStates.set(platform, state);
    }
    const now = Date.now();
    if (now - state.lastRequest > 60000) state.requestCount = 0;
    state.lastRequest = now;
    state.requestCount++;
    if (state.requestCount > 30) {
        state.cooldownUntil = now + 30000;
        state.requestCount = 0;
    }
}

export function markRateLimited(platform: string): void {
    let state = rateLimitStates.get(platform);
    if (!state) {
        state = { lastRequest: Date.now(), requestCount: 0, cooldownUntil: 0 };
        rateLimitStates.set(platform, state);
    }
    const backoff = Math.min(120000, 30000 * Math.pow(2, Math.floor(state.requestCount / 10)));
    state.cooldownUntil = Date.now() + backoff;
}

// ═══════════════════════════════════════════════════════════════
// CACHE MANAGEMENT
// ═══════════════════════════════════════════════════════════════

/**
 * Clear profile cache (force reload from DB)
 */
export function clearProfileCache(): void {
    profilesCache = null;
}

/**
 * Preload profiles (call on app start)
 */
export async function preloadProfiles(): Promise<void> {
    await getProfiles();
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export { FALLBACK_PROFILES };
