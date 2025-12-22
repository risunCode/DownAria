/**
 * useStatus Hook - Platform status with SWR caching
 */
'use client';

import useSWR from 'swr';
import { fetcher, SWR_CONFIG } from '@/lib/swr';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

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
        maintenanceDetails: string | null;
        maintenanceEstimatedEnd: string | null;
        platforms: PlatformStatus[];
    };
}

export function useStatus() {
    const { data, error, isLoading, mutate } = useSWR<StatusData>(
        `${API_URL}/api/v1/status`,
        fetcher,
        {
            ...SWR_CONFIG.static,
            dedupingInterval: 60000, // Cache for 60 seconds
            fallbackData: {
                success: true,
                data: {
                    maintenance: false,
                    maintenanceMessage: null,
                    maintenanceDetails: null,
                    maintenanceEstimatedEnd: null,
                    platforms: [],
                },
            },
        }
    );

    return {
        platforms: data?.data?.platforms || [],
        maintenance: data?.data?.maintenance || false,
        maintenanceMessage: data?.data?.maintenanceMessage,
        maintenanceDetails: data?.data?.maintenanceDetails,
        maintenanceEstimatedEnd: data?.data?.maintenanceEstimatedEnd,
        isLoading,
        isError: !!error,
        refresh: mutate,
    };
}
