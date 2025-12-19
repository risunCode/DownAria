/**
 * Core Database Module
 * ====================
 * Centralized database access and services.
 * 
 * This module consolidates:
 * - lib/supabase.ts (Supabase clients)
 * - lib/services/cache.ts (Response caching)
 * - lib/services/api-keys.ts (API key management)
 * - lib/services/service-config.ts (Service configuration)
 * 
 * Usage:
 *   import { supabase, supabaseAdmin, getCache, setCache } from '@/core/database';
 */

// ═══════════════════════════════════════════════════════════════
// SUPABASE CLIENTS
// ═══════════════════════════════════════════════════════════════

// Re-export Supabase clients and helpers
export {
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
    getCountryFromHeaders,
    type Platform,
    type Quality,
} from '@/lib/supabase';

// ═══════════════════════════════════════════════════════════════
// CACHING
// ═══════════════════════════════════════════════════════════════

export {
    getCache,
    setCache,
    clearCache,
    getCacheStats,
} from '@/lib/services/helper/cache';

// ═══════════════════════════════════════════════════════════════
// API KEYS
// ═══════════════════════════════════════════════════════════════

export {
    // Key validation
    validateApiKey,
    extractApiKey,

    // CRUD operations
    createApiKey,
    getApiKey,
    getAllApiKeys,
    updateApiKey,
    deleteApiKey,
    regenerateApiKey,

    // Usage tracking
    recordKeyUsage,
    resetKeyStats,
} from '@/lib/services/helper/api-keys';

// ═══════════════════════════════════════════════════════════════
// SERVICE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export {
    // Platform status
    isPlatformEnabled,
    getPlatformDisabledMessage,
    getPlatformConfig,
    getAllPlatforms,

    // Maintenance mode
    isMaintenanceMode,
    getMaintenanceMessage,

    // Rate limits
    getGlobalRateLimit,
    getPlaygroundRateLimit,

    // Config getters
    getServiceConfig,
    getServiceConfigAsync,
    loadConfigFromDB,

    // Config setters
    setPlatformEnabled,
    setMaintenanceMode,
    setMaintenanceMessage,
    setGlobalRateLimit,
    setPlaygroundEnabled,
    setPlaygroundRateLimit,
    setApiKeyRequired,
    updatePlatformConfig,
    isApiKeyRequired,
    isPlaygroundEnabled,

    // Request tracking
    recordRequest,

    // Stats
    resetPlatformStats,
    resetAllStats,
    resetToDefaults,

    // Types
    type PlatformId,
    type PlatformConfig,
    type ServiceConfig,
} from '@/lib/services/helper/service-config';
