/**
 * Storage Module
 * ==============
 * Unified storage interface.
 * 
 * - IndexedDB: History, Media Cache (large data)
 * - LocalStorage: Theme, Settings, Cookies (small data)
 * 
 * Usage:
 *   import { initStorage, addHistory, getCachedMedia } from '@/lib/storage';
 *   import { getTheme, saveSettings } from '@/lib/storage';
 */

// ═══════════════════════════════════════════════════════════════
// INDEXEDDB (Large data)
// ═══════════════════════════════════════════════════════════════

export {
  // Initialization
  initStorage,
  getDB,
  closeDB,

  // History
  addHistory,
  getHistory,
  getHistoryByPlatform,
  searchHistory,
  deleteHistory,
  clearHistory,

  // Media Cache
  getCachedMedia,
  getCachedMediaByUrl,
  setCachedMedia,
  deleteCachedMedia,
  clearExpiredCache,
  clearCacheByPlatform,
  clearAllCache,
  getCacheStats,

  // Migration
  migrateFromLocalStorage,

  // Types
  type HistoryEntry,
  type MediaCacheEntry,
} from './local-storage-db';

// ═══════════════════════════════════════════════════════════════
// LOCALSTORAGE (Small data)
// ═══════════════════════════════════════════════════════════════

export {
  // Theme
  getTheme,
  saveTheme,
  applyTheme,
  initTheme,
  type ThemeType,

  // App Settings
  getSettings,
  saveSettings,
  resetSettings,
  type AppSettings,

  // Platform Cookies
  getPlatformCookie,
  savePlatformCookie,
  clearPlatformCookie,
  hasPlatformCookie,
  getAllCookieStatus,
  type CookiePlatform,

  // Legacy aliases
  getWeiboCookie,
  saveWeiboCookie,
  clearWeiboCookie,
  hasValidWeiboCookie,

  // Skip Cache
  getSkipCache,
  setSkipCache,
} from './settings';
