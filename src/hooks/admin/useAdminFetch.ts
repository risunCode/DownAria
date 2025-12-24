'use client';

import useSWR, { SWRConfiguration } from 'swr';
import { useCallback } from 'react';
import { API_URL } from '@/lib/config';

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
export function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
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

// Build full URL (prepend API_URL if relative)
export function buildAdminUrl(url: string): string {
    if (url.startsWith('http')) return url;
    return `${API_URL}${url}`;
}

// Get auth headers for admin requests
export function getAdminHeaders(): Record<string, string> {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

// Admin fetcher with auth header and improved error handling
const adminFetcher = async <T>(url: string): Promise<T> => {
    try {
        const res = await fetch(url, { headers: getAdminHeaders() });
        const json = await res.json();
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
            const res = await fetch(buildAdminUrl(targetUrl), {
                method,
                headers: getAdminHeaders(),
                body: body ? JSON.stringify(body) : undefined,
            });
            const json = await res.json();
            return json;
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
