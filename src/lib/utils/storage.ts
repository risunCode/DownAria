import { HistoryItem, generateId } from '@/lib/types';

const STORAGE_KEY = 'xt_download_history';
const MAX_HISTORY_ITEMS = 50;

// Get all history items
export function getHistory(): HistoryItem[] {
    if (typeof window === 'undefined') return [];

    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// Add item to history
export function addToHistory(item: Omit<HistoryItem, 'id' | 'downloadedAt'>): HistoryItem {
    const history = getHistory();

    const newItem: HistoryItem = {
        ...item,
        id: generateId(),
        downloadedAt: new Date().toISOString(),
    };

    history.unshift(newItem);
    const trimmed = history.slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));

    return newItem;
}

// Remove item from history
export function removeFromHistory(id: string): void {
    const history = getHistory();
    const filtered = history.filter(item => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

// Clear all history
export function clearHistory(): void {
    localStorage.removeItem(STORAGE_KEY);
}

// Search history
export function searchHistory(query: string): HistoryItem[] {
    const history = getHistory();
    const lowerQuery = query.toLowerCase();
    return history.filter(item =>
        item.title.toLowerCase().includes(lowerQuery) ||
        item.platform.toLowerCase().includes(lowerQuery)
    );
}

// Get history by platform
export function getHistoryByPlatform(platform: HistoryItem['platform']): HistoryItem[] {
    const history = getHistory();
    return history.filter(item => item.platform === platform);
}

// ========== PLATFORM COOKIES ==========
import { parseCookie, type CookiePlatform } from './cookie-parser';

// Re-export type for backward compatibility
export type { CookiePlatform };

const COOKIE_KEY_PREFIX = 'xt_cookie_';

// Get saved cookie for platform
export function getPlatformCookie(platform: CookiePlatform): string | null {
    if (typeof window === 'undefined') return null;

    try {
        const data = localStorage.getItem(COOKIE_KEY_PREFIX + platform);
        if (!data) return null;
        
        // Support old format (with expires) - migrate
        try {
            const parsed = JSON.parse(data);
            if (parsed.cookie) {
                localStorage.setItem(COOKIE_KEY_PREFIX + platform, parsed.cookie);
                return parsed.cookie;
            }
        } catch {
            return data;
        }
        return data;
    } catch {
        return null;
    }
}

// Save cookie for platform (supports JSON array or string)
export function savePlatformCookie(platform: CookiePlatform, cookie: string): void {
    if (typeof window === 'undefined') return;
    // Use universal cookie parser
    const parsed = parseCookie(cookie, platform);
    localStorage.setItem(COOKIE_KEY_PREFIX + platform, parsed || cookie);
}

// Clear cookie for platform
export function clearPlatformCookie(platform: CookiePlatform): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(COOKIE_KEY_PREFIX + platform);
}

// Check if platform has valid cookie
export function hasPlatformCookie(platform: CookiePlatform): boolean {
    return getPlatformCookie(platform) !== null;
}

// Get all platform cookies status
export function getAllCookieStatus(): Record<CookiePlatform, boolean> {
    return {
        facebook: hasPlatformCookie('facebook'),
        instagram: hasPlatformCookie('instagram'),
        weibo: hasPlatformCookie('weibo'),
        twitter: hasPlatformCookie('twitter'),
        youtube: hasPlatformCookie('youtube'),
    };
}

// Legacy aliases for Weibo (backward compatibility)
export const getWeiboCookie = () => getPlatformCookie('weibo');
export const saveWeiboCookie = (cookie: string) => savePlatformCookie('weibo', cookie);
export const clearWeiboCookie = () => clearPlatformCookie('weibo');
export const hasValidWeiboCookie = () => hasPlatformCookie('weibo');


// ========== THEME SETTINGS ==========
export type ThemeType = 'light' | 'solarized' | 'dark';

const THEME_KEY = 'xt_theme';
const DEFAULT_THEME: ThemeType = 'solarized';

export function getTheme(): ThemeType {
    if (typeof window === 'undefined') return DEFAULT_THEME;
    
    try {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved && ['light', 'solarized', 'dark'].includes(saved)) {
            return saved as ThemeType;
        }
        return DEFAULT_THEME;
    } catch {
        return DEFAULT_THEME;
    }
}

export function saveTheme(theme: ThemeType): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(THEME_KEY, theme);
    applyTheme(theme);
}

export function applyTheme(theme: ThemeType): void {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove('theme-light', 'theme-solarized', 'theme-simple', 'theme-dark');
    document.documentElement.classList.add(`theme-${theme}`);
}

export function initTheme(): ThemeType {
    const theme = getTheme();
    applyTheme(theme);
    return theme;
}


// ========== URL RESPONSE CACHE ==========
// Client-side cache for API responses (1 day retention)

import { MediaData, Platform } from '@/lib/types';

const URL_CACHE_KEY = 'xt_url_cache';
const URL_CACHE_TTL = 24 * 60 * 60 * 1000; // 1 day
const MAX_CACHE_ENTRIES = 100;

interface CachedResponse {
    data: MediaData;
    platform: Platform;
    cachedAt: number;
}

type UrlCache = Record<string, CachedResponse>;

function normalizeUrl(url: string): string {
    return url.toLowerCase().replace(/\/$/, '').replace(/[?#].*$/, '');
}

function getUrlCache(): UrlCache {
    if (typeof window === 'undefined') return {};
    try {
        const data = localStorage.getItem(URL_CACHE_KEY);
        if (!data) return {};
        return JSON.parse(data);
    } catch {
        return {};
    }
}

function saveUrlCache(cache: UrlCache): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(URL_CACHE_KEY, JSON.stringify(cache));
    } catch {
        // Storage full, clear old entries
        clearExpiredUrlCache();
    }
}

// Get cached response for URL
export function getCachedResponse(url: string): { data: MediaData; platform: Platform } | null {
    const cache = getUrlCache();
    const key = normalizeUrl(url);
    const entry = cache[key];
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.cachedAt > URL_CACHE_TTL) {
        delete cache[key];
        saveUrlCache(cache);
        return null;
    }
    
    return { data: entry.data, platform: entry.platform };
}

// Cache response for URL
export function cacheResponse(url: string, platform: Platform, data: MediaData): void {
    const cache = getUrlCache();
    const key = normalizeUrl(url);
    
    // Limit cache size
    const keys = Object.keys(cache);
    if (keys.length >= MAX_CACHE_ENTRIES) {
        // Remove oldest entries
        const sorted = keys.sort((a, b) => cache[a].cachedAt - cache[b].cachedAt);
        sorted.slice(0, 20).forEach(k => delete cache[k]);
    }
    
    cache[key] = {
        data,
        platform,
        cachedAt: Date.now(),
    };
    
    saveUrlCache(cache);
}

// Clear expired cache entries
export function clearExpiredUrlCache(): number {
    const cache = getUrlCache();
    const now = Date.now();
    let cleared = 0;
    
    for (const key of Object.keys(cache)) {
        if (now - cache[key].cachedAt > URL_CACHE_TTL) {
            delete cache[key];
            cleared++;
        }
    }
    
    saveUrlCache(cache);
    return cleared;
}

// Clear all URL cache
export function clearUrlCache(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(URL_CACHE_KEY);
}

// Get cache stats
export function getUrlCacheStats(): { count: number; size: string } {
    if (typeof window === 'undefined') return { count: 0, size: '0 B' };
    const data = localStorage.getItem(URL_CACHE_KEY);
    const size = data ? (data.length * 2) : 0; // UTF-16
    const cache = getUrlCache();
    const kb = size / 1024;
    return {
        count: Object.keys(cache).length,
        size: kb < 1 ? `${size} B` : kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`,
    };
}
