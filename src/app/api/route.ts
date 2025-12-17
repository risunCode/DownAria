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
import { fetchTikWM } from '@/lib/services/tiktok';
import { scrapeYouTubeInnertube } from '@/lib/services/youtube-innertube';
import { scrapeWeibo } from '@/lib/services/weibo';
import { logger } from '@/lib/services/logger';
import { successResponse, errorResponse } from '@/lib/utils/http';
import { getAdminCookie, type CookiePlatform } from '@/lib/utils/admin-cookie';
import { isPlatformEnabled, isMaintenanceMode, getMaintenanceMessage, getPlatformDisabledMessage, recordRequest, isApiKeyRequired, type PlatformId } from '@/lib/services/service-config';
import { extractApiKey, validateApiKey, recordKeyUsage } from '@/lib/services/api-keys';
import { getCached, setCache, getCacheKey } from '@/lib/utils/api-security';
import { isValidSocialUrl, isValidCookie, detectAttackPatterns, validateRequestBody } from '@/lib/utils/security';

type Platform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'youtube' | 'weibo';

function detectPlatform(url: string): Platform | null {
    if (matchesPlatform(url, 'instagram')) return 'instagram';
    if (matchesPlatform(url, 'facebook')) return 'facebook';
    if (matchesPlatform(url, 'twitter')) return 'twitter';
    if (matchesPlatform(url, 'tiktok')) return 'tiktok';
    if (matchesPlatform(url, 'youtube')) return 'youtube';
    if (matchesPlatform(url, 'weibo')) return 'weibo';
    return null;
}

async function handleRequest(request: NextRequest, url: string, userCookie?: string) {
    const startTime = Date.now();
    
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
    // API KEY VALIDATION
    // ═══════════════════════════════════════════════════════════════
    
    let validatedKey: { id: string } | null = null;
    if (isApiKeyRequired()) {
        const apiKey = extractApiKey(request);
        if (!apiKey) {
            return NextResponse.json({ 
                success: false, 
                error: 'API key required. Get one at /admin/apikey',
                hint: 'Use header: Authorization: Bearer YOUR_KEY or X-API-Key: YOUR_KEY'
            }, { status: 401 });
        }
        
        const validation = await validateApiKey(apiKey);
        if (!validation.valid) {
            return NextResponse.json({ 
                success: false, 
                error: validation.error || 'Invalid API key',
                remaining: validation.remaining
            }, { status: 401 });
        }
        validatedKey = validation.key ? { id: validation.key.id } : null;
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
    
    // Check cache first
    const cacheKey = getCacheKey(platform, url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cached = getCached<{ data: any; usedCookie?: boolean }>(cacheKey);
    if (cached) {
        logger.debug(platform, 'Cache hit');
        recordRequest(platform as PlatformId, true, 0);
        if (validatedKey) recordKeyUsage(validatedKey.id, true);
        return successResponse(platform, { ...cached.data, cached: true });
    }
    
    logger.url(platform, url);
    
    // Get effective cookie
    const cookiePlatforms: CookiePlatform[] = ['facebook', 'instagram', 'twitter', 'weibo'];
    let cookie = userCookie;
    if (!cookie && cookiePlatforms.includes(platform as CookiePlatform)) {
        cookie = await getAdminCookie(platform as CookiePlatform) || undefined;
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
        
        // Cache successful response
        setCache(cacheKey, { data: result.data, usedCookie });
        
        recordRequest(platform as PlatformId, true, responseTime);
        if (validatedKey) recordKeyUsage(validatedKey.id, true);
        return successResponse(platform, { ...result.data, usedCookie: usedCookie || undefined, cached: false });
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
