/**
 * useStatus Hook - Platform status with SWR caching
 */
'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { SWR_CONFIG } from '@/lib/swr';

interface PlatformStatus {
    id: string;
    name: string;
    enabled: boolean;
    status: 'active' | 'maintenance' | 'offline';
}

interface StatusData {
    success: boolean;
    data: {
        maintenance: boolean;
        maintenanceMessage: string | null;
        maintenanceContent: string | null;
        maintenanceLastUpdated: string | null;
        platforms: PlatformStatus[];
    };
}

export function useStatus() {
    const { data, error, isLoading, mutate } = useSWR<StatusData>(
        '/api/v1/status',
        async (endpoint) => {
            const res = await api.get<StatusData>(endpoint);
            return res;
        },
        {
            ...SWR_CONFIG.static,
            dedupingInterval: 60000, // Cache for 60 seconds
            fallbackData: {
                success: true,
                data: {
                    maintenance: false,
                    maintenanceMessage: null,
                    maintenanceContent: null,
                    maintenanceLastUpdated: null,
                    platforms: [],
                },
            },
        }
    );

    return {
        platforms: data?.data?.platforms || [],
        maintenance: data?.data?.maintenance || false,
        maintenanceMessage: data?.data?.maintenanceMessage,
        maintenanceContent: data?.data?.maintenanceContent,
        maintenanceLastUpdated: data?.data?.maintenanceLastUpdated,
        isLoading,
        isError: !!error,
        refresh: mutate,
    };
}
