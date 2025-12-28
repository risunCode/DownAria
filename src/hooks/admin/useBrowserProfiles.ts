/**
 * Hook for managing browser profiles in admin panel
 */

import { useState, useEffect, useCallback } from 'react';
import { useAdminFetch } from './useAdminFetch';

export interface BrowserProfile {
    id: string;
    platform: string;
    label: string;
    user_agent: string;
    sec_ch_ua: string | null;
    sec_ch_ua_platform: string | null;
    sec_ch_ua_mobile: string;
    accept_language: string;
    browser: string;
    device_type: string;
    os: string | null;
    is_chromium: boolean;
    priority: number;
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

export interface BrowserProfileStats {
    platform: string;
    browser: string;
    device_type: string;
    total: number;
    enabled_count: number;
    total_uses: number;
    total_success: number;
    total_errors: number;
}

export interface BrowserProfileTotals {
    total: number;
    enabled: number;
    totalUses: number;
    totalSuccess: number;
    totalErrors: number;
}

export interface CreateProfileInput {
    platform?: string;
    label: string;
    user_agent: string;
    sec_ch_ua?: string | null;
    sec_ch_ua_platform?: string | null;
    sec_ch_ua_mobile?: string;
    accept_language?: string;
    browser?: string;
    device_type?: string;
    os?: string | null;
    is_chromium?: boolean;
    priority?: number;
    enabled?: boolean;
    note?: string | null;
}

export function useBrowserProfiles() {
    const [profiles, setProfiles] = useState<BrowserProfile[]>([]);
    const [stats, setStats] = useState<BrowserProfileStats[]>([]);
    const [totals, setTotals] = useState<BrowserProfileTotals>({
        total: 0,
        enabled: 0,
        totalUses: 0,
        totalSuccess: 0,
        totalErrors: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Get auth token from Supabase session
    const getAuthToken = useCallback((): string | null => {
        if (typeof window === 'undefined') return null;
        const supabaseKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (supabaseKey) {
            try {
                const session = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
                return session?.access_token || null;
            } catch {
                return null;
            }
        }
        return null;
    }, []);

    // Admin fetch helper
    const adminFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        const token = getAuthToken();
        const API_URL = process.env.NEXT_PUBLIC_API_URL;
        if (!API_URL) throw new Error('API_URL not configured');
        const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
        
        const headers: Record<string, string> = { 
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string> || {})
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        
        return fetch(fullUrl, { ...options, headers });
    }, [getAuthToken]);

    const fetchProfiles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminFetch('/api/admin/browser-profiles');
            if (!res) throw new Error('Not authenticated');
            const data = await res.json();
            if (data.success) {
                setProfiles(data.data.profiles || []);
                setStats(data.data.stats || []);
                setTotals(data.data.totals || { total: 0, enabled: 0, totalUses: 0, totalSuccess: 0, totalErrors: 0 });
            } else {
                throw new Error(data.error || 'Failed to fetch profiles');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch profiles');
        } finally {
            setLoading(false);
        }
    }, [adminFetch]);

    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    const createProfile = useCallback(async (input: CreateProfileInput): Promise<BrowserProfile | null> => {
        try {
            const res = await adminFetch('/api/admin/browser-profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            });
            if (!res) throw new Error('Not authenticated');
            const data = await res.json();
            if (data.success) {
                await fetchProfiles();
                return data.data;
            }
            throw new Error(data.error || 'Failed to create profile');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create profile');
            return null;
        }
    }, [fetchProfiles]);

    const updateProfile = useCallback(async (id: string, updates: Partial<CreateProfileInput>): Promise<boolean> => {
        try {
            const res = await adminFetch(`/api/admin/browser-profiles/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!res) throw new Error('Not authenticated');
            const data = await res.json();
            if (data.success) {
                await fetchProfiles();
                return true;
            }
            throw new Error(data.error || 'Failed to update profile');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update profile');
            return false;
        }
    }, [fetchProfiles]);

    const deleteProfile = useCallback(async (id: string): Promise<boolean> => {
        try {
            const res = await adminFetch(`/api/admin/browser-profiles/${id}`, {
                method: 'DELETE',
            });
            if (!res) throw new Error('Not authenticated');
            const data = await res.json();
            if (data.success) {
                await fetchProfiles();
                return true;
            }
            throw new Error(data.error || 'Failed to delete profile');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete profile');
            return false;
        }
    }, [fetchProfiles]);

    const toggleProfile = useCallback(async (id: string, enabled: boolean): Promise<boolean> => {
        return updateProfile(id, { enabled });
    }, [updateProfile]);

    const resetStats = useCallback(async (id: string): Promise<boolean> => {
        // Reset stats by updating to 0
        try {
            const res = await adminFetch(`/api/admin/browser-profiles/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    use_count: 0,
                    success_count: 0,
                    error_count: 0,
                    last_error: null,
                }),
            });
            if (!res) throw new Error('Not authenticated');
            const data = await res.json();
            if (data.success) {
                await fetchProfiles();
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }, [fetchProfiles]);

    return {
        profiles,
        stats,
        totals,
        loading,
        error,
        refetch: fetchProfiles,
        createProfile,
        updateProfile,
        deleteProfile,
        toggleProfile,
        resetStats,
    };
}

// Platform options
export const PLATFORM_OPTIONS = [
    { value: 'all', label: 'All Platforms' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'twitter', label: 'Twitter/X' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'weibo', label: 'Weibo' },
];

// Browser options
export const BROWSER_OPTIONS = [
    { value: 'chrome', label: 'Chrome' },
    { value: 'firefox', label: 'Firefox' },
    { value: 'safari', label: 'Safari' },
    { value: 'edge', label: 'Edge' },
    { value: 'opera', label: 'Opera' },
    { value: 'other', label: 'Other' },
];

// Device type options
export const DEVICE_OPTIONS = [
    { value: 'desktop', label: 'Desktop' },
    { value: 'mobile', label: 'Mobile' },
    { value: 'tablet', label: 'Tablet' },
];

// OS options
export const OS_OPTIONS = [
    { value: 'windows', label: 'Windows' },
    { value: 'macos', label: 'macOS' },
    { value: 'linux', label: 'Linux' },
    { value: 'ios', label: 'iOS' },
    { value: 'android', label: 'Android' },
];
