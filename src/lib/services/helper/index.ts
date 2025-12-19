/**
 * Core Services Barrel Export
 * Non-scraper utilities: config, cache, keys, logging
 * 
 * NOTE: HTTP/fetch utilities are now in @/lib/http (Axios-based)
 */

// Platform config
export {
    detectPlatform, matchesPlatform, isPlatformUrl,
    getPlatformConfig, getPlatformRegex, getPlatformAliases,
    getBaseUrl, getReferer, getOrigin, getApiEndpoint,
    PLATFORM_CONFIGS,
    type PlatformId, type PlatformConfig,
} from './api-config';

// Cache (Supabase)
export {
    getCache, setCache, hasCache, clearCache,
    getCacheStats, cleanupCache, getCacheKey,
} from './cache';

// API Keys
export {
    validateApiKey, extractApiKey,
    createApiKey, getApiKey, getAllApiKeys,
    updateApiKey, deleteApiKey, regenerateApiKey,
    recordKeyUsage, resetKeyStats,
} from './api-keys';

// Service Config
export {
    isPlatformEnabled, getPlatformDisabledMessage,
    getPlatformConfig as getServicePlatformConfig,
    getAllPlatforms, isMaintenanceMode, getMaintenanceMessage,
    getGlobalRateLimit, getPlaygroundRateLimit,
    getServiceConfig, getServiceConfigAsync, loadConfigFromDB,
    setPlatformEnabled, setMaintenanceMode, setMaintenanceMessage, setGlobalRateLimit,
    setPlaygroundEnabled, setPlaygroundRateLimit, setApiKeyRequired,
    updatePlatformConfig, isApiKeyRequired, isPlaygroundEnabled,
    recordRequest, resetPlatformStats, resetAllStats, resetToDefaults,
    type PlatformId as ServicePlatformId,
    type PlatformConfig as ServicePlatformConfig,
    type ServiceConfig,
} from './service-config';

// Logger
export { logger } from './logger';
