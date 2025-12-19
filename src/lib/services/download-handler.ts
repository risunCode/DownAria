/**
 * Unified Download Handler
 * Supported: Facebook, Instagram, Twitter/X, TikTok, Weibo
 */

import { NextRequest, NextResponse } from 'next/server';
import { scrapeFacebook } from './facebook';
import { scrapeInstagram } from './instagram';
import { scrapeTwitter } from './twitter';
import { scrapeTikTok } from './tiktok';
import { scrapeWeibo } from './weibo';
import { logger } from '@/core';
import { getAdminCookie, type CookiePlatform } from '@/lib/cookies';
import {
    isPlatformEnabled, isMaintenanceMode, getMaintenanceMessage,
    getPlatformDisabledMessage, recordRequest, isApiKeyRequired,
    extractApiKey, validateApiKey, recordKeyUsage,
    getCache, setCache, type PlatformId
} from '@/core/database';
import { isValidCookie, detectAttackPatterns, validateRequestBody } from '@/core/security';
import { prepareUrl } from '@/lib/url';

type Platform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'weibo';

interface DownloadParams {
    url: string;
    cookie?: string;
    platform?: string;
    skipCache?: boolean;
}

export function getApiInfo() {
    return {
        name: 'XTFetch Download API',
        version: '2.0',
        platforms: ['facebook', 'instagram', 'twitter', 'tiktok', 'weibo'],
    };
}

export async function handleDownload(request: NextRequest, params: DownloadParams): Promise<NextResponse> {
    const startTime = Date.now();
    const { url, cookie: userCookie, platform: forcePlatform, skipCache = false } = params;

    if (isMaintenanceMode()) return NextResponse.json({ success: false, error: getMaintenanceMessage() }, { status: 503 });
    if (!url) return NextResponse.json({ success: false, error: 'URL required' }, { status: 400 });
    if (detectAttackPatterns(url)) return NextResponse.json({ success: false, error: 'Invalid URL' }, { status: 400 });

    const urlResult = await prepareUrl(url, { timeout: 5000 });
    if (!urlResult.assessment.isValid) return NextResponse.json({ success: false, error: urlResult.assessment.errorMessage || 'Invalid URL' }, { status: 400 });

    const resolvedUrl = urlResult.resolvedUrl;
    const cacheKey = urlResult.cacheKey;

    if (userCookie) {
        const cookieValidation = isValidCookie(userCookie);
        if (!cookieValidation.valid) return NextResponse.json({ success: false, error: cookieValidation.error }, { status: 400 });
        if (detectAttackPatterns(userCookie)) return NextResponse.json({ success: false, error: 'Invalid cookie' }, { status: 400 });
    }

    const bodyValidation = validateRequestBody({ url, cookie: userCookie });
    if (!bodyValidation.valid) return NextResponse.json({ success: false, error: bodyValidation.error }, { status: 400 });

    let validatedKey: { id: string } | null = null;
    if (isApiKeyRequired()) {
        const apiKey = extractApiKey(request);
        if (!apiKey) return NextResponse.json({ success: false, error: 'API key required' }, { status: 401 });
        const validation = await validateApiKey(apiKey);
        if (!validation.valid) return NextResponse.json({ success: false, error: validation.error }, { status: 401 });
        validatedKey = validation.key ? { id: validation.key.id } : null;
    }

    const platform = (forcePlatform as Platform) || (urlResult.platform as Platform);
    if (!platform) return NextResponse.json({ success: false, error: 'Unsupported URL', supported: ['facebook', 'instagram', 'twitter', 'tiktok', 'weibo'] }, { status: 400 });
    if (!isPlatformEnabled(platform as PlatformId)) return NextResponse.json({ success: false, error: getPlatformDisabledMessage(platform as PlatformId), platform }, { status: 503 });

    if (!skipCache) {
        const cached = await getCache<{ data: unknown }>(platform as PlatformId, cacheKey || resolvedUrl);
        if (cached) {
            recordRequest(platform as PlatformId, true, 0);
            if (validatedKey) await recordKeyUsage(validatedKey.id, true);
            return NextResponse.json({ success: true, platform, data: { ...(cached.data as object), cached: true } });
        }
    }

    logger.url(platform, resolvedUrl);

    const cookiePlatforms: CookiePlatform[] = ['facebook', 'instagram', 'twitter', 'weibo'];
    let cookie = userCookie;
    if (!cookie && cookiePlatforms.includes(platform as CookiePlatform)) {
        cookie = await getAdminCookie(platform as CookiePlatform) || undefined;
    }

    let result: { success: boolean; data?: unknown; error?: string };
    let usedCookie = false;

    try {
        switch (platform) {
            case 'facebook':
            case 'instagram': {
                const scraper = platform === 'instagram' ? scrapeInstagram : scrapeFacebook;
                result = await scraper(resolvedUrl, { skipCache });
                if (!result.success && cookie) {
                    result = await scraper(resolvedUrl, { cookie, skipCache });
                    if (result.success) usedCookie = true;
                }
                break;
            }
            case 'twitter': {
                result = await scrapeTwitter(resolvedUrl, { skipCache });
                if (!result.success && cookie) {
                    result = await scrapeTwitter(resolvedUrl, { cookie, skipCache });
                    if (result.success) usedCookie = true;
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
                if (!cookie) result = { success: false, error: 'Weibo requires cookie' };
                else { result = await scrapeWeibo(resolvedUrl, { cookie, skipCache }); usedCookie = true; }
                break;
            }
            default:
                result = { success: false, error: 'Unknown platform' };
        }
    } catch (e) {
        result = { success: false, error: e instanceof Error ? e.message : 'Scrape failed' };
    }

    const responseTime = Date.now() - startTime;

    if (result.success && result.data) {
        setCache(platform as PlatformId, cacheKey || resolvedUrl, { data: result.data, usedCookie });
        recordRequest(platform as PlatformId, true, responseTime);
        if (validatedKey) await recordKeyUsage(validatedKey.id, true);
        return NextResponse.json({ success: true, platform, data: { ...(result.data as object), usedCookie: usedCookie || undefined, cached: false, responseTime } });
    }

    recordRequest(platform as PlatformId, false, responseTime);
    if (validatedKey) await recordKeyUsage(validatedKey.id, false);
    return NextResponse.json({ success: false, platform, error: result.error || 'Could not extract media' }, { status: 400 });
}
