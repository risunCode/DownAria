/**
 * YouTube Scraper using ytdl-core
 * Supports cookies for age-restricted/private content
 */

import ytdl from 'ytdl-core';
import { ScraperErrorCode, createError } from './errors';
import type { ScraperResult, ScraperOptions, ScraperData } from './fetch-helper';
import type { MediaFormat, UnifiedEngagement } from '@/lib/types';
import { logger } from './logger';
import { getCache, setCache } from './cache';

// Disable update check (we manage our own updates)
process.env.YTDL_NO_UPDATE = '1';

/**
 * Parse cookie string to ytdl-core format
 */
function parseCookiesForYtdl(cookieStr: string): { name: string; value: string }[] {
    if (!cookieStr) return [];
    
    // Handle JSON array format from Cookie Editor
    if (cookieStr.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(cookieStr);
            if (Array.isArray(parsed)) {
                return parsed
                    .filter((c: { name?: string; value?: string; domain?: string }) => 
                        c.name && c.value && (c.domain?.includes('youtube') || c.domain?.includes('google'))
                    )
                    .map((c: { name: string; value: string }) => ({ name: c.name, value: c.value }));
            }
        } catch {
            // Not valid JSON
        }
    }
    
    // Handle plain string format: name=value; name2=value2
    return cookieStr.split(';')
        .map(pair => {
            const [name, ...valueParts] = pair.trim().split('=');
            return { name: name?.trim(), value: valueParts.join('=')?.trim() };
        })
        .filter(c => c.name && c.value);
}

/**
 * Format duration from seconds
 */
function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format view count
 */
function formatViews(views: string | number): string {
    const num = typeof views === 'string' ? parseInt(views, 10) : views;
    if (isNaN(num)) return '0';
    
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toString();
}

/**
 * Get quality label from itag or resolution
 */
function getQualityLabel(format: ytdl.videoFormat): string {
    if (format.qualityLabel) return String(format.qualityLabel);
    if (format.audioQuality) return String(format.audioQuality);
    if (format.quality) return String(format.quality);
    return 'Unknown';
}

/**
 * Scrape YouTube video using ytdl-core
 */
export async function scrapeYouTubeYtdl(url: string, options?: ScraperOptions): Promise<ScraperResult> {
    const startTime = Date.now();
    
    // Validate URL
    if (!ytdl.validateURL(url)) {
        return createError(ScraperErrorCode.INVALID_URL, 'Invalid YouTube URL');
    }
    
    const videoId = ytdl.getVideoID(url);
    logger.url('youtube-ytdl', `Fetching: ${videoId}`);
    
    // Check cache first
    if (!options?.skipCache) {
        const cached = await getCache<ScraperData>('youtube', url);
        if (cached) {
            logger.debug('youtube-ytdl', `Cache hit: ${videoId}`);
            return { success: true, data: cached, cached: true };
        }
    }
    
    try {
        // Build ytdl options
        const defaultHeaders: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };
        
        // Add cookies if provided
        if (options?.cookie) {
            const cookies = parseCookiesForYtdl(options.cookie);
            if (cookies.length > 0) {
                defaultHeaders['Cookie'] = cookies.map(c => `${c.name}=${c.value}`).join('; ');
                logger.debug('youtube-ytdl', `Using ${cookies.length} cookies`);
            }
        }
        
        const ytdlOptions: ytdl.getInfoOptions = {
            requestOptions: {
                headers: defaultHeaders,
            },
        };
        
        // Get video info
        const info = await ytdl.getInfo(url, ytdlOptions);
        const details = info.videoDetails;
        
        // Check if video is available
        if (!details || !info.formats || info.formats.length === 0) {
            return createError(ScraperErrorCode.NO_MEDIA, 'No formats available');
        }
        
        // Build formats list
        const formats: MediaFormat[] = [];
        const seenQualities = new Set<string>();
        
        // Filter and sort formats
        const sortedFormats = info.formats
            .filter(f => f.url) // Must have URL
            .sort((a, b) => {
                // Prefer formats with both audio and video
                const aHasBoth = a.hasAudio && a.hasVideo;
                const bHasBoth = b.hasAudio && b.hasVideo;
                if (aHasBoth && !bHasBoth) return -1;
                if (!aHasBoth && bHasBoth) return 1;
                
                // Then by quality (higher first)
                const aHeight = a.height || 0;
                const bHeight = b.height || 0;
                return bHeight - aHeight;
            });
        
        for (const format of sortedFormats) {
            const qualityLabel = getQualityLabel(format);
            const hasAudio = format.hasAudio ?? false;
            const hasVideo = format.hasVideo ?? false;
            
            // Determine type
            let type: 'video' | 'audio' = 'video';
            let quality = qualityLabel;
            
            if (hasVideo && hasAudio) {
                quality = `${qualityLabel} (video+audio)`;
                type = 'video';
            } else if (hasVideo && !hasAudio) {
                quality = `${qualityLabel} (video only)`;
                type = 'video';
            } else if (hasAudio && !hasVideo) {
                quality = `Audio ${format.audioBitrate || ''}kbps`;
                type = 'audio';
            }
            
            // Skip duplicates
            if (seenQualities.has(quality)) continue;
            seenQualities.add(quality);
            
            // Calculate file size
            let fileSize: string | undefined;
            if (format.contentLength) {
                const bytes = parseInt(format.contentLength, 10);
                if (bytes > 1_000_000_000) fileSize = `${(bytes / 1_000_000_000).toFixed(2)} GB`;
                else if (bytes > 1_000_000) fileSize = `${(bytes / 1_000_000).toFixed(2)} MB`;
                else if (bytes > 1_000) fileSize = `${(bytes / 1_000).toFixed(2)} KB`;
            }
            
            formats.push({
                quality,
                type,
                url: format.url,
                hasAudio,
                fileSize,
                mimeType: format.mimeType,
                format: format.container,
            });
            
            // Limit to 10 formats
            if (formats.length >= 10) break;
        }
        
        if (formats.length === 0) {
            return createError(ScraperErrorCode.NO_MEDIA, 'No downloadable formats found');
        }
        
        // Build engagement stats
        const engagement: UnifiedEngagement = {};
        if (details.viewCount) engagement.views = parseInt(details.viewCount, 10);
        if (details.likes) engagement.likes = details.likes;
        
        // Build result
        const data: ScraperData = {
            title: details.title || 'YouTube Video',
            thumbnail: details.thumbnails?.[details.thumbnails.length - 1]?.url || '',
            author: details.author?.name || details.ownerChannelName || 'Unknown',
            authorName: details.author?.name,
            formats,
            url,
            description: details.description || undefined,
            duration: details.lengthSeconds ? formatDuration(parseInt(details.lengthSeconds, 10)) : undefined,
            views: details.viewCount ? formatViews(details.viewCount) : undefined,
            engagement,
            usedCookie: !!options?.cookie,
            type: 'video',
        };
        
        // Cache result
        await setCache('youtube', url, data);
        
        const responseTime = Date.now() - startTime;
        logger.debug('youtube-ytdl', `Success: ${videoId} (${formats.length} formats, ${responseTime}ms)`);
        
        return { success: true, data };
        
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error('youtube-ytdl', `Error: ${msg}`);
        
        // Detect specific errors
        if (msg.includes('Sign in') || msg.includes('age-restricted')) {
            return createError(ScraperErrorCode.AGE_RESTRICTED, 'Age-restricted content. Please provide YouTube cookies.');
        }
        if (msg.includes('private') || msg.includes('Private video')) {
            return createError(ScraperErrorCode.PRIVATE_CONTENT, 'This video is private');
        }
        if (msg.includes('unavailable') || msg.includes('Video unavailable')) {
            return createError(ScraperErrorCode.NOT_FOUND, 'Video unavailable');
        }
        if (msg.includes('429') || msg.includes('Too Many Requests')) {
            return createError(ScraperErrorCode.RATE_LIMITED, 'YouTube rate limit. Try again later.');
        }
        if (msg.includes('copyright')) {
            return createError(ScraperErrorCode.BLOCKED, 'Video blocked due to copyright');
        }
        
        return createError(ScraperErrorCode.API_ERROR, msg);
    }
}

/**
 * Get video info only (without download URLs)
 */
export async function getYouTubeInfo(url: string, options?: ScraperOptions): Promise<ytdl.videoInfo | null> {
    if (!ytdl.validateURL(url)) return null;
    
    try {
        const ytdlOptions: ytdl.getInfoOptions = {};
        
        if (options?.cookie) {
            const cookies = parseCookiesForYtdl(options.cookie);
            if (cookies.length > 0) {
                ytdlOptions.requestOptions = {
                    headers: {
                        Cookie: cookies.map(c => `${c.name}=${c.value}`).join('; '),
                    },
                };
            }
        }
        
        return await ytdl.getBasicInfo(url, ytdlOptions);
    } catch {
        return null;
    }
}

/**
 * Validate YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
    return ytdl.validateURL(url);
}

/**
 * Extract video ID from URL
 */
export function getYouTubeVideoId(url: string): string | null {
    try {
        return ytdl.getVideoID(url);
    } catch {
        return null;
    }
}
