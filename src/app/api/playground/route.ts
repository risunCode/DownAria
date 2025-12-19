/**
 * Guest Playground API
 * Rate-limited endpoint for testing without auth
 * Supported: Facebook, Instagram, Twitter/X, TikTok, Weibo
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectPlatform } from '@/core/config';
import { scrapeFacebook, scrapeInstagram, scrapeTwitter, scrapeTikTok, scrapeWeibo } from '@/lib/services';
import { logger } from '@/core';
import { isPlatformEnabled, isMaintenanceMode, getMaintenanceMessage, getPlatformDisabledMessage, getPlaygroundRateLimit, loadConfigFromDB, getServiceConfig, type PlatformId } from '@/core/database';
import { getAdminCookie, type CookiePlatform } from '@/lib/cookies';
import { isValidSocialUrl, detectAttackPatterns, rateLimit, getClientIP, getRateLimitStatus, RATE_LIMIT_CONFIGS } from '@/core/security';
import { redis, getResultCache, setResultCache } from '@/lib/redis';
import { normalizeUrl as normalizeUrlPipeline } from '@/lib/url';

type Platform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'weibo';

const URL_CACHE_TTL = 120;
const memUrlCache = new Map<string, { urls: Set<string>; resetAt: number }>();

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
    const normalized = normalizeUrlForCache(url);
    const key = `pg:url:${ip}:${normalized}`;
    if (redis) { try { await redis.set(key, '1', { ex: URL_CACHE_TTL }); return; } catch { /* fallback */ } }
    let entry = memUrlCache.get(ip);
    if (!entry || entry.resetAt < Date.now()) {
        entry = { urls: new Set(), resetAt: Date.now() + URL_CACHE_TTL * 1000 };
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

    const currentStatus = await getRateLimitStatus(clientIP, 'playground');
    const currentRemaining = currentStatus ? currentStatus.remaining : maxRequests;

    if (!url) return NextResponse.json({ success: false, error: 'URL required', rateLimit: { remaining: currentRemaining, limit: maxRequests } }, { status: 400 });

    const urlValidation = isValidSocialUrl(url);
    if (!urlValidation.valid) return NextResponse.json({ success: false, error: urlValidation.error || 'Invalid URL', rateLimit: { remaining: currentRemaining, limit: maxRequests } }, { status: 400 });
    if (detectAttackPatterns(url)) return NextResponse.json({ success: false, error: 'Invalid URL', rateLimit: { remaining: currentRemaining, limit: maxRequests } }, { status: 400 });

    const platform = detectPlatform(url);
    if (!platform) return NextResponse.json({ success: false, error: 'Unsupported URL. Supported: Facebook, Instagram, Twitter, TikTok, Weibo', supported: ['facebook', 'instagram', 'twitter', 'tiktok', 'weibo'], rateLimit: { remaining: currentRemaining, limit: maxRequests } }, { status: 400 });

    const isCached = await isUrlCached(clientIP, url);
    let rateCheck = { allowed: true, remaining: currentRemaining, resetIn: 120 };
    if (!isCached) rateCheck = await rateLimit(clientIP, 'playground', { maxRequests });
    if (!rateCheck.allowed) {
        const resetIn = Math.ceil(rateCheck.resetIn / 1000);
        return NextResponse.json({ success: false, error: `Rate limit exceeded. Try again in ${resetIn}s`, rateLimit: { remaining: 0, resetIn, limit: maxRequests } }, { status: 429 });
    }

    if (!isPlatformEnabled(platform as PlatformId)) {
        return NextResponse.json({ success: false, error: getPlatformDisabledMessage(platform as PlatformId), platform, rateLimit: { remaining: rateCheck.remaining, limit: maxRequests } }, { status: 503 });
    }

    logger.debug('playground', `Guest request: ${platform} from ${clientIP}`);

    // Check Redis result cache first (by content ID)
    type CachedResult = { data: unknown; usedCookie?: boolean; cachedAt: number };
    const cachedResult = await getResultCache<CachedResult>(platform as Platform, url);
    if (cachedResult) {
        const responseTime = Date.now() - startTime;
        logger.debug('playground', `Cache HIT for ${platform}`);
        return NextResponse.json({
            success: true,
            platform,
            cached: true,
            data: { ...(cachedResult.data as object), usedCookie: cachedResult.usedCookie || false, responseTime },
            rateLimit: { remaining: rateCheck.remaining, limit: maxRequests }
        });
    }

    const cookiePlatforms: CookiePlatform[] = ['facebook', 'instagram', 'twitter', 'weibo'];
    let cookie: string | undefined;
    if (cookiePlatforms.includes(platform as CookiePlatform)) {
        cookie = await getAdminCookie(platform as CookiePlatform) || undefined;
    }

    let result: { success: boolean; data?: unknown; error?: string } | undefined;
    let usedCookie = false;

    switch (platform) {
        case 'facebook':
            result = await scrapeFacebook(url);
            if (!result.success && cookie) { result = await scrapeFacebook(url, { cookie }); if (result.success) usedCookie = true; }
            break;
        case 'instagram':
            result = await scrapeInstagram(url);
            if (!result.success && cookie) { result = await scrapeInstagram(url, { cookie }); if (result.success) usedCookie = true; }
            break;
        case 'twitter':
            result = await scrapeTwitter(url);
            if (!result.success && cookie) { result = await scrapeTwitter(url, { cookie }); if (result.success) usedCookie = true; }
            break;
        case 'tiktok':
            result = await scrapeTikTok(url);
            break;
        case 'weibo':
            if (!cookie) result = { success: false, error: 'Weibo requires cookie' };
            else { result = await scrapeWeibo(url, { cookie }); usedCookie = true; }
            break;
    }

    // Save successful result to Redis cache
    if (result?.success && result.data) {
        await setResultCache(platform as Platform, url, {
            data: result.data,
            usedCookie,
            cachedAt: Date.now()
        });
    }

    const responseTime = Date.now() - startTime;

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
        return NextResponse.json({
            success: true,
            platform,
            cached: isCached, // true = didn't use rate limit
            data: { ...(result.data as object), usedCookie, responseTime },
            rateLimit: { remaining: rateCheck.remaining, limit: maxRequests }
        });
    }

    return NextResponse.json({ success: false, platform, error: result?.error || 'Could not extract media', responseTime, rateLimit: { remaining: rateCheck.remaining, limit: maxRequests } }, { status: 400 });
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
    return NextResponse.json({
        name: 'XTFetch Guest Playground API',
        enabled: config.playgroundEnabled,
        rateLimit: { maxRequests: config.playgroundRateLimit, windowMinutes: 2 },
        supported: ['facebook', 'instagram', 'twitter', 'tiktok', 'weibo']
    });
}
