import { NextRequest, NextResponse } from 'next/server';
import { scrapeYouTubeYtdl } from '@/lib/services/youtube-ytdl';
import { logger } from '@/lib/services/logger';
import { successResponse, errorResponse, missingUrlResponse } from '@/lib/utils/http';
import { isPlatformEnabled, isMaintenanceMode, getMaintenanceMessage, getPlatformDisabledMessage, recordRequest } from '@/lib/services/service-config';
import { getAdminCookie, type CookiePlatform } from '@/lib/utils/admin-cookie';

/**
 * YouTube API Route
 * Uses ytdl-core (supports HD, cookies for age-restricted)
 */

async function handleRequest(url: string, userCookie?: string, skipCache = false) {
    const startTime = Date.now();
    
    if (isMaintenanceMode()) {
        return errorResponse('youtube', getMaintenanceMessage(), 503);
    }
    
    if (!isPlatformEnabled('youtube')) {
        return errorResponse('youtube', getPlatformDisabledMessage('youtube'), 503);
    }
    
    logger.url('youtube', url);
    
    // Get effective cookie: user cookie > admin cookie
    let effectiveCookie = userCookie;
    if (!effectiveCookie) {
        effectiveCookie = await getAdminCookie('youtube' as CookiePlatform) || undefined;
        if (effectiveCookie) {
            logger.debug('youtube', 'Using admin cookie');
        }
    }
    
    // Use ytdl-core
    const result = await scrapeYouTubeYtdl(url, { 
        cookie: effectiveCookie, 
        skipCache 
    });
    
    const responseTime = Date.now() - startTime;
    
    if (result.success && result.data) {
        logger.meta('youtube', {
            title: result.data.title,
            author: result.data.author,
            formats: result.data.formats.length,
        });
        recordRequest('youtube', true, responseTime);
        return successResponse('youtube', { ...result.data, responseTime });
    }
    
    recordRequest('youtube', false, responseTime);
    logger.error('youtube', result.error || 'ytdl-core failed');
    return errorResponse('youtube', result.error || 'Failed to fetch video');
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    
    if (!url) {
        return NextResponse.json({
            name: 'XTFetch YouTube API',
            version: '3.0',
            method: 'ytdl-core',
            usage: {
                method: 'GET or POST',
                params: '?url=<youtube_url>',
                body: { url: 'string (required)', cookie: 'string (optional)' },
            },
            example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            supported: ['Videos', 'Shorts', 'Music', 'Age-restricted (with cookie)'],
            features: ['HD quality', 'Cookie support'],
        });
    }
    
    try {
        return handleRequest(url);
    } catch (error) {
        logger.error('youtube', error);
        return errorResponse('youtube', error instanceof Error ? error.message : 'Failed', 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const { url, cookie, skipCache } = await request.json();
        if (!url) return missingUrlResponse('youtube');
        return handleRequest(url, cookie, skipCache);
    } catch (error) {
        logger.error('youtube', error);
        return errorResponse('youtube', error instanceof Error ? error.message : 'Failed', 500);
    }
}
