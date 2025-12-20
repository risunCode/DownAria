/**
 * Logger for Social Downloader
 * Clean, consistent logging for API routes
 */

import { PlatformId } from './api-config';

type LogLevel = 'info' | 'error' | 'debug';

const COLORS = {
    info: '\x1b[36m',
    error: '\x1b[31m',
    debug: '\x1b[90m',
    success: '\x1b[32m',
    warn: '\x1b[33m',
    reset: '\x1b[0m',
};

const LOG_LEVELS = { error: 0, info: 1, debug: 2 };

function getLogLevel(): LogLevel {
    const env = process.env.LOG_LEVEL?.toLowerCase();
    if (env === 'error' || env === 'info' || env === 'debug') return env;
    return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
}

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[getLogLevel()];
}

function capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function tag(platform: string, sub?: string): string {
    const base = capitalize(platform);
    return sub ? `[${base}.${sub}]` : `[${base}]`;
}

export const logger = {
    url: (platform: PlatformId | string, url: string) => {
        if (shouldLog('info')) console.log(`${COLORS.info}${tag(platform)}${COLORS.reset} URL: ${url}`);
    },

    resolve: (platform: PlatformId | string, originalUrl: string, resolvedUrl: string) => {
        if (shouldLog('info') && originalUrl !== resolvedUrl) {
            console.log(`${COLORS.info}${tag(platform, 'Resolve')}${COLORS.reset} → ${resolvedUrl}`);
        }
    },

    type: (platform: PlatformId | string, contentType: string) => {
        if (shouldLog('info')) console.log(`${COLORS.info}${tag(platform, 'Type')}${COLORS.reset} Detected: ${contentType}`);
    },

    media: (platform: PlatformId | string, counts: { videos?: number; images?: number; audio?: number }) => {
        if (shouldLog('info')) {
            const parts: string[] = [];
            if (counts.videos) parts.push(`${counts.videos} video${counts.videos > 1 ? 's' : ''}`);
            if (counts.images) parts.push(`${counts.images} image${counts.images > 1 ? 's' : ''}`);
            if (counts.audio) parts.push(`${counts.audio} audio`);
            if (parts.length === 0) parts.push('no media');
            console.log(`${COLORS.info}${tag(platform, 'Media')}${COLORS.reset} Found: ${parts.join(', ')}`);
        }
    },

    complete: (platform: PlatformId | string, timeMs: number) => {
        if (shouldLog('info')) {
            const time = timeMs < 1000 ? `${timeMs}ms` : `${(timeMs / 1000).toFixed(1)}s`;
            console.log(`${COLORS.success}${tag(platform)}${COLORS.reset} ✓ Complete (${time})`);
        }
    },

    cache: (platform: PlatformId | string, hit: boolean) => {
        if (shouldLog('info')) {
            const status = hit ? '✓ Cache hit' : '○ Cache miss';
            console.log(`${COLORS.info}${tag(platform, 'Cache')}${COLORS.reset} ${status}`);
        }
    },

    redis: (platform: PlatformId | string, hit: boolean, key?: string) => {
        if (shouldLog('info')) {
            const status = hit ? '✓ Redis hit' : '○ Redis miss';
            const keyInfo = key ? ` [${key.substring(0, 50)}${key.length > 50 ? '...' : ''}]` : '';
            console.log(`${COLORS.info}${tag(platform, 'Redis')}${COLORS.reset} ${status}${keyInfo}`);
        }
    },

    meta: (platform: PlatformId | string, data: { title?: string; author?: string; type?: string; formats?: number }) => {
        if (!shouldLog('info')) return;
        const parts: string[] = [];
        if (data.title) parts.push(`"${data.title.substring(0, 40)}${data.title.length > 40 ? '...' : ''}"`);
        if (data.author) parts.push(`@${data.author.replace('@', '')}`);
        if (data.type) parts.push(data.type);
        if (data.formats !== undefined) parts.push(`${data.formats} format(s)`);
        if (parts.length) console.log(`${COLORS.info}${tag(platform, 'Meta')}${COLORS.reset} ${parts.join(' | ')}`);
    },

    success: (platform: PlatformId | string, formatCount: number) => {
        if (shouldLog('info')) console.log(`${COLORS.success}${tag(platform)}${COLORS.reset} ✓ Found ${formatCount} format(s)`);
    },

    error: (platform: PlatformId | string, error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`${COLORS.error}${tag(platform)}${COLORS.reset} ✗ ${msg}`);
    },

    warn: (platform: PlatformId | string, message: string) => {
        if (shouldLog('info')) console.log(`${COLORS.warn}${tag(platform)}${COLORS.reset} ⚠ ${message}`);
    },

    debug: (platform: PlatformId | string, message: string) => {
        if (shouldLog('debug')) console.log(`${COLORS.debug}${tag(platform)}${COLORS.reset} ${message}`);
    },
};
