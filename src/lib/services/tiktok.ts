/**
 * TikTok/Douyin Scraper Service
 * Uses TikWM API for video extraction
 */

import { MediaFormat } from '@/lib/types';
import { addFormat } from '@/lib/utils/http';
import { fetchWithTimeout, ScraperResult, ScraperOptions, EngagementStats, TIKTOK_HEADERS } from './fetch-helper';
import { getCache, setCache } from './cache';
import { createError, ScraperErrorCode } from './errors';
import { matchesPlatform } from './api-config';
import { logger } from './logger';

export async function scrapeTikTok(url: string, options?: ScraperOptions): Promise<ScraperResult> {
    const { hd = true, timeout = 10000, skipCache = false } = options || {};
    
    // Validate URL
    if (!matchesPlatform(url, 'tiktok') && !matchesPlatform(url, 'douyin')) {
        return createError(ScraperErrorCode.INVALID_URL, 'Invalid TikTok/Douyin URL');
    }
    
    // Check cache
    if (!skipCache) {
        const cached = getCache<ScraperResult>('tiktok', url);
        if (cached?.success) {
            logger.debug('tiktok', 'Cache hit');
            return { ...cached, cached: true };
        }
    }
    
    logger.url('tiktok', url);
    
    try {
        const res = await fetchWithTimeout(
            `https://tikwm.com/api/?url=${encodeURIComponent(url)}&hd=${hd ? 1 : 0}`,
            { headers: TIKTOK_HEADERS, timeout }
        );
        
        if (!res.ok) {
            return createError(ScraperErrorCode.API_ERROR, `API error: ${res.status}`);
        }
        
        const { code, data: d, msg } = await res.json();
        
        if (code !== 0 || !d) {
            return createError(ScraperErrorCode.NO_MEDIA, msg || 'No data returned');
        }

        // Extract engagement stats (unified format)
        const engagement: EngagementStats = {
            likes: d.digg_count || 0,
            comments: d.comment_count || 0,
            shares: d.share_count || 0,  // Unified as 'shares'
            views: d.play_count || 0,
        };

        const formats: MediaFormat[] = [];
        const isSlideshow = d.images?.length > 0;
        
        if (isSlideshow) {
            d.images.forEach((img: string, i: number) => {
                addFormat(formats, `Image ${i + 1}`, 'image', img, { itemId: `img-${i}`, thumbnail: img });
            });
        } else {
            const [hdSize, sdSize] = [d.hd_size || d.size || 0, d.wm_size || 0];
            if (d.hdplay && d.play && d.hdplay !== d.play) {
                const [hdUrl, sdUrl] = hdSize >= sdSize ? [d.hdplay, d.play] : [d.play, d.hdplay];
                addFormat(formats, 'HD (No Watermark)', 'video', hdUrl, { itemId: 'video-hd' });
                addFormat(formats, 'SD (No Watermark)', 'video', sdUrl, { itemId: 'video-sd' });
            } else if (d.hdplay) {
                addFormat(formats, 'HD (No Watermark)', 'video', d.hdplay, { itemId: 'video-hd' });
            } else if (d.play) {
                addFormat(formats, 'Video (No Watermark)', 'video', d.play, { itemId: 'video-main' });
            }
        }
        
        if (d.music) {
            addFormat(formats, 'Audio', 'audio', d.music, { itemId: 'audio' });
        }

        if (formats.length === 0) {
            return createError(ScraperErrorCode.NO_MEDIA);
        }

        const result: ScraperResult = {
            success: true,
            data: {
                title: d.title || 'TikTok Video',
                author: d.author?.unique_id || '',
                authorName: d.author?.nickname || '',
                thumbnail: d.cover || d.origin_cover || '',
                formats,
                url,
                type: isSlideshow ? 'slideshow' : 'video',
                engagement: (engagement.likes || engagement.comments || engagement.shares || engagement.views) 
                    ? engagement : undefined,
            }
        };
        
        setCache('tiktok', url, result);
        logger.success('tiktok', formats.length);
        
        return result;
    } catch (e) {
        logger.error('tiktok', e);
        return createError(ScraperErrorCode.NETWORK_ERROR, e instanceof Error ? e.message : 'Fetch failed');
    }
}

// Legacy export for backward compatibility
export const fetchTikWM = scrapeTikTok;

// Re-export types
export type { ScraperResult as TikWMResult };
