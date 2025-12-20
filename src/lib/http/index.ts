/**
 * HTTP Module - Centralized HTTP utilities
 * =========================================
 * Single source of truth for all HTTP operations.
 * Uses Axios for better redirect handling.
 */

// ═══════════════════════════════════════════════════════════════
// AXIOS CLIENT (Primary)
// ═══════════════════════════════════════════════════════════════

export {
  // HTTP methods
  httpGet, httpPost, httpHead,
  resolveUrl,
  axiosClient,

  // User agents
  USER_AGENT, DESKTOP_USER_AGENT, MOBILE_USER_AGENT,
  getUserAgent, getUserAgentAsync,

  // Headers
  BROWSER_HEADERS, API_HEADERS, DESKTOP_HEADERS,
  FACEBOOK_HEADERS, INSTAGRAM_HEADERS, TIKTOK_HEADERS,
  getApiHeaders, getApiHeadersAsync,
  getBrowserHeaders, getBrowserHeadersAsync,
  getSecureHeaders, getSecureHeadersAsync,

  // Types
  type HttpOptions, type HttpResponse, type ResolveResult,
} from './client';

// Anti-ban utilities
export {
  getRotatingHeaders, getRandomDelay, randomSleep,
  shouldThrottle, trackRequest, markRateLimited,
  getRandomProfile, FALLBACK_PROFILES,
  type BrowserProfile,
} from './anti-ban';

// ═══════════════════════════════════════════════════════════════
// URL HELPERS
// ═══════════════════════════════════════════════════════════════

export { needsResolve, normalizeUrl as normalizeUrlPipeline } from '@/lib/url';

// ═══════════════════════════════════════════════════════════════
// RESPONSE & FORMAT HELPERS
// ═══════════════════════════════════════════════════════════════

export {
  successResponse, errorResponse, missingUrlResponse, invalidUrlResponse,
  validateMediaUrl, filterValidUrls, decodeUrl, decodeHtml,
  isValidMediaUrl, isSmallImage, normalizeUrl, cleanTrackingParams,
  dedupeFormats, dedupeByQuality, getQualityLabel, getQualityFromBitrate, addFormat,
  extractByPatterns, extractVideos, extractMeta,
} from '@/lib/utils/http';

// ═══════════════════════════════════════════════════════════════
// SCRAPER TYPES (Re-export for convenience)
// ═══════════════════════════════════════════════════════════════

export type { ScraperResult, ScraperOptions, ScraperData, ScraperFn } from '@/core/scrapers/types';
export type { UnifiedEngagement as EngagementStats } from '@/lib/types';
