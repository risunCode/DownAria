/**
 * Core Module - Main Entry Point
 * ===============================
 * Central export for all core domain logic.
 * 
 * Structure:
 * - core/scrapers - Platform-specific scrapers
 * - core/security - Security utilities
 * - core/database - Database access and services
 * - core/config - Configuration and constants
 * 
 * Usage:
 *   import { scrapeFacebook, encrypt, supabase, PLATFORMS } from '@/core';
 * 
 * Or import from submodules:
 *   import { getScraper } from '@/core/scrapers';
 *   import { rateLimit } from '@/core/security';
 */

// Scrapers (includes PlatformId)
export * from './scrapers';

// Security
export * from './security';

// Database (exclude PlatformId to avoid duplicate)
export {
    // Supabase
    supabase,
    supabaseAdmin,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    getSession,
    getUser,
    isAdmin,
    trackDownload,
    trackError,
    getStats,
    getDownloadsByPlatform,
    getDownloadsByCountry,
    getDownloadsBySource,
    getSuccessRate,
    getRecentErrors,

    // Cache
    getCache,
    setCache,
    clearCache,
    getCacheStats,

    // API Keys
    validateApiKey,
    extractApiKey,
    createApiKey,
    getApiKey,
    getAllApiKeys,
    updateApiKey,
    deleteApiKey,
    regenerateApiKey,
    recordKeyUsage,
    resetKeyStats,

    // Service Config
    isPlatformEnabled,
    getPlatformDisabledMessage,
    isMaintenanceMode,
    getMaintenanceMessage,
    getGlobalRateLimit,
    recordRequest,
    type PlatformConfig,
} from './database';

// Config (exclude PlatformId to avoid conflict with scrapers/types)
export {
    matchesPlatform,
    detectPlatform,
    isPlatformUrl,
    getPlatformRegex,
    getPlatformAliases,
    PLATFORM_CONFIGS,
    getApiPlatformConfig,
    getBaseUrl,
    getReferer,
    getOrigin,
    getApiEndpoint,
    type ApiPlatformConfig,
    // Env helpers
    getEnv,
    getEnvOptional,
    isProduction,
    isDevelopment,
    // Constants
    APP_NAME,
    APP_VERSION,
    APP_DESCRIPTION,
    CACHE_TTL,
    TIMEOUTS,
    RATE_LIMIT_WINDOWS,
    ALLOWED_SOCIAL_DOMAINS,
    ALLOWED_CDN_DOMAINS,
} from './config';

// Logger
export { logger } from '@/lib/services/helper/logger';
