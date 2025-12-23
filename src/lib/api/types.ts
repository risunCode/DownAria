/**
 * API Response Types
 */

import type { 
    MediaFormat,
    MediaData,
    DownloadResponse,
    PlatformId 
} from '../types';

// Re-export types from ../types for convenience
export type { MediaData, DownloadResponse } from '../types';

export interface StatusResponse {
    success: boolean;
    data: {
        maintenance: boolean;
        maintenanceMessage: string | null;
        maintenanceContent: string | null;
        maintenanceLastUpdated: string | null;
        platforms: Array<{
            id: string;
            name: string;
            enabled: boolean;
            status: 'active' | 'offline' | 'maintenance';
        }>;
    };
}

export interface PlaygroundResponse {
    success: boolean;
    platform?: string;
    cached?: boolean;
    data?: MediaData;
    error?: string;
    rateLimit: {
        remaining: number;
        limit: number;
        resetIn?: number;
    };
}

export interface AdminAuthResponse {
    success: boolean;
    authenticated?: boolean;
    userId?: string;
    email?: string;
    username?: string;
    role?: string;
    isAdmin?: boolean;
    error?: string;
}

export interface ServiceConfig {
    platforms: Record<string, {
        id: string;
        name: string;
        enabled: boolean;
        method: string;
        rateLimit: number;
        cacheTime: number;
        disabledMessage: string;
        lastUpdated: string;
        stats: {
            totalRequests: number;
            successCount: number;
            errorCount: number;
            avgResponseTime: number;
        };
    }>;
    globalRateLimit: number;
    playgroundRateLimit: number;
    playgroundEnabled: boolean;
    maintenanceMode: boolean;
    maintenanceType: 'off' | 'api' | 'full';
    maintenanceMessage: string;
    apiKeyRequired: boolean;
    lastUpdated: string;
}

export interface ApiKey {
    id: string;
    name: string;
    key: string;
    hashedKey: string;
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

export interface CookiePoolStats {
    platform: string;
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
    label: string | null;
    user_id: string | null;
    status: 'healthy' | 'cooldown' | 'expired' | 'disabled';
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
    updated_at: string;
}
