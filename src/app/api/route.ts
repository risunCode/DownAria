/**
 * Unified API Endpoint
 * Auto-detect platform from URL and route to appropriate scraper
 * 
 * Supported: Facebook, Instagram, Twitter/X, TikTok, Weibo
 */

import { NextRequest, NextResponse } from 'next/server';
import { scrapeFacebook, scrapeInstagram, scrapeTwitter, scrapeTikTok, scrapeWeibo } from '@/lib/services';
import { logger } from '@/core';
import { successResponse, errorResponse } from '@/lib/http';
import { getAdminCookie, parseCookie, type CookiePlatform } from '@/lib/cookies';
import type { MediaData } from '@/lib/types';
import type { ScraperData } from '@/core/scrapers/types';
import {
    isPlatformEnabled, isMaintenanceMode, getMaintenanceMessage, getPlatformDisabledMessage,
    recordRequest, getGlobalRateLimit, extractApiKey, validateApiKey, recordKeyUsage,
    getCache, setCache, type PlatformId
} from '@/core/database';
import { isValidSocialUrl, isValidCookie, detectAttackPatterns, validateRequestBody, getClientIP, rateLimit } from '@/core/security';
import { prepareUrl } from '@/lib/url';

type Platform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'weibo';

async function handleRequest(request: NextRequest, url: string, userCookie?: string) {
    const startTime = Date.now();
    const clientIP = getClientIP(request);

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
    let validatedKey: { id: string } | null = null;
    const apiKey = extractApiKey(request);
    if (apiKey) {
        const validation = await validateApiKey(apiKey);
        if (validation.valid && validation.key) validatedKey = { id: validation.key.id };
    }

    // Rate limiting
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
            supported: ['Facebook', 'Instagram', 'Twitter/X', 'TikTok', 'Weibo'],
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

    // Cache check
    const cached = await getCache<MediaData>(platform as PlatformId, cacheKey || resolvedUrl);
    if (cached) {
        logger.debug(platform, 'Cache hit');
        recordRequest(platform as PlatformId, true, Date.now() - startTime);
        if (validatedKey) recordKeyUsage(validatedKey.id, true);
        return successResponse(platform, { ...cached, cached: true, responseTime: Date.now() - startTime });
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
                result = await scraper(resolvedUrl);
                if (!result.success && cookie) {
                    result = await scraper(resolvedUrl, { cookie });
                    if (result.success) { usedCookie = true; usedAdminCookie = !userCookie; }
                }
                break;
            }
            case 'twitter': {
                result = await scrapeTwitter(resolvedUrl);
                if (!result.success && cookie) {
                    result = await scrapeTwitter(resolvedUrl, { cookie });
                    if (result.success) { usedCookie = true; usedAdminCookie = !userCookie; }
                }
                break;
            }
            case 'tiktok': {
                const tikResult = await scrapeTikTok(resolvedUrl);
                result = tikResult.success && tikResult.data
                    ? { success: true, data: { ...tikResult.data, url: resolvedUrl } }
                    : { success: false, error: tikResult.error || 'TikTok fetch failed' };
                break;
            }
            case 'weibo': {
                if (!cookie) {
                    result = { success: false, error: 'Weibo requires cookie' };
                } else {
                    result = await scrapeWeibo(resolvedUrl, { cookie });
                    usedCookie = true;
                    usedAdminCookie = !userCookie;
                }
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
        setCache(platform as PlatformId, cacheKey || resolvedUrl, mediaData);
        recordRequest(platform as PlatformId, true, responseTime);
        if (validatedKey) recordKeyUsage(validatedKey.id, true);
        return successResponse(platform, mediaData);
    }

    recordRequest(platform as PlatformId, false, responseTime);
    if (validatedKey) recordKeyUsage(validatedKey.id, false);
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
        const bodyValidation = validateRequestBody(body);
        if (!bodyValidation.valid) return NextResponse.json({ success: false, error: bodyValidation.error }, { status: 400 });
        return handleRequest(request, body.url, body.cookie);
    } catch (error) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
    }
}
