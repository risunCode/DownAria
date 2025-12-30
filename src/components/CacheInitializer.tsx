'use client';

/**
 * CacheInitializer
 * ================
 * Initializes client-side IndexedDB cache on app start.
 * Runs cleanup of expired entries.
 */

import { useEffect } from 'react';
import { initCache, cleanupClientCache } from '@/lib/storage';

export function CacheInitializer() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initialize cache and cleanup expired entries
    initCache()
      .then(() => cleanupClientCache())
      .catch(() => {
        // Silently fail - cache is optional enhancement
      });
  }, []);

  return null;
}
