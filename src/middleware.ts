/**
 * Next.js Middleware - Security Layer
 * - Security Headers
 * - Rate Limiting
 * - Admin Route Protection
 * - CORS
 * - DDoS Protection
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rate limit storage (in-memory, resets on deploy)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const loginAttempts = new Map<string, { count: number; blockedUntil: number }>();

// Config
const RATE_LIMIT = { maxRequests: 60, windowMs: 60000 }; // 60 req/min
const LOGIN_LIMIT = { maxAttempts: 5, blockDuration: 300000 }; // 5 attempts, 5 min block
const ALLOWED_ORIGINS = ['https://xtfetch.vercel.app', 'http://localhost:3000'];

// Suspicious patterns (basic DDoS/bot detection)
const SUSPICIOUS_PATTERNS = [
    /\.(php|asp|aspx|jsp|cgi)$/i,
    /wp-admin|wp-login|xmlrpc/i,
    /\.env|\.git|\.htaccess/i,
    /admin\.php|shell|backdoor/i,
];

function getClientIP(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
}

function checkRateLimit(ip: string, limit = RATE_LIMIT.maxRequests): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    // Cleanup old entries
    if (rateLimitMap.size > 10000) {
        for (const [key, val] of rateLimitMap) {
            if (val.resetAt < now) rateLimitMap.delete(key);
        }
    }

    if (!entry || entry.resetAt < now) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
        return { allowed: true, remaining: limit - 1 };
    }

    if (entry.count >= limit) {
        return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: limit - entry.count };
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
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob: https: http:",
        "media-src 'self' blob: https: http:",
        "connect-src 'self' https://*.supabase.co wss://*.supabase.co https:",
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

export function middleware(request: NextRequest) {
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

    // Rate limiting for API routes
    if (pathname.startsWith('/api')) {
        // Skip rate limiting for proxy endpoint (downloads need many requests)
        // Proxy already has SSRF protection via domain whitelist
        const isProxy = pathname.startsWith('/api/proxy');
        let remaining = RATE_LIMIT.maxRequests;

        if (!isProxy) {
            // Stricter limit for auth endpoints
            const limit = pathname.includes('/auth') ? 10 : RATE_LIMIT.maxRequests;
            const rateCheck = checkRateLimit(ip, limit);
            remaining = rateCheck.remaining;

            if (!rateCheck.allowed) {
                return new NextResponse(
                    JSON.stringify({ success: false, error: 'Too many requests. Try again later.' }),
                    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }
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

    // Default response with security headers
    return addSecurityHeaders(NextResponse.next());
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};

// Export for use in API routes
export { recordLoginAttempt, checkRateLimit, getClientIP };
