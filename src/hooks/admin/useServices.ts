'use client';

import { useCallback, useState } from 'react';
import { useAdminFetch } from './useAdminFetch';
import Swal from 'sweetalert2';

interface PlatformStats {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    avgResponseTime: number;
}

interface PlatformConfig {
    id: string;
    name: string;
    enabled: boolean;
    method: string;
    rateLimit: number;
    cacheTime: number;
    disabledMessage: string;
    lastUpdated: string;
    stats: PlatformStats;
}

export interface ServiceConfig {
    platforms: Record<string, PlatformConfig>;
    globalRateLimit: number;
    playgroundRateLimit: number;
    playgroundEnabled: boolean;
    geminiRateLimit: number;
    geminiRateWindow: number;
    maintenanceMode: boolean;
    maintenanceType: 'off' | 'api' | 'full';
    maintenanceMessage: string;
    apiKeyRequired: boolean;
    lastUpdated: string;
}

const toast = (icon: 'success' | 'error', title: string) => {
    Swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
};

export function useServices() {
    const { data, loading, error, refetch, mutate } = useAdminFetch<ServiceConfig>('/api/admin/services');
    const [togglingPlatform, setTogglingPlatform] = useState<string | null>(null);

    const togglePlatform = useCallback(async (platformId: string, enabled: boolean) => {
        setTogglingPlatform(platformId);
        try {
            const result = await mutate('POST', { action: 'updatePlatform', platformId, enabled });
            if (result.success) {
                toast('success', `${platformId} ${enabled ? 'enabled' : 'disabled'}`);
                refetch();
            } else {
                toast('error', result.error || 'Failed to update');
            }
            return result.success;
        } finally {
            setTogglingPlatform(null);
        }
    }, [mutate, refetch]);

    const updatePlatform = useCallback(async (platformId: string, updates: Partial<PlatformConfig>) => {
        const result = await mutate('POST', { action: 'updatePlatform', platformId, ...updates });
        if (result.success) {
            toast('success', `${platformId} updated`);
            refetch();
        } else {
            toast('error', result.error || 'Failed to update');
        }
        return result.success;
    }, [mutate, refetch]);

    const toggleMaintenance = useCallback(async (enabled: boolean, message?: string) => {
        const result = await mutate('PUT', { maintenanceMode: enabled, ...(message && { maintenanceMessage: message }) });
        if (result.success) {
            toast('success', `Maintenance ${enabled ? 'enabled' : 'disabled'}`);
            refetch();
        } else {
            toast('error', result.error || 'Failed to update');
        }
        return result.success;
    }, [mutate, refetch]);

    const toggleApiKey = useCallback(async (required: boolean) => {
        const result = await mutate('PUT', { apiKeyRequired: required });
        if (result.success) {
            toast('success', `API Key ${required ? 'required' : 'optional'}`);
            refetch();
        } else {
            toast('error', result.error || 'Failed to update');
        }
        return result.success;
    }, [mutate, refetch]);

    const updateGlobal = useCallback(async (updates: Partial<Pick<ServiceConfig, 'apiKeyRequired' | 'globalRateLimit' | 'playgroundEnabled' | 'playgroundRateLimit' | 'geminiRateLimit' | 'geminiRateWindow'>>) => {
        const result = await mutate('POST', { action: 'updateGlobal', ...updates });
        if (result.success) {
            toast('success', 'Settings updated');
            refetch();
        } else {
            toast('error', result.error || 'Failed to update');
        }
        return result.success;
    }, [mutate, refetch]);

    const resetStats = useCallback(async (platformId?: string) => {
        const result = await mutate('POST', { action: 'resetStats', platformId });
        if (result.success) {
            toast('success', platformId ? `${platformId} stats reset` : 'All stats reset');
            refetch();
        }
        return result.success;
    }, [mutate, refetch]);

    return {
        config: data,
        platforms: data?.platforms ? Object.values(data.platforms) : [],
        loading,
        togglingPlatform,
        error,
        refetch,
        togglePlatform,
        updatePlatform,
        toggleMaintenance,
        toggleApiKey,
        updateGlobal,
        resetStats,
    };
}
