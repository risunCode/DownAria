import { createScrapeHandler } from '@/lib/utils/route-handler';
import { fetchTikWM } from '@/lib/services/tiktok';
import { resolveUrl } from '@/lib/services/fetch-helper';

// Wrap TikWM for Douyin with short URL resolution
async function scrapeDouyin(url: string) {
    // Resolve short URL (v.douyin.com -> www.douyin.com)
    const actualUrl = url.includes('v.douyin.com') ? await resolveUrl(url) : url;

    const result = await fetchTikWM(actualUrl);
    if (result.success && result.data) {
        return {
            success: true,
            data: { ...result.data, url: actualUrl },
        };
    }
    return {
        success: false,
        error: result.error || 'Could not extract video. May be private or region-locked.',
    };
}

export const POST = createScrapeHandler({
    platform: 'douyin',
    scraper: scrapeDouyin,
});
