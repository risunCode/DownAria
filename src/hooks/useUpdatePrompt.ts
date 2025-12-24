/**
 * useUpdatePrompt Hook - Service Worker update settings
 */
'use client';

import useSWR from 'swr';
import { fetcher, SWR_CONFIG } from '@/lib/swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

interface GlobalSettings {
    update_prompt_mode?: string;
    [key: string]: string | undefined;
}

interface UpdatePromptResponse {
    success: boolean;
    data: GlobalSettings;
}

export function useUpdatePrompt() {
    const { data, error, isLoading } = useSWR<UpdatePromptResponse>(
        `${API_URL}/api/admin/system-config`,
        fetcher,
        {
            ...SWR_CONFIG.static,
            dedupingInterval: 300000, // Cache for 5 minutes (rarely changes)
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    // Extract update_prompt_mode from global settings
    const behavior = data?.data?.update_prompt_mode || 'prompt';

    return {
        behavior: behavior as 'auto' | 'prompt' | 'silent',
        isLoading,
        isError: !!error,
    };
}
