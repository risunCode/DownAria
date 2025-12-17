/**
 * YouTube Innertube API Scraper
 * Pure Node.js implementation - works on Vercel!
 * Uses Android client for direct URLs without signature decryption
 */

import { ScraperResult, ScraperOptions } from './fetch-helper';
import { MediaFormat, formatDuration, formatFileSize } from '@/lib/types';
import { getCache, setCache } from './cache';
import { createError, ScraperErrorCode } from './errors';
import { matchesPlatform } from './api-config';
import { logger } from './logger';

const INNERTUBE_API = 'https://www.youtube.com/youtubei/v1/player';
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

interface InnertubeFormat {
    itag: number;
    url?: string;
    mimeType?: string;
    bitrate?: number;
    width?: number;
    height?: number;
    contentLength?: string;
    quality?: string;
    qualityLabel?: string;
    audioQuality?: string;
    approxDurationMs?: string;
    audioSampleRate?: string;
    audioChannels?: number;
    averageBitrate?: number;
}

interface InnertubeResponse {
    playabilityStatus?: {
        status: string;
        reason?: string;
    };
    videoDetails?: {
        videoId: string;
        title: string;
        lengthSeconds: string;
        author: string;
        viewCount: string;
        thumbnail?: {
            thumbnails: { url: string; width: number; height: number }[];
        };
    };
    streamingData?: {
        formats?: InnertubeFormat[];
        adaptiveFormats?: InnertubeFormat[];
        expiresInSeconds?: string;
    };
}

function extractVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
        /music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
        const m = url.match(p);
        if (m) return m[1];
    }
    return null;
}

async function fetchWithClient(videoId: string, clientType: 'ANDROID' | 'IOS' | 'WEB'): Promise<InnertubeResponse | null> {
    // Build client context based on type
    let clientContext: Record<string, unknown>;
    let userAgent: string;
    
    if (clientType === 'ANDROID') {
        clientContext = {
            clientName: 'ANDROID',
            clientVersion: '19.09.37',
            androidSdkVersion: 30,
            hl: 'en',
            gl: 'US',
            utcOffsetMinutes: 0
        };
        userAgent = 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip';
    } else if (clientType === 'IOS') {
        clientContext = {
            clientName: 'IOS',
            clientVersion: '19.09.3',
            deviceModel: 'iPhone14,3',
            hl: 'en',
            gl: 'US',
            utcOffsetMinutes: 0
        };
        userAgent = 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)';
    } else {
        clientContext = {
            clientName: 'WEB',
            clientVersion: '2.20240101.00.00',
            hl: 'en',
            gl: 'US',
            utcOffsetMinutes: 0
        };
        userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    }
    
    const payload = {
        videoId,
        context: {
            client: clientContext
        },
        playbackContext: {
            contentPlaybackContext: {
                html5Preference: 'HTML5_PREF_WANTS'
            }
        },
        contentCheckOk: true,
        racyCheckOk: true
    };

    try {
        const res = await fetch(`${INNERTUBE_API}?key=${INNERTUBE_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': userAgent
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}


function parseFormats(streamingData: InnertubeResponse['streamingData']): MediaFormat[] {
    if (!streamingData) return [];
    
    const formats: MediaFormat[] = [];
    const seen = new Set<string>();
    
    const allFormats = [
        ...(streamingData.formats || []),
        ...(streamingData.adaptiveFormats || [])
    ];

    for (const f of allFormats) {
        if (!f.url) continue;
        
        const mimeType = f.mimeType || '';
        const hasVideo = mimeType.includes('video');
        const hasAudio = mimeType.includes('audio');
        
        // Combined formats (video + audio)
        if (hasVideo && streamingData.formats?.includes(f)) {
            const quality = f.qualityLabel || f.quality || 'SD';
            const key = `combined-${quality}`;
            if (seen.has(key)) continue;
            seen.add(key);
            
            formats.push({
                quality,
                type: 'video',
                url: f.url,
                hasAudio: true,
                format: mimeType.includes('mp4') ? 'mp4' : 'webm',
                fileSize: f.contentLength ? formatFileSize(parseInt(f.contentLength)) : undefined
            });
        }
        // Video only (adaptive) - SKIP, usually invalid/unplayable
        // Audio only - SKIP, YouTube returns 403 for adaptive audio streams
    }
    
    // Sort: combined first, then by quality
    formats.sort((a, b) => {
        if (a.type === 'audio' && b.type !== 'audio') return 1;
        if (a.type !== 'audio' && b.type === 'audio') return -1;
        if (a.hasAudio && !b.hasAudio) return -1;
        if (!a.hasAudio && b.hasAudio) return 1;
        const aQ = parseInt(a.quality) || 0;
        const bQ = parseInt(b.quality) || 0;
        return bQ - aQ;
    });
    
    return formats;
}

export async function scrapeYouTube(url: string, options?: ScraperOptions): Promise<ScraperResult> {
    const { skipCache = false } = options || {};
    
    // Validate URL
    if (!matchesPlatform(url, 'youtube')) {
        return createError(ScraperErrorCode.INVALID_URL, 'Invalid YouTube URL');
    }
    
    const videoId = extractVideoId(url);
    if (!videoId) {
        return createError(ScraperErrorCode.INVALID_URL, 'Could not extract video ID');
    }
    
    // Check cache
    if (!skipCache) {
        const cached = getCache<ScraperResult>('youtube', url);
        if (cached?.success) {
            logger.debug('youtube', 'Cache hit');
            return { ...cached, cached: true };
        }
    }

    logger.debug('youtube', `Fetching ${videoId}...`);

    // Try Android client first (best for direct URLs)
    let data = await fetchWithClient(videoId, 'ANDROID');
    
    // Fallback to iOS if Android fails
    if (!data || data.playabilityStatus?.status !== 'OK') {
        logger.debug('youtube', 'Android failed, trying iOS...');
        data = await fetchWithClient(videoId, 'IOS');
    }
    
    // Final fallback to Web
    if (!data || data.playabilityStatus?.status !== 'OK') {
        logger.debug('youtube', 'iOS failed, trying Web...');
        data = await fetchWithClient(videoId, 'WEB');
    }

    if (!data) {
        return createError(ScraperErrorCode.NETWORK_ERROR, 'Failed to fetch video data');
    }

    if (data.playabilityStatus?.status !== 'OK') {
        const reason = data.playabilityStatus?.reason || 'Video not available';
        if (reason.includes('private')) return createError(ScraperErrorCode.PRIVATE_CONTENT, reason);
        if (reason.includes('age')) return createError(ScraperErrorCode.AGE_RESTRICTED, reason);
        return createError(ScraperErrorCode.NOT_FOUND, reason);
    }

    const videoDetails = data.videoDetails;
    const formats = parseFormats(data.streamingData);

    if (formats.length === 0) {
        return createError(ScraperErrorCode.NO_MEDIA, 'No downloadable formats found');
    }

    const title = videoDetails?.title || 'YouTube Video';
    const author = videoDetails?.author || '';
    const thumbnail = videoDetails?.thumbnail?.thumbnails?.pop()?.url || 
                     `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const duration = videoDetails?.lengthSeconds ? 
                    formatDuration(parseInt(videoDetails.lengthSeconds)) : undefined;
    const views = videoDetails?.viewCount ? 
                 parseInt(videoDetails.viewCount).toLocaleString() + ' views' : undefined;

    logger.debug('youtube', `Found ${formats.length} formats for "${title}"`);

    const result: ScraperResult = {
        success: true,
        data: {
            title,
            thumbnail,
            author,
            formats,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            duration,
            views,
            type: 'video',
            engagement: videoDetails?.viewCount ? {
                views: parseInt(videoDetails.viewCount) || 0
            } : undefined,
        }
    };
    
    setCache('youtube', url, result);
    logger.success('youtube', formats.length);
    
    return result;
}

// Legacy export for backward compatibility
export const scrapeYouTubeInnertube = scrapeYouTube;
