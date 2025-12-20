/**
 * YouTube Scraper - Using External Free API
 * API: yt-manager-dl-cc.vercel.app
 * 
 * Returns:
 * - Video: HLS stream (m3u8) - needs client-side segment concatenation
 * - Audio: Direct MP3 download
 */

import axios from 'axios';
import { ScraperResult, ScraperOptions, createError, ScraperErrorCode } from '@/core/scrapers/types';

const API_BASE = 'https://yt-manager-dl-cc.vercel.app/api';
const TIMEOUT = 30000;

interface VideoResponse {
    status: boolean;
    heading: string;
    link: string;
    duration: string;
}

interface AudioResponse {
    title: string;
    download: string;
    type: string;
}

interface SearchResult {
    type: string;
    videoId: string;
    url: string;
    title: string;
    description: string;
    thumbnail: string;
    seconds: number;
    timestamp: string;
    views: number;
    author: {
        name: string;
        url: string;
    };
}

interface SearchResponse {
    results: SearchResult[];
}

/**
 * Extract YouTube video ID from various URL formats
 */
function extractVideoId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * Sanitize title for filename
 * Format: YouTube_Title_Quality_[XTFetch].ext
 */
function sanitizeTitle(title: string): string {
    return title
        .replace(/[<>:"/\\|?*]/g, '') // Remove invalid filename chars
        .replace(/\s+/g, '_')          // Replace spaces with underscore
        .replace(/_+/g, '_')           // Collapse multiple underscores
        .substring(0, 50)              // Limit length
        .replace(/_$/, '');            // Remove trailing underscore
}

/**
 * Format view count to human readable
 */
function formatViews(views: number): string {
    if (views >= 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1)}B`;
    if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
    if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
    return views.toString();
}

/**
 * Estimate file size from duration
 * Video: ~2.5 MB/min for HD, Audio: ~1 MB/min for MP3
 */
function estimateFileSize(durationStr: string, type: 'video' | 'audio'): { bytes: number; display: string } {
    // Parse duration like "3:33" or "1:10:22"
    const parts = durationStr.split(':').map(Number);
    let seconds = 0;
    
    if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
    } else {
        seconds = parts[0] || 0;
    }
    
    // Estimate: Video ~2.5 MB/min, Audio ~1 MB/min
    const mbPerMin = type === 'video' ? 2.5 : 1;
    const bytes = Math.round((seconds / 60) * mbPerMin * 1024 * 1024);
    
    // Format display
    const mb = bytes / (1024 * 1024);
    const display = mb >= 1000 ? `~${(mb / 1024).toFixed(1)} GB` : `~${mb.toFixed(1)} MB`;
    
    return { bytes, display };
}

/**
 * Main YouTube scraper
 */
export async function scrapeYouTube(url: string, _options?: ScraperOptions): Promise<ScraperResult> {
    try {
        // Extract video ID
        const videoId = extractVideoId(url);
        if (!videoId) {
            return createError(ScraperErrorCode.INVALID_URL, 'Invalid YouTube URL. Supported: youtube.com/watch, youtu.be, youtube.com/shorts');
        }

        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

        // Fetch video and audio in parallel
        const [videoRes, audioRes] = await Promise.allSettled([
            axios.get<VideoResponse>(`${API_BASE}/video?url=${encodeURIComponent(youtubeUrl)}`, { timeout: TIMEOUT }),
            axios.get<AudioResponse>(`${API_BASE}/audio?url=${encodeURIComponent(youtubeUrl)}`, { timeout: TIMEOUT }),
        ]);

        // Extract results
        const video = videoRes.status === 'fulfilled' ? videoRes.value.data : null;
        const audio = audioRes.status === 'fulfilled' ? audioRes.value.data : null;

        // Need at least video or audio
        if (!video?.status && !audio?.download) {
            return createError(ScraperErrorCode.NO_MEDIA, 'Could not extract media from this video');
        }

        // Build formats array
        const formats = [];
        // Priority: audio.title (usually correct) > video.heading > fallback to videoId
        const rawTitle = audio?.title || video?.heading || '';
        const title = rawTitle && rawTitle !== 'YouTube' ? rawTitle : `Video_${videoId}`;
        const safeTitle = sanitizeTitle(title);
        const duration = video?.duration || '0:00';

        // Add video format (HLS)
        if (video?.status && video.link) {
            const videoSize = estimateFileSize(duration, 'video');
            formats.push({
                url: video.link,
                quality: 'HD Video',
                type: 'video' as const,
                format: 'm3u8',
                isHLS: true, // Flag for client to handle HLS download
                filename: `YT_${safeTitle}_HD_[XTFetch].m3u8`,
                fileSize: videoSize.display,
                filesize: videoSize.bytes,
            });
        }

        // Add audio format (MP3)
        if (audio?.download) {
            const audioSize = estimateFileSize(duration, 'audio');
            formats.push({
                url: audio.download,
                quality: 'MP3 Audio',
                type: 'audio' as const,
                format: 'mp3',
                filename: `YT_${safeTitle}_MP3_[XTFetch].mp3`,
                fileSize: audioSize.display,
                filesize: audioSize.bytes,
            });
        }

        // Get best thumbnail
        const thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
        const fallbackThumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        return {
            success: true,
            data: {
                title: rawTitle || `YouTube Video (${videoId})`,
                thumbnail,
                author: 'YouTube',
                url: youtubeUrl,
                duration: video?.duration,
                formats,
                type: 'video',
            },
        };
    } catch (error) {
        // Handle specific errors
        if (axios.isAxiosError(error)) {
            if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
                return createError(ScraperErrorCode.TIMEOUT, 'Request timed out. Please try again.');
            }
            if (error.response?.status === 429) {
                return createError(ScraperErrorCode.RATE_LIMITED, 'Too many requests. Please wait a moment.');
            }
            if (error.response?.status === 404) {
                return createError(ScraperErrorCode.NOT_FOUND, 'Video not found or unavailable.');
            }
        }

        console.error('[YouTube] Scraper error:', error);
        return createError(
            ScraperErrorCode.API_ERROR,
            error instanceof Error ? error.message : 'Failed to fetch video'
        );
    }
}

/**
 * Search YouTube videos by title
 */
export async function searchYouTube(query: string, limit = 10): Promise<{
    success: boolean;
    results?: SearchResult[];
    error?: string;
}> {
    try {
        const res = await axios.get<SearchResponse>(
            `${API_BASE}/search?title=${encodeURIComponent(query)}`,
            { timeout: TIMEOUT }
        );

        const results = res.data.results?.slice(0, limit).map(r => ({
            ...r,
            viewsFormatted: formatViews(r.views),
        }));

        return { success: true, results };
    } catch (error) {
        console.error('[YouTube] Search error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Search failed',
        };
    }
}

export default scrapeYouTube;
