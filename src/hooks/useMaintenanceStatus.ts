'use client';

import useSWR from 'swr';

interface MaintenanceStatus {
    maintenance: boolean;
    maintenanceType: 'off' | 'api' | 'full' | 'all';
    maintenanceMessage: string | null;
}

interface StatusResponse {
    success: boolean;
    data?: {
        maintenance: boolean;
        maintenanceType: 'off' | 'api' | 'full' | 'all';
        maintenanceMessage: string | null;
    };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const fetcher = async (url: string): Promise<MaintenanceStatus> => {
    try {
        const res = await fetch(url, { 
            cache: 'no-store',
            next: { revalidate: 0 }
        });
        const json: StatusResponse = await res.json();
        
        if (json.success && json.data) {
            return {
                maintenance: json.data.maintenance,
                maintenanceType: json.data.maintenanceType,
                maintenanceMessage: json.data.maintenanceMessage
            };
        }
        
        // Default: no maintenance
        return {
            maintenance: false,
            maintenanceType: 'off',
            maintenanceMessage: null
        };
    } catch {
        // On error, assume no maintenance (fail open)
        return {
            maintenance: false,
            maintenanceType: 'off',
            maintenanceMessage: null
        };
    }
};

export function useMaintenanceStatus() {
    const { data, error, isLoading, mutate } = useSWR<MaintenanceStatus>(
        `${API_URL}/api/v1/status`,
        fetcher,
        {
            refreshInterval: 60000, // Check every minute
            revalidateOnFocus: true,
            dedupingInterval: 30000,
        }
    );

    // Note: Backend may return 'all' or 'full' for full maintenance mode
    const isFullMaintenance = data?.maintenance && (data?.maintenanceType === 'full' || data?.maintenanceType === 'all');
    const isApiMaintenance = data?.maintenance && data?.maintenanceType === 'api';

    return {
        status: data,
        isLoading,
        error,
        isFullMaintenance,
        isApiMaintenance,
        message: data?.maintenanceMessage || '',
        refresh: mutate,
    };
}
