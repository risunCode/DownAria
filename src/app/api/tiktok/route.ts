import { NextRequest, NextResponse } from 'next/server';
import { fetchTikWM } from '@/lib/services';
import { logger } from '@/core';
import { successResponse, errorResponse, missingUrlResponse } from '@/lib/http';
import { isPlatformEnabled, isMaintenanceMode, getMaintenanceMessage, getPlatformDisabledMessage, recordRequest } from '@/core/database';
import { rateLimit, getClientIP } from '@/core/security';

// Legacy API rate limit: 5 requests per 5 minutes
const LEGACY_RATE_LIMIT = { maxRequests: 5, windowMs: 5 * 60 * 1000 };

async function handleRequest(request: NextRequest, url: string, skipCache = false) {
    const startTime = Date.now();
    const clientIP = getClientIP(request);
    
    // Rate limiting
    const rl = await rateLimit(clientIP, 'legacy_tiktok', LEGACY_RATE_LIMIT);
    if (!rl.allowed) {
        const resetIn = Math.ceil(rl.resetIn / 1000);
        return NextResponse.json({ 
            success: false, 
            error: `Rate limit exceeded. Try again in ${resetIn}s.`,
            resetIn 
        }, { status: 429 });
    }
    
    if (isMaintenanceMode()) {
        return errorResponse('tiktok', getMaintenanceMessage(), 503);
    }
    
    if (!isPlatformEnabled('tiktok')) {
        return errorResponse('tiktok', getPlatformDisabledMessage('tiktok'), 503);
    }
    
    logger.url('tiktok', url);
    
    const result = await fetchTikWM(url, { skipCache });
    const responseTime = Date.now() - startTime;
    
    if (result.success && result.data) {
        logger.meta('tiktok', {
            title: result.data.title,
            author: result.data.author,
            formats: result.data.formats?.length || 0,
        });
        recordRequest('tiktok', true, responseTime);
        return successResponse('tiktok', { ...result.data, url, responseTime });
    }
    
    recordRequest('tiktok', false, responseTime);
    logger.error('tiktok', result.error || 'No media found');
    return errorResponse('tiktok', result.error || 'Could not extract video');
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    
    if (!url) {
        return NextResponse.json({
            name: 'XTFetch TikTok API',
            version: '2.0',
            method: 'TikWM API',
            usage: {
                method: 'GET or POST',
                params: '?url=<tiktok_url>',
                body: { url: 'string (required)' },
            },
            example: 'https://www.tiktok.com/@username/video/1234567890',
            supported: ['Videos', 'Slideshows', 'Audio'],
            features: ['No watermark', 'HD quality'],
        });
    }
    
    try {
        return handleRequest(request, url);
    } catch (error) {
        logger.error('tiktok', error);
        return errorResponse('tiktok', error instanceof Error ? error.message : 'Failed', 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const { url, skipCache } = await request.json();
        if (!url) return missingUrlResponse('tiktok');
        return handleRequest(request, url, skipCache);
    } catch (error) {
        logger.error('tiktok', error);
        return errorResponse('tiktok', error instanceof Error ? error.message : 'Failed', 500);
    }
}
