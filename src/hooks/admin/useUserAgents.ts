'use client';

import { useState, useCallback } from 'react';
import { useAdminFetch, getAdminHeaders, buildAdminUrl } from './useAdminFetch';
import Swal from 'sweetalert2';

export interface UserAgentPoolStats {
    platform: string;
    device_type: string;
    total: number;
    enabled_count: number;
    total_uses: number;
    total_success: number;
    total_errors: number;
}

export interface PooledUserAgent {
    id: string;
    platform: string;
    user_agent: string;
    device_type: 'desktop' | 'mobile' | 'tablet';
    browser: string | null;
    label: string | null;
    enabled: boolean;
    use_count: number;
    success_count: number;
    error_count: number;
    last_used_at: string | null;
    last_error: string | null;
    note: string | null;
    created_at: string;
    updated_at: string;
}

const toast = (icon: 'success' | 'error', title: string) => {
    Swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
};

export function useUserAgentStats() {
    const { data, loading, refetch } = useAdminFetch<UserAgentPoolStats[]>('/api/admin/useragents/pool?stats=true');
    
    const getStats = (platform: string): UserAgentPoolStats[] => {
        return data?.filter(s => s.platform === platform || s.platform === 'all') || [];
    };

    const getTotalStats = () => {
        if (!data) return { total: 0, enabled: 0, uses: 0, success: 0, errors: 0 };
        return {
            total: data.reduce((sum, s) => sum + s.total, 0),
            enabled: data.reduce((sum, s) => sum + s.enabled_count, 0),
            uses: data.reduce((sum, s) => sum + s.total_uses, 0),
            success: data.reduce((sum, s) => sum + s.total_success, 0),
            errors: data.reduce((sum, s) => sum + s.total_errors, 0),
        };
    };

    return { stats: data || [], loading, refetch, getStats, getTotalStats };
}

export function useUserAgents(platform: string | null) {
    const [saving, setSaving] = useState(false);
    const url = platform ? `/api/admin/useragents/pool?platform=${platform}` : '/api/admin/useragents/pool';
    const { data, loading, refetch } = useAdminFetch<PooledUserAgent[]>(url);

    const addUserAgent = useCallback(async (uaData: { 
        platform: string;
        user_agent: string; 
        device_type?: string;
        browser?: string;
        label?: string; 
        note?: string;
    }) => {
        setSaving(true);
        try {
            const res = await fetch(buildAdminUrl('/api/admin/useragents/pool'), {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify(uaData)
            });
            const json = await res.json();
            if (json.success) {
                toast('success', 'User-Agent added');
                refetch();
                return true;
            } else {
                toast('error', json.error || 'Failed to add');
                return false;
            }
        } finally {
            setSaving(false);
        }
    }, [refetch]);

    const updateUserAgent = useCallback(async (id: string, updates: Partial<PooledUserAgent>) => {
        setSaving(true);
        try {
            const res = await fetch(buildAdminUrl(`/api/admin/useragents/pool/${id}`), {
                method: 'PATCH',
                headers: getAdminHeaders(),
                body: JSON.stringify(updates)
            });
            const json = await res.json();
            if (json.success) {
                toast('success', 'User-Agent updated');
                refetch();
                return true;
            } else {
                toast('error', json.error || 'Failed to update');
                return false;
            }
        } finally {
            setSaving(false);
        }
    }, [refetch]);

    const deleteUserAgent = useCallback(async (id: string) => {
        const confirm = await Swal.fire({
            title: 'Delete user-agent?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!confirm.isConfirmed) return false;

        try {
            const res = await fetch(buildAdminUrl(`/api/admin/useragents/pool/${id}`), { 
                method: 'DELETE',
                headers: getAdminHeaders()
            });
            const json = await res.json();
            if (json.success) {
                toast('success', 'User-Agent deleted');
                refetch();
                return true;
            } else {
                toast('error', json.error || 'Failed to delete');
                return false;
            }
        } catch {
            toast('error', 'Failed to delete');
            return false;
        }
    }, [refetch]);

    return {
        userAgents: data || [],
        loading,
        saving,
        refetch,
        addUserAgent,
        updateUserAgent,
        deleteUserAgent,
    };
}
