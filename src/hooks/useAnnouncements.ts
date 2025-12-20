/**
 * useAnnouncements Hook - Fetch announcements with SWR caching
 */
'use client';

import useSWR from 'swr';
import { fetcher, SWR_CONFIG } from '@/lib/swr';

interface Announcement {
    id: string | number;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error';
    dismissible?: boolean;
    show_once?: boolean;
    pages?: string[];
    active?: boolean;
    created_at?: string;
}

interface AnnouncementsResponse {
    success: boolean;
    data: Announcement[];
}

export function useAnnouncements(page: string) {
    const { data, error, isLoading, mutate } = useSWR<AnnouncementsResponse>(
        `/api/announcements?page=${page}`,
        fetcher,
        {
            ...SWR_CONFIG.static,
            dedupingInterval: 120000, // Cache for 2 minutes
            revalidateOnFocus: false,
        }
    );

    return {
        announcements: data?.data || [],
        isLoading,
        isError: !!error,
        refresh: mutate,
    };
}
