import { NextRequest, NextResponse } from 'next/server';
import { scrapeWeibo } from '@/lib/services';
import { logger } from '@/core';
import { successResponse, errorResponse, missingUrlResponse } from '@/lib/http';
import { getAdminCookie, parseCookie } from '@/lib/cookies';
import { isPlatformEnabled, isMaintenanceMode, getMaintenanceMessage, getPlatformDisabledMessage, recordRequest } from '@/core/database';
import { rateLimit, getClientIP } from '@/core/security';

// Legacy API rate limit: 5 requests per 5 minutes
const LEGACY_RATE_LIMIT = { maxRequests: 5, windowMs: 5 * 60 * 1000 };

async function handleRequest(request: NextRequest, url: string, userCookie?: string, skipCache = false) {
    const startTime = Date.now();
    const clientIP = getClientIP(request);
    
    // Rate limiting
    const rl = await rateLimit(clientIP, 'legacy_weibo', LEGACY_RATE_LIMIT);
    if (!rl.allowed) {
        const resetIn = Math.ceil(rl.resetIn / 1000);
        return NextResponse.json({ 
            success: false, 
            error: `Rate limit exceeded. Try again in ${resetIn}s.`,
            resetIn 
        }, { status: 429 });
    }
    
    if (isMaintenanceMode()) {
        return errorResponse('weibo', getMaintenanceMessage(), 503);
    }
    
    if (!isPlatformEnabled('weibo')) {
        return errorResponse('weibo', getPlatformDisabledMessage('weibo'), 503);
    }
    
    // Weibo ALWAYS requires cookie
    // Parse cookie (supports JSON format from Cookie Editor)
    let cookie = userCookie ? parseCookie(userCookie, 'weibo') : null;
    if (!cookie) {
        const adminCookie = await getAdminCookie('weibo');
        cookie = adminCookie ? parseCookie(adminCookie, 'weibo') : null;
        if (cookie) logger.debug('weibo', 'Using admin cookie');
    }
    
    if (!cookie) {
        return errorResponse('weibo', 'COOKIE_REQUIRED', 401);
    }
    
    logger.url('weibo', url);
    
    const result = await scrapeWeibo(url, { cookie, skipCache });
    const responseTime = Date.now() - startTime;
    
    if (result.success && result.data) {
        logger.meta('weibo', {
            title: result.data.title,
            author: result.data.author,
            formats: result.data.formats.length,
        });
        recordRequest('weibo', true, responseTime);
        return successResponse('weibo', { ...result.data, responseTime });
    }
    
    recordRequest('weibo', false, responseTime);
    
    // Handle cookie errors
    if (result.error === 'COOKIE_REQUIRED' || result.error === 'COOKIE_EXPIRED') {
        return errorResponse('weibo', result.error, 401);
    }
    
    logger.error('weibo', result.error || 'No media found');
    return errorResponse('weibo', result.error || 'Could not extract media');
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    
    if (!url) {
        return NextResponse.json({
            name: 'XTFetch Weibo API',
            version: '2.0',
            method: 'Mobile API',
            usage: {
                method: 'GET or POST',
                params: '?url=<weibo_url>&cookie=<SUB_cookie>',
                body: { url: 'string (required)', cookie: 'string (required)' },
            },
            example: 'https://weibo.com/1234567890/abc123',
            requiredCookies: ['SUB'],
            notes: 'Cookie ALWAYS required',
        });
    }
    
    try {
        const cookie = request.nextUrl.searchParams.get('cookie') || undefined;
        return handleRequest(request, url, cookie);
    } catch (error) {
        logger.error('weibo', error);
        return errorResponse('weibo', error instanceof Error ? error.message : 'Failed', 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const { url, cookie, skipCache } = await request.json();
        if (!url) return missingUrlResponse('weibo');
        return handleRequest(request, url, cookie, skipCache);
    } catch (error) {
        logger.error('weibo', error);
        return errorResponse('weibo', error instanceof Error ? error.message : 'Failed', 500);
    }
}
