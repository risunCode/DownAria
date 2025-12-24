/**
 * Hook for managing admin alert configuration
 */

import { useState, useCallback } from 'react';
import { useAdminFetch } from './useAdminFetch';

export interface AlertConfig {
    id: string;
    // Alert type toggles (boolean flags)
    alertErrorSpike: boolean;
    alertCookieLow: boolean;
    alertPlatformDown: boolean;
    alertRateLimit: boolean;          // NEW: alert_rate_limit from schema
    // Thresholds
    errorSpikeThreshold: number;
    errorSpikeWindow: number;
    cookieLowThreshold: number;
    platformDownThreshold: number;
    rateLimitThreshold: number;       // NEW: rate_limit_threshold from schema
    cooldownMinutes: number;
    // Alert state
    lastAlertAt: string | null;
    lastAlertType: string | null;
    // Notification settings
    notifyEmail: boolean;             // NEW: notify_email from schema
    notifyDiscord: boolean;           // NEW: notify_discord from schema
    discordWebhookUrl: string | null; // RENAMED: was webhookUrl, now discordWebhookUrl per schema
    emailRecipients: string[] | null; // NEW: email_recipients from schema (JSONB array)
    // Health check settings
    healthCheckEnabled: boolean;
    healthCheckInterval: number;
    lastHealthCheckAt: string | null;
    // Timestamps
    createdAt?: string;               // NEW: created_at from schema
    updatedAt?: string;               // NEW: updated_at from schema
    // Legacy alias for backward compatibility
    webhookUrl?: string | null;       // DEPRECATED: use discordWebhookUrl
    enabled?: boolean;                // DEPRECATED: use individual alert flags
}

export interface HealthCheckResult {
    results: Record<string, {
        total: number;
        healthy: number;
        cooldown: number;
        expired: number;
        checked: string[];
        failed: string[];
    }>;
    summary: {
        totalChecked: number;
        totalHealthy: number;
        totalFailed: number;
    };
    checkedAt: string;
}

export function useAlerts() {
    const { data: config, loading, error, refetch, mutate } = useAdminFetch<AlertConfig>('/api/admin/alerts');
    const [testing, setTesting] = useState(false);
    const [runningHealthCheck, setRunningHealthCheck] = useState(false);

    const updateConfig = useCallback(async (updates: Partial<AlertConfig>): Promise<boolean> => {
        try {
            const result = await mutate('PUT', updates);
            if (result.success) {
                await refetch();
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }, [mutate, refetch]);

    const testWebhook = useCallback(async (webhookUrl: string): Promise<{ success: boolean; error?: string }> => {
        setTesting(true);
        try {
            const result = await mutate('POST', { action: 'test', webhookUrl });
            return { success: result.success, error: result.error };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Test failed' };
        } finally {
            setTesting(false);
        }
    }, [mutate]);

    const runHealthCheck = useCallback(async (): Promise<HealthCheckResult | null> => {
        setRunningHealthCheck(true);
        try {
            // Use separate fetch for health check endpoint
            const { mutate: healthMutate } = useAdminFetch('/api/admin/cookies/health-check');
            const result = await healthMutate('POST');
            if (result.success) {
                await refetch(); // Refresh config
                return result.data as HealthCheckResult;
            }
            return null;
        } catch {
            return null;
        } finally {
            setRunningHealthCheck(false);
        }
    }, [refetch]);

    return {
        config,
        loading,
        error,
        testing,
        runningHealthCheck,
        refetch,
        updateConfig,
        testWebhook,
        runHealthCheck,
    };
}
