'use client';

import { useState, useCallback } from 'react';
import { useAdminFetch, getAdminHeaders, buildAdminUrl } from './useAdminFetch';
import Swal from 'sweetalert2';

export interface GeminiApiKey {
    id: string;
    key: string;
    keyPreview: string;
    label: string;
    enabled: boolean;
    use_count: number;
    error_count: number;
    last_used_at: string | null;
    last_error: string | null;
    rate_limit_reset: string | null;
    created_at: string;
}

export interface GeminiStats {
    total: number;
    enabled: number;
    totalUses: number;
    totalErrors: number;
}

const toast = (icon: 'success' | 'error', title: string) => {
    Swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
};

export function useGeminiKeys() {
    const [saving, setSaving] = useState<string | null>(null);
    const { data, loading, refetch } = useAdminFetch<{ keys: GeminiApiKey[]; stats: GeminiStats }>('/api/admin/gemini');

    const addKey = useCallback(async (key: string, label: string) => {
        setSaving('add');
        try {
            const res = await fetch(buildAdminUrl('/api/admin/gemini'), {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ action: 'add', key, label })
            });
            const json = await res.json();
            if (json.success) {
                toast('success', 'API key added');
                refetch();
                return true;
            } else {
                toast('error', json.error || 'Failed to add');
                return false;
            }
        } finally {
            setSaving(null);
        }
    }, [refetch]);

    const updateKey = useCallback(async (id: string, updates: { label?: string; enabled?: boolean }) => {
        setSaving(id);
        try {
            const res = await fetch(buildAdminUrl('/api/admin/gemini'), {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ action: 'update', id, ...updates })
            });
            const json = await res.json();
            if (json.success) {
                toast('success', 'API key updated');
                refetch();
                return true;
            } else {
                toast('error', json.error || 'Failed to update');
                return false;
            }
        } finally {
            setSaving(null);
        }
    }, [refetch]);

    const deleteKey = useCallback(async (id: string, label: string) => {
        const confirm = await Swal.fire({
            title: 'Delete API Key?',
            html: `<p class="text-sm">Key "<b>${label}</b>" will be permanently deleted.</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!confirm.isConfirmed) return false;

        setSaving(id);
        try {
            const res = await fetch(buildAdminUrl('/api/admin/gemini'), {
                method: 'POST',
                headers: getAdminHeaders(),
                body: JSON.stringify({ action: 'delete', id })
            });
            const json = await res.json();
            if (json.success) {
                toast('success', 'API key deleted');
                refetch();
                return true;
            } else {
                toast('error', json.error || 'Failed to delete');
                return false;
            }
        } finally {
            setSaving(null);
        }
    }, [refetch]);

    const toggleKey = useCallback(async (id: string, enabled: boolean) => {
        return updateKey(id, { enabled });
    }, [updateKey]);

    return {
        keys: data?.keys || [],
        stats: data?.stats || { total: 0, enabled: 0, totalUses: 0, totalErrors: 0 },
        loading,
        saving,
        refetch,
        addKey,
        updateKey,
        deleteKey,
        toggleKey,
    };
}
