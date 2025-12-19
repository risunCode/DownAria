/**
 * Retry Utility
 * ==============
 * Smart retry wrapper with exponential backoff and cookie fallback.
 */

import { ScraperErrorCode, ScraperResult, isRetryable } from '@/core/scrapers/types';
import { shouldRetryWithCookie } from './error-ui';
import { randomSleep } from '@/lib/http';

// ═══════════════════════════════════════════════════════════════
// RETRY OPTIONS
// ═══════════════════════════════════════════════════════════════

export interface RetryOptions {
    /** Maximum retry attempts (default: 2) */
    maxRetries?: number;
    /** Base delay in ms (default: 1000) */
    baseDelay?: number;
    /** Backoff strategy (default: 'exponential') */
    backoff?: 'linear' | 'exponential' | 'none';
    /** Whether to retry with cookie on auth errors */
    retryWithCookie?: boolean;
    /** Cookie to use for retry */
    cookie?: string;
    /** Callback when retrying */
    onRetry?: (attempt: number, error: ScraperErrorCode) => void;
}

// ═══════════════════════════════════════════════════════════════
// RETRY WRAPPER
// ═══════════════════════════════════════════════════════════════

/**
 * Wrap a scraper function with smart retry logic
 */
export async function withRetry<T extends ScraperResult>(
    fn: (useCookie?: boolean) => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 2,
        baseDelay = 1000,
        backoff = 'exponential',
        retryWithCookie = true,
        cookie,
        onRetry,
    } = options;

    let lastResult: T | null = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
        try {
            // First attempt without cookie, subsequent with cookie if needed
            const useCookie = attempt > 0 && retryWithCookie && !!cookie;
            const result = await fn(useCookie);

            // Success - return immediately
            if (result.success) {
                return result;
            }

            lastResult = result;
            const errorCode = result.errorCode || ScraperErrorCode.UNKNOWN;

            // Check if error is retryable
            const canRetry = isRetryable(errorCode);
            const needsCookieRetry = shouldRetryWithCookie(errorCode) && retryWithCookie && !!cookie;

            if (!canRetry && !needsCookieRetry) {
                // Non-retryable error - return as is
                return result;
            }

            // Still have retries left
            if (attempt < maxRetries) {
                onRetry?.(attempt + 1, errorCode);

                // Calculate delay
                const delay = calculateDelay(attempt, baseDelay, backoff);
                await randomSleep(delay, delay + 500);

                attempt++;
            } else {
                // No more retries
                return result;
            }

        } catch (error) {
            // Unexpected error - wrap and return
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            return {
                success: false,
                error: errorMsg,
                errorCode: ScraperErrorCode.UNKNOWN,
            } as T;
        }
    }

    // Should not reach here, but return last result if we do
    return lastResult || {
        success: false,
        error: 'Max retries exceeded',
        errorCode: ScraperErrorCode.UNKNOWN,
    } as T;
}

/**
 * Calculate delay based on backoff strategy
 */
function calculateDelay(
    attempt: number,
    baseDelay: number,
    backoff: 'linear' | 'exponential' | 'none'
): number {
    switch (backoff) {
        case 'exponential':
            return baseDelay * Math.pow(2, attempt);
        case 'linear':
            return baseDelay * (attempt + 1);
        case 'none':
        default:
            return baseDelay;
    }
}

// ═══════════════════════════════════════════════════════════════
// RETRY HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Simple retry for async functions (non-scraper)
 */
export async function retryAsync<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < maxRetries) {
                await randomSleep(delay, delay + 500);
            }
        }
    }

    throw lastError || new Error('Max retries exceeded');
}
