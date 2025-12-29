/**
 * Media Utilities
 * Download helpers, HLS streaming, YouTube merge functionality
 * 
 * Merged from:
 * - download-utils.ts
 * - hls-downloader.ts
 * - youtube-merge.ts
 */

import { MediaData, MediaFormat, PlatformId } from '@/lib/types';
import { formatBytes } from './format';
import { API_URL } from '@/lib/config';

// ============================================================================
// DOWNLOAD UTILITIES (from download-utils.ts)
// ============================================================================

/**
 * Platform short names for filename generation
 */
export const PLATFORM_SHORT_NAMES: Record<string, string> = {
    facebook: 'FB',
    instagram: 'IG',
    twitter: 'X',
    tiktok: 'TT',
    weibo: 'WB',
    youtube: 'YT'
};

/**
 * Extract post ID from various social media URL formats
 */
export function extractPostId(url: string): string {
    const patterns = [
        /\/share\/[rvp]\/([^/?]+)/,
        /\/reel\/(\d+)/,
        /\/videos?\/(\d+)/,
        /\/(p|reel|reels|tv)\/([^/?]+)/,
        /\/video\/(\d+)/,
        /\/status\/(\d+)/,
        /[?&]v=([a-zA-Z0-9_-]{11})/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /\/shorts\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[match.length - 1];
    }
    return Date.now().toString(36);
}

/**
 * Sanitize text for filename (remove special chars, truncate)
 */
function sanitizeForFilename(text: string, maxLength: number = 50): string {
    return text
        .replace(/^@/, '')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9\-_\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g, '')
        .substring(0, maxLength)
        .replace(/_+$/, '') || 'untitled';
}

/**
 * Generate standardized filename for downloaded media
 * Format: Author_Caption_(Quality)_[DownAria].ext
 * 
 * YouTube: Author_Title_(Quality)_[DownAria].ext
 * Others: Author_Caption_(Quality)_[DownAria].ext
 */
export function generateFilename(
    data: MediaData,
    platform: PlatformId,
    format: MediaFormat,
    carouselIndex?: number
): string {
    // Sanitize author
    const author = sanitizeForFilename(data.author || 'unknown', 25);

    // Get caption/title based on platform
    // YouTube uses title, others use description/title as caption
    const rawCaption = platform === 'youtube'
        ? (data.title || '')
        : (data.description || data.title || '');
    const caption = sanitizeForFilename(rawCaption, 50);

    // Extract quality (e.g., "HD (720p)" -> "720p", "1080p" -> "1080p")
    const qualityMatch = format.quality.match(/(\d+p|\d+k|HD|SD|Original|Audio)/i);
    const quality = qualityMatch ? qualityMatch[1] : format.quality.replace(/[^a-zA-Z0-9]/g, '');

    // Determine file extension - use format.format but strip any existing extension first
    // This prevents double extensions like .mp3.mp3 or .m4a.mp4
    let ext = format.format || (format.type === 'video' ? 'mp4' : format.type === 'audio' ? 'mp3' : 'jpg');
    // Remove leading dot if present
    ext = ext.replace(/^\./, '');
    // Strip any existing media extension from the ext itself (handles cases like "mp3.mp4")
    ext = ext.replace(/\.(mp4|webm|mkv|mov|avi|mp3|m4a|aac|opus|wav|jpg|jpeg|png|gif)$/i, '');

    // Carousel suffix for multi-item posts
    const carouselSuffix = carouselIndex ? `_${carouselIndex}` : '';

    // Build filename: Author_Caption_(Quality)_[DownAria].ext
    const parts = [author];
    if (caption && caption !== 'untitled') parts.push(caption);

    // Build base filename without extension
    const baseName = `${parts.join('_')}${carouselSuffix}_(${quality})_[DownAria]`;

    // Remove any existing media extension from baseName before adding the correct one
    // This handles cases where caption/title might contain extension-like patterns
    // Covers: video (mp4, webm, mkv, mov, avi), audio (mp3, m4a, aac, opus, wav), image (jpg, jpeg, png, gif)
    const cleanBaseName = baseName.replace(/\.(mp4|webm|mkv|mov|avi|mp3|m4a|aac|opus|wav|jpg|jpeg|png|gif)$/i, '');

    return `${cleanBaseName}.${ext}`;
}

/**
 * Group media formats by itemId for carousel support
 */
export function groupFormatsByItem(formats: MediaFormat[]): Record<string, MediaFormat[]> {
    const grouped: Record<string, MediaFormat[]> = {};
    formats.forEach(format => {
        const id = format.itemId || 'main';
        if (!grouped[id]) grouped[id] = [];
        grouped[id].push(format);
    });
    return grouped;
}

/**
 * Get item thumbnails from grouped formats
 */
export function getItemThumbnails(formats: MediaFormat[]): Record<string, string> {
    const thumbnails: Record<string, string> = {};
    formats.forEach(format => {
        const id = format.itemId || 'main';
        if (!thumbnails[id]) {
            if (format.thumbnail) {
                thumbnails[id] = format.thumbnail;
            } else if (format.type === 'image' && format.url) {
                thumbnails[id] = format.url;
            }
        }
    });
    return thumbnails;
}

// formatNumber is exported from format.ts - use import { formatNumber } from './format'

/**
 * Check if format is HLS/m3u8 stream
 */
export function isHlsFormat(format: MediaFormat | null): boolean {
    if (!format) return false;
    return format.isHLS === true ||
        format.url.includes('.m3u8') ||
        format.url.includes('hls_playlist') ||
        format.format === 'm3u8' ||
        format.format === 'hls';
}

/**
 * Check if YouTube video can autoplay with audio
 * Only 360p combined format has audio - others are video-only
 * Audio-only formats can always autoplay
 */
export function canYouTubeAutoplay(format: MediaFormat | null, platform: PlatformId): boolean {
    if (!format || platform !== 'youtube') return true; // Non-YouTube always ok

    // Audio can always autoplay
    if (format.type === 'audio') return true;

    // Video: only 360p (combined) has audio, others are video-only
    // needsMerge means video-only (no audio until downloaded)
    if (format.type === 'video' && format.needsMerge) return false;

    return true;
}

/**
 * Get YouTube preview notice message
 * Returns null if no notice needed
 */
export function getYouTubePreviewNotice(format: MediaFormat | null, platform: PlatformId): string | null {
    if (!format || platform !== 'youtube') return null;

    // Video-only formats need notice
    if (format.type === 'video' && format.needsMerge) {
        return '🔇 Preview tanpa suara - dapat diputar setelah download';
    }

    return null;
}

/**
 * Find preferred format from list (HD video > any video > HD image > first)
 */
export function findPreferredFormat(formats: MediaFormat[]): MediaFormat | undefined {
    // First try HD video
    let preferred = formats.find(f =>
        (f.type === 'video' || f.quality.toLowerCase().includes('video')) && (
            f.quality.toLowerCase().includes('hd') ||
            f.quality.toLowerCase().includes('1080') ||
            f.quality.toLowerCase().includes('720')
        )
    );
    // If no HD video, find any video
    if (!preferred) {
        preferred = formats.find(f =>
            f.type === 'video' || f.quality.toLowerCase().includes('video')
        );
    }
    // If no video, find HD non-audio
    if (!preferred) {
        preferred = formats.find(f =>
            f.type !== 'audio' && !f.quality.toLowerCase().includes('audio') && (
                f.quality.toLowerCase().includes('hd') ||
                f.quality.toLowerCase().includes('1080')
            )
        );
    }
    // Fallback to first non-audio, then first
    if (!preferred) {
        preferred = formats.find(f =>
            f.type !== 'audio' && !f.quality.toLowerCase().includes('audio')
        ) || formats[0];
    }
    return preferred;
}

/**
 * Get quality badge text for a format (HD/SD/4K)
 * Returns null for images or unknown quality
 */
export function getQualityBadge(formats: MediaFormat[]): string | null {
    // Only show badge for video content
    const videoFormat = formats.find(f => f.type === 'video');
    if (!videoFormat) return null;

    const quality = videoFormat.quality.toLowerCase();

    // Check for specific resolutions
    if (quality.includes('4k') || quality.includes('2160')) return '4K';
    if (quality.includes('1080') || quality.includes('fhd')) return 'FHD';
    if (quality.includes('hd') || quality.includes('720')) return 'HD';
    if (quality.includes('sd') || quality.includes('480') || quality.includes('360')) return 'SD';

    // Check format quality field patterns
    if (/\b(hd|high)\b/i.test(quality)) return 'HD';
    if (/\b(sd|low|standard)\b/i.test(quality)) return 'SD';

    // Default for video without clear quality indicator
    return null;
}


// ============================================================================
// HLS DOWNLOADER (from hls-downloader.ts)
// ============================================================================

export interface HLSDownloadProgress {
    phase: 'parsing' | 'downloading' | 'merging' | 'complete' | 'error';
    percent: number;
    message: string;
    segmentsLoaded?: number;
    segmentsTotal?: number;
    bytesLoaded?: number;
}

export type ProgressCallback = (progress: HLSDownloadProgress) => void;

/**
 * Parse m3u8 playlist and extract segment URLs
 */
async function parseM3U8(m3u8Url: string): Promise<string[]> {
    // Fetch via proxy to bypass CORS
    const proxyUrl = `${API_URL}/api/v1/proxy?url=${encodeURIComponent(m3u8Url)}&inline=1`;
    const res = await fetch(proxyUrl);

    if (!res.ok) {
        throw new Error(`Failed to fetch playlist: ${res.status}`);
    }

    const text = await res.text();
    const lines = text.split('\n');
    const segments: string[] = [];

    // Base URL for relative segment paths
    const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Check if it's a segment URL
        if (trimmed.includes('.ts') || trimmed.includes('segment')) {
            // Handle relative vs absolute URLs
            if (trimmed.startsWith('http')) {
                segments.push(trimmed);
            } else {
                segments.push(baseUrl + trimmed);
            }
        }
    }

    return segments;
}

/**
 * Download a single segment with retry
 */
async function downloadSegment(url: string, retries = 3): Promise<ArrayBuffer> {
    const proxyUrl = `${API_URL}/api/v1/proxy?url=${encodeURIComponent(url)}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await fetch(proxyUrl);
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            return await res.arrayBuffer();
        } catch (error) {
            if (attempt === retries) {
                throw error;
            }
            // Wait before retry (exponential backoff)
            await new Promise(r => setTimeout(r, 1000 * attempt));
        }
    }

    throw new Error('Failed to download segment');
}

/**
 * Download all segments with progress tracking
 */
async function downloadSegments(
    segmentUrls: string[],
    onProgress?: ProgressCallback
): Promise<ArrayBuffer[]> {
    const segments: ArrayBuffer[] = [];
    const total = segmentUrls.length;
    let bytesLoaded = 0;

    // Download in batches to avoid overwhelming the browser
    const BATCH_SIZE = 3;

    for (let i = 0; i < segmentUrls.length; i += BATCH_SIZE) {
        const batch = segmentUrls.slice(i, i + BATCH_SIZE);

        const batchResults = await Promise.all(
            batch.map(url => downloadSegment(url))
        );

        for (const buffer of batchResults) {
            segments.push(buffer);
            bytesLoaded += buffer.byteLength;
        }

        const loaded = Math.min(i + BATCH_SIZE, total);
        const percent = Math.round((loaded / total) * 85) + 5; // 5-90%

        onProgress?.({
            phase: 'downloading',
            percent,
            message: `Downloading segments ${loaded}/${total}...`,
            segmentsLoaded: loaded,
            segmentsTotal: total,
            bytesLoaded,
        });
    }

    return segments;
}

/**
 * Concatenate segments into single buffer
 */
function concatenateSegments(segments: ArrayBuffer[]): Uint8Array {
    const totalSize = segments.reduce((acc, buf) => acc + buf.byteLength, 0);
    const merged = new Uint8Array(totalSize);

    let offset = 0;
    for (const segment of segments) {
        merged.set(new Uint8Array(segment), offset);
        offset += segment.byteLength;
    }

    return merged;
}

/**
 * Trigger file download in browser
 */
function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Revoke immediately - download has started
    URL.revokeObjectURL(url);
}

/**
 * Main function: Download HLS stream as MP4
 */
export async function downloadHLSAsMP4(
    m3u8Url: string,
    filename: string,
    onProgress?: ProgressCallback
): Promise<{ success: boolean; error?: string; size?: number }> {
    try {
        // Phase 1: Parse playlist
        onProgress?.({
            phase: 'parsing',
            percent: 2,
            message: 'Parsing video playlist...',
        });

        const segmentUrls = await parseM3U8(m3u8Url);

        if (segmentUrls.length === 0) {
            throw new Error('No video segments found in playlist');
        }

        onProgress?.({
            phase: 'parsing',
            percent: 5,
            message: `Found ${segmentUrls.length} segments`,
            segmentsTotal: segmentUrls.length,
        });

        // Phase 2: Download segments
        const segments = await downloadSegments(segmentUrls, onProgress);

        // Phase 3: Merge segments
        onProgress?.({
            phase: 'merging',
            percent: 92,
            message: 'Merging video segments...',
        });

        const merged = concatenateSegments(segments);

        onProgress?.({
            phase: 'merging',
            percent: 98,
            message: 'Preparing download...',
        });

        // Create blob and trigger download
        // Use video/mp4 MIME type - TS segments are H.264/AAC compatible
        const blob = new Blob([merged.buffer as ArrayBuffer], { type: 'video/mp4' });

        // Ensure filename ends with .mp4, replacing any existing media extension
        // This prevents double extensions like .webm.mp4 or .m3u8.mp4
        let finalFilename = filename;
        if (!filename.endsWith('.mp4')) {
            // Remove any existing media extension first, then add .mp4
            finalFilename = filename.replace(/\.(mp4|webm|mkv|mov|avi|m3u8|ts)$/i, '') + '.mp4';
        }

        triggerDownload(blob, finalFilename);

        onProgress?.({
            phase: 'complete',
            percent: 100,
            message: 'Download complete!',
            bytesLoaded: merged.byteLength,
        });

        return { success: true, size: merged.byteLength };

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Download failed';

        onProgress?.({
            phase: 'error',
            percent: 0,
            message: errorMessage,
        });

        return { success: false, error: errorMessage };
    }
}

/**
 * Estimate download size based on duration
 * Rough estimate: ~2-3 MB per minute for HD video
 */
export function estimateSize(durationStr: string): string {
    // Parse duration like "3:33" or "10:22:02"
    const parts = durationStr.split(':').map(Number);
    let seconds = 0;

    if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
    } else {
        seconds = parts[0] || 0;
    }

    // Estimate ~2.5 MB per minute
    const estimatedBytes = (seconds / 60) * 2.5 * 1024 * 1024;
    return formatBytes(estimatedBytes);
}

/**
 * Check if video is too long (warn user about memory usage)
 */
export function isLongVideo(durationStr: string): boolean {
    const parts = durationStr.split(':').map(Number);
    let seconds = 0;

    if (parts.length === 3) {
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        seconds = parts[0] * 60 + parts[1];
    }

    // Consider > 20 minutes as "long"
    return seconds > 20 * 60;
}


// ============================================================================
// YOUTUBE MERGE (from youtube-merge.ts)
// ============================================================================

/**
 * Extended MediaFormat with YouTube-specific properties for merge functionality.
 * These properties are populated by the YouTube scraper to indicate stream types.
 */
export interface YouTubeMediaFormat extends MediaFormat {
    /** Whether this format contains video stream */
    hasVideo?: boolean;
    /** Whether this format contains audio stream */
    hasAudio?: boolean;
    /** Whether this format requires merging with audio (video-only streams) */
    needsMerge?: boolean;
    /** Video codec (e.g., 'avc1', 'vp9', 'none') */
    vcodec?: string;
    /** Audio codec (e.g., 'mp4a', 'opus', 'none') */
    acodec?: string;
    /** Audio bitrate in kbps */
    audioBitrate?: number;
}

export interface YouTubeMergeProgress {
    status: 'idle' | 'preparing' | 'merging' | 'downloading' | 'done' | 'error';
    message: string;
    percent?: number;
    loaded?: number;  // bytes downloaded
    total?: number;   // total bytes (from Content-Length)
    speed?: number;   // bytes per second (fake during merging)
}

export interface YouTubeMergeResult {
    success: boolean;
    blob?: Blob;
    filename?: string;
    error?: string;
}

/**
 * Classify YouTube formats into combined, video-only, and audio-only
 */
export interface ClassifiedFormats {
    combined: YouTubeMediaFormat[];   // Has both video + audio (360p, 720p)
    videoOnly: YouTubeMediaFormat[];  // Video only, needs merge (1080p+)
    audioOnly: YouTubeMediaFormat[];  // Audio only (for merging)
}

/**
 * Classify YouTube formats based on their codec info
 */
export function classifyYouTubeFormats(formats: MediaFormat[]): ClassifiedFormats {
    const combined: YouTubeMediaFormat[] = [];
    const videoOnly: YouTubeMediaFormat[] = [];
    const audioOnly: YouTubeMediaFormat[] = [];

    for (const format of formats) {
        // Skip non-playable formats
        if (!format.url) continue;

        // Cast to YouTubeMediaFormat to access YouTube-specific properties
        const ytFormat = format as YouTubeMediaFormat;

        // Check if format has explicit flags
        if (ytFormat.hasVideo !== undefined && ytFormat.hasAudio !== undefined) {
            if (ytFormat.hasVideo && ytFormat.hasAudio) {
                combined.push(ytFormat);
            } else if (ytFormat.hasVideo && !ytFormat.hasAudio) {
                // Mark as needs merge
                videoOnly.push({ ...ytFormat, needsMerge: true });
            } else if (!ytFormat.hasVideo && ytFormat.hasAudio) {
                audioOnly.push(ytFormat);
            }
            continue;
        }

        // Fallback: detect from codec info
        const hasVideo = ytFormat.vcodec && ytFormat.vcodec !== 'none';
        const hasAudio = ytFormat.acodec && ytFormat.acodec !== 'none';

        if (hasVideo && hasAudio) {
            combined.push({ ...ytFormat, hasVideo: true, hasAudio: true });
        } else if (hasVideo && !hasAudio) {
            videoOnly.push({ ...ytFormat, hasVideo: true, hasAudio: false, needsMerge: true });
        } else if (!hasVideo && hasAudio) {
            audioOnly.push({ ...ytFormat, hasVideo: false, hasAudio: true });
        }
    }

    // Sort video formats by quality (height descending)
    videoOnly.sort((a, b) => (b.height || 0) - (a.height || 0));
    combined.sort((a, b) => (b.height || 0) - (a.height || 0));
    // Sort audio formats by bitrate descending
    audioOnly.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));

    return { combined, videoOnly, audioOnly };
}

/**
 * Get playable formats for display to user
 * - Combined formats (video+audio) are directly playable
 * - Video-only formats need merge but can be shown with "HD" badge
 * - Audio-only formats shown separately
 * 
 * @param formats - All formats from scraper
 * @param includeVideoOnly - Whether to include video-only formats (requires merge)
 * @returns Formats suitable for user display
 */
export function getPlayableFormats(formats: MediaFormat[], includeVideoOnly = true): YouTubeMediaFormat[] {
    const classified = classifyYouTubeFormats(formats);
    const playable: YouTubeMediaFormat[] = [];

    // Add combined formats (directly playable)
    playable.push(...classified.combined);

    // Add video-only formats if requested (will need merge)
    if (includeVideoOnly && classified.audioOnly.length > 0) {
        // Only include video-only if we have audio to merge with
        playable.push(...classified.videoOnly);
    }

    // Add audio-only formats
    playable.push(...classified.audioOnly);

    return playable;
}

/**
 * Check if format is playable in browser (has both video and audio, or is audio-only)
 */
export function isPlayableFormat(format: MediaFormat): boolean {
    // Cast to YouTubeMediaFormat to access YouTube-specific properties
    const ytFormat = format as YouTubeMediaFormat;

    // Audio-only is playable
    if (format.type === 'audio') return true;
    if (ytFormat.hasVideo === false && ytFormat.hasAudio === true) return true;

    // Video with audio is playable
    if (ytFormat.hasVideo === true && ytFormat.hasAudio === true) return true;

    // Video-only is NOT directly playable (needs merge)
    if (ytFormat.hasVideo === true && ytFormat.hasAudio === false) return false;
    if (ytFormat.needsMerge === true) return false;

    // Unknown - assume playable
    return true;
}

/**
 * Find the best compatible audio format for merging with a video format
 * Prefers AAC (m4a) for MP4 output compatibility
 */
export function findBestAudioForMerge(audioFormats: YouTubeMediaFormat[]): YouTubeMediaFormat | null {
    if (audioFormats.length === 0) return null;

    // Prefer AAC/M4A for MP4 compatibility
    const aacFormats = audioFormats.filter(f =>
        f.format === 'm4a' ||
        f.acodec?.includes('mp4a') ||
        f.acodec?.includes('aac')
    );

    if (aacFormats.length > 0) {
        // Return highest bitrate AAC
        return aacFormats.reduce((best, curr) =>
            (curr.audioBitrate || 0) > (best.audioBitrate || 0) ? curr : best
        );
    }

    // Fallback: any audio format (might need re-encode on server)
    return audioFormats[0];
}

/**
 * Get quality label with merge indicator
 */
export function getQualityLabel(format: MediaFormat): { label: string; badge: 'merge' | 'direct' | null } {
    // Cast to YouTubeMediaFormat to access YouTube-specific properties
    const ytFormat = format as YouTubeMediaFormat;
    const label = format.quality || (format.height ? `${format.height}p` : 'Unknown');

    if (ytFormat.needsMerge || (ytFormat.hasVideo && !ytFormat.hasAudio)) {
        return { label, badge: 'merge' };
    }

    if (format.type === 'video' && ytFormat.hasAudio) {
        return { label, badge: 'direct' };
    }

    return { label, badge: null };
}

/**
 * Download merged YouTube video (video + audio)
 * 
 * NEW APPROACH (Dec 2024):
 * Backend now handles everything - just send YouTube URL + quality.
 * Backend will scrape fresh URLs and use yt-dlp for download+merge.
 * 
 * @param youtubeUrl - Original YouTube video URL
 * @param quality - Desired quality (e.g., "1080p", "720p", "480p")
 * @param filename - Output filename
 * @param onProgress - Progress callback
 * @param estimatedSize - Estimated file size in bytes (for realistic fake progress)
 * @returns Promise with merged blob result
 */
export async function downloadMergedYouTube(
    youtubeUrl: string,
    quality: string,
    filename: string,
    onProgress: (progress: YouTubeMergeProgress) => void,
    estimatedSize?: number
): Promise<YouTubeMergeResult> {
    try {
        // Phase 1: Start request
        onProgress({ status: 'preparing', message: 'Preparing...', percent: 0, loaded: 0, total: 0 });

        // Simulate realistic download progress based on estimated size @ 2 Mbps
        // 2 Mbps = 250 KB/s = 256,000 bytes/s (realistic for converting animation)
        const SIMULATED_SPEED = 2 * 1024 * 1024 / 8; // 2 Mbps in bytes/s = 256 KB/s
        const estimatedTotal = estimatedSize || 30 * 1024 * 1024; // Default 30MB if unknown

        // Converting phase: 0-80% with realistic timing
        // We simulate downloading at 2 Mbps, progress updates every 200ms
        const UPDATE_INTERVAL = 200; // ms
        const bytesPerUpdate = SIMULATED_SPEED * (UPDATE_INTERVAL / 1000);
        let fakeLoaded = 0;
        const maxFakePercent = 80; // Stop at 80% until backend responds

        const fakeProgressInterval = setInterval(() => {
            fakeLoaded += bytesPerUpdate * (0.8 + Math.random() * 0.4); // Add some variance
            const fakePercent = Math.min((fakeLoaded / estimatedTotal) * 100, maxFakePercent);
            const fakeMB = (fakeLoaded / 1024 / 1024).toFixed(1);
            const totalMB = (estimatedTotal / 1024 / 1024).toFixed(1);

            if (fakePercent < maxFakePercent) {
                onProgress({
                    status: 'merging',
                    message: `Converting... ${fakeMB} / ~${totalMB} MB (${Math.round(fakePercent)}%)`,
                    percent: Math.round(fakePercent),
                    loaded: Math.round(fakeLoaded),
                    total: estimatedTotal
                });
            }
        }, UPDATE_INTERVAL);

        let response: Response;
        try {
            // Call merge API
            response = await fetch(`${API_URL}/api/v1/youtube/merge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: youtubeUrl,
                    quality,
                    filename
                })
            });
        } catch (fetchError) {
            // Network error - clear interval and rethrow
            clearInterval(fakeProgressInterval);
            throw fetchError;
        }

        // Stop fake progress
        clearInterval(fakeProgressInterval);

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Merge failed' }));
            console.error('[Merge Debug] Response not OK:', response.status, error);
            throw new Error(error.error || `HTTP ${response.status}`);
        }

        // Debug Headers
        const disposition = response.headers.get('content-disposition');
        const contentLength = response.headers.get('content-length');

        // Extract filename from Content-Disposition
        let finalFilename = filename;
        if (disposition) {
            // Try RFC 5987 filename*=UTF-8''... (most reliable)
            const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
            if (utf8Match && utf8Match[1]) {
                finalFilename = decodeURIComponent(utf8Match[1].replace(/['"]/g, ''));
            } else {
                // Fallback to standard filename=
                const filenameMatch = disposition.match(/filename=["']?([^"';]+)["']?/i);
                if (filenameMatch && filenameMatch[1]) {
                    finalFilename = decodeURIComponent(filenameMatch[1]);
                }
            }
        }

        // Final fallback: usage of 'filename' parameter if extraction fails
        if (!finalFilename || finalFilename.trim() === '') {
            finalFilename = filename;
        }

        // Get actual file size from Content-Length header
        const total = contentLength ? parseInt(contentLength) : 0;

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const chunks: Uint8Array[] = [];
        let loaded = 0;
        let lastUpdate = Date.now();

        // First progress with actual total size - jump to 80%
        const totalMB = total > 0 ? (total / 1024 / 1024).toFixed(1) : '?';
        onProgress({
            status: 'downloading',
            message: `Downloading... 0 / ${totalMB} MB (80%)`,
            percent: 80,
            loaded: 0,
            total
        });

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            chunks.push(value);
            loaded += value.length;

            // Throttle progress updates (every 50ms for smoother updates)
            const now = Date.now();
            if (now - lastUpdate > 50) {
                lastUpdate = now;
                // Progress: 80-100% is actual download phase
                const downloadPercent = total > 0
                    ? Math.round((loaded / total) * 20) + 80
                    : 90;
                const loadedMB = (loaded / 1024 / 1024).toFixed(1);

                onProgress({
                    status: 'downloading',
                    message: `Downloading... ${loadedMB} / ${totalMB} MB (${downloadPercent}%)`,
                    percent: Math.min(downloadPercent, 99),
                    loaded,
                    total
                });
            }
        }

        const blob = new Blob(chunks as BlobPart[], { type: 'video/mp4' });
        const finalMB = (blob.size / 1024 / 1024).toFixed(1);

        if (process.env.NODE_ENV === 'development') {
            console.log(`[Merge Debug] Final Blob Size: ${blob.size} bytes (${finalMB} MB)`);
        }

        // Check signature of first chunk
        if (process.env.NODE_ENV === 'development' && chunks.length > 0 && chunks[0].length >= 8) {
            const header = new TextDecoder().decode(chunks[0].slice(0, 40)); // Check first 40 bytes
            console.log('[Merge Debug] First chunk signature (hex):',
                Array.from(chunks[0].slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join(' ')
            );
            console.log('[Merge Debug] First chunk text preview:', header.replace(/[^\x20-\x7E]/g, '.'));
        }

        onProgress({ status: 'done', message: `Done! ${finalMB} MB`, percent: 100, loaded: blob.size, total: blob.size });

        return { success: true, blob, filename: finalFilename };

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        onProgress({ status: 'error', message, percent: 0, loaded: 0, total: 0 });
        return { success: false, error: message };
    }
}

/**
 * Trigger download from blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Delay revocation to ensure browser has time to register the download
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Check if a format needs merge (video-only)
 */
export function needsMerge(format: MediaFormat): boolean {
    // Cast to YouTubeMediaFormat to access YouTube-specific properties
    const ytFormat = format as YouTubeMediaFormat;
    return ytFormat.needsMerge === true ||
        (ytFormat.hasVideo === true && ytFormat.hasAudio === false);
}

/**
 * Extract YouTube video ID from URL
 */
export function extractYouTubeId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/v\/|youtube\.com\/e\/)([a-zA-Z0-9_-]{11})/,
        /(?:music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }

    return null;
}

/**
 * Check if URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
    return /(?:youtube\.com|youtu\.be|music\.youtube\.com)/i.test(url);
}


// ============================================================================
// UNIFIED DOWNLOAD HELPER
// ============================================================================

import { getProxyUrl } from '@/lib/api/proxy';

export interface DownloadProgress {
    status: 'idle' | 'downloading' | 'merging' | 'done' | 'error';
    percent: number;
    loaded: number;
    total: number;
    speed: number;
    message?: string;
}

export interface DownloadResult {
    success: boolean;
    blob?: Blob;
    filename?: string;
    error?: string;
}

/**
 * Unified download function - handles all cases:
 * - Regular direct download
 * - HLS/m3u8 streams
 * - YouTube merge (video + audio)
 */
export async function downloadMedia(
    format: MediaFormat,
    data: MediaData,
    platform: PlatformId,
    carouselIndex?: number,
    onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadResult> {
    try {
        // Generate filename
        let filename = generateFilename(data, platform, format, carouselIndex);

        // Case 1: ALL YouTube downloads go through backend merge endpoint
        if (platform === 'youtube') {
            // Determine extension based on format
            let ext: string;
            if (format.type === 'audio') {
                ext = format.format === 'm4a' ? '.m4a' : '.mp3';
            } else {
                ext = '.mp4';
            }

            // Replace only known media extensions to prevent double extension bug
            // This regex specifically targets media file extensions at the end of filename
            filename = filename.replace(/\.(mp4|webm|mkv|mov|avi|mp3|m4a|aac|opus|wav)$/i, ext);

            if (process.env.NODE_ENV === 'development') {
                console.log(`[Merge Debug] Generated local filename: "${filename}"`);
            }

            onProgress?.({ status: 'merging', percent: 0, loaded: 0, total: 0, speed: 0, message: 'Preparing...' });

            // For audio, pass quality that backend understands
            // M4A -> "M4A", MP3 -> "MP3"
            const qualityParam = format.type === 'audio'
                ? format.quality // "M4A" or "MP3"
                : format.quality; // "1080p", "720p", etc

            const result = await downloadMergedYouTube(
                data.url, // Original YouTube URL
                qualityParam, // e.g., "1080p", "720p", "320kbps", "MP3"
                filename,
                (p) => {
                    const status = p.status === 'done' ? 'done'
                        : p.status === 'error' ? 'error'
                            : p.status === 'downloading' ? 'downloading'
                                : 'merging';

                    onProgress?.({
                        status,
                        percent: p.percent || 0,
                        loaded: p.loaded || 0,
                        total: p.total || 0,
                        speed: (p as { speed?: number }).speed || 0, // Pass through fake speed from merge
                        message: p.message
                    });
                },
                format.filesize
            );

            if (!result.success || !result.blob) {
                return { success: false, error: result.error || 'Download failed' };
            }
            return { success: true, blob: result.blob, filename };
        }

        // Case 2: HLS/m3u8 stream (non-YouTube)
        if (isHlsFormat(format)) {
            filename = filename.replace(/\.m3u8$/i, '.mp4');
            const result = await downloadHLSAsMP4(format.url, filename, (p) => {
                onProgress?.({
                    status: p.phase === 'complete' ? 'done' : p.phase === 'error' ? 'error' : 'downloading',
                    percent: p.percent,
                    loaded: p.bytesLoaded || 0,
                    total: 0,
                    speed: 0,
                    message: p.message
                });
            });

            if (!result.success) {
                return { success: false, error: result.error };
            }
            // HLS downloads directly via triggerDownload inside downloadHLSAsMP4
            return { success: true, filename };
        }

        // Case 3: Regular direct download
        const proxyUrl = getProxyUrl(format.url, { filename, platform });
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength) : 0;
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const chunks: Uint8Array[] = [];
        let loaded = 0;
        let lastTime = Date.now();
        let lastLoaded = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;

            const now = Date.now();
            const timeDiff = now - lastTime;
            if (timeDiff >= 100) {
                const speed = ((loaded - lastLoaded) / timeDiff) * 1000;
                lastTime = now;
                lastLoaded = loaded;
                const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
                onProgress?.({ status: 'downloading', percent, loaded, total, speed });
            }
        }

        onProgress?.({ status: 'done', percent: 100, loaded, total, speed: 0 });
        const blob = new Blob(chunks as BlobPart[]);
        return { success: true, blob, filename };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Download failed';
        onProgress?.({ status: 'error', percent: 0, loaded: 0, total: 0, speed: 0, message: msg });
        return { success: false, error: msg };
    }
}

/**
 * Trigger browser download from blob
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
    if (process.env.NODE_ENV === 'development') {
        console.log(`[Merge Debug] Triggering download with filename: "${filename}"`);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Delay revocation to ensure browser has time to register the download
    setTimeout(() => URL.revokeObjectURL(url), 100);
}
