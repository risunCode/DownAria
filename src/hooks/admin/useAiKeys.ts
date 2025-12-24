'use client';

import { useState, useCallback } from 'react';
import { useAdminFetch } from './useAdminFetch';
import Swal from 'sweetalert2';

export type AiProvider = 'gemini' | 'openai' | 'anthropic' | 'other';

// Backend response format from /api/admin/ai-keys
interface AiApiKeyRaw {
    id: string;
    label: string;
    provider: AiProvider;
    key: string; // Masked key (e.g., "AIza...xxxx")
    keyPreview?: string;
    enabled: boolean;
    use_count: number;
    error_count: number;
    last_used_at: string | null;
    last_error: string | null;
    rate_limit_reset: string | null;  // NEW: rate_limit_reset from schema
    created_at: string;
    updated_at: string;               // NEW: updated_at from schema
}

interface AiApiResponse {
    keys: AiApiKeyRaw[];
    stats: {
        total: number;
        enabled: number;
        totalUses: number;
        totalErrors: number;
        byProvider: Record<AiProvider, number>;
    };
}

// Frontend-friendly interface
export interface AiApiKey {
    id: string;
    name: string;
    provider: AiProvider;
    key: string;
    enabled: boolean;
    created: string;
    lastUsed: string | null;
    lastError?: string | null;
    usageCount: number;
    errorCount: number;
    rateLimitReset?: string | null;  // NEW: rate_limit_reset from schema
    updatedAt?: string;              // NEW: updated_at from schema
}

export interface AiStats {
    totalKeys: number;
    activeKeys: number;
    totalUsage: number;
    byProvider: Record<AiProvider, number>;
}

const toast = (icon: 'success' | 'error', title: string) => {
    Swal.fire({ 
        toast: true, 
        position: 'top-end', 
        icon, 
        title, 
        showConfirmButton: false, 
        timer: 1500, 
        background: 'var(--bg-card)', 
        color: 'var(--text-primary)' 
    });
};

export function useAiKeys() {
    const [saving, setSaving] = useState<string | null>(null);
    const { data, loading, refetch, mutate } = useAdminFetch<AiApiResponse>('/api/admin/ai-keys');

    const addKey = useCallback(async (name: string, key: string, provider: AiProvider): Promise<boolean> => {
        setSaving('create');
        try {
            const result = await mutate('POST', { action: 'create', name, key, provider });
            if (result.success) {
                toast('success', 'AI key added');
                refetch();
                return true;
            } else {
                toast('error', result.error || 'Failed to add key');
                return false;
            }
        } finally {
            setSaving(null);
        }
    }, [mutate, refetch]);

    const toggleKey = useCallback(async (id: string, enabled: boolean): Promise<boolean> => {
        setSaving(id);
        try {
            const result = await mutate('PATCH', { id, enabled });
            if (result.success) {
                toast('success', enabled ? 'Key enabled' : 'Key disabled');
                refetch();
                return true;
            } else {
                toast('error', result.error || 'Failed to update');
                return false;
            }
        } finally {
            setSaving(null);
        }
    }, [mutate, refetch]);

    const deleteKey = useCallback(async (id: string, name: string): Promise<boolean> => {
        const confirm = await Swal.fire({
            title: 'Delete AI Key?',
            html: `<p class="text-sm">Key "<b>${name}</b>" will be permanently deleted.</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Delete',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!confirm.isConfirmed) return false;

        setSaving(id);
        try {
            const result = await mutate('DELETE', { id });
            if (result.success) {
                toast('success', 'Key deleted');
                refetch();
                return true;
            } else {
                toast('error', result.error || 'Failed to delete');
                return false;
            }
        } finally {
            setSaving(null);
        }
    }, [mutate, refetch]);

    // Transform backend response to frontend format
    const rawKeys = data?.keys || [];
    const keys: AiApiKey[] = rawKeys.map(k => ({
        id: k.id,
        name: k.label,
        provider: k.provider,
        key: k.key,
        enabled: k.enabled,
        created: k.created_at,
        lastUsed: k.last_used_at,
        lastError: k.last_error,
        usageCount: k.use_count,
        errorCount: k.error_count,
        rateLimitReset: k.rate_limit_reset,
        updatedAt: k.updated_at,
    }));

    // Stats from backend or calculate from keys
    const defaultByProvider: Record<AiProvider, number> = { gemini: 0, openai: 0, anthropic: 0, other: 0 };
    const stats: AiStats = {
        totalKeys: data?.stats?.total ?? keys.length,
        activeKeys: data?.stats?.enabled ?? keys.filter(k => k.enabled).length,
        totalUsage: data?.stats?.totalUses ?? keys.reduce((sum, k) => sum + k.usageCount, 0),
        byProvider: data?.stats?.byProvider ?? keys.reduce((acc, k) => {
            acc[k.provider] = (acc[k.provider] || 0) + 1;
            return acc;
        }, { ...defaultByProvider }),
    };

    return {
        keys,
        loading,
        saving,
        refetch,
        addKey,
        toggleKey,
        deleteKey,
        stats,
    };
}
