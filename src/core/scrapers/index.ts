/**
 * Core Scrapers - Barrel Export
 * ==============================
 * Central export point for all platform scrapers.
 * 
 * Usage:
 *   import { scrapeFacebook, scrapeTwitter, getScraper } from '@/core/scrapers';
 * 
 * Migration Strategy:
 *   Phase 1: Re-export from existing lib/services (current)
 *   Phase 2: Gradually move scrapers here with updated imports
 */

// Re-export types
export * from './types';

// Re-export scrapers from existing locations (temporary, for backward compatibility)
export { scrapeFacebook } from '@/lib/services/facebook';
export { scrapeInstagram } from '@/lib/services/instagram';
export { scrapeTwitter } from '@/lib/services/twitter';
export { scrapeTikTok } from '@/lib/services/tiktok';
export { scrapeYouTube } from '@/lib/services/youtube-innertube';
export { scrapeYouTubeYtdl, isValidYouTubeUrl, getYouTubeVideoId } from '@/lib/services/youtube-ytdl';
export { scrapeWeibo } from '@/lib/services/weibo';

// Cobalt API (for Douyin and as YouTube backup)
export { scrapeCobalt, scrapeDouyin, scrapeYouTubeCobalt } from '@/lib/services/cobalt';

// Types re-export for convenience
import type { ScraperResult, ScraperOptions, ScraperFn, PlatformId, ScraperErrorCode } from './types';

// ═══════════════════════════════════════════════════════════════
// SCRAPER FACTORY
// ═══════════════════════════════════════════════════════════════

import { scrapeFacebook } from '@/lib/services/facebook';
import { scrapeInstagram } from '@/lib/services/instagram';
import { scrapeTwitter } from '@/lib/services/twitter';
import { scrapeTikTok } from '@/lib/services/tiktok';
import { scrapeYouTube } from '@/lib/services/youtube-innertube';
import { scrapeWeibo } from '@/lib/services/weibo';
import { ScraperErrorCode as ErrorCode } from './types';

/**
 * Get scraper function for a platform
 */
export function getScraper(platform: PlatformId): ScraperFn | null {
    const scrapers: Partial<Record<PlatformId, ScraperFn>> = {
        facebook: scrapeFacebook,
        instagram: scrapeInstagram,
        twitter: scrapeTwitter,
        tiktok: scrapeTikTok,
        youtube: scrapeYouTube,
        weibo: scrapeWeibo,
        douyin: scrapeTikTok, // Douyin uses same TikWM API
    };
    return scrapers[platform] || null;
}

/**
 * Run scraper for detected platform
 */
export async function runScraper(
    platform: PlatformId,
    url: string,
    options?: ScraperOptions
): Promise<ScraperResult> {
    const scraper = getScraper(platform);
    if (!scraper) {
        return {
            success: false,
            error: `No scraper available for ${platform}`,
            errorCode: ErrorCode.UNSUPPORTED_PLATFORM,
        };
    }
    return scraper(url, options);
}

/**
 * List of supported platforms
 */
export const SUPPORTED_PLATFORMS: PlatformId[] = [
    'facebook',
    'instagram',
    'twitter',
    'tiktok',
    'youtube',
    'weibo',
    'douyin',
];

/**
 * Check if platform is supported
 */
export function isPlatformSupported(platform: string): platform is PlatformId {
    return SUPPORTED_PLATFORMS.includes(platform as PlatformId);
}
