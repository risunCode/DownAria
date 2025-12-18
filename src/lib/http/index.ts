/**
 * HTTP Module
 * ===========
 * Centralized HTTP utilities for fetch operations.
 * 
 * This module consolidates:
 * - lib/services/fetch-helper.ts (Fetch utilities)
 * - lib/utils/http.ts (Response helpers)
 * 
 * Usage:
 *   import { fetchWithTimeout, successResponse, errorResponse } from '@/lib/http';
 */

// ═══════════════════════════════════════════════════════════════
// FETCH UTILITIES
// ═══════════════════════════════════════════════════════════════

export {
    // Fetch functions
    fetchWithTimeout,
    apiFetch,
    browserFetch,

    // URL Resolution
    needsResolve,
    detectPlatformFromUrl,
    resolveUrl,
    resolveUrlWithLog,

    // User Agents
    USER_AGENT,
    DESKTOP_USER_AGENT,
    MOBILE_USER_AGENT,
    getUserAgent,

    // Headers
    BROWSER_HEADERS,
    DESKTOP_HEADERS,
    API_HEADERS,
    INSTAGRAM_GRAPHQL_HEADERS,
    INSTAGRAM_STORY_HEADERS,
    TIKTOK_HEADERS,
    getApiHeaders,
    getBrowserHeaders,
    getSecureHeaders,
} from '@/lib/services/fetch-helper';

// ═══════════════════════════════════════════════════════════════
// RESPONSE HELPERS
// ═══════════════════════════════════════════════════════════════

export {
    // Response builders
    successResponse,
    errorResponse,

    // URL utilities
    validateMediaUrl,
    filterValidUrls,
    decodeUrl,
    decodeHtml,
    isValidMediaUrl,
    isSmallImage,
    normalizeUrl,
    cleanTrackingParams,

    // Format helpers
    dedupeFormats,
    dedupeByQuality,
    getQualityLabel,
    getQualityFromBitrate,
    addFormat,

    // Extraction helpers
    extractByPatterns,
    extractVideos,
    extractMeta,
} from '@/lib/utils/http';
