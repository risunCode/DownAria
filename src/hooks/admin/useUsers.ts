'use client';

import { useState, useCallback } from 'react';
import { useAdminFetch } from './useAdminFetch';
import Swal from 'sweetalert2';
import type { UserStatus } from '@/lib/types';

export interface User {
    id: string;
    email: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    role: 'user' | 'admin';
    status: UserStatus;  // 'active' | 'frozen' | 'banned'
    referralCode: string;
    referredBy: string | null;
    totalReferrals: number;
    lastSeen: string | null;
    firstJoined: string;
    updatedAt: string;
}

export interface UserFilters {
    search?: string;
    role?: 'user' | 'admin';
    status?: UserStatus;
    page?: number;
    limit?: number;
}

interface UsersResponse {
    users: User[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
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
    
    const { data, loading, error, refetch, mutate } = useAdminFetch<UsersResponse>(url);

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
        // Legacy method - calls updateStatus internally
        return updateStatus(userId, freeze ? 'frozen' : 'active');
    }, []);

    const updateStatus = useCallback(async (userId: string, status: UserStatus) => {
        const statusLabels: Record<UserStatus, string> = {
            active: 'Activate',
            frozen: 'Freeze',
            banned: 'Ban',
        };
        const statusColors: Record<UserStatus, string> = {
            active: '#22c55e',
            frozen: '#f59e0b',
            banned: '#ef4444',
        };

        const confirm = await Swal.fire({
            title: `${statusLabels[status]} user?`,
            icon: status === 'active' ? 'question' : 'warning',
            showCancelButton: true,
            confirmButtonColor: statusColors[status],
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!confirm.isConfirmed) return false;

        setSaving(userId);
        try {
            const result = await mutate('POST', { action: 'updateStatus', userId, status });
            if (result.success) {
                toast('success', `User ${status === 'active' ? 'activated' : status}`);
                refetch();
                return true;
            } else {
                toast('error', result.error || 'Failed to update status');
                return false;
            }
        } finally {
            setSaving(null);
        }
    }, [mutate, refetch]);

    const banUser = useCallback(async (userId: string) => {
        return updateStatus(userId, 'banned');
    }, [updateStatus]);

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
        users: data?.users || [],
        total: data?.total || 0,
        page: data?.page || 1,
        totalPages: data?.totalPages || 1,
        loading,
        error,
        saving,
        refetch,
        updateRole,
        updateStatus,
        banUser,
        toggleFreeze,  // Legacy - kept for backward compatibility
        deleteUser,
        addUser,
    };
}
