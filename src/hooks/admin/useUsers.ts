'use client';

import { useState, useCallback } from 'react';
import { useAdminFetch } from './useAdminFetch';
import Swal from 'sweetalert2';

export interface User {
    id: string;
    email: string;
    username: string | null;
    role: 'user' | 'admin';
    status: 'active' | 'frozen';
    referral_code: string | null;
    created_at: string;
    last_login: string | null;
}

export interface UserFilters {
    search?: string;
    role?: 'user' | 'admin';
    status?: 'active' | 'frozen';
    page?: number;
    limit?: number;
}

const toast = (icon: 'success' | 'error', title: string) => {
    Swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
};

export function useUsers(filters: UserFilters = {}) {
    const [saving, setSaving] = useState<string | null>(null);
    
    // Build query string
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.role) params.set('role', filters.role);
    if (filters.status) params.set('status', filters.status);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    
    const queryString = params.toString();
    const url = `/api/admin/users${queryString ? `?${queryString}` : ''}`;
    
    const { data, loading, error, refetch, mutate } = useAdminFetch<User[]>(url);

    const updateRole = useCallback(async (userId: string, role: 'user' | 'admin') => {
        const confirm = await Swal.fire({
            title: `Change role to ${role}?`,
            icon: 'question',
            showCancelButton: true,
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!confirm.isConfirmed) return false;

        setSaving(userId);
        try {
            const result = await mutate('POST', { action: 'updateRole', userId, role });
            if (result.success) {
                toast('success', `Role changed to ${role}`);
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

    const toggleFreeze = useCallback(async (userId: string, freeze: boolean) => {
        const confirm = await Swal.fire({
            title: freeze ? 'Freeze user?' : 'Unfreeze user?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: freeze ? '#ef4444' : '#22c55e',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!confirm.isConfirmed) return false;

        setSaving(userId);
        try {
            const result = await mutate('POST', { action: freeze ? 'freeze' : 'unfreeze', userId });
            if (result.success) {
                toast('success', freeze ? 'User frozen' : 'User unfrozen');
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

    const deleteUser = useCallback(async (userId: string, email: string) => {
        const confirm = await Swal.fire({
            title: 'Delete user?',
            html: `<p>User <b>${email}</b> will be permanently deleted.</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!confirm.isConfirmed) return false;

        setSaving(userId);
        try {
            const result = await mutate('DELETE', { userId });
            if (result.success) {
                toast('success', 'User deleted');
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

    const addUser = useCallback(async (userData: { email: string; password: string; role?: 'user' | 'admin' }) => {
        setSaving('new');
        try {
            const result = await mutate('POST', { action: 'create', ...userData });
            if (result.success) {
                toast('success', 'User created');
                refetch();
                return true;
            } else {
                toast('error', result.error || 'Failed to create');
                return false;
            }
        } finally {
            setSaving(null);
        }
    }, [mutate, refetch]);

    return {
        users: data || [],
        loading,
        error,
        saving,
        refetch,
        updateRole,
        toggleFreeze,
        deleteUser,
        addUser,
    };
}
