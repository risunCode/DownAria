/**
 * LocalStorage DB Implementation (Simplified)
 * ===========================================
 * Replaces IndexedDB with simple LocalStorage logic.
 * Enforces strict limits to prevent quota issues.
 * 
 * Storage Keys:
 * - xt_history_v2: Download history array (max 50)
 * - xt_cache_v2: Media cache object (max 20)
 */

import { Platform, MediaFormat } from '@/lib/types';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS & TYPES
// ═══════════════════════════════════════════════════════════════

const HISTORY_KEY = 'xtf_history';
const CACHE_KEY = 'xtf_cache';

const MAX_HISTORY_ITEMS = 50;
const MAX_CACHE_ITEMS = 20;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (reduced from 7 days)

export interface HistoryEntry {
    id: string;
    platform: Platform;
    contentId: string;
    resolvedUrl: string;
    title: string;
    thumbnail: string;
    author: string;
    downloadedAt: number; // timestamp
    quality?: string;
    type?: 'video' | 'image' | 'audio';
}

export interface MediaCacheEntry {
    cacheKey: string;
    platform: Platform;
    contentId: string;
    resolvedUrl: string;
    title: string;
    description?: string;
    thumbnail: string;
    author: string;
    authorName?: string;
    duration?: string;
    engagement?: {
        views?: number;
        likes?: number;
        comments?: number;
        shares?: number;
        reposts?: number;
    };
    formats: MediaFormat[];
    cachedAt: number;
    expiresAt: number;
    usedCookie?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

// Mock DB interface for compatibility if needed, but we'll remove direct DB usage
export async function getDB(): Promise<any> { return null; }
export function closeDB(): void { }

export async function initStorage(): Promise<void> {
    if (typeof window === 'undefined') return;
    // Cleanup expired cache on init
    await clearExpiredCache();
}

/**
 * Migrate not needed anymore (simplification), or could migrate partial data.
 * For now, we start fresh or keep existing simple localstorage data.
 */
export async function migrateFromLocalStorage(): Promise<{ history: number; cache: number }> {
    return { history: 0, cache: 0 };
}

// ═══════════════════════════════════════════════════════════════
// HISTORY OPERATIONS
// ═══════════════════════════════════════════════════════════════

function getStoredHistory(): HistoryEntry[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveStoredHistory(items: HistoryEntry[]) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
    } catch (e) {
        console.warn('LocalStorage full, clearing oldest history');
        // If full, keep only top 10
        localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 10)));
    }
}

export async function addHistory(entry: Omit<HistoryEntry, 'id' | 'downloadedAt'>): Promise<string> {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2)}`;
    const fullEntry: HistoryEntry = {
        ...entry,
        id,
        downloadedAt: Date.now(),
    };

    const history = getStoredHistory();
    // Add to beginning
    history.unshift(fullEntry);

    // Trim
    if (history.length > MAX_HISTORY_ITEMS) {
        history.length = MAX_HISTORY_ITEMS;
    }

    saveStoredHistory(history);
    return id;
}

export async function getHistory(limit = 100): Promise<HistoryEntry[]> {
    const history = getStoredHistory();
    return history.slice(0, limit);
}

export async function getHistoryByPlatform(platform: Platform): Promise<HistoryEntry[]> {
    const history = getStoredHistory();
    return history.filter(h => h.platform === platform);
}

export async function searchHistory(query: string): Promise<HistoryEntry[]> {
    const history = getStoredHistory();
    const q = query.toLowerCase();
    return history.filter(h =>
        h.title.toLowerCase().includes(q) ||
        h.author.toLowerCase().includes(q)
    );
}

export async function deleteHistory(id: string): Promise<void> {
    let history = getStoredHistory();
    history = history.filter(h => h.id !== id);
    saveStoredHistory(history);
}

export async function clearHistory(): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(HISTORY_KEY);
}

// ═══════════════════════════════════════════════════════════════
// MEDIA CACHE OPERATIONS
// ═══════════════════════════════════════════════════════════════

function getStoredCache(): Record<string, MediaCacheEntry> {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveStoredCache(cache: Record<string, MediaCacheEntry>) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.warn('LocalStorage full, clearing cache');
        localStorage.removeItem(CACHE_KEY);
    }
}

export async function getCachedMedia(cacheKey: string): Promise<MediaCacheEntry | null> {
    const cache = getStoredCache();
    const entry = cache[cacheKey];

    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
        delete cache[cacheKey];
        saveStoredCache(cache);
        return null;
    }

    return entry;
}

export async function getCachedMediaByUrl(
    platform: Platform,
    url: string,
    extractContentId: (p: Platform, u: string) => string | null
): Promise<MediaCacheEntry | null> {
    const contentId = extractContentId(platform, url);
    if (!contentId) return null;

    const cacheKey = `${platform}:${contentId}`;
    return getCachedMedia(cacheKey);
}

export async function setCachedMedia(entry: Omit<MediaCacheEntry, 'cachedAt' | 'expiresAt'>): Promise<void> {
    const cache = getStoredCache();
    const now = Date.now();

    // Clean expired first
    let hasChanges = false;
    Object.keys(cache).forEach(key => {
        if (cache[key].expiresAt < now) {
            delete cache[key];
            hasChanges = true;
        }
    });

    // Enforce LRU-like limit (by just deleting random/oldest if too big)
    const keys = Object.keys(cache);
    if (keys.length >= MAX_CACHE_ITEMS) {
        // Delete oldest by cachedAt
        const sorted = keys.sort((a, b) => cache[a].cachedAt - cache[b].cachedAt);
        // Remove oldest 5
        sorted.slice(0, 5).forEach(k => delete cache[k]);
        hasChanges = true;
    }

    cache[entry.cacheKey] = {
        ...entry,
        cachedAt: now,
        expiresAt: now + CACHE_TTL_MS
    };

    saveStoredCache(cache);
}

export async function deleteCachedMedia(cacheKey: string): Promise<void> {
    const cache = getStoredCache();
    if (cache[cacheKey]) {
        delete cache[cacheKey];
        saveStoredCache(cache);
    }
}

export async function clearExpiredCache(): Promise<number> {
    const cache = getStoredCache();
    const now = Date.now();
    let count = 0;

    Object.keys(cache).forEach(key => {
        if (cache[key].expiresAt < now) {
            delete cache[key];
            count++;
        }
    });

    if (count > 0) saveStoredCache(cache);
    return count;
}

export async function clearCacheByPlatform(platform: Platform): Promise<number> {
    const cache = getStoredCache();
    let count = 0;

    Object.keys(cache).forEach(key => {
        if (cache[key].platform === platform) {
            delete cache[key];
            count++;
        }
    });

    if (count > 0) saveStoredCache(cache);
    return count;
}

export async function clearAllCache(): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CACHE_KEY);
}

export async function getCacheStats(): Promise<{
    count: number;
    platforms: Record<string, number>;
    oldestEntry: number | null;
    newestEntry: number | null;
}> {
    const cache = getStoredCache();
    const keys = Object.keys(cache);
    const platforms: Record<string, number> = {};
    let oldest: number | null = null;
    let newest: number | null = null;

    keys.forEach(key => {
        const entry = cache[key];
        platforms[entry.platform] = (platforms[entry.platform] || 0) + 1;

        if (oldest === null || entry.cachedAt < oldest) oldest = entry.cachedAt;
        if (newest === null || entry.cachedAt > newest) newest = entry.cachedAt;
    });

    return {
        count: keys.length,
        platforms,
        oldestEntry: oldest,
        newestEntry: newest
    };
}
