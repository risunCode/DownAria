'use client';

import { useState } from 'react';
import { useAdminFetch, ADMIN_SWR_CONFIG } from './useAdminFetch';

// ============================================================================
// INTERFACES - Matching backend /api/admin/stats response
// ============================================================================

interface PlatformStat {
    total: number;
    success: number;
    failed: number;
}

interface Summary {
    totalDownloads: number;
    successfulDownloads: number;
    failedDownloads: number;
    uniqueUsers: number;
    successRate: number;  // percentage (0-100)
}

interface DailyStat {
    id: string;
    platform: string;
    date: string;
    total_downloads: number;
    successful_downloads: number;
    failed_downloads: number;
    unique_users: number;
    avg_response_time_ms: number;
}

interface RecentError {
    id: string;
    platform: string;
    error_type: string;
    error_code: string;
    error_message: string;
    request_url: string | null;
    user_agent: string | null;
    ip_address: string | null;
    timestamp: string;
}

/** Stats data structure from /api/admin/stats (after adminFetcher extracts .data) */
export interface StatsData {
    summary: Summary;
    byPlatform: Record<string, PlatformStat>;
    byCountry: Record<string, number>;
    bySource: Record<string, number>;
    recentErrors: RecentError[];
    errorsByCode: Record<string, number>;
    dailyStats: DailyStat[];
}

export function useStats(days: number = 7) {
    const [autoRefresh, setAutoRefresh] = useState(false);
    
    // Use SWR with conditional auto-refresh
    // Note: adminFetcher already extracts .data from response
    const { data: stats, loading, error, refetch } = useAdminFetch<StatsData>(
        `/api/admin/stats?days=${days}`,
        {
            ...ADMIN_SWR_CONFIG.default,
            // Auto-refresh every 30s when enabled, otherwise no auto-refresh
            refreshInterval: autoRefresh ? 30000 : 0,
            // Dedupe for 15s to prevent spam
            dedupingInterval: 15000,
        }
    );

    // Computed stats - with null checks
    const totalDownloads = stats?.summary?.totalDownloads ?? 0;
    const platformCount = stats?.byPlatform ? Object.keys(stats.byPlatform).length : 0;
    const failedCount = stats?.summary?.failedDownloads ?? 0;
    const successRate = stats?.summary?.successRate ?? 0;
    const uniqueUsers = stats?.summary?.uniqueUsers ?? 0;

    return {
        stats,
        loading,
        error,
        refetch,
        autoRefresh,
        setAutoRefresh,
        // Computed
        totalDownloads,
        platformCount,
        failedCount,
        successRate,
        uniqueUsers,
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
