'use client';

import { useState, useCallback } from 'react';
import { useAdminFetch, getAdminHeaders, buildAdminUrl } from './useAdminFetch';
import Swal from 'sweetalert2';

type CookieStatus = 'healthy' | 'cooldown' | 'expired' | 'disabled';

export type CookieTier = 'public' | 'private';

export interface CookiePoolStats {
    platform: string;
    tier: CookieTier;
    total: number;
    enabled_count: number;
    healthy_count: number;
    cooldown_count: number;
    expired_count: number;
    disabled_count: number;
    total_uses: number;
    total_success: number;
    total_errors: number;
}

export interface PooledCookie {
    id: string;
    platform: string;
    cookie: string;
    cookiePreview?: string;
    label: string | null;
    status: CookieStatus;
    tier: CookieTier;
    last_used_at: string | null;
    use_count: number;
    success_count: number;
    error_count: number;
    last_error: string | null;
    cooldown_until: string | null;
    max_uses_per_hour: number;
    enabled: boolean;
    note: string | null;
    created_at: string;
    user_id?: string;      // Owner user ID (if applicable)
    updated_at?: string;   // Last update timestamp
}

const toast = (icon: 'success' | 'error', title: string) => {
    Swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
};

export function useCookieStats() {
    const { data, loading, refetch } = useAdminFetch<CookiePoolStats[]>('/api/admin/cookies/pool?stats=true');
    
    const getStats = (platform: string, tier: CookieTier = 'public'): CookiePoolStats => {
        return data?.find(s => s.platform === platform && s.tier === tier) || {
            platform, tier, total: 0, enabled_count: 0, healthy_count: 0, cooldown_count: 0,
            expired_count: 0, disabled_count: 0, total_uses: 0, total_success: 0, total_errors: 0
        };
    };

    return { stats: data || [], loading, refetch, getStats };
}

export function useCookies(platform: string | null) {
    const [saving, setSaving] = useState(false);
    const [tierFilter, setTierFilter] = useState<CookieTier | 'all'>('all');
    
    // Build URL with platform and optional tier filter
    const url = platform 
        ? `/api/admin/cookies/pool?platform=${platform}${tierFilter !== 'all' ? `&tier=${tierFilter}` : ''}`
        : null;
    const { data, loading, refetch } = useAdminFetch<PooledCookie[]>(url);

    const addCookie = useCallback(async (
        cookieData: { cookie: string; label?: string; note?: string; max_uses_per_hour?: number },
        tier: CookieTier = 'public'
    ) => {
        if (!platform) return false;
        setSaving(true);
        try {
            const res = await fetch(buildAdminUrl('/api/admin/cookies/pool'), {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ platform, tier, ...cookieData })
            });
            const json = await res.json();
            if (json.success) {
                toast('success', 'Cookie added');
                refetch();
                return true;
            } else {
                toast('error', json.error || 'Failed to add');
                return false;
            }
        } finally {
            setSaving(false);
        }
    }, [platform, refetch]);

    const updateCookie = useCallback(async (id: string, updates: Partial<PooledCookie>) => {
        setSaving(true);
        try {
            const res = await fetch(buildAdminUrl(`/api/admin/cookies/pool/${id}`), {
                method: 'PATCH',
                headers: getAdminHeaders(),
                body: JSON.stringify(updates)
            });
            const json = await res.json();
            if (json.success) {
                toast('success', 'Cookie updated');
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

    const deleteCookie = useCallback(async (id: string) => {
        const confirm = await Swal.fire({
            title: 'Delete cookie?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!confirm.isConfirmed) return false;

        try {
            const res = await fetch(buildAdminUrl(`/api/admin/cookies/pool/${id}`), { 
                method: 'DELETE',
                headers: getAdminHeaders()
            });
            const json = await res.json();
            if (json.success) {
                toast('success', 'Cookie deleted');
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

    const testCookie = useCallback(async (id: string) => {
        try {
            const res = await fetch(buildAdminUrl(`/api/admin/cookies/pool/${id}?test=true`), {
                headers: getAdminHeaders()
            });
            const json = await res.json();
            if (json.success) {
                if (json.data?.healthy) {
                    toast('success', 'Cookie is healthy');
                } else {
                    toast('error', json.data?.error || 'Cookie unhealthy');
                }
                refetch();
            }
            return json.success && json.data?.healthy;
        } catch {
            toast('error', 'Test failed');
            return false;
        }
    }, [refetch]);

    return {
        cookies: data || [],
        loading,
        saving,
        refetch,
        addCookie,
        updateCookie,
        deleteCookie,
        testCookie,
        tierFilter,
        setTierFilter,
    };
}
