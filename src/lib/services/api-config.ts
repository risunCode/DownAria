/**
 * Platform Configuration for Social Downloader
 * Domain aliases and platform detection
 */

// ========== PLATFORM TYPES ==========
export type PlatformId = 'youtube' | 'tiktok' | 'douyin' | 'instagram' | 'facebook' | 'twitter' | 'weibo';

export interface PlatformConfig {
    name: string;
    /** Primary domain (used for referer/origin headers) */
    domain: string;
    /** All domain aliases for URL detection */
    aliases: string[];
    /** API endpoints if any */
    apiEndpoints?: Record<string, string>;
}

// ========== PLATFORM CONFIGS ==========
export const PLATFORM_CONFIGS: Record<PlatformId, PlatformConfig> = {
    youtube: {
        name: 'YouTube',
        domain: 'youtube.com',
        aliases: ['youtube.com', 'youtu.be', 'music.youtube.com', 'm.youtube.com', 'www.youtube.com'],
    },
    tiktok: {
        name: 'TikTok',
        domain: 'tiktok.com',
        aliases: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'm.tiktok.com', 'www.tiktok.com'],
    },
    douyin: {
        name: 'Douyin',
        domain: 'douyin.com',
        aliases: ['douyin.com', 'v.douyin.com', 'iesdouyin.com', 'www.douyin.com'],
    },
    instagram: {
        name: 'Instagram',
        domain: 'instagram.com',
        aliases: ['instagram.com', 'instagr.am', 'ddinstagram.com', 'www.instagram.com', 'ig.me'],
    },
    facebook: {
        name: 'Facebook',
        domain: 'facebook.com',
        aliases: ['facebook.com', 'fb.com', 'fb.watch', 'fb.me', 'fb.gg', 'm.facebook.com', 'web.facebook.com', 'www.facebook.com', 'l.facebook.com'],
    },
    twitter: {
        name: 'Twitter/X',
        domain: 'x.com',
        aliases: ['x.com', 'twitter.com', 'mobile.twitter.com', 'mobile.x.com', 'www.twitter.com', 't.co', 'fxtwitter.com', 'vxtwitter.com', 'fixupx.com'],
        apiEndpoints: { syndication: 'https://cdn.syndication.twimg.com/tweet-result' },
    },
    weibo: {
        name: 'Weibo',
        domain: 'weibo.com',
        aliases: ['weibo.com', 'weibo.cn', 'm.weibo.cn', 'video.weibo.com', 'www.weibo.com', 't.cn'],
        apiEndpoints: { mobile: 'https://m.weibo.cn/statuses/show' },
    },
};

// ========== DERIVED HELPERS ==========

/** Get base URL from domain (https://www.{domain}) */
export function getBaseUrl(platform: PlatformId): string {
    const domain = PLATFORM_CONFIGS[platform]?.domain;
    return domain ? `https://www.${domain}` : '';
}

/** Get referer header (https://www.{domain}/) */
export function getReferer(platform: PlatformId): string {
    const domain = PLATFORM_CONFIGS[platform]?.domain;
    return domain ? `https://www.${domain}/` : '';
}

/** Get origin header (https://www.{domain}) */
export function getOrigin(platform: PlatformId): string {
    return getBaseUrl(platform);
}

// ========== PLATFORM DETECTION ==========

/**
 * Detect platform from URL using domain aliases
 */
export function detectPlatform(url: string): PlatformId | null {
    try {
        const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
        for (const [id, config] of Object.entries(PLATFORM_CONFIGS)) {
            if (config.aliases.some(alias => hostname === alias.replace(/^www\./, '') || hostname.endsWith('.' + alias.replace(/^www\./, '')))) {
                return id as PlatformId;
            }
        }
    } catch {
        /* invalid URL */
    }
    return null;
}

/**
 * Check if URL belongs to a specific platform
 */
export function isPlatformUrl(url: string, platform: PlatformId): boolean {
    return detectPlatform(url) === platform;
}

/**
 * Check if URL string contains any platform alias (for regex-free validation)
 */
export function matchesPlatform(url: string, platform: PlatformId): boolean {
    const aliases = PLATFORM_CONFIGS[platform]?.aliases || [];
    const lower = url.toLowerCase();
    return aliases.some(alias => lower.includes(alias));
}

/**
 * Build regex pattern from platform aliases
 */
export function getPlatformRegex(platform: PlatformId): RegExp {
    const aliases = PLATFORM_CONFIGS[platform]?.aliases || [];
    const escaped = aliases.map(a => a.replace(/\./g, '\\.'));
    return new RegExp(`(${escaped.join('|')})`, 'i');
}

/**
 * Get all domain aliases for a platform
 */
export function getPlatformAliases(platform: PlatformId): string[] {
    return PLATFORM_CONFIGS[platform]?.aliases || [];
}

// ========== CONFIG HELPERS ==========

export function getPlatformConfig(platform: PlatformId): PlatformConfig {
    return PLATFORM_CONFIGS[platform];
}

export function getApiEndpoint(platform: PlatformId, endpoint: string): string {
    return PLATFORM_CONFIGS[platform]?.apiEndpoints?.[endpoint] || '';
}
