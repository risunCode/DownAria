/**
 * useCookieStatus Hook - Check cookie status for settings page
 * Uses public v1 endpoint (no auth required)
 */
'use client';

import useSWR from 'swr';
import { SWR_CONFIG } from '@/lib/swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

interface CookieStatusResponse {
    success: boolean;
    data: Record<string, { available: boolean; label: string } | boolean>;
}

// Public fetcher (no auth needed)
const fetcher = async (url: string): Promise<CookieStatusResponse> => {
    const res = await fetch(url);
    return res.json();
};

export function useCookieStatus() {
    const { data, error, isLoading, mutate } = useSWR<CookieStatusResponse>(
        `${API_URL}/api/v1/cookies`,
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
