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
} from '@/lib/supabase';

// ═══════════════════════════════════════════════════════════════
// CACHING
// ═══════════════════════════════════════════════════════════════

export {
    getCache,
    setCache,
    clearCache,
    getCacheStats,
} from '@/lib/services/cache';

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
} from '@/lib/services/api-keys';

// ═══════════════════════════════════════════════════════════════
// SERVICE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export {
    // Platform status
    isPlatformEnabled,
    getPlatformDisabledMessage,

    // Maintenance mode
    isMaintenanceMode,
    getMaintenanceMessage,

    // Rate limits
    getGlobalRateLimit,

    // Request tracking
    recordRequest,

    // Types
    type PlatformId,
    type PlatformConfig,
} from '@/lib/services/service-config';
