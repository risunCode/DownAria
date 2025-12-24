'use client';

import { useCallback } from 'react';
import { useAdminFetch, getAdminHeaders, buildAdminUrl } from './useAdminFetch';
import Swal from 'sweetalert2';

export interface GlobalSettings {
    site_name: string;
    site_description: string;
    discord_webhook_url: string;
    maintenance_details: string;
    maintenance_estimated_end: string;
    [key: string]: string;
}

const toast = (icon: 'success' | 'error', title: string) => {
    Swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
};

export function useSettings() {
    const { data, loading, error, refetch, mutate } = useAdminFetch<GlobalSettings>(
        '/api/admin/system-config',
        {
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            dedupingInterval: 60000,
        }
    );

    const updateSetting = useCallback(async (key: string, value: string) => {
        const result = await mutate('POST', { key, value });
        if (result.success) {
            toast('success', 'Setting saved');
            refetch();
        } else {
            toast('error', result.error || 'Failed to save');
        }
        return result.success;
    }, [mutate, refetch]);

    const updateSettings = useCallback(async (settings: Partial<GlobalSettings>) => {
        const result = await mutate('POST', settings);
        if (result.success) {
            toast('success', 'Settings saved');
            refetch();
        } else {
            toast('error', result.error || 'Failed to save');
        }
        return result.success;
    }, [mutate, refetch]);

    const clearCache = useCallback(async () => {
        const confirm = await Swal.fire({
            title: 'Clear Server Cache?',
            text: 'This will clear all cached API responses.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!confirm.isConfirmed) return false;

        try {
            const res = await fetch(buildAdminUrl('/api/admin/cache'), { 
                method: 'DELETE',
                headers: getAdminHeaders()
            });
            const data = await res.json();
            if (data.success) {
                toast('success', `Cleared ${data.data?.deleted || 0} entries`);
                return true;
            } else {
                toast('error', data.error || 'Failed to clear');
                return false;
            }
        } catch {
            toast('error', 'Failed to clear cache');
            return false;
        }
    }, []);

    return {
        settings: data,
        loading,
        error,
        refetch,
        updateSetting,
        updateSettings,
        clearCache,
    };
}
