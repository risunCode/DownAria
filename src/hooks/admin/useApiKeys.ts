'use client';

import { useState, useCallback } from 'react';
import { useAdminFetch } from './useAdminFetch';
import Swal from 'sweetalert2';

export interface ApiKey {
    id: string;
    name: string;
    key: string;
    enabled: boolean;
    rateLimit: number;
    created: string;
    lastUsed: string | null;
    expiresAt: string | null;
    stats: {
        totalRequests: number;
        successCount: number;
        errorCount: number;
    };
}

export interface CreateKeyOptions {
    rateLimit?: number;
    validityDays?: number | null;
    isTest?: boolean;
    keyLength?: number;
    keyFormat?: 'alphanumeric' | 'hex' | 'base64';
    prefix?: string;
}

const toast = (icon: 'success' | 'error', title: string) => {
    Swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
};

export function useApiKeys() {
    const [saving, setSaving] = useState<string | null>(null);
    const { data, loading, refetch, mutate } = useAdminFetch<ApiKey[]>('/api/admin/apikeys');

    const createKey = useCallback(async (name: string, options?: CreateKeyOptions): Promise<{ key?: ApiKey; plainKey?: string } | null> => {
        setSaving('create');
        try {
            const result = await mutate('POST', { action: 'create', name, ...options }) as { success: boolean; data?: ApiKey; plainKey?: string; error?: string };
            if (result.success) {
                toast('success', 'API key created');
                refetch();
                return { key: result.data, plainKey: result.plainKey };
            } else {
                toast('error', result.error || 'Failed to create');
                return null;
            }
        } finally {
            setSaving(null);
        }
    }, [mutate, refetch]);

    const toggleKey = useCallback(async (id: string, enabled: boolean) => {
        setSaving(id);
        try {
            const result = await mutate('POST', { action: 'update', id, enabled });
            if (result.success) {
                toast('success', enabled ? 'Key enabled' : 'Key disabled');
                refetch();
            } else {
                toast('error', result.error || 'Failed to update');
            }
            return result.success;
        } finally {
            setSaving(null);
        }
    }, [mutate, refetch]);

    const deleteKey = useCallback(async (id: string, name: string) => {
        const confirm = await Swal.fire({
            title: 'Delete API Key?',
            html: `<p class="text-sm">Key "<b>${name}</b>" will be permanently deleted.</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!confirm.isConfirmed) return false;

        setSaving(id);
        try {
            const result = await mutate('POST', { action: 'delete', id });
            if (result.success) {
                toast('success', 'Key deleted');
                refetch();
            }
            return result.success;
        } finally {
            setSaving(null);
        }
    }, [mutate, refetch]);

    const regenerateKey = useCallback(async (id: string, name: string): Promise<{ key?: ApiKey; plainKey?: string } | null> => {
        const confirm = await Swal.fire({
            title: 'Regenerate Key?',
            html: `<p class="text-sm">The old key for "<b>${name}</b>" will stop working immediately.</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f59e0b',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!confirm.isConfirmed) return null;

        setSaving(id);
        try {
            const result = await mutate('POST', { action: 'regenerate', id }) as { success: boolean; data?: ApiKey; plainKey?: string; error?: string };
            if (result.success) {
                toast('success', 'Key regenerated');
                refetch();
                return { key: result.data, plainKey: result.plainKey };
            } else {
                toast('error', result.error || 'Failed to regenerate');
                return null;
            }
        } finally {
            setSaving(null);
        }
    }, [mutate, refetch]);

    // Stats
    const totalKeys = data?.length || 0;
    const activeKeys = data?.filter(k => k.enabled && (!k.expiresAt || new Date(k.expiresAt) > new Date())).length || 0;
    const totalRequests = data?.reduce((sum, k) => sum + k.stats.totalRequests, 0) || 0;

    return {
        keys: data || [],
        loading,
        saving,
        refetch,
        createKey,
        toggleKey,
        deleteKey,
        regenerateKey,
        stats: { totalKeys, activeKeys, totalRequests },
    };
}
