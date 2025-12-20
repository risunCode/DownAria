// Admin Hooks - Barrel Export

export { useAdminFetch, ADMIN_SWR_CONFIG } from './useAdminFetch';
export { useServices } from './useServices';
export { useCookies, useCookieStats, type CookiePoolStats, type PooledCookie } from './useCookies';
export { useUserAgents, useUserAgentStats, type UserAgentPoolStats, type PooledUserAgent } from './useUserAgents';
export { useBrowserProfiles, PLATFORM_OPTIONS, BROWSER_OPTIONS, DEVICE_OPTIONS, OS_OPTIONS, type BrowserProfile, type BrowserProfileStats, type BrowserProfileTotals, type CreateProfileInput } from './useBrowserProfiles';
export { useApiKeys, type ApiKey, type CreateKeyOptions } from './useApiKeys';
export { useStats, getCountryFlag, PLATFORM_COLORS, type DashboardStats } from './useStats';
export { useSettings, type GlobalSettings } from './useSettings';
export { useUsers, type User, type UserFilters } from './useUsers';
export { useAlerts, type AlertConfig, type HealthCheckResult } from './useAlerts';
