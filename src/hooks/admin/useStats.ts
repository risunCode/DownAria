'use client';

import { useState } from 'react';
import { useAdminFetch, ADMIN_SWR_CONFIG } from './useAdminFetch';

interface PlatformStats {
    [platform: string]: number;
}

interface CountryStats {
    [country: string]: number;
}

interface SourceStats {
    [source: string]: number;
}

interface SuccessRate {
    total: number;
    success: number;
    rate: number;
}

interface RecentError {
    id: number;
    platform: string;
    error_type: string;
    error_message: string;
    created_at: string;
}

export interface DashboardStats {
    period: string;
    platform: PlatformStats;
    country: CountryStats;
    source: SourceStats;
    successRate: SuccessRate;
    dailyTrend: Record<string, number>;
    recentErrors: RecentError[];
}

export function useStats(days: number = 7) {
    const [autoRefresh, setAutoRefresh] = useState(false);
    
    // Use SWR with conditional auto-refresh
    const { data, loading, error, refetch } = useAdminFetch<DashboardStats>(
        `/api/admin/stats?days=${days}`,
        {
            ...ADMIN_SWR_CONFIG.default,
            // Auto-refresh every 30s when enabled, otherwise no auto-refresh
            refreshInterval: autoRefresh ? 30000 : 0,
            // Dedupe for 15s to prevent spam
            dedupingInterval: 15000,
        }
    );

    // Computed stats
    const totalDownloads = data ? Object.values(data.platform).reduce((a, b) => a + b, 0) : 0;
    const platformCount = data ? Object.keys(data.platform).length : 0;
    const countryCount = data ? Object.keys(data.country).length : 0;
    const failedCount = data ? data.successRate.total - data.successRate.success : 0;

    return {
        stats: data,
        loading,
        error,
        refetch,
        autoRefresh,
        setAutoRefresh,
        // Computed
        totalDownloads,
        platformCount,
        countryCount,
        failedCount,
    };
}

// Helper: Get country flag emoji from ISO code
export function getCountryFlag(countryCode: string): string {
    if (countryCode === 'XX' || !countryCode || countryCode.length !== 2) return '🌐';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

// Platform colors for charts
export const PLATFORM_COLORS: Record<string, string> = {
    facebook: 'bg-blue-500',
    instagram: 'bg-pink-500',
    twitter: 'bg-sky-500',
    tiktok: 'bg-cyan-500',
    weibo: 'bg-orange-500',
    youtube: 'bg-red-500',
};
