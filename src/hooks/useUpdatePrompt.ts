/**
 * useUpdatePrompt Hook - Service Worker update settings
 */
'use client';

import useSWR from 'swr';
import { fetcher, SWR_CONFIG } from '@/lib/swr';

interface UpdatePromptSettings {
    behavior: 'auto' | 'prompt' | 'silent';
}

interface UpdatePromptResponse {
    success: boolean;
    data: UpdatePromptSettings;
}

export function useUpdatePrompt() {
    const { data, error, isLoading } = useSWR<UpdatePromptResponse>(
        '/api/settings/update-prompt',
        fetcher,
        {
            ...SWR_CONFIG.static,
            dedupingInterval: 300000, // Cache for 5 minutes (rarely changes)
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
        }
    );

    return {
        behavior: data?.data?.behavior || 'prompt',
        isLoading,
        isError: !!error,
    };
}
