/**
 * Storage Module
 * ==============
 * Unified storage interface.
 * 
 * - IndexedDB: History, Media Cache (unlimited, local)
 * - LocalStorage: Theme, Settings, Cookies (small data)
 * 
 * Usage:
 *   import { initStorage, addHistory, getCachedMedia } from '@/lib/storage';
 *   import { getTheme, saveSettings } from '@/lib/storage';
 *   import { exportHistoryAsJSON, importHistoryFromFile } from '@/lib/storage';
 */

// ═══════════════════════════════════════════════════════════════
// INDEXEDDB (Large data - unlimited history)
// ═══════════════════════════════════════════════════════════════

export {
  // Initialization
  initStorage,
  closeDB,

  // History
  addHistory,
  getHistory,
  getHistoryCount,
  getHistoryByPlatform,
  searchHistory,
  deleteHistory,
  clearHistory,

  // Export / Import
  exportHistory,
  exportHistoryAsJSON,
  exportHistoryAsBlob,
  downloadHistoryExport,
  importHistory,
  importHistoryFromFile,
  
  // Full Backup (ZIP)
  createFullBackup,
  downloadFullBackupAsZip,
  importFullBackupFromZip,
  type FullBackupData,

  // Media Cache (deprecated - Redis handles caching now)
  getCachedMedia,
  setCachedMedia,
  clearExpiredCache,
  clearAllCache,

  // Stats
  getStorageStats,

  // Types
  type HistoryEntry,
  type ExportData,
} from './indexed-db';

// ═══════════════════════════════════════════════════════════════
// ENCRYPTED STORAGE
// ═══════════════════════════════════════════════════════════════

export {
  setEncrypted,
  getEncrypted,
  removeEncrypted,
  isEncrypted,
  migrateToEncrypted,
} from './crypto';

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

  // Language
  getLanguagePreference,
  setLanguagePreference,
  getResolvedLocale,
  type LanguagePreference,
} from './settings';
