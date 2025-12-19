/**
 * Cookies Module - Parsing, pool rotation, admin management
 */

// Parsing
export { parseCookie, validateCookie, isCookieLike, getCookieFormat } from '@/lib/utils/cookie-parser';

// Pool rotation & management
export {
    getRotatingCookie,
    markCookieSuccess,
    markCookieCooldown,
    markCookieExpired,
    getCookiePoolStats,
    getCookiesByPlatform,
    addCookieToPool,
    updatePooledCookie,
    deleteCookieFromPool,
    testCookieHealth,
    type CookiePoolStats,
    type PooledCookie,
    type CookieStatus,
} from '@/lib/utils/cookie-pool';

// Admin cookies (legacy single cookie)
export {
    getAdminCookie,
    hasAdminCookie,
    getAllAdminCookies,
    setAdminCookie,
    toggleAdminCookie,
    deleteAdminCookie,
    clearAdminCookieCache,
    type CookiePlatform,
} from '@/lib/utils/admin-cookie';
