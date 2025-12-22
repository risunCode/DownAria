/**
 * Proxy URL Helper
 * Builds proxy URLs pointing to backend API
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

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

export function getProxiedThumbnail(url: string, platform?: string): string {
    if (!url) return '';
    
    // Check if URL needs proxying (CDN domains)
    const needsProxy = 
        url.includes('fbcdn.net') || 
        url.includes('cdninstagram.com') || 
        url.includes('scontent') ||
        url.includes('twimg.com') ||
        url.includes('tiktokcdn');
    
    if (!needsProxy) return url;
    
    return getProxyUrl(url, { platform, inline: true });
}
