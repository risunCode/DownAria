/**
 * Fetch Helpers for Social Downloader
 * ====================================
 * SINGLE SOURCE OF TRUTH for:
 * - User Agents (all platforms)
 * - HTTP Headers (browser, API, platform-specific)
 * - URL Resolution (short links for all platforms)
 * - Fetch utilities with timeout
 */

import { PlatformId, getReferer, getOrigin } from './api-config';
import { MediaFormat } from '@/lib/types';
import { ScraperErrorCode } from './errors';
import { logger } from './logger';

// ═══════════════════════════════════════════════════════════════
// USER AGENTS - Single source of truth
// ═══════════════════════════════════════════════════════════════

/** Chrome Windows - default for most platforms */
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Safari macOS - for Weibo, TikTok validation */
export const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';

/** Mobile Safari - for mobile APIs */
export const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

/** Get platform-specific User-Agent */
export function getUserAgent(platform?: PlatformId): string {
    switch (platform) {
        case 'weibo': return DESKTOP_USER_AGENT;
        case 'tiktok':
        case 'douyin': return MOBILE_USER_AGENT;
        default: return USER_AGENT;
    }
}

// ═══════════════════════════════════════════════════════════════
// HEADERS - Pre-built for common use cases
// ═══════════════════════════════════════════════════════════════

export const BROWSER_HEADERS: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip, deflate, br', 'Connection': 'keep-alive',
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0', 'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none', 'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1', 'Cache-Control': 'max-age=0',
};

export const DESKTOP_HEADERS: Record<string, string> = {
    'User-Agent': DESKTOP_USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8', 'Accept-Encoding': 'gzip, deflate, br', Connection: 'keep-alive',
    'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1', 'Cache-Control': 'max-age=0',
};

export const API_HEADERS: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9'
};

export const INSTAGRAM_GRAPHQL_HEADERS: Record<string, string> = {
    'User-Agent': USER_AGENT, 'Accept': '*/*', 'Accept-Language': 'en-US,en;q=0.9',
    'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest',
};

export const INSTAGRAM_STORY_HEADERS: Record<string, string> = {
    'User-Agent': USER_AGENT, 'X-IG-App-ID': '936619743392459',
    'X-Requested-With': 'XMLHttpRequest', 'Accept': '*/*',
};

export const TIKTOK_HEADERS: Record<string, string> = {
    'User-Agent': MOBILE_USER_AGENT, 'Accept': 'application/json', 'Referer': 'https://tikwm.com/',
};

// ═══════════════════════════════════════════════════════════════
// HEADER BUILDERS
// ═══════════════════════════════════════════════════════════════

export function getApiHeaders(platform?: PlatformId, extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { ...API_HEADERS, 'User-Agent': getUserAgent(platform) };
    if (platform) { h['Referer'] = getReferer(platform); h['Origin'] = getOrigin(platform); }
    return extra ? { ...h, ...extra } : h;
}

export function getBrowserHeaders(platform?: PlatformId, extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { ...BROWSER_HEADERS, 'User-Agent': getUserAgent(platform) };
    if (platform) h['Referer'] = getReferer(platform);
    return extra ? { ...h, ...extra } : h;
}

/** Build secure headers with optional cookie */
export function getSecureHeaders(platform?: PlatformId, cookie?: string): Record<string, string> {
    const h = getBrowserHeaders(platform);
    if (cookie) h['Cookie'] = cookie;
    return h;
}

// ═══════════════════════════════════════════════════════════════
// FETCH UTILITIES
// ═══════════════════════════════════════════════════════════════

export async function fetchWithTimeout(url: string, opts?: RequestInit & { timeout?: number }): Promise<Response> {
    const { timeout = 10000, ...fetchOpts } = opts || {};
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeout);
    try { return await fetch(url, { ...fetchOpts, signal: ctrl.signal }); }
    finally { clearTimeout(tid); }
}

export async function apiFetch(url: string, platform?: PlatformId, opts?: RequestInit & { timeout?: number }): Promise<Response> {
    const { timeout = 10000, ...fetchOpts } = opts || {};
    return fetchWithTimeout(url, { ...fetchOpts, timeout, headers: getApiHeaders(platform, fetchOpts.headers as Record<string, string>) });
}

export async function browserFetch(url: string, platform?: PlatformId, opts?: RequestInit & { timeout?: number }): Promise<Response> {
    const { timeout = 10000, ...fetchOpts } = opts || {};
    return fetchWithTimeout(url, { ...fetchOpts, timeout, headers: getBrowserHeaders(platform, fetchOpts.headers as Record<string, string>) });
}

// ═══════════════════════════════════════════════════════════════
// URL RESOLUTION - Unified for all platforms
// ═══════════════════════════════════════════════════════════════

/** Short URL patterns per platform */
const SHORT_URL_PATTERNS: Record<string, RegExp> = {
    facebook: /fb\.watch|fb\.me|l\.facebook|\/share\//,
    instagram: /instagr\.am/,
    twitter: /t\.co\//,
    tiktok: /vm\.tiktok|vt\.tiktok/,
    youtube: /youtu\.be/,
};

/** Check if URL needs resolution */
export function needsResolve(url: string, platform?: PlatformId): boolean {
    if (platform && SHORT_URL_PATTERNS[platform]) {
        return SHORT_URL_PATTERNS[platform].test(url);
    }
    // Check all patterns
    return Object.values(SHORT_URL_PATTERNS).some(re => re.test(url));
}

/** Detect platform from short URL */
export function detectPlatformFromUrl(url: string): PlatformId | null {
    for (const [platform, pattern] of Object.entries(SHORT_URL_PATTERNS)) {
        if (pattern.test(url)) return platform as PlatformId;
    }
    if (/facebook\.com|fb\.com/.test(url)) return 'facebook';
    if (/instagram\.com/.test(url)) return 'instagram';
    if (/twitter\.com|x\.com/.test(url)) return 'twitter';
    if (/tiktok\.com/.test(url)) return 'tiktok';
    if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
    if (/weibo\./.test(url)) return 'weibo';
    return null;
}

/**
 * Resolve short URL to full URL
 * Fast: single fetch with redirect:follow
 */
export async function resolveUrl(shortUrl: string, timeout = 3000): Promise<string> {
    try {
        const res = await fetchWithTimeout(shortUrl, {
            method: 'GET',
            redirect: 'follow',
            timeout,
            headers: BROWSER_HEADERS
        });
        return res.url || shortUrl;
    } catch { return shortUrl; }
}

/**
 * Resolve URL with logging
 * Returns { original, resolved, changed }
 */
export async function resolveUrlWithLog(
    url: string,
    platform: PlatformId,
    timeout = 3000
): Promise<{ original: string; resolved: string; changed: boolean }> {
    if (!needsResolve(url, platform)) {
        return { original: url, resolved: url, changed: false };
    }

    const resolved = await resolveUrl(url, timeout);
    const changed = resolved !== url;

    if (changed) {
        logger.resolve(platform, url, resolved);
    }

    return { original: url, resolved, changed };
}

// ========== TYPES ==========

// Re-export unified engagement type from types
export type { UnifiedEngagement as EngagementStats } from '@/lib/types';

// Import UnifiedEngagement for use within this file
import type { UnifiedEngagement } from '@/lib/types';

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
