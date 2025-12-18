/**
 * Cobalt API Scraper Service
 * ==========================
 * Uses cobalt.tools API for downloading from multiple platforms.
 * 
 * Supported: TikTok, Douyin, YouTube, Twitter/X, Instagram, Reddit, 
 *            Tumblr, Twitch, SoundCloud, Bilibili, etc.
 * 
 * API Docs: https://github.com/imputnet/cobalt/blob/main/docs/api.md
 * 
 * Note: cobalt.tools is free and does not require API key for public instance.
 * Rate limit: 20 req/second
 */

import { MediaFormat } from '@/lib/types';
import { fetchWithTimeout, ScraperResult, ScraperOptions, BROWSER_HEADERS } from './fetch-helper';
import { getCache, setCache } from './cache';
import { createError, ScraperErrorCode } from './errors';
import { logger } from './logger';

// ═══════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════

// Public Cobalt API instance (uses co.wuk.sh which is the official public instance)
// Alternative: self-host from https://github.com/imputnet/cobalt
const COBALT_API_URL = 'https://api.cobalt.tools';

// Fallback API instances (in case main is down)
const COBALT_FALLBACKS = [
    'https://co.wuk.sh',
    'https://cobalt.iikku.dev',
];

const COBALT_HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
};

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface CobaltRequest {
    url: string;
    videoQuality?: '144' | '240' | '360' | '480' | '720' | '1080' | '1440' | '2160' | '4320' | 'max';
    audioFormat?: 'best' | 'mp3' | 'ogg' | 'wav' | 'opus';
    audioBitrate?: '320' | '256' | '128' | '96' | '64' | '8';
    downloadMode?: 'auto' | 'audio' | 'mute';
    filenameStyle?: 'classic' | 'pretty' | 'basic' | 'nerdy';
    disableMetadata?: boolean;
    tiktokFullAudio?: boolean;
    allowH265?: boolean;
}

interface CobaltTunnelResponse {
    status: 'tunnel' | 'redirect';
    url: string;
    filename: string;
}

interface CobaltPickerItem {
    type: 'video' | 'photo' | 'gif';
    url: string;
    thumb?: string;
}

interface CobaltPickerResponse {
    status: 'picker';
    audio?: string;
    audioFilename?: string;
    picker: CobaltPickerItem[];
}

interface CobaltErrorResponse {
    status: 'error';
    error: {
        code: string;
        context?: {
            service?: string;
        };
    };
}

type CobaltResponse = CobaltTunnelResponse | CobaltPickerResponse | CobaltErrorResponse;

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function mapCobaltError(code: string): ScraperErrorCode {
    const errorMap: Record<string, ScraperErrorCode> = {
        'error.api.link.invalid': ScraperErrorCode.INVALID_URL,
        'error.api.link.unsupported': ScraperErrorCode.UNSUPPORTED_PLATFORM,
        'error.api.content.video.unavailable': ScraperErrorCode.NOT_FOUND,
        'error.api.content.video.private': ScraperErrorCode.PRIVATE_CONTENT,
        'error.api.content.video.age': ScraperErrorCode.AGE_RESTRICTED,
        'error.api.content.video.live': ScraperErrorCode.NO_MEDIA,
        'error.api.content.post.unavailable': ScraperErrorCode.NOT_FOUND,
        'error.api.content.post.private': ScraperErrorCode.PRIVATE_CONTENT,
        'error.api.fetch.fail': ScraperErrorCode.NETWORK_ERROR,
        'error.api.rate-limit': ScraperErrorCode.RATE_LIMITED,
    };
    return errorMap[code] || ScraperErrorCode.UNKNOWN;
}

function getQualityLabel(quality: string, type: 'video' | 'photo' | 'gif' | 'audio'): string {
    if (type === 'audio') return 'Audio';
    if (type === 'photo') return 'Image';
    if (type === 'gif') return 'GIF';

    // For video, try to extract resolution
    if (quality.includes('2160') || quality.includes('4k')) return 'UHD 4K';
    if (quality.includes('1440')) return 'QHD 1440p';
    if (quality.includes('1080')) return 'Full HD 1080p';
    if (quality.includes('720')) return 'HD 720p';
    if (quality.includes('480')) return 'SD 480p';
    if (quality.includes('360')) return 'Low 360p';
    return 'Video';
}

// ═══════════════════════════════════════════════════════════════
// MAIN SCRAPER
// ═══════════════════════════════════════════════════════════════

/**
 * Download media using Cobalt API
 * Works for: Douyin, TikTok, YouTube, Twitter, Instagram, etc.
 */
export async function scrapeCobalt(
    url: string,
    options?: ScraperOptions & {
        quality?: CobaltRequest['videoQuality'];
        audioOnly?: boolean;
    }
): Promise<ScraperResult> {
    const { skipCache = false, quality = '1080', audioOnly = false } = options || {};

    // Determine platform for logging (cast to valid PlatformId)
    type LogPlatform = 'douyin' | 'tiktok' | 'youtube' | 'twitter' | 'instagram' | 'facebook';
    const platform: LogPlatform = url.includes('douyin') ? 'douyin' :
        url.includes('tiktok') ? 'tiktok' :
            url.includes('youtube') || url.includes('youtu.be') ? 'youtube' :
                url.includes('twitter') || url.includes('x.com') ? 'twitter' :
                    url.includes('instagram') ? 'instagram' : 'tiktok';

    // Check cache
    if (!skipCache) {
        const cached = await getCache<ScraperResult>(platform, url);
        if (cached?.success) {
            logger.cache(platform, true);
            return { ...cached, cached: true };
        }
    }

    logger.debug(platform, `Using Cobalt API for: ${url.substring(0, 50)}...`);

    // Build request body
    const requestBody: CobaltRequest = {
        url,
        videoQuality: quality,
        filenameStyle: 'basic',
        downloadMode: audioOnly ? 'audio' : 'auto',
        tiktokFullAudio: true,
        allowH265: false, // Better compatibility
    };

    // Try main API, then fallbacks
    const apisToTry = [COBALT_API_URL, ...COBALT_FALLBACKS];
    let lastError: Error | null = null;

    for (const apiUrl of apisToTry) {
        try {
            const res = await fetchWithTimeout(apiUrl, {
                method: 'POST',
                headers: COBALT_HEADERS,
                body: JSON.stringify(requestBody),
                timeout: 15000,
            });

            if (!res.ok) {
                if (res.status === 429) {
                    return createError(ScraperErrorCode.RATE_LIMITED, 'Cobalt rate limit reached');
                }
                lastError = new Error(`HTTP ${res.status}`);
                continue;
            }

            const data: CobaltResponse = await res.json();

            // Handle error response
            if (data.status === 'error') {
                const errorCode = data.error?.code || 'unknown';
                logger.debug(platform, `Cobalt error: ${errorCode}`);
                return createError(mapCobaltError(errorCode), `Cobalt: ${errorCode}`);
            }

            const formats: MediaFormat[] = [];

            // Handle tunnel/redirect response (single file)
            if (data.status === 'tunnel' || data.status === 'redirect') {
                formats.push({
                    quality: audioOnly ? 'Audio' : `Video ${quality}p`,
                    type: audioOnly ? 'audio' : 'video',
                    url: data.url,
                    format: audioOnly ? 'mp3' : 'mp4',
                    itemId: 'main',
                    filename: data.filename,
                });
            }

            // Handle picker response (multiple items - slideshows, galleries)
            if (data.status === 'picker') {
                data.picker.forEach((item, idx) => {
                    const mediaType = item.type === 'photo' ? 'image' :
                        item.type === 'gif' ? 'video' : 'video';
                    formats.push({
                        quality: getQualityLabel('', item.type),
                        type: mediaType,
                        url: item.url,
                        format: item.type === 'photo' ? 'jpg' : 'mp4',
                        itemId: `item-${idx}`,
                        thumbnail: item.thumb,
                    });
                });

                // Add audio if available for picker
                if (data.audio) {
                    formats.push({
                        quality: 'Audio',
                        type: 'audio',
                        url: data.audio,
                        format: 'mp3',
                        itemId: 'audio',
                        filename: data.audioFilename,
                    });
                }
            }

            if (formats.length === 0) {
                return createError(ScraperErrorCode.NO_MEDIA, 'No media found');
            }

            const result: ScraperResult = {
                success: true,
                data: {
                    title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Video`,
                    author: '',
                    thumbnail: formats.find(f => f.thumbnail)?.thumbnail || '',
                    formats,
                    url,
                    type: formats.some(f => f.type === 'video') ? 'video' :
                        formats.some(f => f.type === 'image') ? 'image' : 'video',
                },
            };

            const videoCount = formats.filter(f => f.type === 'video').length;
            const imageCount = formats.filter(f => f.type === 'image').length;
            const audioCount = formats.filter(f => f.type === 'audio').length;
            logger.media(platform, { videos: videoCount, images: imageCount, audio: audioCount });

            setCache(platform, url, result);
            return result;

        } catch (e) {
            lastError = e instanceof Error ? e : new Error('Unknown error');
            logger.debug(platform, `Cobalt API ${apiUrl} failed: ${lastError.message}`);
            continue;
        }
    }

    logger.error(platform, lastError);
    return createError(ScraperErrorCode.NETWORK_ERROR, lastError?.message || 'All Cobalt APIs failed');
}

/**
 * Dedicated Douyin scraper using Cobalt
 */
export async function scrapeDouyin(url: string, options?: ScraperOptions): Promise<ScraperResult> {
    return scrapeCobalt(url, { ...options, quality: '1080' });
}

/**
 * Alternative YouTube scraper using Cobalt (backup)
 */
export async function scrapeYouTubeCobalt(url: string, options?: ScraperOptions): Promise<ScraperResult> {
    return scrapeCobalt(url, { ...options, quality: 'max' });
}

// Re-export for convenience
export type { CobaltRequest, CobaltResponse };
