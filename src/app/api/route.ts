/**
 * Unified API Endpoint
 * Auto-detect platform from URL and route to appropriate scraper
 * 
 * Supported: Facebook, Instagram, Twitter/X, TikTok, Weibo
 */

import { NextRequest, NextResponse } from 'next/server';
import { scrapeFacebook, scrapeInstagram, scrapeTwitter, scrapeTikTok, scrapeWeibo, scrapeYouTube } from '@/lib/services';
import { logger } from '@/core';
import { successResponse, errorResponse } from '@/lib/http';
import { getAdminCookie, parseCookie, type CookiePlatform } from '@/lib/cookies';
import type { MediaData } from '@/lib/types';
import type { ScraperData } from '@/core/scrapers/types';
import {
    isPlatformEnabled, isMaintenanceMode, getMaintenanceMessage, getPlatformDisabledMessage,
    recordRequest, getGlobalRateLimit, extractApiKey, validateApiKey, recordKeyUsage,
    loadConfigFromDB, getPlatformConfig, trackDownload, trackError, getCountryFromHeaders, type PlatformId
} from '@/core/database';
import { isValidSocialUrl, isValidCookie, detectAttackPatterns, validateRequestBody, getClientIP, rateLimit } from '@/core/security';
import { prepareUrl } from '@/lib/url';

type Platform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'weibo' | 'youtube';

// Allowed origins for main API (only our domain)
const ALLOWED_ORIGINS = [
    'https://xt-fetch.vercel.app',
    'http://localhost:3001', // Dev only
];

/**
 * Validate request origin - only allow from our domain or with valid API key
 */
function validateOrigin(request: NextRequest): { valid: boolean; error?: string } {
    // Check if request has API key - API key users can access from anywhere
    const apiKey = extractApiKey(request);
    if (apiKey) return { valid: true };
    
    // Check Origin header (for CORS requests)
    const origin = request.headers.get('origin');
    if (origin && ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed))) {
        return { valid: true };
    }
    
    // Check Referer header (for same-origin requests)
    const referer = request.headers.get('referer');
    if (referer && ALLOWED_ORIGINS.some(allowed => referer.startsWith(allowed))) {
        return { valid: true };
    }
    
    // Check Sec-Fetch-Site header (modern browsers)
    const secFetchSite = request.headers.get('sec-fetch-site');
    if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') {
        return { valid: true };
    }
    
    // No valid origin - block request
    return { 
        valid: false, 
        error: 'Direct API access not allowed. Use /api/playground for testing or get an API key.' 
    };
}

async function handleRequest(request: NextRequest, url: string, userCookie?: string, skipCache = false) {
    const startTime = Date.now();
    const clientIP = getClientIP(request);

    // Load config from DB first
    await loadConfigFromDB();

    // Validate origin - block direct API access without API key
    const originCheck = validateOrigin(request);
    if (!originCheck.valid) {
        return NextResponse.json({ 
            success: false, 
            error: originCheck.error,
            hint: 'Use /api/playground for testing or include X-API-Key header'
        }, { status: 403 });
    }

    if (isMaintenanceMode()) {
        return NextResponse.json({ success: false, error: getMaintenanceMessage() }, { status: 503 });
    }

    // Input validation
    if (url) {
        const urlValidation = isValidSocialUrl(url);
        if (!urlValidation.valid) {
            return NextResponse.json({ success: false, error: urlValidation.error || 'Invalid URL' }, { status: 400 });
        }
        if (detectAttackPatterns(url)) {
            logger.error('security', `Attack pattern detected in URL`);
            return NextResponse.json({ success: false, error: 'Invalid URL' }, { status: 400 });
        }
    }

    if (userCookie) {
        const cookieValidation = isValidCookie(userCookie);
        if (!cookieValidation.valid) {
            return NextResponse.json({ success: false, error: cookieValidation.error || 'Invalid cookie format' }, { status: 400 });
        }
        if (detectAttackPatterns(userCookie)) {
            return NextResponse.json({ success: false, error: 'Invalid cookie' }, { status: 400 });
        }
    }

    // API key validation (optional)
    let validatedKey: { id: string; rateLimit?: number } | null = null;
    const apiKey = extractApiKey(request);
    if (apiKey) {
        const validation = await validateApiKey(apiKey);
        if (!validation.valid) {
            // API key provided but invalid or rate limited
            return NextResponse.json({ 
                success: false, 
                error: validation.error || 'Invalid API key',
                remaining: validation.remaining ?? 0
            }, { status: validation.error?.includes('Rate limit') ? 429 : 401 });
        }
        if (validation.key) {
            validatedKey = { id: validation.key.id, rateLimit: validation.key.rateLimit };
        }
    }

    // Rate limiting (only for guests without API key)
    if (!validatedKey) {
        const rl = await rateLimit(clientIP, 'public', { maxRequests: getGlobalRateLimit() });
        if (!rl.allowed) {
            const resetIn = Math.ceil(rl.resetIn / 1000);
            return NextResponse.json({ success: false, error: `Rate limit exceeded. Try again in ${resetIn}s.`, resetIn }, { status: 429 });
        }
    }

    if (!url) {
        return NextResponse.json({
            name: 'XTFetch Unified API',
            version: '2.0',
            supported: ['Facebook', 'Instagram', 'Twitter/X', 'TikTok', 'Weibo', 'YouTube'],
            usage: { method: 'GET or POST', params: '?url=<social_media_url>', body: { url: 'required', cookie: 'optional' } },
        });
    }

    // URL Pipeline
    const urlResult = await prepareUrl(url, { timeout: 5000 });
    if (!urlResult.assessment.isValid || !urlResult.platform) {
        return NextResponse.json({ success: false, error: urlResult.assessment.errorMessage || 'Unsupported URL' }, { status: 400 });
    }

    const platform = urlResult.platform as Platform;
    const resolvedUrl = urlResult.resolvedUrl;
    const cacheKey = urlResult.cacheKey;

    if (!isPlatformEnabled(platform as PlatformId)) {
        return errorResponse(platform, getPlatformDisabledMessage(platform as PlatformId), 503);
    }

    // Per-platform rate limiting (for guests only)
    if (!validatedKey) {
        const platformConfig = getPlatformConfig(platform as PlatformId);
        if (platformConfig?.rateLimit) {
            const platformRl = await rateLimit(clientIP, platform, { maxRequests: platformConfig.rateLimit, windowMs: 60_000 });
            if (!platformRl.allowed) {
                const resetIn = Math.ceil(platformRl.resetIn / 1000);
                return NextResponse.json({ 
                    success: false, 
                    error: `Rate limit exceeded for ${platform}. Try again in ${resetIn}s.`, 
                    resetIn,
                    platform 
                }, { status: 429 });
            }
        }
    }

    // Cache check - use hash-based cacheKey from prepareUrl
    // Format: result:platform:hash (e.g., result:facebook:abc123)
    const fullCacheKey = `result:${cacheKey}`;
    // console.log(`[DEBUG] cacheKey=${cacheKey}, fullCacheKey=${fullCacheKey}, skipCache=${skipCache}`);
    
    if (!skipCache) {
        const cacheStart = Date.now();
        const { getCacheByKey } = await import('@/lib/services/helper/cache');
        const cached = await getCacheByKey<MediaData>(fullCacheKey);
        const cacheTime = Date.now() - cacheStart;
        
        if (cached && cached.formats && cached.formats.length > 0) {
            const totalTime = Date.now() - startTime;
            logger.redis(platform, true, fullCacheKey);
            recordRequest(platform as PlatformId, true, totalTime);
            if (validatedKey) recordKeyUsage(validatedKey.id, true);
            return successResponse(platform, { ...cached, cached: true, responseTime: totalTime });
        }
        
        // If cached but no formats, skip cache (corrupted entry)
        if (cached) {
            logger.warn(platform, `Cache entry has no formats [${fullCacheKey}], re-scraping`);
        } else {
            logger.redis(platform, false, fullCacheKey);
        }
    } else {
        logger.debug(platform, 'Skip cache enabled, fetching fresh data');
    }

    logger.url(platform, resolvedUrl);

    // Get cookie
    const cookiePlatforms: CookiePlatform[] = ['facebook', 'instagram', 'twitter', 'weibo'];
    let cookie = userCookie ? parseCookie(userCookie, platform as CookiePlatform) : null;
    if (!cookie && cookiePlatforms.includes(platform as CookiePlatform)) {
        const adminCookie = await getAdminCookie(platform as CookiePlatform);
        if (adminCookie) cookie = parseCookie(adminCookie, platform as CookiePlatform);
    }

    let result: { success: boolean; data?: ScraperData; error?: string } | undefined;
    let usedCookie = false;
    let usedAdminCookie = false;

    try {
        switch (platform) {
            case 'facebook':
            case 'instagram': {
                const scraper = platform === 'instagram' ? scrapeInstagram : scrapeFacebook;
                // Pass cookie from the start - scraper has internal retry logic
                result = await scraper(resolvedUrl, cookie ? { cookie, skipCache } : { skipCache });
                if (result.success && result.data?.usedCookie) {
                    // Scraper explicitly tells us cookie was used
                    usedCookie = true;
                    usedAdminCookie = !userCookie;
                }
                break;
            }
            case 'twitter': {
                result = await scrapeTwitter(resolvedUrl, { skipCache });
                if (!result.success && cookie) {
                    result = await scrapeTwitter(resolvedUrl, { cookie, skipCache });
                    if (result.success) { usedCookie = true; usedAdminCookie = !userCookie; }
                }
                break;
            }
            case 'tiktok': {
                const tikResult = await scrapeTikTok(resolvedUrl, { skipCache });
                result = tikResult.success && tikResult.data
                    ? { success: true, data: { ...tikResult.data, url: resolvedUrl } }
                    : { success: false, error: tikResult.error || 'TikTok fetch failed' };
                break;
            }
            case 'weibo': {
                if (!cookie) {
                    result = { success: false, error: 'Weibo requires cookie' };
                } else {
                    result = await scrapeWeibo(resolvedUrl, { cookie, skipCache });
                    usedCookie = true;
                    usedAdminCookie = !userCookie;
                }
                break;
            }
            case 'youtube': {
                result = await scrapeYouTube(resolvedUrl, { skipCache });
                break;
            }
        }
    } catch (e) {
        result = { success: false, error: e instanceof Error ? e.message : 'Scrape failed' };
    }

    // Cookie status tracking
    const { markCookieSuccess, markCookieCooldown, markCookieExpired } = await import('@/lib/cookies');
    if (usedAdminCookie && result) {
        if (result.success) markCookieSuccess().catch(() => {});
        else if (result.error) {
            const err = result.error.toLowerCase();
            if (err.includes('verification') || err.includes('checkpoint') || err.includes('login')) markCookieExpired(result.error).catch(() => {});
            else if (err.includes('rate limit') || err.includes('429')) markCookieCooldown(30, result.error).catch(() => {});
        }
    }

    const responseTime = Date.now() - startTime;
    const country = getCountryFromHeaders(request.headers);
    const source = validatedKey ? 'api' : 'web';

    if (result?.success && result.data) {
        const mediaData: MediaData = {
            title: result.data.title || 'Untitled',
            thumbnail: result.data.thumbnail || '',
            author: result.data.author,
            duration: result.data.duration,
            views: result.data.views,
            description: result.data.description,
            formats: result.data.formats || [],
            url: result.data.url || resolvedUrl,
            engagement: result.data.engagement,
            usedCookie: usedCookie || undefined,
            cached: false,
            responseTime,
        };
        // Only cache if we have valid formats
        if (mediaData.formats.length > 0) {
            const { setCacheByKey } = await import('@/lib/services/helper/cache');
            // console.log(`[DEBUG] Caching ${mediaData.formats.length} formats to ${fullCacheKey}`);
            setCacheByKey(fullCacheKey, platform as PlatformId, mediaData);
        }
        // else { console.log(`[DEBUG] NOT caching: formats=${mediaData.formats.length}`); }
        recordRequest(platform as PlatformId, true, responseTime);
        if (validatedKey) recordKeyUsage(validatedKey.id, true);
        
        // Track successful download
        trackDownload({
            platform,
            quality: (mediaData.formats[0]?.quality || 'unknown') as 'HD' | 'SD' | 'audio' | 'original' | 'unknown',
            source,
            country,
            success: true,
        });
        
        return successResponse(platform, mediaData);
    }

    recordRequest(platform as PlatformId, false, responseTime);
    if (validatedKey) recordKeyUsage(validatedKey.id, false);
    
    // Track failed download
    const errorMsg = result?.error || 'Could not extract media';
    trackDownload({
        platform,
        quality: 'unknown',
        source,
        country,
        success: false,
        error_type: errorMsg.substring(0, 50),
    });
    trackError({
        platform,
        source,
        country,
        error_type: 'scrape_failed',
        error_message: errorMsg,
    });
    
    return errorResponse(platform, errorMsg);
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url') || '';
    const cookie = request.nextUrl.searchParams.get('cookie') || undefined;
    const skipCache = request.nextUrl.searchParams.get('skipCache') === 'true';
    return handleRequest(request, url, cookie, skipCache);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const bodyValidation = validateRequestBody(body);
        if (!bodyValidation.valid) return NextResponse.json({ success: false, error: bodyValidation.error }, { status: 400 });
        return handleRequest(request, body.url, body.cookie, body.skipCache === true);
    } catch (error) {
        // Sanitize error message - don't expose internal details
        const safeMessage = error instanceof SyntaxError 
            ? 'Invalid JSON in request body' 
            : 'Invalid request format';
        return NextResponse.json({ success: false, error: safeMessage }, { status: 400 });
    }
}
