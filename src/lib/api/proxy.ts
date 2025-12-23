/**
 * Proxy URL Helper
 * Builds proxy URLs pointing to backend API
 */

import { API_URL } from '@/lib/config';
import type { PlatformId } from '@/lib/types';

export function getProxyUrl(url: string, options?: {
    filename?: string;
    platform?: string;
    inline?: boolean;
    head?: boolean;
    hls?: boolean;
}): string {
    const params = new URLSearchParams();
    params.set('url', url);
    
    if (options?.filename) params.set('filename', options.filename);
    if (options?.platform) params.set('platform', options.platform);
    if (options?.inline) params.set('inline', '1');
    if (options?.head) params.set('head', '1');
    if (options?.hls) params.set('hls', '1');
    
    return `${API_URL}/api/v1/proxy?${params.toString()}`;
}

/**
 * Get proxied thumbnail URL for platforms that block direct access
 * Consolidated from thumbnail-utils.ts
 */
export function getProxiedThumbnail(url: string | undefined, platform?: PlatformId | string): string {
    if (!url) return '';
    
    // Check if URL needs proxying (CDN domains that block direct access)
    const needsProxy = 
        url.includes('fbcdn.net') || 
        url.includes('cdninstagram.com') || 
        url.includes('scontent') ||
        url.includes('twimg.com') ||
        url.includes('tiktokcdn');
    
    if (!needsProxy) return url;
    
    return getProxyUrl(url, { platform: platform as string, inline: true });
}
