/**
 * Thumbnail Utilities
 * Shared thumbnail processing functions
 */

import type { Platform } from '@/lib/types';

/**
 * Proxy thumbnail for platforms that block direct access (Instagram CDN)
 * @param url - Original thumbnail URL
 * @param platform - Platform identifier
 * @returns Proxied URL if needed, otherwise original URL
 */
export function getProxiedThumbnail(url: string | undefined, platform: Platform): string {
    if (!url) return '';

    // Facebook/Instagram CDN blocks direct browser access, need to proxy
    if ((platform === 'instagram' || platform === 'facebook') && (
        url.includes('instagram') ||
        url.includes('cdninstagram') ||
        url.includes('fbcdn') ||
        url.includes('scontent')
    )) {
        return `/api/proxy?url=${encodeURIComponent(url)}&platform=${platform}&inline=1`;
    }

    return url;
}
