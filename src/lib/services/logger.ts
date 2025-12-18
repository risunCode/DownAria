/**
 * Logger for Social Downloader
 * Clean, consistent logging for API routes
 * 
 * Log Levels (controlled by LOG_LEVEL env var):
 * - error: Only errors (production default)
 * - info: Errors + info (requests, results)
 * - debug: All logs including verbose debug (development default)
 * 
 * Output Format:
 * [Platform] URL: https://...
 * [Platform.Resolve] → https://... (if different)
 * [Platform.Type] Detected: reel | post | story | video | etc
 * [Platform.Media] Found: 2 videos, 4 images
 * [Platform] ✓ Complete (1.2s)
 */

import { PlatformId } from './api-config';

type LogLevel = 'info' | 'error' | 'debug';

const COLORS = {
    info: '\x1b[36m',    // cyan
    error: '\x1b[31m',   // red
    debug: '\x1b[90m',   // gray
    success: '\x1b[32m', // green
    warn: '\x1b[33m',    // yellow
    reset: '\x1b[0m',
};

// Log level hierarchy: error < info < debug
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
    /** Log input URL */
    url: (platform: PlatformId | string, url: string) => {
        if (shouldLog('info')) {
            console.log(`${COLORS.info}${tag(platform)}${COLORS.reset} URL: ${url}`);
        }
    },

    /** Log resolved URL (only if different from input) */
    resolve: (platform: PlatformId | string, originalUrl: string, resolvedUrl: string) => {
        if (shouldLog('info') && originalUrl !== resolvedUrl) {
            console.log(`${COLORS.info}${tag(platform, 'Resolve')}${COLORS.reset} → ${resolvedUrl}`);
        }
    },

    /** Log detected content type */
    type: (platform: PlatformId | string, contentType: string) => {
        if (shouldLog('info')) {
            console.log(`${COLORS.info}${tag(platform, 'Type')}${COLORS.reset} Detected: ${contentType}`);
        }
    },

    /** Log media found breakdown */
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

    /** Log success with timing */
    complete: (platform: PlatformId | string, timeMs: number) => {
        if (shouldLog('info')) {
            const time = timeMs < 1000 ? `${timeMs}ms` : `${(timeMs / 1000).toFixed(1)}s`;
            console.log(`${COLORS.success}${tag(platform)}${COLORS.reset} ✓ Complete (${time})`);
        }
    },

    /** Log cache hit */
    cache: (platform: PlatformId | string, hit: boolean) => {
        if (shouldLog('info')) {
            const status = hit ? '✓ Cache hit' : '○ Cache miss';
            console.log(`${COLORS.info}${tag(platform, 'Cache')}${COLORS.reset} ${status}`);
        }
    },

    /** Log metadata found (legacy - still useful) */
    meta: (platform: PlatformId | string, data: { title?: string; author?: string; type?: string; formats?: number }) => {
        if (!shouldLog('info')) return;
        const parts: string[] = [];
        if (data.title) parts.push(`"${data.title.substring(0, 40)}${data.title.length > 40 ? '...' : ''}"`);
        if (data.author) parts.push(`@${data.author.replace('@', '')}`);
        if (data.type) parts.push(data.type);
        if (data.formats !== undefined) parts.push(`${data.formats} format(s)`);
        if (parts.length) {
            console.log(`${COLORS.info}${tag(platform, 'Meta')}${COLORS.reset} ${parts.join(' | ')}`);
        }
    },

    /** Log success count (legacy) */
    success: (platform: PlatformId | string, formatCount: number) => {
        if (shouldLog('info')) {
            console.log(`${COLORS.success}${tag(platform)}${COLORS.reset} ✓ Found ${formatCount} format(s)`);
        }
    },

    /** Log error (always logged) */
    error: (platform: PlatformId | string, error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`${COLORS.error}${tag(platform)}${COLORS.reset} ✗ ${msg}`);
    },

    /** Log warning */
    warn: (platform: PlatformId | string, message: string) => {
        if (shouldLog('info')) {
            console.log(`${COLORS.warn}${tag(platform)}${COLORS.reset} ⚠ ${message}`);
        }
    },

    /** Debug log (only when LOG_LEVEL=debug) */
    debug: (platform: PlatformId | string, message: string) => {
        if (shouldLog('debug')) {
            console.log(`${COLORS.debug}${tag(platform)}${COLORS.reset} ${message}`);
        }
    },
};
