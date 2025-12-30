/**
 * useScraperCache Hook
 * ====================
 * Wraps scraper API calls with client-side IndexedDB caching.
 * 
 * Flow:
 * 1. Check IndexedDB cache first
 * 2. If cache hit → return cached data (instant)
 * 3. If cache miss → call API → cache result → return
 * 
 * Benefits:
 * - Instant cache hits (~5ms vs ~100ms+ API)
 * - Zero server cost for repeated requests
 * - Works offline for cached content
 * - Reduces Redis usage on backend
 */

import { useCallback, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { 
  initCache, 
  cacheGet, 
  cacheSet, 
  cleanupClientCache,
  extractContentId 
} from '@/lib/storage';
import { platformDetect } from '@/lib/utils/format';
import type { PlatformId, MediaData } from '@/lib/types';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface ScraperResponse {
  success: boolean;
  data?: MediaData;
  error?: string;
  errorCode?: string;
  platform?: string;
}

interface UseScraperCacheOptions {
  /** Skip cache and always fetch fresh (default: false) */
  skipCache?: boolean;
}

interface ScraperResult {
  success: boolean;
  data?: MediaData;
  error?: string;
  errorCode?: string;
  fromCache?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export function useScraperCache(options: UseScraperCacheOptions = {}) {
  const initialized = useRef(false);

  // Initialize cache on mount
  useEffect(() => {
    if (!initialized.current && typeof window !== 'undefined') {
      initialized.current = true;
      initCache().then(() => {
        // Cleanup old entries periodically
        cleanupClientCache();
      });
    }
  }, []);

  /**
   * Fetch media with caching
   */
  const fetchWithCache = useCallback(async (
    url: string,
    cookie?: string,
    forceSkipCache = false
  ): Promise<ScraperResult> => {
    const platform = platformDetect(url) as PlatformId | null;
    const skipCache = options.skipCache || forceSkipCache;

    // Try cache first (if not skipping)
    if (!skipCache && platform) {
      const contentId = extractContentId(platform, url);
      
      if (contentId) {
        try {
          const cached = await cacheGet<MediaData>(platform, url);
          if (cached) {
            return {
              success: true,
              data: cached,
              fromCache: true,
            };
          }
        } catch {
          // Cache error - continue to API
        }
      }
    }

    // Fetch from API
    try {
      const result = await api.post<ScraperResponse>('/api/v1/publicservices', {
        url,
        cookie,
        skipCache: true, // Always skip server cache - we handle caching client-side
      });

      // Cache successful result
      if (result.success && result.data && platform) {
        const isStory = url.includes('/stories/');
        cacheSet(platform, url, result.data, isStory).catch(() => {
          // Silently fail - caching is optional
        });
      }

      return {
        success: result.success,
        data: result.data,
        error: result.error,
        errorCode: result.errorCode,
        fromCache: false,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed',
        fromCache: false,
      };
    }
  }, [options.skipCache]);

  return { fetchWithCache };
}

// ═══════════════════════════════════════════════════════════════
// STANDALONE FUNCTION (for non-hook usage)
// ═══════════════════════════════════════════════════════════════

/**
 * Fetch media with caching (standalone function)
 * Use this when you can't use hooks (e.g., in event handlers)
 */
export async function fetchMediaWithCache(
  url: string,
  cookie?: string,
  skipCache = false
): Promise<ScraperResult> {
  const platform = platformDetect(url) as PlatformId | null;

  // Try cache first
  if (!skipCache && platform) {
    try {
      const cached = await cacheGet<MediaData>(platform, url);
      if (cached) {
        return {
          success: true,
          data: cached,
          fromCache: true,
        };
      }
    } catch {
      // Cache error - continue to API
    }
  }

  // Fetch from API
  try {
    const result = await api.post<ScraperResponse>('/api/v1/publicservices', {
      url,
      cookie,
      skipCache: true,
    });

    // Cache successful result
    if (result.success && result.data && platform) {
      const isStory = url.includes('/stories/');
      cacheSet(platform, url, result.data, isStory).catch(() => {});
    }

    return {
      success: result.success,
      data: result.data,
      error: result.error,
      errorCode: result.errorCode,
      fromCache: false,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Request failed',
      fromCache: false,
    };
  }
}
