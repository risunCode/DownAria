'use client';

import useSWR, { SWRConfiguration } from 'swr';
import { useCallback } from 'react';

// Admin fetcher with credentials
const adminFetcher = async <T>(url: string): Promise<T> => {
    const res = await fetch(url, { credentials: 'include' });
    const json = await res.json();
    if (!json.success) {
        throw new Error(json.error || 'Request failed');
    }
    return json.data;
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
    
    const { data, error, isLoading, mutate: swrMutate } = useSWR<T>(
        skip || !url ? null : url,
        adminFetcher,
        swrConfig
    );

    // Manual mutation for POST/PUT/PATCH/DELETE
    const mutate = useCallback(async (
        method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', 
        body?: unknown
    ): Promise<{ success: boolean; data?: unknown; error?: string }> => {
        if (!url) return { success: false, error: 'No URL' };
        
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
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
