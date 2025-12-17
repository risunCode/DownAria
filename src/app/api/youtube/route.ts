import { NextRequest, NextResponse } from 'next/server';
import { scrapeYouTubeInnertube } from '@/lib/services/youtube-innertube';
import { logger } from '@/lib/services/logger';
import { successResponse, errorResponse, missingUrlResponse } from '@/lib/utils/http';
import { isPlatformEnabled, isMaintenanceMode, getMaintenanceMessage, getPlatformDisabledMessage, recordRequest } from '@/lib/services/service-config';

async function handleRequest(url: string) {
    const startTime = Date.now();
    
    if (isMaintenanceMode()) {
        return errorResponse('youtube', getMaintenanceMessage(), 503);
    }
    
    if (!isPlatformEnabled('youtube')) {
        return errorResponse('youtube', getPlatformDisabledMessage('youtube'), 503);
    }
    
    logger.url('youtube', url);
    
    const result = await scrapeYouTubeInnertube(url);
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
    logger.error('youtube', result.error || 'Innertube failed');
    return errorResponse('youtube', result.error || 'Failed to fetch video');
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    
    if (!url) {
        return NextResponse.json({
            name: 'XTFetch YouTube API',
            version: '2.0',
            method: 'Innertube API',
            usage: {
                method: 'GET or POST',
                params: '?url=<youtube_url>',
                body: { url: 'string (required)' },
            },
            example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            supported: ['Videos', 'Shorts', 'Music'],
            limitations: ['360p max (Innertube)'],
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
        const { url } = await request.json();
        if (!url) return missingUrlResponse('youtube');
        return handleRequest(url);
    } catch (error) {
        logger.error('youtube', error);
        return errorResponse('youtube', error instanceof Error ? error.message : 'Failed', 500);
    }
}
