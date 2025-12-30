/**
 * Storage Module
 * ==============
 * 5 Storage Keys:
 * 
 * 1. downaria_settings - All user preferences
 * 2. downaria_cookies - All platform cookies (encrypted)
 * 3. downaria_seasonal - Seasonal effects
 * 4. downaria_queue - Pending downloads queue
 * 5. downaria_ai - AI chat sessions
 */

// ═══════════════════════════════════════════════════════════════
// INDEXEDDB (History)
// ═══════════════════════════════════════════════════════════════

export {
  initStorage,
  closeDB,
  addHistory,
  getHistory,
  getHistoryCount,
  getHistoryByPlatform,
  searchHistory,
  deleteHistory,
  clearHistory,
  exportHistory,
  exportHistoryAsJSON,
  exportHistoryAsBlob,
  downloadHistoryExport,
  importHistory,
  importHistoryFromFile,
  createFullBackup,
  downloadFullBackupAsZip,
  importFullBackupFromZip,
  getCachedMedia,
  setCachedMedia,
  clearExpiredCache,
  clearAllCache,
  getStorageStats,
  type FullBackupData,
  type HistoryEntry,
  type ExportData,
} from './indexed-db';

// ═══════════════════════════════════════════════════════════════
// ENCRYPTED STORAGE
// ═══════════════════════════════════════════════════════════════

export {
  getEncryptedCookies,
  setEncryptedCookies,
  clearAllCookies,
  setEncrypted,
  getEncrypted,
  removeEncrypted,
  isEncrypted,
  type CookieStorage,
} from './crypto';

// ═══════════════════════════════════════════════════════════════
// UNIFIED SETTINGS
// ═══════════════════════════════════════════════════════════════

export {
  STORAGE_KEYS,
  DEFAULT_DISCORD,
  getUnifiedSettings,
  saveUnifiedSettings,
  resetUnifiedSettings,
  getTheme,
  getResolvedTheme,
  getTimeBasedTheme,
  saveTheme,
  applyTheme,
  initTheme,
  cleanupAutoTheme,
  getPlatformCookie,
  savePlatformCookie,
  clearPlatformCookie,
  hasPlatformCookie,
  getAllCookieStatus,
  getSkipCache,
  setSkipCache,
  getLanguagePreference,
  setLanguagePreference,
  getResolvedLocale,
  getDismissedAnnouncements,
  dismissAnnouncement,
  isAnnouncementDismissed,
  getUpdateDismissed,
  setUpdateDismissed,
  getDiscordSettings,
  saveDiscordSettings,
  getUserDiscordSettings,
  saveUserDiscordSettings,
  type DownAriaSettings,
  type DiscordSettings,
  type ThemeType,
  type ResolvedTheme,
  type CookiePlatform,
  type LanguagePreference,
} from './settings';

// ═══════════════════════════════════════════════════════════════
// SEASONAL EFFECTS
// ═══════════════════════════════════════════════════════════════

export {
  getSeasonalSettings,
  saveSeasonalSettings,
  setSeasonalMode,
  setCustomBackground,
  setBackgroundPosition,
  setBackgroundOpacity,
  setBackgroundBlur,
  setCardOpacity,
  setParticleIntensity,
  setParticlesWithBackground,
  setRandomInterval,
  resetSeasonalSettings,
  saveBackgroundBlob,
  getBackgroundBlob,
  deleteBackgroundBlob,
  processBackgroundFile,
  loadBackgroundFromDB,
  clearCustomBackground,
  getCurrentSeason,
  getRandomSeason,
  getCurrentRandomSeason,
  startRandomRotation,
  stopRandomRotation,
  getSeasonEmoji,
  getSeasonName,
  fileToDataUrl,
  formatFileSize,
  isValidImageUrl,
  useSeasonalSettings,
  ACTIVE_SEASONS,
  type UseSeasonalSettingsReturn,
  type SeasonType,
  type BackgroundType,
  type BackgroundPosition,
  type CustomBackground,
  type SeasonalSettings,
} from './seasonal';

// ═══════════════════════════════════════════════════════════════
// CLIENT-SIDE CACHE (Scraper Results)
// ═══════════════════════════════════════════════════════════════

export {
  initCache,
  cacheGet,
  cacheSet,
  cacheDelete,
  clearExpiredCache as clearExpiredClientCache,
  clearAllCache as clearAllClientCache,
  cleanupIfNeeded as cleanupClientCache,
  getCacheStats,
  resetCacheStats,
  extractContentId,
  type CachedResult,
  type CacheStats,
} from './client-cache';
