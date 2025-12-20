/**
 * useCookieStatus Hook - Check cookie status for settings page
 */
'use client';

import useSWR from 'swr';
import { fetcher, SWR_CONFIG } from '@/lib/swr';

interface CookieStatusResponse {
    success: boolean;
    data: Record<string, boolean>;
}

export function useCookieStatus() {
    const { data, error, isLoading, mutate } = useSWR<CookieStatusResponse>(
        '/api/status/cookies',
        fetcher,
        {
            ...SWR_CONFIG.static,
            dedupingInterval: 60000, // Cache for 1 minute
        }
    );

    return {
        cookieStatus: data?.data || {},
        isLoading,
        isError: !!error,
        refresh: mutate,
    };
}
