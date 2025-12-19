/**
 * Services Barrel Export
 * Scrapers at root level, helpers in helper/ subfolder
 */

// ═══════════════════════════════════════════════════════════════
// SCRAPERS (root level)
// ═══════════════════════════════════════════════════════════════

export { scrapeFacebook } from './facebook';
export { scrapeInstagram } from './instagram';
export { scrapeTwitter } from './twitter';
export { scrapeTikTok, fetchTikWM, type TikWMResult } from './tiktok';
export { scrapeWeibo } from './weibo';

// ═══════════════════════════════════════════════════════════════
// DOWNLOAD HANDLER
// ═══════════════════════════════════════════════════════════════

export { handleDownload, getApiInfo } from './download-handler';

// ═══════════════════════════════════════════════════════════════
// HELPER SERVICES (helper/ subfolder)
// ═══════════════════════════════════════════════════════════════

export * from './helper';

// URL Resolution
export { prepareUrl, normalizeUrl, needsResolve, extractContentId } from '@/lib/url';

// Scraper Types
export { ScraperErrorCode, createError, detectErrorCode, isRetryable } from '@/core/scrapers/types';
export type { ScraperResult, ScraperOptions, ScraperData, ScraperFn } from '@/core/scrapers/types';
export type { UnifiedEngagement as EngagementStats } from '@/lib/types';
