/**
 * useAnnouncements Hook - Fetch announcements with SWR caching
 */
'use client';

import useSWR from 'swr';
import { SWR_CONFIG } from '@/lib/swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

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
const announcementsFetcher = async (url: string): Promise<AnnouncementsResponse> => {
    const res = await fetch(url);
    return res.json();
};

export function useAnnouncements(page: string) {
    const url = `${API_URL}/api/v1/announcements?page=${page}`;
    
    const { data, error, isLoading, mutate } = useSWR<AnnouncementsResponse>(
        url,
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
