/**
 * API Client for Backend Communication
 * Handles all requests to the backend API
 * 
 * Features:
 * - Configurable request timeout (Issue #3)
 * - Exponential backoff retry for 5xx errors (Issue #12)
 * - Fast offline detection
 */

// Backend API URL - defaults to localhost for development
// Production should set NEXT_PUBLIC_API_URL to Railway backend: https://xtfetch-api-production.up.railway.app
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

// Default configuration
const DEFAULT_TIMEOUT = 30000; // 30 seconds for scraping operations
const DEFAULT_RETRIES = 3;
const CONNECTION_TIMEOUT = 5000; // 5 seconds for initial connection check
const OFFLINE_CACHE_TTL = 10000; // Cache offline status for 10 seconds

// Track backend status to avoid repeated slow failures
let lastOfflineCheck = 0;
let isBackendOffline = false;

export class ApiError extends Error {
    constructor(public status: number, message: string, public data?: unknown) {
        super(message);
        this.name = 'ApiError';
    }
}

export class TimeoutError extends Error {
    constructor(message = 'Request timed out') {
        super(message);
        this.name = 'TimeoutError';
    }
}

export class OfflineError extends Error {
    constructor(message = 'Backend server is offline') {
        super(message);
        this.name = 'OfflineError';
    }
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
    auth?: boolean;
    body?: unknown;
    /** Request timeout in milliseconds (default: 30000) */
    timeout?: number;
    /** Number of retry attempts for 5xx errors (default: 3) */
    retries?: number;
}

function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    // Try to get from Supabase session in localStorage
    const supabaseKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (supabaseKey) {
        try {
            const session = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
            return session?.access_token || null;
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Fetch with timeout support using AbortController
 * @param url - Request URL
 * @param options - Fetch options
 * @param timeout - Timeout in milliseconds
 */
async function fetchWithTimeout(
    url: string, 
    options: RequestInit, 
    timeout = DEFAULT_TIMEOUT
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, { 
            ...options, 
            signal: controller.signal 
        });
        // Backend responded - mark as online
        isBackendOffline = false;
        return response;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new TimeoutError(`Request timed out after ${timeout}ms`);
        }
        // Connection failed - likely offline
        if (error instanceof TypeError && error.message.includes('fetch')) {
            isBackendOffline = true;
            lastOfflineCheck = Date.now();
            throw new OfflineError('Cannot connect to backend server');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Quick check if backend was recently detected as offline
 * Avoids repeated slow connection attempts
 */
function isRecentlyOffline(): boolean {
    if (!isBackendOffline) return false;
    const elapsed = Date.now() - lastOfflineCheck;
    // If offline status is stale, allow retry
    if (elapsed > OFFLINE_CACHE_TTL) {
        isBackendOffline = false;
        return false;
    }
    return true;
}

/**
 * Fetch with exponential backoff retry for 5xx errors
 * @param url - Request URL
 * @param options - Fetch options
 * @param retries - Number of retry attempts
 * @param timeout - Timeout per request in milliseconds
 */
async function fetchWithRetry(
    url: string, 
    options: RequestInit, 
    retries = DEFAULT_RETRIES,
    timeout = DEFAULT_TIMEOUT
): Promise<Response> {
    // Fast fail if backend was recently detected as offline
    if (isRecentlyOffline()) {
        throw new OfflineError('Backend server is offline (cached)');
    }
    
    let lastError: Error | null = null;
    
    // Use shorter timeout for first attempt to detect offline faster
    const firstAttemptTimeout = Math.min(timeout, CONNECTION_TIMEOUT);
    
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            // First attempt uses shorter timeout for fast offline detection
            const attemptTimeout = attempt === 0 ? firstAttemptTimeout : timeout;
            const response = await fetchWithTimeout(url, options, attemptTimeout);
            
            // Don't retry client errors (4xx), only server errors (5xx)
            if (response.ok || response.status < 500) {
                return response;
            }
            
            // Store the response for potential retry
            lastError = new Error(`Server error: ${response.status}`);
        } catch (error) {
            // Don't retry if backend is offline
            if (error instanceof OfflineError) {
                throw error;
            }
            
            // Don't retry if it was a timeout (AbortError converted to TimeoutError)
            if (error instanceof TimeoutError) {
                throw error;
            }
            
            lastError = error instanceof Error ? error : new Error(String(error));
        }
        
        // If it's the last attempt, don't wait
        if (attempt === retries - 1) break;
        
        // Exponential backoff: 1s, 2s, 4s...
        const backoffMs = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
    
    throw lastError || new Error('Max retries exceeded');
}

export async function apiClient<T>(
    endpoint: string,
    options: FetchOptions = {}
): Promise<T> {
    const { 
        auth = false, 
        body, 
        timeout = DEFAULT_TIMEOUT,
        retries = DEFAULT_RETRIES,
        ...fetchOptions 
    } = options;
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers as Record<string, string>),
    };
    
    if (auth) {
        const token = getAuthToken();
        if (token) {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
        }
    }
    
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    
    const response = await fetchWithRetry(
        url, 
        {
            ...fetchOptions,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        },
        retries,
        timeout
    );
    
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
        throw new ApiError(response.status, data.error || 'Request failed', data);
    }
    
    return data as T;
}

// Convenience methods
export const api = {
    get: <T>(endpoint: string, options?: Omit<FetchOptions, 'method' | 'body'>) =>
        apiClient<T>(endpoint, { ...options, method: 'GET' }),
    
    post: <T>(endpoint: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
        apiClient<T>(endpoint, { ...options, method: 'POST', body }),
    
    put: <T>(endpoint: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
        apiClient<T>(endpoint, { ...options, method: 'PUT', body }),
    
    patch: <T>(endpoint: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
        apiClient<T>(endpoint, { ...options, method: 'PATCH', body }),
    
    delete: <T>(endpoint: string, options?: Omit<FetchOptions, 'method'>) =>
        apiClient<T>(endpoint, { ...options, method: 'DELETE' }),
};

export default api;

/**
 * Reset offline status (useful after user action or network change)
 */
export function resetOfflineStatus(): void {
    isBackendOffline = false;
    lastOfflineCheck = 0;
}

/**
 * Check if backend is currently marked as offline
 */
export function checkBackendStatus(): { offline: boolean; lastCheck: number } {
    return {
        offline: isBackendOffline,
        lastCheck: lastOfflineCheck,
    };
}
