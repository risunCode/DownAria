// Platform types
export type Platform = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'weibo' | 'youtube';

/**
 * Unified Engagement Stats
 * Normalized across all platforms for consistent display
 */
export interface UnifiedEngagement {
    views?: number;       // View/play count
    likes?: number;       // Like/favorite/heart count
    comments?: number;    // Comment count
    shares?: number;      // Unified: retweets, reposts, shares
    bookmarks?: number;   // Save/bookmark count
    replies?: number;     // Reply count (Twitter)
}

// Media format interface
export interface MediaFormat {
    quality: string;
    type: 'video' | 'audio' | 'image';
    url: string;
    size?: string;
    fileSize?: string; // Human-readable file size (e.g. "32.5 MB")
    filesize?: number; // File size in bytes
    format?: string;
    mimeType?: string;
    filename?: string; // Custom filename hint
    itemId?: string; // To group multiple formats of the same item (e.g. multiple images in a post)
    thumbnail?: string; // Specific thumbnail for this item
    width?: number;
    height?: number;
}

// Download response from API
export interface DownloadResponse {
    success: boolean;
    platform: Platform;
    data?: MediaData;
    error?: string;
    // Flattened structure support (used by some route handlers)
    title?: string;
    thumbnail?: string;
    author?: string;
    formats?: MediaFormat[];
}

// Media data extracted from URL
export interface MediaData {
    title: string;
    thumbnail: string;
    duration?: string;
    author?: string;
    authorUrl?: string;
    views?: string;
    description?: string;
    formats: MediaFormat[];
    url: string;
    embedHtml?: string; // Embed HTML for iframe preview (fallback when no direct download)
    usedCookie?: boolean; // Whether cookie was used to fetch this media (indicates private/authenticated content)
    cached?: boolean; // Whether this response was served from cache
    responseTime?: number; // API response time in milliseconds
    engagement?: UnifiedEngagement;
}

// History item stored in localStorage
export interface HistoryItem {
    id: string;
    url: string;
    platform: Platform;
    title: string;
    thumbnail: string;
    downloadedAt: string;
    quality: string;
    type: 'video' | 'audio' | 'image';
}

// API request body
export interface DownloadRequest {
    url: string;
}

// Download progress state
export interface DownloadProgress {
    status: 'idle' | 'fetching' | 'ready' | 'downloading' | 'error';
    progress?: number;
    error?: string;
}

// Platform configuration
export interface PlatformConfig {
    id: Platform;
    name: string;
    icon: string;
    color: string;
    placeholder: string;
    patterns: RegExp[];
}

// Platform configurations
export const PLATFORMS: PlatformConfig[] = [
    {
        id: 'facebook',
        name: 'Facebook',
        icon: '📘',
        color: '#1877f2',
        placeholder: 'https://www.facebook.com/watch?v=...',
        patterns: [
            /^(https?:\/\/)?(www\.|m\.|web\.)?facebook\.com\/.+/,
            /^(https?:\/\/)?(www\.)?fb\.(watch|gg|me)\/.+/,
            /^(https?:\/\/)?l\.facebook\.com\/.+/,
        ],
    },
    {
        id: 'instagram',
        name: 'Instagram',
        icon: '📸',
        color: '#e4405f',
        placeholder: 'https://www.instagram.com/reel/...',
        patterns: [
            /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|reels|tv|stories)\/.+/,
            /^(https?:\/\/)?instagr\.am\/.+/,
            /^(https?:\/\/)?(www\.)?ig\.me\/.+/,
            /^(https?:\/\/)?ddinstagram\.com\/.+/,
        ],
    },
    {
        id: 'twitter',
        name: 'X',
        icon: '𝕏',
        color: '#ffffff',
        placeholder: 'https://twitter.com/user/status/...',
        patterns: [
            /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/.+\/status\/.+/,
            /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)\/i\/status\/.+/,
            /^(https?:\/\/)?t\.co\/.+/,
            /^(https?:\/\/)?(www\.)?fxtwitter\.com\/.+/,
            /^(https?:\/\/)?(www\.)?vxtwitter\.com\/.+/,
            /^(https?:\/\/)?(www\.)?fixupx\.com\/.+/,
        ],
    },
    {
        id: 'tiktok',
        name: 'TikTok',
        icon: '🎵',
        color: '#00f2ea',
        placeholder: 'https://www.tiktok.com/@user/video/...',
        patterns: [
            /^(https?:\/\/)?(www\.|vm\.|vt\.|m\.)?tiktok\.com\/.+/,
            /^(https?:\/\/)?tiktok\.com\/.+/,
        ],
    },
    {
        id: 'weibo',
        name: 'Weibo',
        icon: '🔴',
        color: '#e6162d',
        placeholder: 'https://weibo.com/...',
        patterns: [
            /^(https?:\/\/)?(www\.|m\.|video\.)?weibo\.(com|cn)\/.+/,
            /^(https?:\/\/)?t\.cn\/.+/,
        ],
    },
    {
        id: 'youtube',
        name: 'YouTube',
        icon: '▶️',
        color: '#ff0000',
        placeholder: 'https://www.youtube.com/watch?v=...',
        patterns: [
            /^(https?:\/\/)?(www\.|m\.|music\.)?youtube\.com\/(watch|shorts|embed)\?.+/,
            /^(https?:\/\/)?(www\.|m\.|music\.)?youtube\.com\/shorts\/.+/,
            /^(https?:\/\/)?youtu\.be\/.+/,
        ],
    },
];

// Helper to detect platform from URL
export function detectPlatform(url: string): Platform | null {
    for (const platform of PLATFORMS) {
        for (const pattern of platform.patterns) {
            if (pattern.test(url)) {
                return platform.id;
            }
        }
    }
    return null;
}

// Helper to validate URL for platform
export function validateUrl(url: string, platform: Platform): boolean {
    const config = PLATFORMS.find(p => p.id === platform);
    if (!config) return false;
    return config.patterns.some(pattern => pattern.test(url));
}

// Generate unique ID
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Format duration from seconds
export function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Format file size
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Format relative time
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

// Sanitize pasted text to extract just the URL
// Handles cases like:
// - TikTok: "Check this out! https://vm.tiktok.com/xxx #fyp"
// - Random garbage with URL in middle
export function sanitizeUrl(text: string): string {
    if (!text) return '';

    // Clean up common garbage patterns first
    let cleaned = text
        .replace(/[\r\n]+/g, ' ')  // Replace newlines with space
        .trim();

    // Pattern to find URLs - stop at Chinese chars, whitespace, or common terminators
    const urlPattern = /https?:\/\/[^\s\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]+/gi;
    const matches = cleaned.match(urlPattern);

    if (matches && matches.length > 0) {
        // Clean up the URL - remove trailing punctuation and garbage
        let url = matches[0]
            .replace(/[,，。！!?？、；;：:]+$/, '')  // Remove trailing punctuation
            .replace(/\/+$/, '')  // Remove trailing slashes (but keep path slashes)
            .trim();
        
        // Re-add single trailing slash for short URLs that need it
        if (/\/(v|vm|vt|t|s)\./.test(url) && !url.includes('?')) {
            url = url.replace(/\/?$/, '/');
        }
        
        return url;
    }

    // If no http URL found, check if it looks like a URL without protocol
    const noProtocolPattern = /(vm\.tiktok\.com|vt\.tiktok\.com|t\.co|fb\.watch|instagr\.am)\/[^\s\u4e00-\u9fff]+/gi;
    const noProtoMatches = cleaned.match(noProtocolPattern);
    
    if (noProtoMatches && noProtoMatches.length > 0) {
        return 'https://' + noProtoMatches[0].replace(/[,，。！!?？]+$/, '').trim();
    }

    // Return empty if no valid URL found (don't return garbage)
    return '';
}
