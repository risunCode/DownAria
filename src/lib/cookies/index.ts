/**
 * Cookies Module
 * ==============
 * Centralized cookie management utilities.
 * 
 * This module consolidates:
 * - lib/utils/cookie-parser.ts (Cookie parsing)
 * - lib/utils/cookie-pool.ts (Cookie pool rotation)
 * - lib/utils/admin-cookie.ts (Admin cookie management)
 * 
 * Usage:
 *   import { parseCookie, getRotatingCookie, getAdminCookie } from '@/lib/cookies';
 */

// ═══════════════════════════════════════════════════════════════
// COOKIE PARSING
// ═══════════════════════════════════════════════════════════════

export {
    parseCookie,
    validateCookie,
    isCookieLike,
    getCookieFormat,
} from '@/lib/utils/cookie-parser';

// ═══════════════════════════════════════════════════════════════
// COOKIE POOL (Multi-cookie rotation)
// ═══════════════════════════════════════════════════════════════

export {
    getRotatingCookie,
    markCookieSuccess,
    markCookieCooldown,
    markCookieExpired,
    getCookiePoolStats,
} from '@/lib/utils/cookie-pool';

// ═══════════════════════════════════════════════════════════════
// ADMIN COOKIES
// ═══════════════════════════════════════════════════════════════

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
