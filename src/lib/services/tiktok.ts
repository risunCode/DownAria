/**
 * TikTok Scraper Service
 * Uses TikWM API
 */

import { MediaFormat } from '@/lib/types';
import { addFormat } from '@/lib/http';
import { httpGet, TIKTOK_HEADERS, type EngagementStats } from '@/lib/http';
import { getCache, setCache } from './helper/cache';
import { createError, ScraperErrorCode, type ScraperResult, type ScraperOptions } from '@/core/scrapers/types';
import { matchesPlatform } from './helper/api-config';
import { logger } from './helper/logger';
import { getScraperTimeout } from './helper/system-config';

export async function scrapeTikTok(url: string, options?: ScraperOptions): Promise<ScraperResult> {
    const { hd = true, skipCache = false } = options || {};
    const timeout = options?.timeout ?? getScraperTimeout('tiktok');

    if (!matchesPlatform(url, 'tiktok')) {
        return createError(ScraperErrorCode.INVALID_URL, 'Invalid TikTok URL');
    }

    if (!skipCache) {
        const cached = await getCache<ScraperResult>('tiktok', url);
        if (cached?.success) { logger.cache('tiktok', true); return { ...cached, cached: true }; }
    }

    try {
        const apiUrl = `https://tikwm.com/api/?url=${encodeURIComponent(url)}&hd=${hd ? 1 : 0}`;
        const res = await httpGet(apiUrl, { headers: TIKTOK_HEADERS, timeout });

        if (res.status !== 200) {
            return createError(ScraperErrorCode.API_ERROR, `API error: ${res.status}`);
        }

        const json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        const { code, data: d, msg } = json;

        if (code !== 0 || !d) {
            return createError(ScraperErrorCode.NO_MEDIA, msg || 'No data returned');
        }

        const engagement: EngagementStats = {
            likes: d.digg_count || 0,
            comments: d.comment_count || 0,
            shares: d.share_count || 0,
            views: d.play_count || 0,
        };

        const formats: MediaFormat[] = [];
        const isSlideshow = d.images?.length > 0;
        logger.type('tiktok', isSlideshow ? 'slideshow' : 'video');

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
                engagement: (engagement.likes || engagement.comments || engagement.shares || engagement.views) ? engagement : undefined,
            }
        };

        logger.media('tiktok', { 
            videos: formats.filter(f => f.type === 'video').length, 
            images: formats.filter(f => f.type === 'image').length,
            audio: formats.filter(f => f.type === 'audio').length 
        });

        setCache('tiktok', url, result);
        return result;
    } catch (e) {
        logger.error('tiktok', e);
        return createError(ScraperErrorCode.NETWORK_ERROR, e instanceof Error ? e.message : 'Fetch failed');
    }
}

export const fetchTikWM = scrapeTikTok;
export type { ScraperResult as TikWMResult };
