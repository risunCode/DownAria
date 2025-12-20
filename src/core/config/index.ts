/**
 * Core Config Module
 * ==================
 * Centralized configuration and constants.
 * 
 * This module consolidates:
 * - lib/services/api-config.ts (Platform configs)
 * - lib/utils/global-settings.ts (Global settings)
 * - Environment variable helpers
 * 
 * Usage:
 *   import { PLATFORMS, matchesPlatform, getEnv } from '@/core/config';
 */

// ═══════════════════════════════════════════════════════════════
// PLATFORM CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export {
    // Platform matching
    matchesPlatform,
    detectPlatform,
    isPlatformUrl,
    getPlatformRegex,
    getPlatformAliases,

    // Platform configs
    PLATFORM_CONFIGS,
    getPlatformConfig as getApiPlatformConfig,

    // URL helpers
    getBaseUrl,
    getReferer,
    getOrigin,

    // API endpoints
    getApiEndpoint,

    // Types
    type PlatformId,
    type PlatformConfig as ApiPlatformConfig,
} from '@/lib/services/helper/api-config';

// Re-export platform types from types
export type { Platform } from '@/lib/types';

// ═══════════════════════════════════════════════════════════════
// ENVIRONMENT HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Get environment variable with type safety
 */
export function getEnv(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined) return defaultValue;
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

/**
 * Get environment variable, returning undefined if not set
 */
export function getEnvOptional(key: string): string | undefined {
    return process.env[key];
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development';
}

// ═══════════════════════════════════════════════════════════════
// APPLICATION CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const APP_NAME = 'XTFetch';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Social Media Downloader';

// Cache TTLs (in milliseconds)
export const CACHE_TTL = {
    SHORT: 5 * 60 * 1000,      // 5 minutes
    MEDIUM: 30 * 60 * 1000,    // 30 minutes
    LONG: 24 * 60 * 60 * 1000, // 24 hours
};

// Request timeouts (in milliseconds)
export const TIMEOUTS = {
    SHORT: 5000,   // 5 seconds
    NORMAL: 10000, // 10 seconds
    LONG: 30000,   // 30 seconds
};

// Rate limit windows (in milliseconds)
export const RATE_LIMIT_WINDOWS = {
    SHORT: 60 * 1000,      // 1 minute
    MEDIUM: 5 * 60 * 1000, // 5 minutes
    LONG: 60 * 60 * 1000,  // 1 hour
};

// ═══════════════════════════════════════════════════════════════
// ALLOWED DOMAINS (for SSRF prevention)
// ═══════════════════════════════════════════════════════════════

export const ALLOWED_SOCIAL_DOMAINS = [
    // Facebook
    'facebook.com', 'fb.com', 'fb.watch', 'fbcdn.net',

    // Instagram
    'instagram.com', 'cdninstagram.com', 'instagr.am',

    // Twitter/X
    'twitter.com', 'x.com', 't.co', 'twimg.com',

    // TikTok
    'tiktok.com', 'tiktokcdn.com', 'musical.ly',

    // Weibo
    'weibo.com', 'weibo.cn', 'sinaimg.cn',

    // YouTube
    'youtube.com', 'youtu.be', 'googlevideo.com', 'ytimg.com',
];

export const ALLOWED_CDN_DOMAINS = [
    // Facebook CDN
    'fbcdn.net', 'cdninstagram.com', 'scontent.cdninstagram.com',

    // Twitter CDN
    'pbs.twimg.com', 'video.twimg.com',

    // TikTok CDN
    'tiktokcdn.com', 'tiktokcdn-us.com',

    // Weibo CDN
    'sinaimg.cn', 'weibocdn.com',
];
