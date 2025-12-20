/**
 * Meta API Route (Facebook + Instagram)
 * Handles video/image extraction from Facebook and Instagram
 * 
 * Cookie Priority:
 * 1. User cookie (from request body - localStorage)
 * 2. Admin cookie (from Supabase - global fallback)
 */

import { NextRequest } from 'next/server';
import { scrapeFacebook, scrapeInstagram } from '@/lib/services';
import { detectPlatform as detectPlatformCore } from '@/core/config';
import { logger } from '@/core';
import { successResponse, errorResponse, missingUrlResponse } from '@/lib/http';
import { getAdminCookie } from '@/lib/cookies';
import { 
    isPlatformEnabled, 
    isMaintenanceMode, 
    getMaintenanceMessage, 
    getPlatformDisabledMessage, 
    recordRequest, 
    type PlatformId 
} from '@/core/database';

type MetaPlatform = 'facebook' | 'instagram';

// Detect platform from URL (only facebook/instagram for this endpoint)
function detectPlatform(url: string): MetaPlatform | null {
    const platform = detectPlatformCore(url);
    if (platform === 'instagram' || platform === 'facebook') return platform;
    return null;
}

// Get effective cookie (user > admin)
async function getEffectiveCookie(
    userCookie: string | undefined, 
    platform: MetaPlatform
): Promise<string | undefined> {
    // User cookie takes priority
    if (userCookie) return userCookie;
    
    // Fallback to admin cookie
    const adminCookie = await getAdminCookie(platform);
    return adminCookie || undefined;
}

async function handleRequest(url: string, userCookie?: string, skipCache = false) {
    const startTime = Date.now();
    
    // Check maintenance mode
    if (isMaintenanceMode()) {
        return errorResponse('facebook', getMaintenanceMessage(), 503);
    }
    
    if (!url) return missingUrlResponse('facebook');

    // Detect platform
    const platform = detectPlatform(url);
    if (!platform) {
        return errorResponse('facebook', 'Invalid Facebook/Instagram URL');
    }
    
    // Check if platform is enabled
    if (!isPlatformEnabled(platform as PlatformId)) {
        return errorResponse(platform, getPlatformDisabledMessage(platform as PlatformId), 503);
    }

    logger.url(platform, url);
    
    // Scrape based on platform
    const scraper = platform === 'instagram' ? scrapeInstagram : scrapeFacebook;
    
    // Check if content requires cookie (stories, groups)
    const requiresCookie = /\/stories\/|\/groups\//.test(url);
    
    // Get cookie upfront for content that requires it
    const cookie = await getEffectiveCookie(userCookie, platform);
    
    let result;
    let usedCookie = false;
    
    if (requiresCookie) {
        // For stories/groups: use cookie directly (skip guest attempt)
        if (cookie) {
            logger.debug(platform, `Using ${userCookie ? 'user' : 'admin'} cookie for private content...`);
            result = await scraper(url, { cookie, skipCache });
            usedCookie = result.success;
        } else {
            logger.debug(platform, 'No cookie available for private content');
            result = { success: false, error: 'This content requires login. Please add your cookie in Settings.' };
        }
    } else {
        // For public content: pass cookie to scraper for internal retry logic
        // Scraper will try guest first, then retry with cookie if needed
        logger.debug(platform, cookie ? 'Scraping with cookie available for retry...' : 'Scraping without cookie...');
        result = await scraper(url, { cookie, skipCache });
        // Check if scraper actually used cookie (from result.data.usedCookie)
        usedCookie = result.success && result.data?.usedCookie === true;
    }

    const responseTime = Date.now() - startTime;
    
    if (result.success && result.data) {
        logger.meta(platform, {
            title: result.data.title,
            author: result.data.author,
            formats: result.data.formats.length,
        });
        recordRequest(platform as PlatformId, true, responseTime);
        // Add usedCookie and responseTime to response
        return successResponse(platform, { ...result.data, usedCookie, responseTime });
    }

    recordRequest(platform as PlatformId, false, responseTime);
    logger.error(platform, result.error || 'No media found');
    return errorResponse(platform, result.error || 'Could not extract media');
}

// GET: /api/meta or /api/meta?url=...
export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    
    // No URL = return usage info
    if (!url) {
        return Response.json({
            name: 'XTFetch Meta API',
            version: '2.0',
            platforms: ['Facebook', 'Instagram'],
            usage: {
                method: 'POST (recommended) or GET',
                body: { url: 'string (required)', cookie: 'string (optional)' },
            },
            examples: {
                facebook: 'https://www.facebook.com/share/p/abc123/',
                instagram: 'https://www.instagram.com/p/abc123/',
            },
            supported: {
                facebook: ['Posts', 'Reels', 'Stories', 'Groups', 'Videos'],
                instagram: ['Posts', 'Reels', 'Stories', 'Carousels', 'IGTV'],
            },
            cookies: {
                facebook: 'c_user, xs (for Stories, Groups)',
                instagram: 'sessionid (for private/age-restricted)',
            },
            notes: 'Cookie optional for public content, required for private/stories',
        });
    }
    
    try {
        const cookie = request.nextUrl.searchParams.get('cookie') || undefined;
        return handleRequest(url, cookie);
    } catch (error) {
        logger.error('facebook', error);
        return errorResponse('facebook', error instanceof Error ? error.message : 'Failed to fetch', 500);
    }
}

// POST: /api/meta { url, cookie, skipCache }
export async function POST(request: NextRequest) {
    try {
        const { url, cookie, skipCache } = await request.json();
        return handleRequest(url, cookie, skipCache);
    } catch (error) {
        logger.error('facebook', error);
        return errorResponse('facebook', error instanceof Error ? error.message : 'Failed to fetch', 500);
    }
}


