/**
 * HLS to MP4 Downloader
 * Downloads HLS stream segments and concatenates them into a single MP4 file
 * 
 * How it works:
 * 1. Fetch m3u8 playlist
 * 2. Parse segment URLs (.ts files)
 * 3. Download all segments
 * 4. Concatenate into single blob
 * 5. Download as MP4 (TS segments are H.264/AAC, playable as MP4)
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

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
 * Format bytes to human readable
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
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
        
        // Ensure filename ends with .mp4
        const finalFilename = filename.endsWith('.mp4') ? filename : `${filename}.mp4`;
        
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
