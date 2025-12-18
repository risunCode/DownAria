/**
 * HTTP Utilities for Social Downloader
 * Compact, smart helpers for URL validation, extraction, and responses
 * 
 * NOTE: Cache moved to src/lib/services/cache.ts (Supabase-backed)
 * NOTE: User-Agents centralized in src/lib/services/fetch-helper.ts
 */

import { NextResponse } from 'next/server';
import { DownloadResponse, MediaFormat } from '@/lib/types';
import { PlatformId, getReferer, getPlatformConfig } from '@/lib/services/api-config';
import { getUserAgent, DESKTOP_USER_AGENT } from '@/lib/services/fetch-helper';

// ========== URL VALIDATION ==========
const TRUSTED_CDNS: Record<string, string[]> = {
    tiktok: ['tiktok.com', 'webapp-prime', 'bytedance', 'musical.ly', 'tiktokcdn'],
    douyin: ['zjcdn.com', 'douyin.com'],
};

export async function validateMediaUrl(url: string, platform: PlatformId, timeout = 3000): Promise<boolean> {
    if (TRUSTED_CDNS[platform]?.some(d => url.includes(d))) return true;
    try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), timeout);
        // Use platform-specific UA from centralized fetch-helper
        const ua = (platform === 'tiktok' || platform === 'douyin') ? DESKTOP_USER_AGENT : getUserAgent(platform);
        const res = await fetch(url, {
            method: 'HEAD',
            signal: ctrl.signal,
            headers: { 'User-Agent': ua, 'Referer': getReferer(platform) },
        });
        clearTimeout(tid);
        return res.ok;
    } catch { return false; }
}

export async function filterValidUrls(urls: string[], platform: PlatformId): Promise<string[]> {
    const results = await Promise.all(urls.map(async url => {
        const ok = await validateMediaUrl(url, platform);
        return ok ? url : null;
    }));
    return results.filter((u): u is string => !!u);
}

// ========== DECODE ==========
const DECODE_MAP: [RegExp, string][] = [
    [/\\\\\//g, '/'],   // \\/ -> /
    [/\\u0025/g, '%'], [/\\u0026/g, '&'], [/\\u003C/g, '<'], [/\\u003E/g, '>'],
    [/\\u002F/g, '/'], [/\\\//g, '/'], [/\\"/g, '"'], [/&amp;/g, '&'],
    [/&lt;/g, '<'], [/&gt;/g, '>'], [/&#x3D;/g, '='], [/&quot;/g, '"'],
    [/&#x27;/g, "'"], [/&#39;/g, "'"],
    [/\\+$/g, ''],      // trailing backslashes
];

export const decodeUrl = (s: string) => DECODE_MAP.reduce((r, [p, v]) => r.replace(p, v), s);

// Decode HTML entities including numeric (&#xHEX; and &#DEC;)
export const decodeHtml = (s: string) => {
    let result = decodeUrl(s);
    // Decode hex entities: &#x1f49a; -> 💚
    result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
    // Decode decimal entities: &#183; -> ·
    result = result.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
    return result;
};

// ========== URL HELPERS ==========
export const isValidMediaUrl = (url: string, domains?: string[]) =>
    url?.length > 20 && !/<|>/.test(url) && (!domains || domains.some(d => url.includes(d)));

const SMALL_IMG_PATTERNS = [
    /\/[ps]\d+x\d+\//, /s(16|24|32|40|48|60|75|100)x\1/,
    /emoji|static|sticker|rsrc\.php|\/cp0\/|\/c\d+\.\d+\.\d+\.\d+\//i,
];
export const isSmallImage = (url: string) => SMALL_IMG_PATTERNS.some(p => p.test(url));

export function normalizeUrl(url: string, platform: PlatformId): string {
    let u = url;
    if (platform === 'facebook') u = u.replace(/m\.|mbasic\.|web\./g, 'www.');
    else if (platform === 'youtube') u = u.replace('music.youtube.com', 'www.youtube.com');
    return u.startsWith('http') ? u : 'https://' + u;
}

export const cleanTrackingParams = (url: string) => url
    .replace(/[&?](wtsid|_rdr|rdid|share_url|app|__cft__\[[^\]]*\]|__tn__)=[^&]*/g, '')
    .replace(/&&+/g, '&').replace(/\?&/g, '?').replace(/[&?]$/g, '');

// ========== RESPONSE HELPERS ==========
type MediaData = { title: string; thumbnail: string; author: string; formats: MediaFormat[]; url: string; description?: string; duration?: string; views?: string; usedCookie?: boolean; cached?: boolean; responseTime?: number };

export const successResponse = (platform: PlatformId, data: MediaData) =>
    NextResponse.json<DownloadResponse>({ success: true, platform, data });

export const errorResponse = (platform: PlatformId, error: string, status = 400) =>
    NextResponse.json<DownloadResponse>({ success: false, platform, error }, { status });

export const missingUrlResponse = (p: PlatformId) => errorResponse(p, 'URL is required', 400);
export const invalidUrlResponse = (p: PlatformId) => errorResponse(p, `Invalid ${getPlatformConfig(p)?.name || p} URL`, 400);

// ========== FORMAT HELPERS ==========
export const dedupeFormats = (f: MediaFormat[]) => f.filter((x, i, a) => i === a.findIndex(y => y.url === x.url));
export const dedupeByQuality = (f: MediaFormat[]) => f.filter((x, i, a) => 
    i === a.findIndex(y => y.quality === x.quality && y.type === x.type && y.itemId === x.itemId));

export const getQualityLabel = (h: number) => h >= 1080 ? 'FHD 1080p' : h >= 720 ? 'HD 720p' : h >= 480 ? 'SD 480p' : h >= 360 ? 'SD 360p' : `${h}p`;
export const getQualityFromBitrate = (b: number) => b >= 5e6 ? 'FULLHD (1080p)' : b >= 2e6 ? 'HD (720p)' : b >= 8e5 ? 'SD (480p)' : b > 0 ? 'Low (360p)' : 'Video';

// ========== EXTRACTION HELPERS ==========
export function extractByPatterns(html: string, patterns: RegExp[], decode = true): string[] {
    const results = new Set<string>();
    for (const p of patterns) {
        let m;
        while ((m = p.exec(html)) !== null) {
            const url = decode ? decodeUrl(m[1] || m[0]) : (m[1] || m[0]);
            if (url?.length > 20) results.add(url);
        }
    }
    return [...results];
}

export function extractVideos(html: string, patterns: { pattern: RegExp; quality: string }[]): Map<string, string> {
    const urls = new Map<string, string>();
    const found = new Set<string>();
    for (const { pattern, quality } of patterns) {
        let m;
        while ((m = pattern.exec(html)) !== null) {
            const url = decodeUrl(m[1]);
            if (url?.length > 50 && !found.has(quality)) {
                urls.set(url, quality);
                found.add(quality);
            }
        }
    }
    return urls;
}

export function extractMeta(html: string, $?: ReturnType<typeof import('cheerio').load>): { title: string; thumbnail: string; description: string } {
    const get = (prop: string) => {
        if ($) return $(`meta[property="${prop}"]`).attr('content') || '';
        const m = html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]+)"`, 'i'));
        return m ? decodeUrl(m[1]) : '';
    };
    return {
        title: get('og:title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.replace(/ \| .+$/, '').trim() || '',
        thumbnail: get('og:image'),
        description: get('og:description').substring(0, 500),
    };
}

// ========== SMART SCRAPER ==========
export interface ScrapeResult {
    formats: MediaFormat[];
    title: string;
    thumbnail: string;
    author: string;
    description?: string;
}

export function createFormat(
    quality: string, type: 'video' | 'image' | 'audio', url: string,
    opts?: { itemId?: string; thumbnail?: string; filename?: string }
): MediaFormat {
    return {
        quality, type, url,
        format: type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : url.includes('.png') ? 'png' : 'jpg',
        ...opts,
    };
}

export function addFormat(
    formats: MediaFormat[], quality: string, type: 'video' | 'image' | 'audio', url: string,
    opts?: { itemId?: string; thumbnail?: string; filename?: string }
) {
    if (url && !formats.find(f => f.url === url)) {
        formats.push(createFormat(quality, type, url, opts));
    }
}
