/**
 * Fetch Helpers for Social Downloader
 * Centralized HTTP utilities, headers, and shared types
 */

import { PlatformId, getReferer, getOrigin } from './api-config';
import { MediaFormat } from '@/lib/types';
import { ScraperErrorCode } from './errors';

// ========== USER AGENTS & HEADERS ==========
// Chrome Windows - most reliable for Facebook/Instagram with cookies
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// iPad Air - fallback for some platforms
export const MOBILE_USER_AGENT = 'Mozilla/5.0 (iPad; CPU OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

// Safari macOS - for platforms that need desktop UA (Weibo)
export const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';

export const BROWSER_HEADERS: Record<string, string> = {
    'User-Agent': USER_AGENT, 
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9', 'Accept-Encoding': 'gzip, deflate, br', 'Connection': 'keep-alive',
    'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-Ch-Ua-Mobile': '?0', 'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none', 'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1', 'Cache-Control': 'max-age=0',
};

// Desktop headers for Weibo
export const DESKTOP_HEADERS: Record<string, string> = {
    'User-Agent': DESKTOP_USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8', 'Accept-Encoding': 'gzip, deflate, br', Connection: 'keep-alive',
    'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1', 'Cache-Control': 'max-age=0',
};

export const API_HEADERS: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: '*/*', 'Accept-Language': 'en-US,en;q=0.9' };

// Instagram GraphQL headers
export const INSTAGRAM_GRAPHQL_HEADERS: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-IG-App-ID': '936619743392459',
    'X-Requested-With': 'XMLHttpRequest',
};

// Instagram Story headers
export const INSTAGRAM_STORY_HEADERS: Record<string, string> = {
    'User-Agent': USER_AGENT,
    'X-IG-App-ID': '936619743392459',
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': '*/*',
};

// TikTok/TikWM API headers
export const TIKTOK_HEADERS: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15',
    'Accept': 'application/json',
    'Referer': 'https://tikwm.com/',
};

// ========== HEADER HELPERS ==========
export function getApiHeaders(platform?: PlatformId, extra?: Record<string, string>): Record<string, string> {
    const h = { ...API_HEADERS };
    if (platform) { h['Referer'] = getReferer(platform); h['Origin'] = getOrigin(platform); }
    return extra ? { ...h, ...extra } : h;
}

export function getBrowserHeaders(platform?: PlatformId, extra?: Record<string, string>): Record<string, string> {
    const h = { ...BROWSER_HEADERS };
    if (platform) h['Referer'] = getReferer(platform);
    return extra ? { ...h, ...extra } : h;
}

// ========== FETCH UTILITIES ==========
export async function fetchWithTimeout(url: string, opts?: RequestInit & { timeout?: number }): Promise<Response> {
    const { timeout = 10000, ...fetchOpts } = opts || {};
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeout);
    try { return await fetch(url, { ...fetchOpts, signal: ctrl.signal }); }
    finally { clearTimeout(tid); }
}

export async function resolveUrl(shortUrl: string, timeout = 5000): Promise<string> {
    try {
        // Fast method: single fetch with redirect:follow, extract final URL
        const res = await fetchWithTimeout(shortUrl, { 
            method: 'GET', 
            redirect: 'follow', 
            timeout,
            headers: BROWSER_HEADERS 
        });
        return res.url || shortUrl;
    } catch { return shortUrl; }
}

export async function apiFetch(url: string, platform?: PlatformId, opts?: RequestInit & { timeout?: number }): Promise<Response> {
    const { timeout = 10000, ...fetchOpts } = opts || {};
    return fetchWithTimeout(url, { ...fetchOpts, timeout, headers: getApiHeaders(platform, fetchOpts.headers as Record<string, string>) });
}

export async function browserFetch(url: string, platform?: PlatformId, opts?: RequestInit & { timeout?: number }): Promise<Response> {
    const { timeout = 10000, ...fetchOpts } = opts || {};
    return fetchWithTimeout(url, { ...fetchOpts, timeout, headers: getBrowserHeaders(platform, fetchOpts.headers as Record<string, string>) });
}

// ========== TYPES ==========

/** Unified engagement stats (normalized across platforms) */
export interface EngagementStats {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;      // Unified: reposts, retweets, shares
    bookmarks?: number;
    replies?: number;
}

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
    engagement?: EngagementStats;
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
