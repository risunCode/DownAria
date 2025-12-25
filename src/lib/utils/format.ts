/**
 * Format Utilities
 * Formatting functions + URL utilities
 */

import { PlatformId, PLATFORMS } from '@/lib/types';

// === FORMATTING ===

/**
 * Format bytes to human readable string
 * @example formatBytes(1536) => "1.5 KB"
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Format download speed
 */
export function formatSpeed(bytesPerSec: number): { mb: string; mbit: string } {
    const mbps = bytesPerSec / (1024 * 1024);
    const mbitps = (bytesPerSec * 8) / (1024 * 1024);
    return {
        mb: mbps.toFixed(2) + ' MB/s',
        mbit: mbitps.toFixed(1) + ' Mbit/s'
    };
}

/**
 * Parse file size string to bytes
 * @example parseFileSizeToBytes("24.3 MB") => 25480396
 */
export function parseFileSizeToBytes(sizeStr: string): number | undefined {
    const match = sizeStr.match(/([\d.]+)\s*(KB|MB|GB)/i);
    if (!match) return undefined;
    
    const num = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    switch (unit) {
        case 'GB': return num * 1024 * 1024 * 1024;
        case 'MB': return num * 1024 * 1024;
        case 'KB': return num * 1024;
        default: return undefined;
    }
}

/**
 * Format duration from seconds
 * @example formatDuration(3661) => "1:01:01"
 */
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format relative time
 * @example formatRelativeTime("2024-01-01") => "3 days ago"
 */
export function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;

    return date.toLocaleDateString();
}

/**
 * Format large numbers with K/M suffix
 * @example formatNumber(1500) => "1.5K"
 */
export function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
}

// === URL UTILITIES ===

/**
 * Detect platform from URL
 */
export function platformDetect(url: string): PlatformId | null {
    for (const platform of PLATFORMS) {
        for (const pattern of platform.patterns) {
            if (pattern.test(url)) {
                return platform.id;
            }
        }
    }
    return null;
}

/**
 * Validate URL for specific platform
 */
export function validateUrl(url: string, platform: PlatformId): boolean {
    const config = PLATFORMS.find(p => p.id === platform);
    if (!config) return false;
    return config.patterns.some(pattern => pattern.test(url));
}

/**
 * Sanitize pasted text to extract URL
 * Handles garbage text around URLs (TikTok shares, etc.)
 */
export function sanitizeUrl(text: string): string {
    if (!text) return '';

    let cleaned = text.replace(/[\r\n]+/g, ' ').trim();

    // Find URL pattern
    const urlPattern = /https?:\/\/[^\s\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+/gi;
    const matches = cleaned.match(urlPattern);

    if (matches && matches.length > 0) {
        let url = matches[0]
            .replace(/[,，。！!?？、；;：:]+$/, '')
            .replace(/\/+$/, '')
            .trim();
        
        if (/\/(v|vm|vt|t|s)\./.test(url) && !url.includes('?')) {
            url = url.replace(/\/?$/, '/');
        }
        
        return url;
    }

    // Check for URLs without protocol
    const noProtocolPattern = /(vm\.tiktok\.com|vt\.tiktok\.com|t\.co|fb\.watch|instagr\.am)\/[^\s\u4e00-\u9fff]+/gi;
    const noProtoMatches = cleaned.match(noProtocolPattern);
    
    if (noProtoMatches && noProtoMatches.length > 0) {
        return 'https://' + noProtoMatches[0].replace(/[,，。！!?？]+$/, '').trim();
    }

    return '';
}