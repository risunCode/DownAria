/**
 * Guest Playground API
 * Rate-limited endpoint for testing without auth
 * Supported: Facebook, Instagram, Twitter/X, TikTok, Weibo
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectPlatform } from '@/core/config';
import { scrapeFacebook, scrapeInstagram, scrapeTwitter, scrapeTikTok, scrapeWeibo, scrapeYouTube } from '@/lib/services';
import { logger } from '@/core';
import { isPlatformEnabled, isMaintenanceMode, getMaintenanceMessage, getPlatformDisabledMessage, getPlaygroundRateLimit, loadConfigFromDB, getServiceConfig, trackDownload, trackError, getCountryFromHeaders, type PlatformId } from '@/core/database';
import { getAdminCookie, type CookiePlatform } from '@/lib/cookies';
import { isValidSocialUrl, detectAttackPatterns, rateLimit, getClientIP, getRateLimitStatus, RATE_LIMIT_CONFIGS } from '@/core/security';
import { redis, getResultCache, setResultCache } from '@/lib/redis';
import { prepareUrl, normalizeUrl as normalizeUrlPipeline } from '@/lib/url';

type Platform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'weibo' | 'youtube';

const DEFAULT_URL_CACHE_TTL = 120;
const memUrlCache = new Map<string, { urls: Set<string>; resetAt: number }>();

// Get URL cache TTL from system config
async function getUrlCacheTTL(): Promise<number> {
    try {
        const { getCacheTtlPlaygroundUrl } = await import('@/lib/services/helper/system-config');
        return Math.floor(getCacheTtlPlaygroundUrl() / 1000); // Convert ms to seconds
    } catch {
        return DEFAULT_URL_CACHE_TTL;
    }
}

function normalizeUrlForCache(url: string): string {
    try {
        const normalized = normalizeUrlPipeline(url);
        const parsed = new URL(normalized);
        return `${parsed.hostname}${parsed.pathname}`.toLowerCase().replace(/\/$/, '');
    } catch { return url.toLowerCase(); }
}

async function isUrlCached(ip: string, url: string): Promise<boolean> {
    const key = `pg:url:${ip}:${normalizeUrlForCache(url)}`;
    if (redis) { try { return !!(await redis.exists(key)); } catch { /* fallback */ } }
    const entry = memUrlCache.get(ip);
    return !!(entry && entry.resetAt > Date.now() && entry.urls.has(normalizeUrlForCache(url)));
}

async function cacheUrl(ip: string, url: string): Promise<void> {
    const urlCacheTTL = await getUrlCacheTTL();
    const normalized = normalizeUrlForCache(url);
    const key = `pg:url:${ip}:${normalized}`;
    if (redis) { try { await redis.set(key, '1', { ex: urlCacheTTL }); return; } catch { /* fallback */ } }
    let entry = memUrlCache.get(ip);
    if (!entry || entry.resetAt < Date.now()) {
        entry = { urls: new Set(), resetAt: Date.now() + urlCacheTTL * 1000 };
        memUrlCache.set(ip, entry);
    }
    entry.urls.add(normalized);
}

async function handlePlaygroundRequest(request: NextRequest, url: string): Promise<NextResponse> {
    const startTime = Date.now();
    const clientIP = getClientIP(request);

    await loadConfigFromDB();
    const config = getServiceConfig();
    const maxRequests = config.playgroundRateLimit || RATE_LIMIT_CONFIGS.playground.maxRequests;

    if (!config.playgroundEnabled) return NextResponse.json({ success: false, error: 'Guest playground is disabled.' }, { status: 503 });
    if (isMaintenanceMode()) return NextResponse.json({ success: false, error: getMaintenanceMessage() }, { status: 503 });

    const currentStatus = await getRateLimitStatus(clientIP, 'playground', maxRequests);
    const currentRemaining = currentStatus ? currentStatus.remaining : maxRequests;

    if (!url) return NextResponse.json({ success: false, error: 'URL required', rateLimit: { remaining: currentRemaining, limit: maxRequests } }, { status: 400 });

    const urlValidation = isValidSocialUrl(url);
    if (!urlValidation.valid) return NextResponse.json({ success: false, error: urlValidation.error || 'Invalid URL', rateLimit: { remaining: currentRemaining, limit: maxRequests } }, { status: 400 });
    if (detectAttackPatterns(url)) return NextResponse.json({ success: false, error: 'Invalid URL', rateLimit: { remaining: currentRemaining, limit: maxRequests } }, { status: 400 });

    const platform = detectPlatform(url);
    if (!platform) return NextResponse.json({ success: false, error: 'Unsupported URL. Supported: Facebook, Instagram, Twitter, TikTok, Weibo, YouTube', supported: ['facebook', 'instagram', 'twitter', 'tiktok', 'weibo', 'youtube'], rateLimit: { remaining: currentRemaining, limit: maxRequests } }, { status: 400 });

    // Resolve URL for canonical cache key
    const urlResult = await prepareUrl(url, { timeout: 5000 });
    const resolvedUrl = urlResult.resolvedUrl || url;
    const resolvedPlatform = urlResult.platform || platform;

    const isCached = await isUrlCached(clientIP, url);
    let rateCheck = { allowed: true, remaining: currentRemaining, resetIn: 120 };
    if (!isCached) rateCheck = await rateLimit(clientIP, 'playground', { maxRequests });
    if (!rateCheck.allowed) {
        const resetIn = Math.ceil(rateCheck.resetIn / 1000);
        return NextResponse.json({ success: false, error: `Rate limit exceeded. Try again in ${resetIn}s`, rateLimit: { remaining: 0, resetIn, limit: maxRequests } }, { status: 429 });
    }

    if (!isPlatformEnabled(resolvedPlatform as PlatformId)) {
        return NextResponse.json({ success: false, error: getPlatformDisabledMessage(resolvedPlatform as PlatformId), platform: resolvedPlatform, rateLimit: { remaining: rateCheck.remaining, limit: maxRequests } }, { status: 503 });
    }

    logger.debug('playground', `Guest request: ${resolvedPlatform} from ${clientIP}`);

    // Check Redis result cache using RESOLVED URL for canonical cache key
    type CachedResult = { data: unknown; usedCookie?: boolean; cachedAt: number };
    const cachedResult = await getResultCache<CachedResult>(resolvedPlatform as Platform, resolvedUrl);
    if (cachedResult && cachedResult.data) {
        const cachedData = cachedResult.data as { formats?: unknown[] };
        // Only use cache if it has valid formats
        if (cachedData.formats && Array.isArray(cachedData.formats) && cachedData.formats.length > 0) {
            const responseTime = Date.now() - startTime;
            logger.debug('playground', `Cache HIT for ${resolvedPlatform} (canonical key from resolved URL)`);
            return NextResponse.json({
                success: true,
                platform: resolvedPlatform,
                cached: true,
                data: { ...(cachedResult.data as object), usedCookie: cachedResult.usedCookie || false, responseTime },
                rateLimit: { remaining: rateCheck.remaining, limit: maxRequests }
            });
        }
        // Cache exists but no formats - skip and re-scrape
        logger.debug('playground', `Cache entry has no formats for ${resolvedPlatform}, re-scraping`);
    }

    const cookiePlatforms: CookiePlatform[] = ['facebook', 'instagram', 'twitter', 'weibo'];
    let cookie: string | undefined;
    if (cookiePlatforms.includes(resolvedPlatform as CookiePlatform)) {
        cookie = await getAdminCookie(resolvedPlatform as CookiePlatform) || undefined;
    }

    let result: { success: boolean; data?: { usedCookie?: boolean; formats?: unknown[] }; error?: string } | undefined;
    let usedCookie = false;

    // Use resolved URL for scraping
    switch (resolvedPlatform) {
        case 'facebook':
            // Pass cookie from the start - scraper has internal retry logic
            result = await scrapeFacebook(resolvedUrl, cookie ? { cookie } : undefined);
            if (result.success && result.data?.usedCookie) usedCookie = true;
            break;
        case 'instagram':
            result = await scrapeInstagram(resolvedUrl, cookie ? { cookie } : undefined);
            if (result.success && result.data?.usedCookie) usedCookie = true;
            break;
        case 'twitter':
            result = await scrapeTwitter(resolvedUrl);
            if (!result.success && cookie) { result = await scrapeTwitter(resolvedUrl, { cookie }); if (result.success) usedCookie = true; }
            break;
        case 'tiktok':
            result = await scrapeTikTok(resolvedUrl);
            break;
        case 'weibo':
            if (!cookie) result = { success: false, error: 'Weibo requires cookie' };
            else { result = await scrapeWeibo(resolvedUrl, { cookie }); usedCookie = true; }
            break;
        case 'youtube':
            result = await scrapeYouTube(resolvedUrl);
            break;
    }

    // Save successful result to Redis cache using RESOLVED URL for canonical key
    // Only cache if we have valid formats
    if (result?.success && result.data) {
        const resultData = result.data as { formats?: unknown[] };
        if (resultData.formats && Array.isArray(resultData.formats) && resultData.formats.length > 0) {
            await setResultCache(resolvedPlatform as Platform, resolvedUrl, {
                data: result.data,
                usedCookie,
                cachedAt: Date.now()
            });
        }
    }

    const responseTime = Date.now() - startTime;
    const country = getCountryFromHeaders(request.headers);

    if (usedCookie && cookie) {
        const { markCookieSuccess, markCookieCooldown, markCookieExpired } = await import('@/lib/cookies');
        if (result?.success) markCookieSuccess().catch(() => { });
        else if (result?.error) {
            const err = result.error.toLowerCase();
            if (err.includes('verification') || err.includes('checkpoint') || err.includes('login')) markCookieExpired(result.error).catch(() => { });
            else if (err.includes('rate limit') || err.includes('429')) markCookieCooldown(30, result.error).catch(() => { });
        }
    }

    if (result?.success && result.data) {
        if (!isCached) await cacheUrl(clientIP, url);
        
        // Track successful playground download
        trackDownload({
            platform: resolvedPlatform,
            quality: 'unknown',
            source: 'playground',
            country,
            success: true,
        });
        
        return NextResponse.json({
            success: true,
            platform: resolvedPlatform,
            cached: isCached, // true = didn't use rate limit
            data: { ...(result.data as object), usedCookie, responseTime },
            rateLimit: { remaining: rateCheck.remaining, limit: maxRequests }
        });
    }

    // Track failed playground request
    const errorMsg = result?.error || 'Could not extract media';
    trackDownload({
        platform: resolvedPlatform,
        quality: 'unknown',
        source: 'playground',
        country,
        success: false,
        error_type: errorMsg.substring(0, 50),
    });
    trackError({
        platform: resolvedPlatform,
        source: 'playground',
        country,
        error_type: 'playground_failed',
        error_message: errorMsg,
    });

    return NextResponse.json({ success: false, platform: resolvedPlatform, error: errorMsg, responseTime, rateLimit: { remaining: rateCheck.remaining, limit: maxRequests } }, { status: 400 });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        return handlePlaygroundRequest(request, body.url);
    } catch (error) {
        const limit = getPlaygroundRateLimit();
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Request failed', rateLimit: { remaining: limit, limit } }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    if (url) return handlePlaygroundRequest(request, url);

    await loadConfigFromDB();
    const config = getServiceConfig();
    const clientIP = getClientIP(request);
    
    // Get current rate limit status for this client
    const maxRequests = config.playgroundRateLimit || RATE_LIMIT_CONFIGS.playground.maxRequests;
    const currentStatus = await getRateLimitStatus(clientIP, 'playground', maxRequests);
    
    return NextResponse.json({
        success: true,
        data: {
            remaining: currentStatus?.remaining ?? maxRequests,
            limit: maxRequests,
            resetIn: currentStatus?.resetIn ? Math.ceil(currentStatus.resetIn / 1000) : 0,
        },
        // Also include config info
        config: {
            name: 'XTFetch Guest Playground API',
            enabled: config.playgroundEnabled,
            supported: ['facebook', 'instagram', 'twitter', 'tiktok', 'weibo', 'youtube']
        }
    }, {
        headers: {
            'Cache-Control': 'no-store', // Don't cache rate limit status
        },
    });
}
