/**
 * usePlayground Hook - Guest playground rate limit status
 */
'use client';

import useSWR from 'swr';
import { fetcher, SWR_CONFIG } from '@/lib/swr';

interface PlaygroundStatusResponse {
    success: boolean;
    data: {
        remaining: number;
        limit: number;
        resetIn: number;
    };
}

export function usePlayground() {
    const { data, error, isLoading, mutate } = useSWR<PlaygroundStatusResponse>(
        '/api/playground',
        fetcher,
        {
            ...SWR_CONFIG.moderate,
            dedupingInterval: 10000, // 10s dedup (rate limit changes frequently)
        }
    );

    return {
        remaining: data?.data?.remaining ?? 0,
        limit: data?.data?.limit ?? 5,
        resetIn: data?.data?.resetIn ?? 0,
        isLoading,
        isError: !!error,
        refresh: mutate,
    };
}
