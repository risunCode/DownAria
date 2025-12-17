/**
 * Logger for Social Downloader
 * Clean, consistent logging for API routes
 * 
 * Log Levels (controlled by LOG_LEVEL env var):
 * - error: Only errors (production default)
 * - info: Errors + info (requests, results)
 * - debug: All logs including verbose debug (development default)
 */

import { PlatformId } from './api-config';

type LogLevel = 'info' | 'error' | 'debug';

const COLORS = {
    info: '\x1b[36m',   // cyan
    error: '\x1b[31m',  // red
    debug: '\x1b[90m',  // gray
    reset: '\x1b[0m',
};

// Log level hierarchy: error < info < debug
const LOG_LEVELS = { error: 0, info: 1, debug: 2 };

function getLogLevel(): LogLevel {
    const env = process.env.LOG_LEVEL?.toLowerCase();
    if (env === 'error' || env === 'info' || env === 'debug') return env;
    // Default: debug in dev, info in production
    return process.env.NODE_ENV === 'development' ? 'debug' : 'info';
}

function shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[getLogLevel()];
}

function formatLog(platform: PlatformId | string, level: LogLevel, message: string): string {
    const tag = `[${platform.charAt(0).toUpperCase() + platform.slice(1)}]`;
    return `${COLORS[level]}${tag}${COLORS.reset} ${message}`;
}

export const logger = {
    /** Log URL being processed (info level) */
    url: (platform: PlatformId | string, url: string) => {
        if (shouldLog('info')) console.log(formatLog(platform, 'info', `URL: ${url}`));
    },

    /** Log metadata found (info level) */
    meta: (platform: PlatformId | string, data: { title?: string; author?: string; type?: string; formats?: number }) => {
        if (!shouldLog('info')) return;
        const parts: string[] = [];
        if (data.title) parts.push(`Title: "${data.title.substring(0, 50)}${data.title.length > 50 ? '...' : ''}"`);
        if (data.author) parts.push(`Author: @${data.author.replace('@', '')}`);
        if (data.type) parts.push(`Type: ${data.type}`);
        if (data.formats !== undefined) parts.push(`Formats: ${data.formats}`);
        
        if (parts.length) {
            console.log(formatLog(platform, 'info', parts.join(' | ')));
        }
    },

    /** Log success (info level) */
    success: (platform: PlatformId | string, formatCount: number) => {
        if (shouldLog('info')) console.log(formatLog(platform, 'info', `✓ Found ${formatCount} format(s)`));
    },

    /** Log error (always logged) */
    error: (platform: PlatformId | string, error: unknown) => {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(formatLog(platform, 'error', `✗ ${msg}`));
    },

    /** Debug log (only when LOG_LEVEL=debug or in development) */
    debug: (platform: PlatformId | string, message: string) => {
        if (shouldLog('debug')) console.log(formatLog(platform, 'debug', message));
    },
};
