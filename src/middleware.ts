/**
 * Next.js Middleware - Security Layer
 * - Security Headers
 * - Rate Limiting (uses @/core/security)
 * - Admin Route Protection
 * - CORS
 * - DDoS Protection
 * - Maintenance Mode Redirect
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ═══════════════════════════════════════════════════════════════
// MAINTENANCE MODE CACHE
// ═══════════════════════════════════════════════════════════════

type MaintenanceType = 'off' | 'api' | 'full';

interface MaintenanceCache {
    enabled: boolean;
    type: MaintenanceType;
    message: string;
    checkedAt: number;
}

let maintenanceCache: MaintenanceCache | null = null;
const MAINTENANCE_CACHE_TTL = 30000; // 30 seconds

async function checkMaintenanceMode(): Promise<MaintenanceCache> {
    const now = Date.now();
    
    // Return cached value if still valid
    if (maintenanceCache && (now - maintenanceCache.checkedAt) < MAINTENANCE_CACHE_TTL) {
        return maintenanceCache;
    }

    // Default to not in maintenance if we can't check
    const defaultState: MaintenanceCache = { enabled: false, type: 'off', message: '', checkedAt: now };

    try {
        // Use Supabase REST API directly (can't import modules in middleware)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            maintenanceCache = defaultState;
            return defaultState;
        }

        const res = await fetch(
            `${supabaseUrl}/rest/v1/service_config?id=eq.global&select=maintenance_mode,maintenance_type,maintenance_message`,
            {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                },
                // Short timeout to not block requests
                signal: AbortSignal.timeout(2000),
            }
        );

        if (!res.ok) {
            maintenanceCache = defaultState;
            return defaultState;
        }

        const data = await res.json();
        const config = data?.[0];

        maintenanceCache = {
            enabled: config?.maintenance_mode ?? false,
            type: config?.maintenance_type ?? 'off',
            message: config?.maintenance_message ?? '🔧 XTFetch is under maintenance. Please try again later.',
            checkedAt: now,
        };

        return maintenanceCache;
    } catch {
        // On error, use cached value or default
        if (maintenanceCache) return maintenanceCache;
        maintenanceCache = defaultState;
        return defaultState;
    }
}

// ═══════════════════════════════════════════════════════════════
// RATE LIMITING (Inline - can't import from @/core in middleware)
// Mirrors implementation from @/core/security
// ═══════════════════════════════════════════════════════════════

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();

// Cleanup interval for rate limit store (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;
const MAX_STORE_SIZE = 5000;

// Periodic cleanup of expired entries
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        // Cleanup rate limit store
        for (const [key, entry] of rateLimitStore.entries()) {
            if (entry.resetAt < now) rateLimitStore.delete(key);
        }
        // Cleanup login attempts
        for (const [key, entry] of loginAttempts.entries()) {
            if (entry.blockedUntil < now && entry.count === 0) loginAttempts.delete(key);
        }
    }, CLEANUP_INTERVAL);
}

// Config
const RATE_LIMIT_CONFIG = {
    global: { maxRequests: 60, windowMs: 60000 },  // 60 req/min
    auth: { maxRequests: 10, windowMs: 60000 },    // 10 req/min for auth
};
const LOGIN_LIMIT = { maxAttempts: 5, blockDuration: 300000 }; // 5 attempts, 5 min block
const ALLOWED_ORIGINS = ['https://xtfetch.vercel.app', 'http://localhost:3001'];

// Suspicious patterns (basic DDoS/bot detection)
const SUSPICIOUS_PATTERNS = [
    /\.(php|asp|aspx|jsp|cgi)$/i,
    /wp-admin|wp-login|xmlrpc/i,
    /\.env|\.git|\.htaccess/i,
    /admin\.php|shell|backdoor/i,
];

/**
 * Get client IP from request headers
 * 
 * SECURITY NOTE: On Vercel, x-forwarded-for is set by their edge network
 * and is trustworthy. For self-hosted deployments, you should validate
 * this header comes from a trusted proxy.
 * 
 * Vercel sets the real client IP as the first value in x-forwarded-for.
 */
function getClientIP(request: NextRequest): string {
    // Vercel sets real client IP in x-forwarded-for (trustworthy on their platform)
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        // Take first IP (Vercel puts real client IP first)
        const ip = forwarded.split(',')[0]?.trim();
        // Basic validation - must look like an IP
        if (ip && /^[\d.:a-f]+$/i.test(ip)) {
            return ip;
        }
    }
    
    // Fallback to x-real-ip
    const realIP = request.headers.get('x-real-ip');
    if (realIP && /^[\d.:a-f]+$/i.test(realIP)) {
        return realIP;
    }
    
    return 'unknown';
}

/**
 * Rate limit check (mirrors @/core/security rateLimit)
 */
function checkRateLimit(
    identifier: string, 
    context: 'global' | 'auth' = 'global'
): { allowed: boolean; remaining: number; resetIn: number } {
    const config = RATE_LIMIT_CONFIG[context];
    const now = Date.now();
    const key = `mw:${context}:${identifier}`;

    // Cleanup old entries
    if (rateLimitStore.size > 10000) {
        for (const [k, val] of rateLimitStore) {
            if (val.resetAt < now) rateLimitStore.delete(k);
        }
    }

    const entry = rateLimitStore.get(key);

    if (!entry || entry.resetAt < now) {
        rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
        return { allowed: true, remaining: config.maxRequests - 1, resetIn: config.windowMs };
    }

    if (entry.count >= config.maxRequests) {
        return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
    }

    entry.count++;
    return { allowed: true, remaining: config.maxRequests - entry.count, resetIn: entry.resetAt - now };
}

function checkLoginAttempts(ip: string): { allowed: boolean; blockedFor?: number } {
    const now = Date.now();
    const entry = loginAttempts.get(ip);

    if (!entry) return { allowed: true };

    if (entry.blockedUntil > now) {
        return { allowed: false, blockedFor: Math.ceil((entry.blockedUntil - now) / 1000) };
    }

    if (entry.count >= LOGIN_LIMIT.maxAttempts) {
        entry.blockedUntil = now + LOGIN_LIMIT.blockDuration;
        return { allowed: false, blockedFor: LOGIN_LIMIT.blockDuration / 1000 };
    }

    return { allowed: true };
}

function recordLoginAttempt(ip: string, success: boolean) {
    if (success) {
        loginAttempts.delete(ip);
        return;
    }

    const entry = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
    entry.count++;
    loginAttempts.set(ip, entry);
}

function addSecurityHeaders(response: NextResponse): NextResponse {
    // Content Security Policy
    response.headers.set('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://unpkg.com",
        "worker-src 'self' blob:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https: http:",
        "media-src 'self' blob: https: http:",
        "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https:",
        "frame-ancestors 'none'",
    ].join('; '));

    // Other security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // HSTS (only in production)
    if (process.env.NODE_ENV === 'production') {
        response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    return response;
}

// Strict localhost pattern - prevents bypass with domains like 'evil-localhost.com'
const LOCALHOST_PATTERN = /^https?:\/\/localhost(:\d+)?$/;

function handleCORS(request: NextRequest, response: NextResponse): NextResponse {
    const origin = request.headers.get('origin');

    // Check allowed origins with strict localhost validation
    if (origin && (ALLOWED_ORIGINS.includes(origin) || LOCALHOST_PATTERN.test(origin))) {
        response.headers.set('Access-Control-Allow-Origin', origin);
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    response.headers.set('Access-Control-Max-Age', '86400');

    return response;
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const ip = getClientIP(request);

    // Block suspicious patterns (honeypot/attack detection)
    if (SUSPICIOUS_PATTERNS.some(p => p.test(pathname))) {
        console.log(`[Security] Blocked suspicious request: ${pathname} from ${ip}`);
        return new NextResponse('Not Found', { status: 404 });
    }

    // Handle preflight
    if (request.method === 'OPTIONS') {
        const response = new NextResponse(null, { status: 204 });
        return handleCORS(request, addSecurityHeaders(response));
    }

    // ═══════════════════════════════════════════════════════════════
    // MAINTENANCE MODE CHECK
    // Skip for: /admin/*, /api/admin/*, /maintenance, static assets
    // ═══════════════════════════════════════════════════════════════
    const isAdminRoute = pathname.startsWith('/admin');
    const isAdminApi = pathname.startsWith('/api/admin');
    const isMaintenancePage = pathname === '/maintenance';
    const isStatusApi = pathname === '/api/status';
    const isAuthRoute = pathname.startsWith('/auth') || pathname.startsWith('/api/auth');
    const isApiRoute = pathname.startsWith('/api');
    
    // Check maintenance mode for non-admin routes
    if (!isAdminRoute && !isAdminApi && !isMaintenancePage && !isStatusApi) {
        const maintenance = await checkMaintenanceMode();
        
        if (maintenance.enabled) {
            // Full maintenance: redirect all non-admin pages to maintenance page
            if (maintenance.type === 'full' && !isAuthRoute) {
                return NextResponse.redirect(new URL('/maintenance', request.url));
            }
            
            // API-only maintenance: block API routes but allow pages
            if (maintenance.type === 'api' && isApiRoute && !isAuthRoute) {
                return new NextResponse(
                    JSON.stringify({ 
                        success: false, 
                        error: maintenance.message || 'Service is under maintenance',
                        maintenance: true 
                    }),
                    { status: 503, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }
    }

    // Rate limiting for API routes
    if (pathname.startsWith('/api')) {
        // Skip rate limiting for proxy endpoint (downloads need many requests)
        // Proxy already has SSRF protection via domain whitelist
        const isProxy = pathname.startsWith('/api/proxy');
        let remaining = RATE_LIMIT_CONFIG.global.maxRequests;

        if (!isProxy) {
            // Stricter limit for auth endpoints
            const context = pathname.includes('/auth') ? 'auth' : 'global';
            const rateCheck = checkRateLimit(ip, context);
            remaining = rateCheck.remaining;

            if (!rateCheck.allowed) {
                const retryAfter = Math.ceil(rateCheck.resetIn / 1000);
                return new NextResponse(
                    JSON.stringify({ success: false, error: 'Too many requests. Try again later.' }),
                    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': retryAfter.toString() } }
                );
            }
        }

        // Check login brute force
        if (pathname.includes('/auth') && request.method === 'POST') {
            const loginCheck = checkLoginAttempts(ip);
            if (!loginCheck.allowed) {
                return new NextResponse(
                    JSON.stringify({ success: false, error: `Too many login attempts. Try again in ${loginCheck.blockedFor}s` }),
                    { status: 429, headers: { 'Content-Type': 'application/json' } }
                );
            }
        }

        const response = NextResponse.next();
        if (!isProxy) response.headers.set('X-RateLimit-Remaining', remaining.toString());
        return handleCORS(request, addSecurityHeaders(response));
    }

    // Admin routes - add extra headers
    if (pathname.startsWith('/admin')) {
        const response = NextResponse.next();
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        return addSecurityHeaders(response);
    }

    // All other pages - prevent caching to always get fresh content
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return addSecurityHeaders(response);
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};

// Export for use in API routes
export { recordLoginAttempt, checkRateLimit, getClientIP };
