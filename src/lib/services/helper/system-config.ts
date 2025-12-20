/**
 * System Config - Centralized Configuration
 * ==========================================
 * Loads configurable values from database with fallback defaults.
 * Replaces hardcoded values throughout the codebase.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface SystemConfig {
    // Cache TTLs (milliseconds)
    cacheTtlConfig: number;
    cacheTtlApikeys: number;
    cacheTtlCookies: number;
    cacheTtlUseragents: number;
    cacheTtlPlaygroundUrl: number;
    
    // HTTP Settings
    httpTimeout: number;
    httpMaxRedirects: number;
    
    // Scraper Settings
    scraperTimeoutFacebook: number;
    scraperTimeoutInstagram: number;
    scraperTimeoutTwitter: number;
    scraperTimeoutTiktok: number;
    scraperTimeoutWeibo: number;
    scraperMaxRetries: number;
    scraperRetryDelay: number;
    
    // Cookie Pool
    cookieCooldownMinutes: number;
    cookieMaxUsesDefault: number;
    
    // Rate Limits (fallback)
    rateLimitPublic: number;
    rateLimitApiKey: number;
    rateLimitAuth: number;
    rateLimitAdmin: number;
    
    // Meta
    lastUpdated: string;
}

// ═══════════════════════════════════════════════════════════════
// DEFAULTS (used when DB unavailable)
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: SystemConfig = {
    // Cache TTLs
    cacheTtlConfig: 30000,
    cacheTtlApikeys: 10000,
    cacheTtlCookies: 300000,
    cacheTtlUseragents: 300000,
    cacheTtlPlaygroundUrl: 120000,
    
    // HTTP
    httpTimeout: 15000,
    httpMaxRedirects: 10,
    
    // Scrapers
    scraperTimeoutFacebook: 10000,
    scraperTimeoutInstagram: 15000,
    scraperTimeoutTwitter: 15000,
    scraperTimeoutTiktok: 10000,
    scraperTimeoutWeibo: 15000,
    scraperMaxRetries: 2,
    scraperRetryDelay: 1000,
    
    // Cookie Pool
    cookieCooldownMinutes: 30,
    cookieMaxUsesDefault: 100,
    
    // Rate Limits
    rateLimitPublic: 15,
    rateLimitApiKey: 100,
    rateLimitAuth: 10,
    rateLimitAdmin: 60,
    
    lastUpdated: new Date().toISOString(),
};

// ═══════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════

let systemConfig: SystemConfig = { ...DEFAULT_CONFIG };
let lastFetch = 0;
let isLoading = false;

// Self-referencing cache TTL (bootstrap with default, then use loaded value)
const BOOTSTRAP_CACHE_TTL = 30000;

// ═══════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ═══════════════════════════════════════════════════════════════

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
    if (supabase) return supabase;
    
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) return null;
    
    supabase = createClient(url, key);
    return supabase;
}

// ═══════════════════════════════════════════════════════════════
// LOADER
// ═══════════════════════════════════════════════════════════════

/**
 * Load system config from database
 */
export async function loadSystemConfig(): Promise<boolean> {
    const cacheTtl = systemConfig.cacheTtlConfig || BOOTSTRAP_CACHE_TTL;
    
    // Return cached if fresh
    if (Date.now() - lastFetch < cacheTtl) return true;
    
    // Prevent concurrent loads
    if (isLoading) return true;
    isLoading = true;
    
    try {
        const db = getSupabase();
        if (!db) {
            isLoading = false;
            return false;
        }
        
        const { data, error } = await db
            .from('system_config')
            .select('*')
            .eq('id', 'default')
            .single();
        
        if (error || !data) {
            isLoading = false;
            return false;
        }
        
        // Map DB columns to config
        systemConfig = {
            cacheTtlConfig: data.cache_ttl_config ?? DEFAULT_CONFIG.cacheTtlConfig,
            cacheTtlApikeys: data.cache_ttl_apikeys ?? DEFAULT_CONFIG.cacheTtlApikeys,
            cacheTtlCookies: data.cache_ttl_cookies ?? DEFAULT_CONFIG.cacheTtlCookies,
            cacheTtlUseragents: data.cache_ttl_useragents ?? DEFAULT_CONFIG.cacheTtlUseragents,
            cacheTtlPlaygroundUrl: data.cache_ttl_playground_url ?? DEFAULT_CONFIG.cacheTtlPlaygroundUrl,
            
            httpTimeout: data.http_timeout ?? DEFAULT_CONFIG.httpTimeout,
            httpMaxRedirects: data.http_max_redirects ?? DEFAULT_CONFIG.httpMaxRedirects,
            
            scraperTimeoutFacebook: data.scraper_timeout_facebook ?? DEFAULT_CONFIG.scraperTimeoutFacebook,
            scraperTimeoutInstagram: data.scraper_timeout_instagram ?? DEFAULT_CONFIG.scraperTimeoutInstagram,
            scraperTimeoutTwitter: data.scraper_timeout_twitter ?? DEFAULT_CONFIG.scraperTimeoutTwitter,
            scraperTimeoutTiktok: data.scraper_timeout_tiktok ?? DEFAULT_CONFIG.scraperTimeoutTiktok,
            scraperTimeoutWeibo: data.scraper_timeout_weibo ?? DEFAULT_CONFIG.scraperTimeoutWeibo,
            scraperMaxRetries: data.scraper_max_retries ?? DEFAULT_CONFIG.scraperMaxRetries,
            scraperRetryDelay: data.scraper_retry_delay ?? DEFAULT_CONFIG.scraperRetryDelay,
            
            cookieCooldownMinutes: data.cookie_cooldown_minutes ?? DEFAULT_CONFIG.cookieCooldownMinutes,
            cookieMaxUsesDefault: data.cookie_max_uses_default ?? DEFAULT_CONFIG.cookieMaxUsesDefault,
            
            rateLimitPublic: data.rate_limit_public ?? DEFAULT_CONFIG.rateLimitPublic,
            rateLimitApiKey: data.rate_limit_api_key ?? DEFAULT_CONFIG.rateLimitApiKey,
            rateLimitAuth: data.rate_limit_auth ?? DEFAULT_CONFIG.rateLimitAuth,
            rateLimitAdmin: data.rate_limit_admin ?? DEFAULT_CONFIG.rateLimitAdmin,
            
            lastUpdated: data.updated_at || new Date().toISOString(),
        };
        
        lastFetch = Date.now();
        isLoading = false;
        return true;
    } catch {
        isLoading = false;
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// GETTERS
// ═══════════════════════════════════════════════════════════════

export function getSystemConfig(): SystemConfig {
    return systemConfig;
}

// Cache TTLs
export function getCacheTtlConfig(): number { return systemConfig.cacheTtlConfig; }
export function getCacheTtlApikeys(): number { return systemConfig.cacheTtlApikeys; }
export function getCacheTtlCookies(): number { return systemConfig.cacheTtlCookies; }
export function getCacheTtlUseragents(): number { return systemConfig.cacheTtlUseragents; }
export function getCacheTtlPlaygroundUrl(): number { return systemConfig.cacheTtlPlaygroundUrl; }

// HTTP
export function getHttpTimeout(): number { return systemConfig.httpTimeout; }
export function getHttpMaxRedirects(): number { return systemConfig.httpMaxRedirects; }

// Scraper Timeouts
export function getScraperTimeout(platform: string): number {
    switch (platform) {
        case 'facebook': return systemConfig.scraperTimeoutFacebook;
        case 'instagram': return systemConfig.scraperTimeoutInstagram;
        case 'twitter': return systemConfig.scraperTimeoutTwitter;
        case 'tiktok': return systemConfig.scraperTimeoutTiktok;
        case 'weibo': return systemConfig.scraperTimeoutWeibo;
        default: return systemConfig.httpTimeout;
    }
}
export function getScraperMaxRetries(): number { return systemConfig.scraperMaxRetries; }
export function getScraperRetryDelay(): number { return systemConfig.scraperRetryDelay; }

// Cookie Pool
export function getCookieCooldownMinutes(): number { return systemConfig.cookieCooldownMinutes; }
export function getCookieMaxUsesDefault(): number { return systemConfig.cookieMaxUsesDefault; }

// Rate Limits
export function getRateLimitPublic(): number { return systemConfig.rateLimitPublic; }
export function getRateLimitApiKey(): number { return systemConfig.rateLimitApiKey; }
export function getRateLimitAuth(): number { return systemConfig.rateLimitAuth; }
export function getRateLimitAdmin(): number { return systemConfig.rateLimitAdmin; }

// ═══════════════════════════════════════════════════════════════
// SETTERS (for admin panel)
// ═══════════════════════════════════════════════════════════════

export async function updateSystemConfig(updates: Partial<Record<string, number>>): Promise<boolean> {
    const db = getSupabase();
    if (!db) return false;
    
    // Map camelCase to snake_case
    const dbUpdates: Record<string, number> = {};
    const keyMap: Record<string, string> = {
        cacheTtlConfig: 'cache_ttl_config',
        cacheTtlApikeys: 'cache_ttl_apikeys',
        cacheTtlCookies: 'cache_ttl_cookies',
        cacheTtlUseragents: 'cache_ttl_useragents',
        cacheTtlPlaygroundUrl: 'cache_ttl_playground_url',
        httpTimeout: 'http_timeout',
        httpMaxRedirects: 'http_max_redirects',
        scraperTimeoutFacebook: 'scraper_timeout_facebook',
        scraperTimeoutInstagram: 'scraper_timeout_instagram',
        scraperTimeoutTwitter: 'scraper_timeout_twitter',
        scraperTimeoutTiktok: 'scraper_timeout_tiktok',
        scraperTimeoutWeibo: 'scraper_timeout_weibo',
        scraperMaxRetries: 'scraper_max_retries',
        scraperRetryDelay: 'scraper_retry_delay',
        cookieCooldownMinutes: 'cookie_cooldown_minutes',
        cookieMaxUsesDefault: 'cookie_max_uses_default',
        rateLimitPublic: 'rate_limit_public',
        rateLimitApiKey: 'rate_limit_api_key',
        rateLimitAuth: 'rate_limit_auth',
        rateLimitAdmin: 'rate_limit_admin',
    };
    
    for (const [key, value] of Object.entries(updates)) {
        const dbKey = keyMap[key];
        if (dbKey && typeof value === 'number') {
            dbUpdates[dbKey] = value;
        }
    }
    
    if (Object.keys(dbUpdates).length === 0) return false;
    
    const { error } = await db
        .from('system_config')
        .update(dbUpdates)
        .eq('id', 'default');
    
    if (error) return false;
    
    // Invalidate cache
    lastFetch = 0;
    await loadSystemConfig();
    
    return true;
}

// ═══════════════════════════════════════════════════════════════
// RESET
// ═══════════════════════════════════════════════════════════════

export async function resetSystemConfig(): Promise<boolean> {
    const db = getSupabase();
    if (!db) return false;
    
    const { error } = await db
        .from('system_config')
        .update({
            cache_ttl_config: DEFAULT_CONFIG.cacheTtlConfig,
            cache_ttl_apikeys: DEFAULT_CONFIG.cacheTtlApikeys,
            cache_ttl_cookies: DEFAULT_CONFIG.cacheTtlCookies,
            cache_ttl_useragents: DEFAULT_CONFIG.cacheTtlUseragents,
            cache_ttl_playground_url: DEFAULT_CONFIG.cacheTtlPlaygroundUrl,
            http_timeout: DEFAULT_CONFIG.httpTimeout,
            http_max_redirects: DEFAULT_CONFIG.httpMaxRedirects,
            scraper_timeout_facebook: DEFAULT_CONFIG.scraperTimeoutFacebook,
            scraper_timeout_instagram: DEFAULT_CONFIG.scraperTimeoutInstagram,
            scraper_timeout_twitter: DEFAULT_CONFIG.scraperTimeoutTwitter,
            scraper_timeout_tiktok: DEFAULT_CONFIG.scraperTimeoutTiktok,
            scraper_timeout_weibo: DEFAULT_CONFIG.scraperTimeoutWeibo,
            scraper_max_retries: DEFAULT_CONFIG.scraperMaxRetries,
            scraper_retry_delay: DEFAULT_CONFIG.scraperRetryDelay,
            cookie_cooldown_minutes: DEFAULT_CONFIG.cookieCooldownMinutes,
            cookie_max_uses_default: DEFAULT_CONFIG.cookieMaxUsesDefault,
            rate_limit_public: DEFAULT_CONFIG.rateLimitPublic,
            rate_limit_api_key: DEFAULT_CONFIG.rateLimitApiKey,
            rate_limit_auth: DEFAULT_CONFIG.rateLimitAuth,
            rate_limit_admin: DEFAULT_CONFIG.rateLimitAdmin,
        })
        .eq('id', 'default');
    
    if (error) return false;
    
    systemConfig = { ...DEFAULT_CONFIG };
    lastFetch = Date.now();
    
    return true;
}

export { DEFAULT_CONFIG as SYSTEM_CONFIG_DEFAULTS };
