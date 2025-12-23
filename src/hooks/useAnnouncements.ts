/**
 * useAnnouncements Hook - Fetch announcements with SWR caching
 */
'use client';

import useSWR from 'swr';
import { SWR_CONFIG } from '@/lib/swr';
import { api } from '@/lib/api';

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

// Fetcher for announcements (no auth needed for public endpoint)
const announcementsFetcher = async (endpoint: string): Promise<AnnouncementsResponse> => {
    return await api.get<AnnouncementsResponse>(endpoint);
};

export function useAnnouncements(page: string) {
    const endpoint = `/api/v1/announcements?page=${page}`;
    
    const { data, error, isLoading, mutate } = useSWR<AnnouncementsResponse>(
        endpoint,
        announcementsFetcher,
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
