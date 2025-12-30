/**
 * Client-Side Cache Module
 * ========================
 * Caches scraper results in IndexedDB to reduce API calls.
 * Replaces server-side Redis caching for web frontend.
 * 
 * Benefits:
 * - Instant cache hits (~5ms vs ~100ms Redis)
 * - Zero server cost
 * - Works offline
 * - Per-user storage
 * 
 * TTL Strategy:
 * - YouTube: 2 minutes (URLs expire quickly)
 * - Stories: 10 minutes (ephemeral content)
 * - Other content: 30 minutes (balance freshness)
 */

import type { PlatformId } from '@/lib/types';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface CachedResult {
  /** Cache key: platform:contentId */
  key: string;
  /** Platform identifier */
  platform: PlatformId;
  /** Content ID extracted from URL */
  contentId: string;
  /** Original URL */
  url: string;
  /** Scraper result data */
  data: unknown;
  /** When cached (timestamp) */
  cachedAt: number;
  /** When expires (timestamp) */
  expiresAt: number;
  /** Access count for stats */
  accessCount: number;
  /** Last access time */
  lastAccess: number;
}

export interface CacheStats {
  /** Total cached items */
  count: number;
  /** Cache hits */
  hits: number;
  /** Cache misses */
  misses: number;
  /** Hit rate percentage */
  hitRate: string;
  /** Estimated storage size */
  size: string;
  /** Items by platform */
  byPlatform: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// TTL CONFIGURATION (in milliseconds)
// ═══════════════════════════════════════════════════════════════

const TTL_CONFIG: Record<PlatformId, number> = {
  youtube: 2 * 60 * 1000,      // 2 minutes - URLs expire quickly
  instagram: 30 * 60 * 1000,   // 30 minutes
  facebook: 30 * 60 * 1000,    // 30 minutes
  tiktok: 30 * 60 * 1000,      // 30 minutes
  twitter: 30 * 60 * 1000,     // 30 minutes
  weibo: 30 * 60 * 1000,       // 30 minutes
  bilibili: 30 * 60 * 1000,    // 30 minutes
  reddit: 30 * 60 * 1000,      // 30 minutes
  soundcloud: 30 * 60 * 1000,  // 30 minutes
  threads: 30 * 60 * 1000,     // 30 minutes
  pixiv: 30 * 60 * 1000,       // 30 minutes
  erome: 30 * 60 * 1000,       // 30 minutes
  eporner: 30 * 60 * 1000,     // 30 minutes
  pornhub: 30 * 60 * 1000,     // 30 minutes
  rule34video: 30 * 60 * 1000, // 30 minutes
};

/** TTL for stories (shorter) */
const STORY_TTL = 10 * 60 * 1000; // 10 minutes

/** Max cache entries before cleanup */
const MAX_CACHE_ENTRIES = 200;

/** Probability of cleanup after write (10% = 0.1) */
const CLEANUP_PROBABILITY = 0.1;

/** Stats storage key */
const STATS_KEY = 'downaria_cache_stats';

// ═══════════════════════════════════════════════════════════════
// DATABASE SETUP
// ═══════════════════════════════════════════════════════════════

const DB_NAME = 'downaria_cache';
const DB_VERSION = 1;
const CACHE_STORE = 'scraper_cache';

let db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains(CACHE_STORE)) {
        const store = database.createObjectStore(CACHE_STORE, { keyPath: 'key' });
        store.createIndex('platform', 'platform', { unique: false });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
        store.createIndex('lastAccess', 'lastAccess', { unique: false });
      }
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// CONTENT ID EXTRACTION
// ═══════════════════════════════════════════════════════════════

const CONTENT_ID_EXTRACTORS: Record<PlatformId, (url: string) => string | null> = {
  twitter: (url) => {
    const match = url.match(/status(?:es)?\/(\d+)/i);
    return match ? match[1] : null;
  },
  
  instagram: (url) => {
    const shortcode = url.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
    if (shortcode) return shortcode[1];
    const storyId = url.match(/\/stories\/[^/]+\/(\d+)/i);
    if (storyId) return `story:${storyId[1]}`;
    return null;
  },
  
  facebook: (url) => {
    const videoId = url.match(/\/(?:videos?|watch|reel)\/(\d+)/i);
    if (videoId) return videoId[1];
    const watchParam = url.match(/[?&]v=(\d+)/i);
    if (watchParam) return watchParam[1];
    const storyFbid = url.match(/story_fbid=(\d+)/i);
    if (storyFbid) return storyFbid[1];
    const pfbid = url.match(/pfbid([A-Za-z0-9]+)/i);
    if (pfbid) return `pfbid${pfbid[1]}`;
    const shareId = url.match(/\/share\/[prvs]\/([A-Za-z0-9]+)/i);
    if (shareId) return `share:${shareId[1]}`;
    const storyId = url.match(/\/stories\/[^/]+\/(\d+)/i);
    if (storyId) return `story:${storyId[1]}`;
    return null;
  },
  
  tiktok: (url) => {
    const videoId = url.match(/\/video\/(\d+)/i);
    if (videoId) return videoId[1];
    const fullUrl = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i);
    if (fullUrl) return fullUrl[1];
    return null;
  },
  
  youtube: (url) => {
    const watchId = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (watchId) return watchId[1];
    const shortId = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortId) return shortId[1];
    const shortsId = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsId) return shortsId[1];
    return null;
  },
  
  weibo: (url) => {
    const longId = url.match(/\/(\d{16,})/);
    if (longId) return longId[1];
    const detail = url.match(/\/(?:detail|status)\/(\d+)/i);
    if (detail) return detail[1];
    return null;
  },
  
  // New platforms - generic ID extraction
  bilibili: (url) => {
    const bvId = url.match(/\/video\/(BV[a-zA-Z0-9]+)/i);
    if (bvId) return bvId[1];
    const avId = url.match(/\/video\/av(\d+)/i);
    if (avId) return `av${avId[1]}`;
    return null;
  },
  
  reddit: (url) => {
    const postId = url.match(/\/comments\/([a-z0-9]+)/i);
    return postId ? postId[1] : null;
  },
  
  soundcloud: (url) => {
    const trackPath = url.match(/soundcloud\.com\/([^/]+\/[^/?]+)/i);
    return trackPath ? trackPath[1].replace('/', ':') : null;
  },
  
  threads: (url) => {
    const postId = url.match(/\/post\/([A-Za-z0-9_-]+)/i);
    return postId ? postId[1] : null;
  },
  
  pixiv: (url) => {
    const artworkId = url.match(/\/artworks\/(\d+)/i);
    return artworkId ? artworkId[1] : null;
  },
  
  erome: (url) => {
    const albumId = url.match(/\/a\/([A-Za-z0-9]+)/i);
    return albumId ? albumId[1] : null;
  },
  
  eporner: (url) => {
    const videoId = url.match(/\/video-([a-zA-Z0-9]+)/i);
    return videoId ? videoId[1] : null;
  },
  
  pornhub: (url) => {
    const viewkey = url.match(/viewkey=([a-zA-Z0-9]+)/i);
    return viewkey ? viewkey[1] : null;
  },
  
  rule34video: (url) => {
    const postId = url.match(/\/post\/(\d+)/i);
    return postId ? postId[1] : null;
  },
};

/**
 * Extract content ID from URL
 */
export function extractContentId(platform: PlatformId, url: string): string | null {
  const extractor = CONTENT_ID_EXTRACTORS[platform];
  return extractor ? extractor(url) : null;
}

/**
 * Generate cache key
 */
function generateCacheKey(platform: PlatformId, contentId: string): string {
  return `${platform}:${contentId}`;
}

/**
 * Check if content is a story (shorter TTL)
 */
function isStoryContent(url: string, contentId: string): boolean {
  return url.includes('/stories/') || contentId.startsWith('story:');
}

// ═══════════════════════════════════════════════════════════════
// STATS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

interface InternalStats {
  hits: number;
  misses: number;
}

function getStats(): InternalStats {
  if (typeof window === 'undefined') return { hits: 0, misses: 0 };
  try {
    const stored = localStorage.getItem(STATS_KEY);
    return stored ? JSON.parse(stored) : { hits: 0, misses: 0 };
  } catch {
    return { hits: 0, misses: 0 };
  }
}

function saveStats(stats: InternalStats): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch { /* ignore */ }
}

function trackHit(): void {
  const stats = getStats();
  stats.hits++;
  saveStats(stats);
}

function trackMiss(): void {
  const stats = getStats();
  stats.misses++;
  saveStats(stats);
}

// ═══════════════════════════════════════════════════════════════
// CORE CACHE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get cached result
 */
export async function cacheGet<T>(platform: PlatformId, url: string): Promise<T | null> {
  try {
    const contentId = extractContentId(platform, url);
    if (!contentId) {
      trackMiss();
      return null;
    }
    
    const database = await openDB();
    const key = generateCacheKey(platform, contentId);
    
    return new Promise((resolve) => {
      const tx = database.transaction(CACHE_STORE, 'readwrite');
      const store = tx.objectStore(CACHE_STORE);
      const request = store.get(key);
      
      request.onsuccess = () => {
        const entry = request.result as CachedResult | undefined;
        
        if (!entry) {
          trackMiss();
          resolve(null);
          return;
        }
        
        // Check expiry
        if (Date.now() > entry.expiresAt) {
          // Delete expired entry
          store.delete(key);
          trackMiss();
          resolve(null);
          return;
        }
        
        // Update access stats
        entry.accessCount++;
        entry.lastAccess = Date.now();
        store.put(entry);
        
        trackHit();
        resolve(entry.data as T);
      };
      
      request.onerror = () => {
        trackMiss();
        resolve(null);
      };
    });
  } catch {
    trackMiss();
    return null;
  }
}

/**
 * Set cached result
 */
export async function cacheSet<T>(
  platform: PlatformId,
  url: string,
  data: T,
  isStory = false
): Promise<void> {
  try {
    const contentId = extractContentId(platform, url);
    if (!contentId) return;
    
    const database = await openDB();
    const key = generateCacheKey(platform, contentId);
    const now = Date.now();
    
    // Determine TTL
    const ttl = isStory || isStoryContent(url, contentId)
      ? STORY_TTL
      : TTL_CONFIG[platform] || 30 * 60 * 1000;
    
    const entry: CachedResult = {
      key,
      platform,
      contentId,
      url,
      data,
      cachedAt: now,
      expiresAt: now + ttl,
      accessCount: 1,
      lastAccess: now,
    };
    
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(CACHE_STORE, 'readwrite');
      const store = tx.objectStore(CACHE_STORE);
      const request = store.put(entry);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Probabilistic cleanup (10% chance after each write)
    // This prevents expired entries from accumulating
    if (Math.random() < CLEANUP_PROBABILITY) {
      cleanupIfNeeded().catch(() => {});
    }
  } catch {
    // Silently fail - cache is optional
  }
}

/**
 * Delete specific cache entry
 */
export async function cacheDelete(platform: PlatformId, url: string): Promise<void> {
  try {
    const contentId = extractContentId(platform, url);
    if (!contentId) return;
    
    const database = await openDB();
    const key = generateCacheKey(platform, contentId);
    
    return new Promise((resolve) => {
      const tx = database.transaction(CACHE_STORE, 'readwrite');
      const store = tx.objectStore(CACHE_STORE);
      store.delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════
// CLEANUP FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
  try {
    const database = await openDB();
    const now = Date.now();
    let cleared = 0;
    
    return new Promise((resolve) => {
      const tx = database.transaction(CACHE_STORE, 'readwrite');
      const store = tx.objectStore(CACHE_STORE);
      const index = store.index('expiresAt');
      const range = IDBKeyRange.upperBound(now);
      
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cleared++;
          cursor.continue();
        }
      };
      
      tx.oncomplete = () => resolve(cleared);
      tx.onerror = () => resolve(cleared);
    });
  } catch {
    return 0;
  }
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  try {
    const database = await openDB();
    
    return new Promise((resolve) => {
      const tx = database.transaction(CACHE_STORE, 'readwrite');
      const store = tx.objectStore(CACHE_STORE);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}

/**
 * Cleanup old entries if over limit (LRU eviction)
 */
export async function cleanupIfNeeded(): Promise<number> {
  try {
    const database = await openDB();
    
    // First clear expired
    const expiredCleared = await clearExpiredCache();
    
    // Check count
    const count = await new Promise<number>((resolve) => {
      const tx = database.transaction(CACHE_STORE, 'readonly');
      const store = tx.objectStore(CACHE_STORE);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
    
    if (count <= MAX_CACHE_ENTRIES) {
      return expiredCleared;
    }
    
    // Need to evict oldest entries
    const toDelete = count - MAX_CACHE_ENTRIES + 20; // Delete 20 extra for buffer
    let deleted = 0;
    
    return new Promise((resolve) => {
      const tx = database.transaction(CACHE_STORE, 'readwrite');
      const store = tx.objectStore(CACHE_STORE);
      const index = store.index('lastAccess');
      
      const request = index.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && deleted < toDelete) {
          cursor.delete();
          deleted++;
          cursor.continue();
        }
      };
      
      tx.oncomplete = () => resolve(expiredCleared + deleted);
      tx.onerror = () => resolve(expiredCleared);
    });
  } catch {
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<CacheStats> {
  const defaultStats: CacheStats = {
    count: 0,
    hits: 0,
    misses: 0,
    hitRate: '0%',
    size: '0 KB',
    byPlatform: {},
  };
  
  try {
    const database = await openDB();
    const internalStats = getStats();
    
    // Count entries by platform
    const byPlatform: Record<string, number> = {};
    let count = 0;
    
    await new Promise<void>((resolve) => {
      const tx = database.transaction(CACHE_STORE, 'readonly');
      const store = tx.objectStore(CACHE_STORE);
      
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const entry = cursor.value as CachedResult;
          count++;
          byPlatform[entry.platform] = (byPlatform[entry.platform] || 0) + 1;
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => resolve();
    });
    
    // Calculate hit rate
    const total = internalStats.hits + internalStats.misses;
    const hitRate = total > 0 
      ? `${((internalStats.hits / total) * 100).toFixed(1)}%`
      : '0%';
    
    // Estimate storage size
    let size = '0 KB';
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.usage) {
          const kb = estimate.usage / 1024;
          size = kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
        }
      } catch { /* ignore */ }
    }
    
    return {
      count,
      hits: internalStats.hits,
      misses: internalStats.misses,
      hitRate,
      size,
      byPlatform,
    };
  } catch {
    return defaultStats;
  }
}

/**
 * Reset cache statistics
 */
export function resetCacheStats(): void {
  saveStats({ hits: 0, misses: 0 });
}

// ═══════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════

/** Track if visibility listener is registered */
let visibilityListenerRegistered = false;

/**
 * Initialize cache (call on app start)
 * - Opens IndexedDB connection
 * - Cleans up expired entries
 * - Sets up visibility-based cleanup (runs when user returns to tab)
 */
export async function initCache(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    await openDB();
    // Cleanup expired entries on init
    await clearExpiredCache();
    
    // Register visibility change listener (only once)
    // This cleans up expired entries when user returns to the tab
    if (!visibilityListenerRegistered) {
      visibilityListenerRegistered = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // User returned to tab - cleanup expired entries
          clearExpiredCache().catch(() => {});
        }
      });
    }
  } catch (err) {
    console.warn('[ClientCache] Init failed:', err);
  }
}
