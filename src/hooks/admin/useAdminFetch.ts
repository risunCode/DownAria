'use client';

import useSWR, { SWRConfiguration } from 'swr';
import { useCallback } from 'react';
import { API_URL } from '@/lib/config';
import { supabase } from '@/lib/supabase';

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Custom error class for admin API errors with user-friendly messages
 */
export class AdminApiError extends Error {
    public readonly isNetworkError: boolean;
    public readonly isServerOffline: boolean;
    public readonly userMessage: string;
    public readonly originalError?: Error;

    constructor(message: string, options?: { 
        isNetworkError?: boolean; 
        isServerOffline?: boolean;
        userMessage?: string;
        originalError?: Error;
    }) {
        super(message);
        this.name = 'AdminApiError';
        this.isNetworkError = options?.isNetworkError ?? false;
        this.isServerOffline = options?.isServerOffline ?? false;
        this.userMessage = options?.userMessage ?? message;
        this.originalError = options?.originalError;
    }
}

/**
 * Check if an error is a network/connection error
 */
function isNetworkError(error: unknown): boolean {
    if (error instanceof TypeError) {
        const message = error.message.toLowerCase();
        return (
            message.includes('failed to fetch') ||
            message.includes('network') ||
            message.includes('fetch') ||
            message.includes('cors') ||
            message.includes('connection')
        );
    }
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (
            message === 'failed to fetch' ||
            message.includes('network error') ||
            message.includes('net::err_') ||
            message.includes('econnrefused')
        );
    }
    return false;
}

/**
 * Transform raw errors into user-friendly AdminApiError
 */
function transformError(error: unknown): AdminApiError {
    // Network/connection errors
    if (isNetworkError(error)) {
        return new AdminApiError('Server tidak dapat dihubungi', {
            isNetworkError: true,
            isServerOffline: true,
            userMessage: 'Backend server offline - tidak dapat terhubung ke server. Pastikan backend sedang berjalan.',
            originalError: error instanceof Error ? error : undefined,
        });
    }

    // Already an AdminApiError
    if (error instanceof AdminApiError) {
        return error;
    }

    // Standard Error
    if (error instanceof Error) {
        return new AdminApiError(error.message, {
            userMessage: error.message,
            originalError: error,
        });
    }

    // Unknown error type
    return new AdminApiError('Terjadi kesalahan tidak diketahui', {
        userMessage: 'Terjadi kesalahan tidak diketahui. Silakan coba lagi.',
    });
}

// ============================================================================
// AUTH HELPERS
// ============================================================================

// Get auth token from Supabase session
export async function getAuthTokenAsync(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    
    try {
        // Best method: Use Supabase client directly
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            return session.access_token;
        }
    } catch {
        // Fallback to localStorage
    }
    
    // Fallback: Try localStorage patterns
    return getAuthToken();
}

// Sync version for headers (fallback to localStorage)
export function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    // Try multiple Supabase storage key patterns
    // Pattern 1: sb-{project-ref}-auth-token (Supabase v2+)
    // Pattern 2: supabase.auth.token (older versions)
    const patterns = [
        // Supabase v2+ pattern
        () => {
            const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
            if (key) {
                const data = JSON.parse(localStorage.getItem(key) || '{}');
                return data?.access_token || null;
            }
            return null;
        },
        // Alternative: check for session object directly
        () => {
            const key = Object.keys(localStorage).find(k => k.includes('supabase') && k.includes('auth'));
            if (key) {
                const data = JSON.parse(localStorage.getItem(key) || '{}');
                // Handle nested session structure
                if (data?.currentSession?.access_token) return data.currentSession.access_token;
                if (data?.session?.access_token) return data.session.access_token;
                if (data?.access_token) return data.access_token;
            }
            return null;
        },
    ];

    for (const pattern of patterns) {
        try {
            const token = pattern();
            if (token) return token;
        } catch {
            continue;
        }
    }
    
    return null;
}

// Build full URL (prepend API_URL if relative)
export function buildAdminUrl(url: string): string {
    if (url.startsWith('http')) return url;
    return `${API_URL}${url}`;
}

// Get auth headers for admin requests (async version - preferred)
export async function getAdminHeadersAsync(): Promise<Record<string, string>> {
    const token = await getAuthTokenAsync();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

// Get auth headers for admin requests (sync version - fallback)
export function getAdminHeaders(): Record<string, string> {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

// Admin fetcher with auth header and improved error handling
const adminFetcher = async <T>(url: string): Promise<T> => {
    try {
        const headers = await getAdminHeadersAsync();
        const res = await fetch(url, { headers });
        
        // Handle non-OK responses
        if (!res.ok) {
            // Try to parse error response
            let errorMessage = `Server error: ${res.status}`;
            try {
                const errorJson = await res.json();
                errorMessage = errorJson.error || errorMessage;
            } catch {
                // Response body might be empty or not JSON
                if (res.status === 500) {
                    errorMessage = 'Internal server error - check backend logs';
                } else if (res.status === 401) {
                    errorMessage = 'Unauthorized - please login again';
                } else if (res.status === 503) {
                    errorMessage = 'Service unavailable - database not configured';
                }
            }
            throw new AdminApiError(errorMessage, {
                userMessage: errorMessage,
            });
        }
        
        // Parse successful response
        const text = await res.text();
        if (!text) {
            throw new AdminApiError('Empty response from server', {
                userMessage: 'Server returned empty response',
            });
        }
        
        let json;
        try {
            json = JSON.parse(text);
        } catch {
            throw new AdminApiError('Invalid JSON response', {
                userMessage: 'Server returned invalid response format',
            });
        }
        
        if (!json.success) {
            throw new AdminApiError(json.error || 'Request failed', {
                userMessage: json.error || 'Permintaan gagal',
            });
        }
        return json.data;
    } catch (error) {
        // Re-throw if already transformed
        if (error instanceof AdminApiError) {
            throw error;
        }
        // Transform and throw
        throw transformError(error);
    }
};

// SWR config presets for admin
export const ADMIN_SWR_CONFIG = {
    // Default: moderate refresh
    default: {
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 30000, // 30s dedup
        errorRetryCount: 2,
    },
    
    // For rarely changing data (services config)
    static: {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        dedupingInterval: 60000, // 60s dedup
        refreshInterval: 0,
    },
    
    // For real-time data (stats dashboard)
    realtime: {
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 10000, // 10s dedup
        refreshInterval: 30000, // Auto-refresh 30s
    },
};

interface UseAdminFetchOptions {
    skip?: boolean;
    revalidateOnFocus?: boolean;
    revalidateOnReconnect?: boolean;
    dedupingInterval?: number;
    refreshInterval?: number;
    errorRetryCount?: number;
}

interface UseAdminFetchResult<T> {
    data: T | null;
    loading: boolean;
    error: AdminApiError | null;
    isServerOffline: boolean;
    userErrorMessage: string | null;
    refetch: () => Promise<T | undefined>;
    mutate: (method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown, customUrl?: string) => Promise<{ success: boolean; data?: unknown; error?: string }>;
}

export function useAdminFetch<T>(
    url: string | null, 
    options: UseAdminFetchOptions = {}
): UseAdminFetchResult<T> {
    const { skip, ...swrOptions } = options;
    
    const swrConfig: SWRConfiguration = {
        ...ADMIN_SWR_CONFIG.default,
        ...swrOptions,
    };
    
    const fullUrl = url ? buildAdminUrl(url) : null;
    
    const { data, error, isLoading, mutate: swrMutate } = useSWR<T>(
        skip || !fullUrl ? null : fullUrl,
        adminFetcher,
        swrConfig
    );

    // Transform error for user-friendly display
    const transformedError = error ? transformError(error) : null;
    const isServerOffline = transformedError?.isServerOffline ?? false;
    const userErrorMessage = transformedError?.userMessage ?? null;

    // Manual mutation for POST/PUT/PATCH/DELETE
    const mutate = useCallback(async (
        method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', 
        body?: unknown,
        customUrl?: string
    ): Promise<{ success: boolean; data?: unknown; error?: string }> => {
        const targetUrl = customUrl || url;
        if (!targetUrl) return { success: false, error: 'No URL' };
        
        try {
            const headers = await getAdminHeadersAsync();
            const res = await fetch(buildAdminUrl(targetUrl), {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
            
            // Handle non-OK responses
            if (!res.ok) {
                let errorMessage = `Server error: ${res.status}`;
                try {
                    const errorJson = await res.json();
                    errorMessage = errorJson.error || errorMessage;
                } catch {
                    // Response body might be empty
                }
                return { success: false, error: errorMessage };
            }
            
            // Parse response
            const text = await res.text();
            if (!text) {
                return { success: false, error: 'Empty response from server' };
            }
            
            try {
                const json = JSON.parse(text);
                return json;
            } catch {
                return { success: false, error: 'Invalid JSON response' };
            }
        } catch (err) {
            const transformed = transformError(err);
            return { success: false, error: transformed.userMessage };
        }
    }, [url]);

    // Refetch wrapper
    const refetch = useCallback(async () => {
        return swrMutate();
    }, [swrMutate]);

    return { 
        data: data ?? null, 
        loading: isLoading, 
        error: transformedError, 
        isServerOffline,
        userErrorMessage,
        refetch, 
        mutate 
    };
}
