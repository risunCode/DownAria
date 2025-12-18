/**
 * Guest Playground API
 * Rate-limited endpoint for testing API without authentication
 * Separate rate limit from main download endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { matchesPlatform } from '@/lib/services/api-config';
import { scrapeFacebook } from '@/lib/services/facebook';
import { scrapeInstagram } from '@/lib/services/instagram';
import { scrapeTwitter } from '@/lib/services/twitter';
import { scrapeTikTok } from '@/lib/services/tiktok';
import { scrapeYouTube } from '@/lib/services/youtube-innertube';
import { scrapeWeibo } from '@/lib/services/weibo';
import { logger } from '@/lib/services/logger';
import { isPlatformEnabled, isMaintenanceMode, getMaintenanceMessage, getPlatformDisabledMessage, getPlaygroundRateLimit, loadConfigFromDB, getServiceConfig, type PlatformId } from '@/lib/services/service-config';
import { getAdminCookie, type CookiePlatform } from '@/lib/utils/admin-cookie';
import { isValidSocialUrl, detectAttackPatterns } from '@/lib/utils/security';

type Platform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'youtube' | 'weibo';

// Rate limit window (2 minutes for playground)
const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000;

// In-memory rate limit store (per IP)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// URL cache - same URL = no rate limit deduction (per IP)
const urlCacheStore = new Map<string, { urls: Set<string>; resetAt: number }>();

function normalizeUrl(url: string): string {
    try {
        const parsed = new URL(url);
        // Remove tracking params, normalize
        return `${parsed.hostname}${parsed.pathname}`.toLowerCase().replace(/\/$/, '');
    } catch {
        return url.toLowerCase();
    }
}

function isUrlCached(ip: string, url: string): boolean {
    const now = Date.now();
    const entry = urlCacheStore.get(ip);
    
    if (!entry || now >= entry.resetAt) {
        return false;
    }
    
    return entry.urls.has(normalizeUrl(url));
}

function cacheUrl(ip: string, url: string): void {
    const now = Date.now();
    const normalizedUrl = normalizeUrl(url);
    let entry = urlCacheStore.get(ip);
    
    if (!entry || now >= entry.resetAt) {
        entry = { urls: new Set(), resetAt: now + RATE_LIMIT_WINDOW_MS };
        urlCacheStore.set(ip, entry);
    }
    
    entry.urls.add(normalizedUrl);
    
    // Cleanup old entries
    if (urlCacheStore.size > 5000) {
        for (const [key, val] of urlCacheStore.entries()) {
            if (now >= val.resetAt) urlCacheStore.delete(key);
        }
    }
}

function getClientIP(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
        || request.headers.get('x-real-ip') 
        || 'unknown';
}

function checkGuestRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number; limit: number } {
    const now = Date.now();
    const maxRequests = getPlaygroundRateLimit();
    const entry = rateLimitStore.get(ip);
    
    // Clean up old entries periodically
    if (rateLimitStore.size > 10000) {
        for (const [key, val] of rateLimitStore.entries()) {
            if (now >= val.resetAt) rateLimitStore.delete(key);
        }
    }
    
    if (!entry || now >= entry.resetAt) {
        rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return { allowed: true, remaining: maxRequests - 1, resetIn: 120, limit: maxRequests };
    }
    
    if (entry.count >= maxRequests) {
        const resetIn = Math.ceil((entry.resetAt - now) / 1000);
        return { allowed: false, remaining: 0, resetIn, limit: maxRequests };
    }
    
    entry.count++;
    return { 
        allowed: true, 
        remaining: maxRequests - entry.count,
        resetIn: Math.ceil((entry.resetAt - now) / 1000),
        limit: maxRequests
    };
}

function detectPlatform(url: string): Platform | null {
    if (matchesPlatform(url, 'instagram')) return 'instagram';
    if (matchesPlatform(url, 'facebook')) return 'facebook';
    if (matchesPlatform(url, 'twitter')) return 'twitter';
    if (matchesPlatform(url, 'tiktok')) return 'tiktok';
    if (matchesPlatform(url, 'youtube')) return 'youtube';
    if (matchesPlatform(url, 'weibo')) return 'weibo';
    return null;
}

// Shared handler for both GET and POST
async function handlePlaygroundRequest(request: NextRequest, url: string): Promise<NextResponse> {
    const startTime = Date.now();
    const clientIP = getClientIP(request);
    
    // Force refresh config from DB for accurate playground status
    await loadConfigFromDB();
    const config = getServiceConfig();
    
    // Check if playground is enabled
    if (!config.playgroundEnabled) {
        return NextResponse.json({ 
            success: false, 
            error: 'Guest playground is currently disabled.' 
        }, { status: 503 });
    }
    
    // Check maintenance mode
    if (isMaintenanceMode()) {
        return NextResponse.json({ 
            success: false, 
            error: getMaintenanceMessage() 
        }, { status: 503 });
    }
    
    // Get current rate limit status (without deducting)
    const maxRequests = getPlaygroundRateLimit();
    const currentEntry = rateLimitStore.get(clientIP);
    const now = Date.now();
    const currentRemaining = (!currentEntry || now >= currentEntry.resetAt) 
        ? maxRequests 
        : Math.max(0, maxRequests - currentEntry.count);
    
    if (!url) {
        return NextResponse.json({ 
            success: false, 
            error: 'URL required',
            rateLimit: { remaining: currentRemaining, limit: maxRequests }
        }, { status: 400 });
    }
    
    // Validate URL BEFORE rate limit check (don't waste limit on invalid URLs)
    const urlValidation = isValidSocialUrl(url);
    if (!urlValidation.valid) {
        return NextResponse.json({ 
            success: false, 
            error: urlValidation.error || 'Invalid URL',
            rateLimit: { remaining: currentRemaining, limit: maxRequests }
        }, { status: 400 });
    }
    
    // Check for attack patterns (don't deduct rate limit)
    if (detectAttackPatterns(url)) {
        logger.error('security', `Attack pattern in playground from ${clientIP}`);
        return NextResponse.json({ 
            success: false, 
            error: 'Invalid URL',
            rateLimit: { remaining: currentRemaining, limit: maxRequests }
        }, { status: 400 });
    }
    
    // Detect platform (don't deduct rate limit for unsupported)
    const platform = detectPlatform(url);
    if (!platform) {
        return NextResponse.json({ 
            success: false, 
            error: 'Unsupported URL. Supported: Facebook, Instagram, Twitter, TikTok, YouTube, Weibo',
            supported: ['facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'weibo'],
            rateLimit: { remaining: currentRemaining, limit: maxRequests }
        }, { status: 400 });
    }
    
    // NOW check rate limit (only for valid URLs that will actually be processed)
    const isCached = isUrlCached(clientIP, url);
    const rateCheck = isCached 
        ? { allowed: true, remaining: currentRemaining, resetIn: 60, limit: maxRequests }
        : checkGuestRateLimit(clientIP);
        
    if (!rateCheck.allowed) {
        return NextResponse.json({ 
            success: false, 
            error: `Rate limit exceeded. Try again in ${rateCheck.resetIn}s`,
            rateLimit: {
                remaining: 0,
                resetIn: rateCheck.resetIn,
                limit: rateCheck.limit
            }
        }, { status: 429 });
    }
    
    // Check if platform is enabled
    if (!isPlatformEnabled(platform as PlatformId)) {
        return NextResponse.json({ 
            success: false, 
            error: getPlatformDisabledMessage(platform as PlatformId),
            platform,
            rateLimit: { remaining: rateCheck.remaining, limit: rateCheck.limit }
        }, { status: 503 });
    }
    
    logger.debug('playground', `Guest request: ${platform} from ${clientIP}`);
    
    // Get admin cookie for platforms that need it
    const cookiePlatforms: CookiePlatform[] = ['facebook', 'instagram', 'twitter', 'weibo'];
    let cookie: string | undefined;
    if (cookiePlatforms.includes(platform as CookiePlatform)) {
        cookie = await getAdminCookie(platform as CookiePlatform) || undefined;
    }
    
    // Execute scraper
    let result;
    let usedCookie = false;
    
    switch (platform) {
        case 'facebook':
            result = await scrapeFacebook(url);
            if (!result.success && cookie) {
                result = await scrapeFacebook(url, { cookie });
                if (result.success) usedCookie = true;
            }
            break;
        case 'instagram':
            result = await scrapeInstagram(url);
            if (!result.success && cookie) {
                result = await scrapeInstagram(url, { cookie });
                if (result.success) usedCookie = true;
            }
            break;
        case 'twitter':
            result = await scrapeTwitter(url);
            if (!result.success && cookie) {
                result = await scrapeTwitter(url, { cookie });
                if (result.success) usedCookie = true;
            }
            break;
        case 'tiktok':
            result = await scrapeTikTok(url);
            break;
        case 'youtube':
            result = await scrapeYouTube(url);
            break;
        case 'weibo':
            if (!cookie) {
                result = { success: false, error: 'Weibo requires cookie' };
            } else {
                result = await scrapeWeibo(url, { cookie });
                usedCookie = true;
            }
            break;
    }
    
    const responseTime = Date.now() - startTime;
    
    if (result?.success && result.data) {
        // Cache URL so same request doesn't count against rate limit
        cacheUrl(clientIP, url);
        
        return NextResponse.json({
            success: true,
            platform,
            data: {
                ...result.data,
                usedCookie,
                responseTime,
            },
            rateLimit: {
                remaining: rateCheck.remaining,
                limit: rateCheck.limit
            }
        });
    }
    
    return NextResponse.json({
        success: false,
        platform,
        error: result?.error || 'Could not extract media',
        responseTime,
        rateLimit: {
            remaining: rateCheck.remaining,
            limit: rateCheck.limit
        }
    }, { status: 400 });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { url } = body;
        return handlePlaygroundRequest(request, url);
    } catch (error) {
        const limit = getPlaygroundRateLimit();
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Request failed',
            rateLimit: {
                remaining: limit,
                limit: limit
            }
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    
    // If URL provided, process the request (same as POST)
    if (url) {
        return handlePlaygroundRequest(request, url);
    }
    
    // No URL - return API info
    await loadConfigFromDB();
    const config = getServiceConfig();
    const limit = config.playgroundRateLimit;
    const enabled = config.playgroundEnabled;
    
    return NextResponse.json({
        name: 'XTFetch Guest Playground API',
        description: 'Rate-limited API for testing without authentication',
        enabled,
        rateLimit: {
            maxRequests: limit,
            windowMs: RATE_LIMIT_WINDOW_MS,
            windowMinutes: 2,
            note: 'Per IP address'
        },
        usage: {
            get: 'GET /api/playground?url=<social_media_url>',
            post: 'POST /api/playground with body { "url": "<social_media_url>" }',
            note: 'No API key required, uses admin cookies as fallback'
        },
        example: '/api/playground?url=https://www.instagram.com/reel/C6O6Wp-yXHy/',
        supported: ['facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'weibo']
    });
}
