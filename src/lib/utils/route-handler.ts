/**
 * Unified Route Handler for Social Media Scrapers
 * Reduces boilerplate across all platform API routes
 */

import { NextRequest } from 'next/server';
import { logger } from '@/lib/services/logger';
import { successResponse, errorResponse, missingUrlResponse } from '@/lib/utils/http';
import { ScraperResult, ScraperOptions } from '@/lib/services/fetch-helper';
import { PlatformId } from '@/lib/services/api-config';
import { trackDownload, trackError, getCountryFromHeaders, Platform, Quality } from '@/lib/supabase';
import { isPlatformEnabled, isMaintenanceMode, getMaintenanceMessage, getPlatformDisabledMessage, recordRequest, type PlatformId as ServicePlatformId } from '@/lib/services/service-config';
import { getAdminCookie, type CookiePlatform } from '@/lib/utils/admin-cookie';

type ScrapeFunction = (url: string, options?: ScraperOptions) => Promise<ScraperResult>;

interface RouteOptions {
    /** Platform identifier for logging and responses */
    platform: PlatformId;
    /** The scraper function to call */
    scraper: ScrapeFunction;
    /** Custom error handler for platform-specific errors (e.g., Weibo cookie) */
    handleError?: (result: ScraperResult) => Response | null;
}

// Detect quality from formats
function detectQuality(formats: Array<{ quality?: string; height?: number }>): Quality {
    for (const f of formats) {
        const q = f.quality?.toLowerCase() || '';
        const h = f.height || 0;
        if (q.includes('hd') || q.includes('1080') || h >= 1080) return 'HD';
        if (q.includes('720') || h >= 720) return 'HD';
        if (q.includes('audio') || q.includes('mp3')) return 'audio';
    }
    return 'SD';
}

/**
 * Creates a POST handler for scraping endpoints
 * 
 * @example
 * // In your route.ts:
 * import { createScrapeHandler } from '@/lib/utils/route-handler';
 * import { scrapeTwitter } from '@/lib/services/twitter';
 * 
 * export const POST = createScrapeHandler({
 *     platform: 'twitter',
 *     scraper: scrapeTwitter,
 * });
 */
export function createScrapeHandler({ platform, scraper, handleError }: RouteOptions) {
    return async function POST(request: NextRequest) {
        const country = getCountryFromHeaders(request.headers);
        const startTime = Date.now();
        
        // Check maintenance mode
        if (isMaintenanceMode()) {
            return errorResponse(platform, getMaintenanceMessage(), 503);
        }
        
        // Check if platform is enabled
        if (!isPlatformEnabled(platform as ServicePlatformId)) {
            return errorResponse(platform, getPlatformDisabledMessage(platform as ServicePlatformId), 503);
        }
        
        try {
            const { url, cookie } = await request.json();
            if (!url) return missingUrlResponse(platform);

            logger.url(platform, url);
            
            // SAFE COOKIE LOGIC: Try without cookie first, then with cookie if fails
            // This prevents shadow bans from overusing cookies
            // Only applies to: Facebook, Instagram, Twitter/X, Weibo
            const cookiePlatforms = ['facebook', 'instagram', 'twitter', 'weibo'];
            const useSafeCookie = cookiePlatforms.includes(platform);
            
            // Get effective cookie: user cookie > admin cookie
            let effectiveCookie = cookie;
            if (!effectiveCookie && cookiePlatforms.includes(platform)) {
                effectiveCookie = await getAdminCookie(platform as CookiePlatform) || undefined;
                if (effectiveCookie) {
                    logger.debug(platform, 'Using admin cookie from Supabase');
                }
            }
            
            let result: ScraperResult;
            if (useSafeCookie && effectiveCookie) {
                // Try without cookie first
                result = await scraper(url);
                
                // If failed, retry with cookie
                if (!result.success) {
                    logger.debug(platform, 'Retrying with cookie...');
                    result = await scraper(url, { cookie: effectiveCookie });
                }
            } else {
                // For other platforms or no cookie provided, use directly
                result = await scraper(url, effectiveCookie ? { cookie: effectiveCookie } : undefined);
            }

            if (result.success && result.data) {
                const responseTime = Date.now() - startTime;
                logger.meta(platform, {
                    title: result.data.title,
                    author: result.data.author,
                    formats: result.data.formats.length,
                });
                
                // Record stats for service control
                recordRequest(platform as ServicePlatformId, true, responseTime);
                
                // Track successful download
                trackDownload({
                    platform: platform as Platform,
                    quality: detectQuality(result.data.formats || []),
                    source: 'web',
                    country,
                    success: true,
                });
                
                return successResponse(platform, result.data);
            }

            // Record failed request stats
            const responseTime = Date.now() - startTime;
            recordRequest(platform as ServicePlatformId, false, responseTime);
            
            // Track failed download
            trackDownload({
                platform: platform as Platform,
                quality: 'unknown',
                source: 'web',
                country,
                success: false,
                error_type: 'scrape_failed',
            });

            // Allow platform-specific error handling
            if (handleError) {
                const customResponse = handleError(result);
                if (customResponse) return customResponse;
            }

            logger.error(platform, result.error || 'No media found');
            return errorResponse(platform, result.error || 'Could not extract media');
        } catch (error) {
            // Track error
            trackError({
                platform: platform as Platform,
                source: 'web',
                country,
                error_type: 'exception',
                error_message: error instanceof Error ? error.message : 'Unknown error',
            });
            
            logger.error(platform, error);
            return errorResponse(platform, error instanceof Error ? error.message : 'Failed to fetch', 500);
        }
    };
}
