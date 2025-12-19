import { NextRequest, NextResponse } from 'next/server';
import { scrapeTwitter } from '@/lib/services';
import { logger } from '@/core';
import { successResponse, errorResponse, missingUrlResponse } from '@/lib/http';
import { getAdminCookie, parseCookie } from '@/lib/cookies';
import { isPlatformEnabled, isMaintenanceMode, getMaintenanceMessage, getPlatformDisabledMessage, recordRequest } from '@/core/database';

async function handleRequest(url: string, userCookie?: string, skipCache = false) {
    const startTime = Date.now();
    
    if (isMaintenanceMode()) {
        return errorResponse('twitter', getMaintenanceMessage(), 503);
    }
    
    if (!isPlatformEnabled('twitter')) {
        return errorResponse('twitter', getPlatformDisabledMessage('twitter'), 503);
    }
    
    logger.url('twitter', url);
    
    // Get effective cookie: user > admin (parse JSON format)
    let cookie = userCookie ? parseCookie(userCookie, 'twitter') : null;
    if (!cookie) {
        const adminCookie = await getAdminCookie('twitter');
        cookie = adminCookie ? parseCookie(adminCookie, 'twitter') : null;
        if (cookie) logger.debug('twitter', 'Using admin cookie');
    }
    
    // Try without cookie first, then with cookie
    let result = await scrapeTwitter(url, { skipCache });
    let usedCookie = false;
    
    if (!result.success && cookie) {
        logger.debug('twitter', 'Retrying with cookie...');
        result = await scrapeTwitter(url, { cookie, skipCache });
        if (result.success) usedCookie = true;
    }
    
    const responseTime = Date.now() - startTime;
    
    if (result.success && result.data) {
        logger.meta('twitter', {
            title: result.data.title,
            author: result.data.author,
            formats: result.data.formats.length,
        });
        recordRequest('twitter', true, responseTime);
        return successResponse('twitter', { ...result.data, usedCookie, responseTime });
    }
    
    recordRequest('twitter', false, responseTime);
    logger.error('twitter', result.error || 'No media found');
    return errorResponse('twitter', result.error || 'Could not extract media');
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    
    if (!url) {
        return NextResponse.json({
            name: 'XTFetch Twitter/X API',
            version: '2.0',
            method: 'Syndication + GraphQL API',
            usage: {
                method: 'GET or POST',
                params: '?url=<tweet_url>',
                body: { url: 'string (required)', cookie: 'string (optional)' },
            },
            example: 'https://x.com/elonmusk/status/1234567890',
            supported: ['Tweets', 'Images', 'Videos', 'GIFs', 'Age-restricted'],
            cookies: 'auth_token, ct0 (for age-restricted content)',
        });
    }
    
    try {
        const cookie = request.nextUrl.searchParams.get('cookie') || undefined;
        return handleRequest(url, cookie);
    } catch (error) {
        logger.error('twitter', error);
        return errorResponse('twitter', error instanceof Error ? error.message : 'Failed', 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const { url, cookie, skipCache } = await request.json();
        if (!url) return missingUrlResponse('twitter');
        return handleRequest(url, cookie, skipCache);
    } catch (error) {
        logger.error('twitter', error);
        return errorResponse('twitter', error instanceof Error ? error.message : 'Failed', 500);
    }
}
