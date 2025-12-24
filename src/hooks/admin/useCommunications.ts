'use client';

import { useCallback } from 'react';
import { useAdminFetch, ADMIN_SWR_CONFIG } from './useAdminFetch';

// ============================================================================
// TYPES
// ============================================================================

export interface Announcement {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error' | 'promo';
    icon?: string;
    link_url?: string;
    link_text?: string;
    show_on_home: boolean;
    show_on_history: boolean;
    show_on_settings: boolean;
    show_on_docs: boolean;
    start_date: string;
    end_date?: string;
    enabled: boolean;
    priority: number;
    views: number;
    dismisses: number;
    clicks: number;
    created_at: string;
    updated_at: string;
}

export interface BannerAd {
    id: string;
    name: string;
    image_url: string;
    link_url: string;
    alt_text?: string;
    placement: 'home' | 'result' | 'history' | 'all';
    position: 'top' | 'middle' | 'bottom';
    badge_text?: string;
    badge_color: string;
    sponsor_text?: string;
    start_date: string;
    end_date?: string;
    enabled: boolean;
    priority: number;
    impressions: number;
    clicks: number;
    created_at: string;
    updated_at: string;
}

export interface CompactAd {
    id: string;
    name: string;
    title: string;
    description?: string;
    image_url: string;
    link_url: string;
    preview_title?: string;
    preview_description?: string;
    preview_image?: string;
    placement: 'home-input' | 'home-bottom' | 'about' | 'all';
    size: 'small' | 'medium' | 'large';
    start_date: string;
    end_date?: string;
    enabled: boolean;
    priority: number;
    impressions: number;
    clicks: number;
    created_at: string;
    updated_at: string;
}

export interface PushNotification {
    id: string;
    title: string;
    body: string;
    icon?: string;
    image?: string;
    badge?: string;
    click_url?: string;
    target: 'all' | 'users' | 'guests' | 'specific';
    status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
    scheduled_at?: string;
    sent_at?: string;
    total_sent: number;
    total_delivered: number;
    total_clicked: number;
    total_failed: number;
    created_at: string;
}

interface CommunicationsData {
    announcements: Announcement[];
    banners: BannerAd[];
    compact: CompactAd[];
    push: PushNotification[];
    pushSubscriberCount: number;
}

// ============================================================================
// HOOKS
// ============================================================================

export function useCommunications() {
    const { data, loading, error, refetch, mutate } = useAdminFetch<CommunicationsData>(
        '/api/admin/communications',
        ADMIN_SWR_CONFIG.default
    );

    return {
        announcements: data?.announcements || [],
        banners: data?.banners || [],
        compactAds: data?.compact || [],
        pushNotifications: data?.push || [],
        pushSubscriberCount: data?.pushSubscriberCount || 0,
        loading,
        error,
        refetch,
        mutate,
    };
}

export function useAnnouncements() {
    const { data, loading, error, refetch, mutate } = useAdminFetch<Announcement[]>(
        '/api/admin/communications/announcements',
        ADMIN_SWR_CONFIG.default
    );

    const create = useCallback(async (announcement: Partial<Announcement>) => {
        const result = await mutate('POST', announcement);
        if (result.success) refetch();
        return result;
    }, [mutate, refetch]);

    const update = useCallback(async (id: string, updates: Partial<Announcement>) => {
        const result = await mutate('PUT', updates, `/api/admin/communications/announcements/${id}`);
        if (result.success) refetch();
        return result;
    }, [mutate, refetch]);

    const remove = useCallback(async (id: string) => {
        const result = await mutate('DELETE', undefined, `/api/admin/communications/announcements/${id}`);
        if (result.success) refetch();
        return result;
    }, [mutate, refetch]);

    return {
        announcements: data || [],
        loading,
        error,
        refetch,
        create,
        update,
        remove,
    };
}

export function useBannerAds() {
    const { data, loading, error, refetch, mutate } = useAdminFetch<BannerAd[]>(
        '/api/admin/communications/banners',
        ADMIN_SWR_CONFIG.default
    );

    const create = useCallback(async (banner: Partial<BannerAd>) => {
        const result = await mutate('POST', banner);
        if (result.success) refetch();
        return result;
    }, [mutate, refetch]);

    const update = useCallback(async (id: string, updates: Partial<BannerAd>) => {
        const result = await mutate('PUT', updates, `/api/admin/communications/banners/${id}`);
        if (result.success) refetch();
        return result;
    }, [mutate, refetch]);

    const remove = useCallback(async (id: string) => {
        const result = await mutate('DELETE', undefined, `/api/admin/communications/banners/${id}`);
        if (result.success) refetch();
        return result;
    }, [mutate, refetch]);

    return {
        banners: data || [],
        loading,
        error,
        refetch,
        create,
        update,
        remove,
    };
}

export function useCompactAds() {
    const { data, loading, error, refetch, mutate } = useAdminFetch<CompactAd[]>(
        '/api/admin/communications/compact',
        ADMIN_SWR_CONFIG.default
    );

    const create = useCallback(async (ad: Partial<CompactAd>) => {
        const result = await mutate('POST', ad);
        if (result.success) refetch();
        return result;
    }, [mutate, refetch]);

    const update = useCallback(async (id: string, updates: Partial<CompactAd>) => {
        const result = await mutate('PUT', updates, `/api/admin/communications/compact/${id}`);
        if (result.success) refetch();
        return result;
    }, [mutate, refetch]);

    const remove = useCallback(async (id: string) => {
        const result = await mutate('DELETE', undefined, `/api/admin/communications/compact/${id}`);
        if (result.success) refetch();
        return result;
    }, [mutate, refetch]);

    return {
        compactAds: data || [],
        loading,
        error,
        refetch,
        create,
        update,
        remove,
    };
}

export function usePushNotifications() {
    const { data, loading, error, refetch, mutate } = useAdminFetch<{
        data: PushNotification[];
        subscriberCount: number;
        vapidConfigured: boolean;
    }>('/api/admin/communications/push', ADMIN_SWR_CONFIG.default);

    const send = useCallback(async (notification: {
        title: string;
        body: string;
        icon?: string;
        image?: string;
        click_url?: string;
        send_now?: boolean;
    }) => {
        const result = await mutate('POST', { ...notification, send_now: true });
        if (result.success) refetch();
        return result;
    }, [mutate, refetch]);

    return {
        notifications: data?.data || [],
        subscriberCount: data?.subscriberCount || 0,
        vapidConfigured: data?.vapidConfigured || false,
        loading,
        error,
        refetch,
        send,
    };
}
