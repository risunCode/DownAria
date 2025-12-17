/**
 * Unified Download Handler
 * Shared logic for /api/download and /api/download/[platform]
 */

import { NextRequest, NextResponse } from 'next/server';
import { matchesPlatform } from '@/lib/services/api-config';
import { scrapeFacebook } from '@/lib/services/facebook';
import { scrapeInstagram } from '@/lib/services/instagram';
import { scrapeTwitter } from '@/lib/services/twitter';
import { fetchTikWM } from '@/lib/services/tiktok';
import { scrapeYouTubeInnertube } from '@/lib/services/youtube-innertube';
import { scrapeWeibo } from '@/lib/services/weibo';
import { logger } from '@/lib/services/logger';
import { getAdminCookie, type CookiePlatform } from '@/lib/utils/admin-cookie';
import { 
    isPlatformEnabled, isMaintenanceMode, getMaintenanceMessage, 
    getPlatformDisabledMessage, recordRequest, isApiKeyRequired, 
    type PlatformId 
} from '@/lib/services/service-config';
import { extractApiKey, validateApiKey, recordKeyUsage } from '@/lib/services/api-keys';
import { getCached, setCache, getCacheKey } from '@/lib/utils/api-security';
import { isValidSocialUrl, isValidCookie, detectAttackPatterns, validateRequestBody } from '@/lib/utils/security';

type Platform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'youtube' | 'weibo';

interface DownloadParams {
    url: string;
    cookie?: string;
    platform?: string; // If provided, skip auto-detect
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

export function getApiInfo() {
    return {
        name: 'XTFetch Download API',
        version: '2.0',
        endpoints: {
            unified: {
                path: '/api/download',
                description: 'Auto-detect platform from URL',
                methods: ['GET', 'POST'],
            },
            perPlatform: {
                path: '/api/download/{platform}',
                description: 'Direct platform endpoint (faster)',
                platforms: ['facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'weibo'],
                methods: ['GET', 'POST'],
            }
        },
        authentication: {
            header: 'X-API-Key: YOUR_KEY',
            bearer: 'Authorization: Bearer YOUR_KEY',
            query: '?key=YOUR_KEY',
        },
        body: {
            url: 'string (required)',
            cookie: 'string (optional)',
        },
        examples: [
            'POST /api/download { "url": "https://instagram.com/p/xxx" }',
            'POST /api/download/facebook { "url": "https://fb.watch/xxx" }',
            'GET /api/download/tiktok?url=https://tiktok.com/@user/video/123',
        ]
    };
}

export async function handleDownload(
    request: NextRequest, 
    params: DownloadParams
): Promise<NextResponse> {
    const startTime = Date.now();
    const { url, cookie: userCookie, platform: forcePlatform } = params;

    // Maintenance check
    if (isMaintenanceMode()) {
        return NextResponse.json({ 
            success: false, 
            error: getMaintenanceMessage() 
        }, { status: 503 });
    }

    // URL validation
    if (!url) {
        return NextResponse.json({ 
            success: false, 
            error: 'URL required' 
        }, { status: 400 });
    }

    const urlValidation = isValidSocialUrl(url);
    if (!urlValidation.valid) {
        return NextResponse.json({ 
            success: false, 
            error: urlValidation.error || 'Invalid URL' 
        }, { status: 400 });
    }

    if (detectAttackPatterns(url)) {
        logger.error('security', 'Attack pattern in URL');
        return NextResponse.json({ success: false, error: 'Invalid URL' }, { status: 400 });
    }

    // Cookie validation
    if (userCookie) {
        const cookieValidation = isValidCookie(userCookie);
        if (!cookieValidation.valid) {
            return NextResponse.json({ 
                success: false, 
                error: cookieValidation.error 
            }, { status: 400 });
        }
        if (detectAttackPatterns(userCookie)) {
            return NextResponse.json({ success: false, error: 'Invalid cookie' }, { status: 400 });
        }
    }

    // Body validation
    const bodyValidation = validateRequestBody({ url, cookie: userCookie });
    if (!bodyValidation.valid) {
        return NextResponse.json({ success: false, error: bodyValidation.error }, { status: 400 });
    }

    // API Key validation
    let validatedKey: { id: string } | null = null;
    
    // NOTE: Admin bypass removed for security - all requests must use API key when required
    // Playground should use a valid API key for testing
    
    if (isApiKeyRequired()) {
        const apiKey = extractApiKey(request);
        if (!apiKey) {
            return NextResponse.json({ 
                success: false, 
                error: 'API key required',
                hint: 'Use header X-API-Key or Authorization: Bearer'
            }, { status: 401 });
        }

        const validation = await validateApiKey(apiKey);
        if (!validation.valid) {
            return NextResponse.json({ 
                success: false, 
                error: validation.error,
                remaining: validation.remaining
            }, { status: 401 });
        }
        validatedKey = validation.key ? { id: validation.key.id } : null;
    }

    // Detect or use forced platform
    const platform = (forcePlatform as Platform) || detectPlatform(url);
    if (!platform) {
        return NextResponse.json({ 
            success: false, 
            error: 'Unsupported URL. Use /api/download/{platform} for explicit routing.',
            supported: ['facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'weibo']
        }, { status: 400 });
    }

    // Platform enabled check
    if (!isPlatformEnabled(platform as PlatformId)) {
        return NextResponse.json({ 
            success: false, 
            error: getPlatformDisabledMessage(platform as PlatformId),
            platform
        }, { status: 503 });
    }

    // Cache check
    const cacheKey = getCacheKey(platform, url);
    const cached = getCached<{ data: unknown; usedCookie?: boolean }>(cacheKey);
    if (cached) {
        logger.debug(platform, 'Cache hit');
        recordRequest(platform as PlatformId, true, 0);
        if (validatedKey) await recordKeyUsage(validatedKey.id, true);
        const cachedData = typeof cached.data === 'object' && cached.data !== null 
            ? { ...(cached.data as object), cached: true }
            : { data: cached.data, cached: true };
        return NextResponse.json({ 
            success: true, 
            platform,
            data: cachedData
        });
    }

    logger.url(platform, url);

    // Get effective cookie
    const cookiePlatforms: CookiePlatform[] = ['facebook', 'instagram', 'twitter', 'weibo'];
    let cookie = userCookie;
    const isAdminCookie = !userCookie;
    if (!cookie && cookiePlatforms.includes(platform as CookiePlatform)) {
        cookie = await getAdminCookie(platform as CookiePlatform) || undefined;
    }

    // Execute scraper
    let result: { success: boolean; data?: unknown; error?: string };
    let usedCookie = false;

    try {
        switch (platform) {
            case 'facebook':
            case 'instagram': {
                const scraper = platform === 'instagram' ? scrapeInstagram : scrapeFacebook;
                result = await scraper(url);
                if (!result.success && cookie) {
                    logger.debug(platform, `Retrying with ${isAdminCookie ? 'admin' : 'user'} cookie`);
                    result = await scraper(url, { cookie });
                    if (result.success) usedCookie = true;
                }
                break;
            }
            case 'twitter': {
                result = await scrapeTwitter(url);
                if (!result.success && cookie) {
                    logger.debug(platform, `Retrying with ${isAdminCookie ? 'admin' : 'user'} cookie`);
                    result = await scrapeTwitter(url, { cookie });
                    if (result.success) usedCookie = true;
                }
                break;
            }
            case 'tiktok': {
                const tikResult = await fetchTikWM(url);
                result = tikResult.success && tikResult.data
                    ? { success: true, data: { ...tikResult.data, url } }
                    : { success: false, error: tikResult.error || 'TikTok fetch failed' };
                break;
            }
            case 'youtube': {
                result = await scrapeYouTubeInnertube(url);
                break;
            }
            case 'weibo': {
                if (!cookie) {
                    result = { success: false, error: 'Weibo requires cookie (SUB)' };
                } else {
                    result = await scrapeWeibo(url, { cookie });
                    usedCookie = true;
                }
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
        // Cache successful response
        setCache(cacheKey, { data: result.data, usedCookie });
        recordRequest(platform as PlatformId, true, responseTime);
        if (validatedKey) await recordKeyUsage(validatedKey.id, true);

        const responseData = typeof result.data === 'object' && result.data !== null 
            ? { ...result.data, usedCookie: usedCookie || undefined, cached: false, responseTime }
            : { data: result.data, usedCookie: usedCookie || undefined, cached: false, responseTime };
            
        return NextResponse.json({ 
            success: true, 
            platform,
            data: responseData
        });
    }

    recordRequest(platform as PlatformId, false, responseTime);
    if (validatedKey) await recordKeyUsage(validatedKey.id, false);
    logger.error(platform, result.error || 'No media found');

    return NextResponse.json({ 
        success: false, 
        platform,
        error: result.error || 'Could not extract media'
    }, { status: 400 });
}
