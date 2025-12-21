'use client';

import useSWR, { SWRConfiguration } from 'swr';
import { useCallback } from 'react';

// API URL from environment
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Get auth token from Supabase session
function getAuthToken(): string | null {
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

// Admin fetcher with auth header
const adminFetcher = async <T>(url: string): Promise<T> => {
    const token = getAuthToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    
    const res = await fetch(url, { headers });
    const json = await res.json();
    if (!json.success) {
        throw new Error(json.error || 'Request failed');
    }
    return json.data;
};

// Build full URL (prepend API_URL if relative)
function buildUrl(url: string): string {
    if (url.startsWith('http')) return url;
    return `${API_URL}${url}`;
}

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
    error: Error | null;
    refetch: () => Promise<T | undefined>;
    mutate: (method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown) => Promise<{ success: boolean; data?: unknown; error?: string }>;
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
    
    const fullUrl = url ? buildUrl(url) : null;
    
    const { data, error, isLoading, mutate: swrMutate } = useSWR<T>(
        skip || !fullUrl ? null : fullUrl,
        adminFetcher,
        swrConfig
    );

    // Manual mutation for POST/PUT/PATCH/DELETE
    const mutate = useCallback(async (
        method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', 
        body?: unknown
    ): Promise<{ success: boolean; data?: unknown; error?: string }> => {
        if (!url) return { success: false, error: 'No URL' };
        
        const token = getAuthToken();
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        try {
            const res = await fetch(buildUrl(url), {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
            });
            const json = await res.json();
            return json;
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Request failed' };
        }
    }, [url]);

    // Refetch wrapper
    const refetch = useCallback(async () => {
        return swrMutate();
    }, [swrMutate]);

    return { 
        data: data ?? null, 
        loading: isLoading, 
        error: error ?? null, 
        refetch, 
        mutate 
    };
}
