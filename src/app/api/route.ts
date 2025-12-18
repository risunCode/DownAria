/**
 * Unified API Endpoint
 * Auto-detect platform from URL and route to appropriate scraper
 * 
 * Usage:
 *   GET  /api?url=<any_social_media_url>
 *   POST /api { url, cookie? }
 * 
 * Features:
 *   - Auto-detect platform
 *   - Response caching (3 days TTL)
 *   - API key validation
 *   - Rate limiting per key
 *   - Input validation (XSS, SSRF prevention)
 */

import { NextRequest, NextResponse } from 'next/server';
import { matchesPlatform } from '@/lib/services/api-config';
import { scrapeFacebook } from '@/lib/services/facebook';
import { scrapeInstagram } from '@/lib/services/instagram';
import { scrapeTwitter } from '@/lib/services/twitter';
import { scrapeTikTok } from '@/lib/services/tiktok';
import { scrapeCobalt } from '@/lib/services/cobalt';
import { scrapeWeibo } from '@/lib/services/weibo';
import { logger } from '@/lib/services/logger';
import { successResponse, errorResponse } from '@/lib/utils/http';
import { getAdminCookie, type CookiePlatform } from '@/lib/utils/admin-cookie';
import { parseCookie } from '@/lib/utils/cookie-parser';
import { isPlatformEnabled, isMaintenanceMode, getMaintenanceMessage, getPlatformDisabledMessage, recordRequest, getGlobalRateLimit, type PlatformId } from '@/lib/services/service-config';
import { extractApiKey, validateApiKey, recordKeyUsage } from '@/lib/services/api-keys';
import { getCache, setCache } from '@/lib/services/cache';
import { isValidSocialUrl, isValidCookie, detectAttackPatterns, validateRequestBody, getClientIP } from '@/lib/utils/security';

type Platform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'youtube' | 'weibo' | 'douyin';

// ═══════════════════════════════════════════════════════════════
// RATE LIMITING (15 req/min per IP for public)
// ═══════════════════════════════════════════════════════════════
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();


function checkRateLimit(ip: string, hasApiKey: boolean): { allowed: boolean; remaining: number; resetIn: number } {
    // API key users get higher limit (managed separately via api-keys)
    if (hasApiKey) return { allowed: true, remaining: 999, resetIn: 0 };

    const now = Date.now();
    const maxRequests = getGlobalRateLimit(); // 15 req/min
    const entry = rateLimitStore.get(ip);

    // Cleanup old entries periodically
    if (rateLimitStore.size > 10000) {
        for (const [key, val] of rateLimitStore.entries()) {
            if (now >= val.resetAt) rateLimitStore.delete(key);
        }
    }

    if (!entry || now >= entry.resetAt) {
        rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return { allowed: true, remaining: maxRequests - 1, resetIn: 60 };
    }

    if (entry.count >= maxRequests) {
        const resetIn = Math.ceil((entry.resetAt - now) / 1000);
        return { allowed: false, remaining: 0, resetIn };
    }

    entry.count++;
    return {
        allowed: true,
        remaining: maxRequests - entry.count,
        resetIn: Math.ceil((entry.resetAt - now) / 1000)
    };
}

function detectPlatform(url: string): Platform | null {
    if (matchesPlatform(url, 'instagram')) return 'instagram';
    if (matchesPlatform(url, 'facebook')) return 'facebook';
    if (matchesPlatform(url, 'twitter')) return 'twitter';
    if (matchesPlatform(url, 'douyin')) return 'douyin';
    if (matchesPlatform(url, 'tiktok')) return 'tiktok';
    if (matchesPlatform(url, 'youtube')) return 'youtube';
    if (matchesPlatform(url, 'weibo')) return 'weibo';
    return null;
}

async function handleRequest(request: NextRequest, url: string, userCookie?: string) {
    const startTime = Date.now();
    const clientIP = getClientIP(request);

    if (isMaintenanceMode()) {
        return NextResponse.json({ success: false, error: getMaintenanceMessage() }, { status: 503 });
    }

    // ═══════════════════════════════════════════════════════════════
    // INPUT VALIDATION (Security)
    // ═══════════════════════════════════════════════════════════════

    // Validate URL (SSRF prevention)
    if (url) {
        const urlValidation = isValidSocialUrl(url);
        if (!urlValidation.valid) {
            return NextResponse.json({
                success: false,
                error: urlValidation.error || 'Invalid URL'
            }, { status: 400 });
        }

        // Check for attack patterns
        if (detectAttackPatterns(url)) {
            logger.error('security', `Attack pattern detected in URL from ${request.headers.get('x-forwarded-for')}`);
            return NextResponse.json({ success: false, error: 'Invalid URL' }, { status: 400 });
        }
    }

    // Validate cookie (XSS prevention)
    if (userCookie) {
        const cookieValidation = isValidCookie(userCookie);
        if (!cookieValidation.valid) {
            return NextResponse.json({
                success: false,
                error: cookieValidation.error || 'Invalid cookie format'
            }, { status: 400 });
        }

        if (detectAttackPatterns(userCookie)) {
            logger.error('security', 'Attack pattern detected in cookie');
            return NextResponse.json({ success: false, error: 'Invalid cookie' }, { status: 400 });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // API KEY VALIDATION (Optional - for tracking/rate limiting)
    // ═══════════════════════════════════════════════════════════════
    // Public API - no key required, but if provided, track usage
    let validatedKey: { id: string } | null = null;
    const apiKey = extractApiKey(request);
    if (apiKey) {
        const validation = await validateApiKey(apiKey);
        if (validation.valid && validation.key) {
            validatedKey = { id: validation.key.id };
        }
        // Don't reject if invalid - just ignore and continue as public request
    }

    // ═══════════════════════════════════════════════════════════════
    // RATE LIMITING (15 req/min for public, unlimited for API key users)
    // ═══════════════════════════════════════════════════════════════
    const rateLimit = checkRateLimit(clientIP, !!validatedKey);
    if (!rateLimit.allowed) {
        return NextResponse.json({
            success: false,
            error: `Rate limit exceeded. Try again in ${rateLimit.resetIn} seconds.`,
            hint: 'Use an API key for higher limits',
            resetIn: rateLimit.resetIn
        }, {
            status: 429,
            headers: {
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': rateLimit.resetIn.toString(),
                'Retry-After': rateLimit.resetIn.toString()
            }
        });
    }

    if (!url) {
        return NextResponse.json({
            name: 'XTFetch Unified API',
            version: '1.0',
            usage: {
                method: 'GET or POST',
                params: '?url=<social_media_url>',
                body: { url: 'string (required)', cookie: 'string (optional)' },
            },
            supported: ['Facebook', 'Instagram', 'Twitter/X', 'TikTok', 'YouTube', 'Weibo'],
            examples: [
                'https://www.instagram.com/p/abc123/',
                'https://x.com/user/status/123456',
                'https://www.tiktok.com/@user/video/123',
            ],
        });
    }

    const platform = detectPlatform(url);
    if (!platform) {
        return NextResponse.json({
            success: false,
            error: 'Unsupported URL. Supported: Facebook, Instagram, Twitter/X, TikTok, YouTube, Weibo'
        }, { status: 400 });
    }

    if (!isPlatformEnabled(platform as PlatformId)) {
        return errorResponse(platform, getPlatformDisabledMessage(platform as PlatformId), 503);
    }

    // Check cache first (Supabase)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cached = await getCache<{ data: any; usedCookie?: boolean }>(platform as PlatformId, url);
    if (cached) {
        logger.debug(platform, 'Cache hit');
        const cacheTime = Date.now() - startTime;
        recordRequest(platform as PlatformId, true, cacheTime);
        if (validatedKey) recordKeyUsage(validatedKey.id, true);
        return successResponse(platform, { ...cached.data, cached: true, responseTime: cacheTime });
    }

    logger.url(platform, url);

    // Get effective cookie (parse JSON format from Cookie Editor)
    const cookiePlatforms: CookiePlatform[] = ['facebook', 'instagram', 'twitter', 'weibo'];
    let cookie = userCookie ? parseCookie(userCookie, platform as CookiePlatform) : null;
    if (!cookie && cookiePlatforms.includes(platform as CookiePlatform)) {
        const adminCookie = await getAdminCookie(platform as CookiePlatform);
        cookie = adminCookie ? parseCookie(adminCookie, platform as CookiePlatform) : null;
        if (cookie) logger.debug(platform, 'Using admin cookie');
    }

    let result;
    let usedCookie = false;

    try {
        switch (platform) {
            case 'facebook':
            case 'instagram': {
                const scraper = platform === 'instagram' ? scrapeInstagram : scrapeFacebook;
                result = await scraper(url);
                if (!result.success && cookie) {
                    result = await scraper(url, { cookie });
                    if (result.success) usedCookie = true;
                }
                break;
            }
            case 'twitter': {
                result = await scrapeTwitter(url);
                if (!result.success && cookie) {
                    result = await scrapeTwitter(url, { cookie });
                    if (result.success) usedCookie = true;
                }
                break;
            }
            case 'tiktok': {
                const tikResult = await scrapeTikTok(url);
                result = tikResult.success && tikResult.data
                    ? { success: true, data: { ...tikResult.data, url } }
                    : { success: false, error: tikResult.error || 'TikTok fetch failed' };
                break;
            }
            case 'youtube':
            case 'douyin': {
                // YouTube & Douyin: Cobalt API (primary, no fallback)
                const cobaltResult = await scrapeCobalt(url, { quality: platform === 'youtube' ? 'max' : '1080' });
                result = cobaltResult.success && cobaltResult.data
                    ? { success: true, data: { ...cobaltResult.data, url } }
                    : { success: false, error: cobaltResult.error || `${platform} fetch failed` };
                break;
            }
            case 'weibo': {
                if (!cookie) {
                    result = { success: false, error: 'Weibo requires cookie' };
                } else {
                    result = await scrapeWeibo(url, { cookie });
                    usedCookie = true;
                }
                break;
            }
        }
    } catch (e) {
        result = { success: false, error: e instanceof Error ? e.message : 'Scrape failed' };
    }

    const responseTime = Date.now() - startTime;

    if (result?.success && result.data) {
        logger.meta(platform, {
            title: result.data.title,
            author: result.data.author,
            formats: result.data.formats?.length || 0,
        });

        // Cache successful response (Supabase)
        setCache(platform as PlatformId, url, { data: result.data, usedCookie });

        recordRequest(platform as PlatformId, true, responseTime);
        if (validatedKey) recordKeyUsage(validatedKey.id, true);
        return successResponse(platform, { ...result.data, usedCookie: usedCookie || undefined, cached: false, responseTime });
    }

    recordRequest(platform as PlatformId, false, responseTime);
    if (validatedKey) recordKeyUsage(validatedKey.id, false);
    logger.error(platform, result?.error || 'No media found');
    return errorResponse(platform, result?.error || 'Could not extract media');
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url') || '';
    const cookie = request.nextUrl.searchParams.get('cookie') || undefined;
    return handleRequest(request, url, cookie);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate request body size
        const bodyValidation = validateRequestBody(body);
        if (!bodyValidation.valid) {
            return NextResponse.json({
                success: false,
                error: bodyValidation.error
            }, { status: 400 });
        }

        return handleRequest(request, body.url, body.cookie);
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Invalid request'
        }, { status: 400 });
    }
}
