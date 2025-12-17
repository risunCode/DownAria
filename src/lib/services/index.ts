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

// Config & helpers
export { detectPlatform, matchesPlatform, getPlatformConfig, PLATFORM_CONFIGS } from './api-config';
export { logger } from './logger';
export {
    fetchWithTimeout,
    browserFetch,
    apiFetch,
    resolveUrl,
    BROWSER_HEADERS,
    DESKTOP_HEADERS,
    API_HEADERS,
    INSTAGRAM_GRAPHQL_HEADERS,
    INSTAGRAM_STORY_HEADERS,
    TIKTOK_HEADERS,
    USER_AGENT,
    MOBILE_USER_AGENT,
    DESKTOP_USER_AGENT,
} from './fetch-helper';

// Cache
export { getCache, setCache, hasCache, clearCache, getCacheStats, cleanupCache } from './cache';

// Errors
export { ScraperErrorCode, createError, detectErrorCode, isRetryable } from './errors';

// Types
export type { ScraperResult, ScraperOptions, ScraperData, EngagementStats, ScraperFn } from './fetch-helper';
export type { TikWMResult } from './tiktok';
export type { PlatformId, PlatformConfig } from './api-config';
