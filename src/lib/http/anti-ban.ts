/**
 * Anti-Ban System - Smart Header Rotation
 * ========================================
 * Rotates User-Agents, headers, and adds random delays
 * to avoid detection and rate limiting.
 */

import { type PlatformId } from '@/core/config';

// ═══════════════════════════════════════════════════════════════
// USER AGENT POOL (Latest 2024 versions)
// ═══════════════════════════════════════════════════════════════

interface BrowserProfile {
    ua: string;
    secChUa: string;
    secChUaPlatform: string;
    acceptLanguage: string;
}

const BROWSER_PROFILES: BrowserProfile[] = [
    // Chrome 143 Windows (Dec 2025)
    {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        secChUa: '"Google Chrome";v="143", "Chromium";v="143", "Not_A Brand";v="24"',
        secChUaPlatform: '"Windows"',
        acceptLanguage: 'en-US,en;q=0.9',
    },
    // Chrome 143 Mac (Dec 2025)
    {
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        secChUa: '"Google Chrome";v="143", "Chromium";v="143", "Not_A Brand";v="24"',
        secChUaPlatform: '"macOS"',
        acceptLanguage: 'en-US,en;q=0.9',
    },
    // Firefox 134 Windows (Dec 2025)
    {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
        secChUa: '', // Firefox doesn't send Sec-Ch-Ua
        secChUaPlatform: '',
        acceptLanguage: 'en-US,en;q=0.5',
    },
    // Safari 18.2 Mac (Dec 2025)
    {
        ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
        secChUa: '', // Safari doesn't send Sec-Ch-Ua
        secChUaPlatform: '',
        acceptLanguage: 'en-US,en;q=0.9',
    },
    // Edge 143 Windows (Dec 2025)
    {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
        secChUa: '"Microsoft Edge";v="143", "Chromium";v="143", "Not_A Brand";v="24"',
        secChUaPlatform: '"Windows"',
        acceptLanguage: 'en-US,en;q=0.9',
    },
    // Chrome 142 Windows (Nov 2025 - slightly older)
    {
        ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
        secChUa: '"Google Chrome";v="142", "Chromium";v="142", "Not_A Brand";v="24"',
        secChUaPlatform: '"Windows"',
        acceptLanguage: 'en-US,en;q=0.9',
    },
];

// Track last used profile to avoid repetition
let lastProfileIndex = -1;

/**
 * Get a random browser profile (avoiding the last used one)
 * @param chromiumOnly If true, only return Chromium-based profiles (Chrome, Edge)
 */
export function getRandomProfile(chromiumOnly = false): BrowserProfile {
    const pool = chromiumOnly
        ? BROWSER_PROFILES.filter(p => p.secChUa !== '')
        : BROWSER_PROFILES;

    let idx: number;
    do {
        idx = Math.floor(Math.random() * pool.length);
    } while (idx === lastProfileIndex && pool.length > 1);
    lastProfileIndex = idx;
    return pool[idx];
}

// ═══════════════════════════════════════════════════════════════
// ROTATING HEADERS
// ═══════════════════════════════════════════════════════════════

interface RotatingHeadersOptions {
    platform?: PlatformId;
    cookie?: string;
    includeReferer?: boolean;
    chromiumOnly?: boolean;
}

/**
 * Get rotating headers with randomized browser profile
 */
export function getRotatingHeaders(options: RotatingHeadersOptions = {}): Record<string, string> {
    const { platform, cookie, includeReferer = true, chromiumOnly = false } = options;

    // Use Chromium-only for platforms that require Sec-Ch headers
    const useChromium = chromiumOnly || platform === 'facebook' || platform === 'instagram';
    const profile = getRandomProfile(useChromium);

    const headers: Record<string, string> = {
        'User-Agent': profile.ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': profile.acceptLanguage,
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1',
    };

    // Add Chromium-specific headers (Chrome, Edge)
    if (profile.secChUa) {
        headers['Sec-Ch-Ua'] = profile.secChUa;
        headers['Sec-Ch-Ua-Mobile'] = '?0';
        headers['Sec-Ch-Ua-Platform'] = profile.secChUaPlatform;
        headers['Sec-Fetch-Dest'] = 'document';
        headers['Sec-Fetch-Mode'] = 'navigate';
        headers['Sec-Fetch-User'] = '?1';
    }

    // Platform-specific headers
    if (platform === 'facebook' && includeReferer) {
        headers['Referer'] = 'https://www.facebook.com/';
        headers['Origin'] = 'https://www.facebook.com';
        headers['Sec-Fetch-Site'] = 'same-origin';
    } else if (platform === 'instagram' && includeReferer) {
        headers['Referer'] = 'https://www.instagram.com/';
        headers['Origin'] = 'https://www.instagram.com';
        headers['Sec-Fetch-Site'] = 'same-origin';
    } else if (profile.secChUa) {
        headers['Sec-Fetch-Site'] = 'none';
    }

    if (cookie) {
        headers['Cookie'] = cookie;
    }

    return headers;
}

// ═══════════════════════════════════════════════════════════════
// REQUEST TIMING
// ═══════════════════════════════════════════════════════════════

/**
 * Get a random delay between requests (human-like timing)
 * @param min Minimum delay in ms (default: 500)
 * @param max Maximum delay in ms (default: 2000)
 */
export function getRandomDelay(min = 500, max = 2000): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep for a random duration (human-like pause)
 */
export async function randomSleep(min = 500, max = 2000): Promise<void> {
    const delay = getRandomDelay(min, max);
    await new Promise(resolve => setTimeout(resolve, delay));
}

// ═══════════════════════════════════════════════════════════════
// RATE LIMIT TRACKING
// ═══════════════════════════════════════════════════════════════

interface RateLimitState {
    lastRequest: number;
    requestCount: number;
    cooldownUntil: number;
}

const rateLimitStates = new Map<string, RateLimitState>();

/**
 * Check if we should throttle requests to a platform
 */
export function shouldThrottle(platform: string): boolean {
    const state = rateLimitStates.get(platform);
    if (!state) return false;

    // If in cooldown, wait
    if (Date.now() < state.cooldownUntil) {
        return true;
    }

    // Reset if cooldown passed
    if (state.cooldownUntil > 0 && Date.now() >= state.cooldownUntil) {
        state.cooldownUntil = 0;
        state.requestCount = 0;
    }

    return false;
}

/**
 * Track a request and apply rate limiting if needed
 */
export function trackRequest(platform: string): void {
    let state = rateLimitStates.get(platform);
    if (!state) {
        state = { lastRequest: 0, requestCount: 0, cooldownUntil: 0 };
        rateLimitStates.set(platform, state);
    }

    const now = Date.now();
    const timeSinceLastRequest = now - state.lastRequest;

    // Reset counter if more than 60s since last request
    if (timeSinceLastRequest > 60000) {
        state.requestCount = 0;
    }

    state.lastRequest = now;
    state.requestCount++;

    // If too many requests in 60s, trigger cooldown
    if (state.requestCount > 30) {
        state.cooldownUntil = now + 30000; // 30s cooldown
        state.requestCount = 0;
    }
}

/**
 * Mark a rate limit error (429) for a platform
 */
export function markRateLimited(platform: string): void {
    let state = rateLimitStates.get(platform);
    if (!state) {
        state = { lastRequest: Date.now(), requestCount: 0, cooldownUntil: 0 };
        rateLimitStates.set(platform, state);
    }

    // Exponential backoff: 30s, 60s, 120s
    const backoff = Math.min(120000, 30000 * Math.pow(2, Math.floor(state.requestCount / 10)));
    state.cooldownUntil = Date.now() + backoff;
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

export { BROWSER_PROFILES, type BrowserProfile };
