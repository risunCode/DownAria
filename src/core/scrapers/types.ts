/**
 * Scraper Types - Core Domain Types
 * Central type definitions for all platform scrapers
 */

import type { MediaFormat, UnifiedEngagement } from '@/lib/types';

// ═══════════════════════════════════════════════════════════════
// PLATFORM TYPES
// ═══════════════════════════════════════════════════════════════

export type PlatformId = 'youtube' | 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'weibo' | 'douyin';

// ═══════════════════════════════════════════════════════════════
// ERROR CODES
// ═══════════════════════════════════════════════════════════════

export enum ScraperErrorCode {
    // URL errors
    INVALID_URL = 'INVALID_URL',
    UNSUPPORTED_PLATFORM = 'UNSUPPORTED_PLATFORM',

    // Auth errors
    COOKIE_REQUIRED = 'COOKIE_REQUIRED',
    COOKIE_EXPIRED = 'COOKIE_EXPIRED',
    COOKIE_INVALID = 'COOKIE_INVALID',

    // Content errors
    NOT_FOUND = 'NOT_FOUND',
    PRIVATE_CONTENT = 'PRIVATE_CONTENT',
    AGE_RESTRICTED = 'AGE_RESTRICTED',
    NO_MEDIA = 'NO_MEDIA',
    DELETED = 'DELETED',

    // Network errors
    TIMEOUT = 'TIMEOUT',
    RATE_LIMITED = 'RATE_LIMITED',
    BLOCKED = 'BLOCKED',
    NETWORK_ERROR = 'NETWORK_ERROR',

    // Platform errors
    API_ERROR = 'API_ERROR',
    PARSE_ERROR = 'PARSE_ERROR',
    CHECKPOINT_REQUIRED = 'CHECKPOINT_REQUIRED',

    // Generic
    UNKNOWN = 'UNKNOWN',
}

// User-friendly error messages
export const ERROR_MESSAGES: Record<ScraperErrorCode, string> = {
    [ScraperErrorCode.INVALID_URL]: 'Invalid URL format',
    [ScraperErrorCode.UNSUPPORTED_PLATFORM]: 'This platform is not supported',

    [ScraperErrorCode.COOKIE_REQUIRED]: 'This content requires login. Please provide a cookie.',
    [ScraperErrorCode.COOKIE_EXPIRED]: 'Your cookie has expired. Please update it.',
    [ScraperErrorCode.COOKIE_INVALID]: 'Invalid cookie format',

    [ScraperErrorCode.NOT_FOUND]: 'Content not found',
    [ScraperErrorCode.PRIVATE_CONTENT]: 'This content is private',
    [ScraperErrorCode.AGE_RESTRICTED]: 'This content is age-restricted. Please provide a cookie.',
    [ScraperErrorCode.NO_MEDIA]: 'No downloadable media found',
    [ScraperErrorCode.DELETED]: 'This content has been deleted',

    [ScraperErrorCode.TIMEOUT]: 'Request timed out. Please try again.',
    [ScraperErrorCode.RATE_LIMITED]: 'Too many requests. Please wait a moment.',
    [ScraperErrorCode.BLOCKED]: 'Request was blocked by the platform',
    [ScraperErrorCode.NETWORK_ERROR]: 'Network error. Please check your connection.',

    [ScraperErrorCode.API_ERROR]: 'Platform API error',
    [ScraperErrorCode.PARSE_ERROR]: 'Failed to parse response',
    [ScraperErrorCode.CHECKPOINT_REQUIRED]: 'Account verification required. Please check your account.',

    [ScraperErrorCode.UNKNOWN]: 'An unexpected error occurred',
};

// ═══════════════════════════════════════════════════════════════
// SCRAPER DATA TYPES
// ═══════════════════════════════════════════════════════════════

/** Scraper result data */
export interface ScraperData {
    title: string;
    thumbnail: string;
    author: string;
    authorName?: string;
    formats: MediaFormat[];
    url: string;
    description?: string;
    duration?: string;
    views?: string;
    postedAt?: string;
    engagement?: UnifiedEngagement;
    usedCookie?: boolean;
    /** Content type hint */
    type?: 'video' | 'image' | 'slideshow' | 'story' | 'mixed';
}

/** Unified scraper result */
export interface ScraperResult {
    success: boolean;
    data?: ScraperData;
    error?: string;
    errorCode?: ScraperErrorCode;
    /** Was result from cache? */
    cached?: boolean;
}

/** Scraper options */
export interface ScraperOptions {
    cookie?: string;
    /** Request HD quality (TikTok) */
    hd?: boolean;
    /** Request timeout in ms */
    timeout?: number;
    /** Skip cache lookup */
    skipCache?: boolean;
}

/** Scraper function signature */
export type ScraperFn = (url: string, options?: ScraperOptions) => Promise<ScraperResult>;

// ═══════════════════════════════════════════════════════════════
// ERROR UTILITIES
// ═══════════════════════════════════════════════════════════════

/**
 * Create standardized error result
 */
export function createError(code: ScraperErrorCode, customMessage?: string): {
    success: false;
    error: string;
    errorCode: ScraperErrorCode;
} {
    return {
        success: false,
        error: customMessage || ERROR_MESSAGES[code],
        errorCode: code,
    };
}

/**
 * Detect error code from error message or response
 */
export function detectErrorCode(error: unknown): ScraperErrorCode {
    const msg = error instanceof Error ? error.message : String(error);
    const lower = msg.toLowerCase();

    if (lower.includes('timeout') || lower.includes('aborted')) return ScraperErrorCode.TIMEOUT;
    if (lower.includes('rate limit') || lower.includes('429')) return ScraperErrorCode.RATE_LIMITED;
    if (lower.includes('cookie') && lower.includes('required')) return ScraperErrorCode.COOKIE_REQUIRED;
    if (lower.includes('cookie') && lower.includes('expired')) return ScraperErrorCode.COOKIE_EXPIRED;
    if (lower.includes('login') || lower.includes('auth')) return ScraperErrorCode.COOKIE_REQUIRED;
    if (lower.includes('private')) return ScraperErrorCode.PRIVATE_CONTENT;
    if (lower.includes('not found') || lower.includes('404')) return ScraperErrorCode.NOT_FOUND;
    if (lower.includes('deleted')) return ScraperErrorCode.DELETED;
    if (lower.includes('age') && lower.includes('restrict')) return ScraperErrorCode.AGE_RESTRICTED;
    if (lower.includes('checkpoint')) return ScraperErrorCode.CHECKPOINT_REQUIRED;
    if (lower.includes('blocked') || lower.includes('403')) return ScraperErrorCode.BLOCKED;
    if (lower.includes('network') || lower.includes('fetch')) return ScraperErrorCode.NETWORK_ERROR;

    return ScraperErrorCode.UNKNOWN;
}

/**
 * Check if error is retryable
 */
export function isRetryable(code: ScraperErrorCode): boolean {
    return [
        ScraperErrorCode.TIMEOUT,
        ScraperErrorCode.NETWORK_ERROR,
        ScraperErrorCode.API_ERROR,
    ].includes(code);
}
