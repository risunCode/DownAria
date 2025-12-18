/**
 * Services Barrel Export
 * Re-export all scrapers for easy import
 */

// Platform scrapers
export { fetchTikWM, scrapeTikTok } from './tiktok';
export { scrapeTwitter } from './twitter';
export { scrapeInstagram } from './instagram';
export { scrapeFacebook } from './facebook';
export { scrapeWeibo } from './weibo';
export { scrapeYouTube, scrapeYouTubeInnertube } from './youtube-innertube';
export { scrapeYouTubeYtdl, isValidYouTubeUrl, getYouTubeVideoId } from './youtube-ytdl';

// Config & helpers
export { detectPlatform, matchesPlatform, getPlatformConfig, PLATFORM_CONFIGS } from './api-config';
export { logger } from './logger';
export {
    // Fetch utilities
    fetchWithTimeout,
    browserFetch,
    apiFetch,
    // URL resolution
    resolveUrl,
    resolveUrlWithLog,
    needsResolve,
    detectPlatformFromUrl,
    // Headers
    getApiHeaders,
    getBrowserHeaders,
    getSecureHeaders,
    getUserAgent,
    BROWSER_HEADERS,
    DESKTOP_HEADERS,
    API_HEADERS,
    INSTAGRAM_GRAPHQL_HEADERS,
    INSTAGRAM_STORY_HEADERS,
    TIKTOK_HEADERS,
    // User Agents
    USER_AGENT,
    MOBILE_USER_AGENT,
    DESKTOP_USER_AGENT,
} from './fetch-helper';

// Cache (Supabase only - persistent)
export { getCache, setCache, hasCache, clearCache, getCacheStats, cleanupCache, getCacheKey } from './cache';

// Errors
export { ScraperErrorCode, createError, detectErrorCode, isRetryable } from './errors';

// Types
export type { ScraperResult, ScraperOptions, ScraperData, EngagementStats, ScraperFn } from './fetch-helper';
export type { TikWMResult } from './tiktok';
export type { PlatformId, PlatformConfig } from './api-config';
