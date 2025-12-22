/**
 * Hook for managing admin alert configuration
 */

import { useState, useCallback } from 'react';
import { useAdminFetch } from './useAdminFetch';

export interface AlertConfig {
    id: string;
    webhookUrl: string | null;
    enabled: boolean;
    alertErrorSpike: boolean;
    alertCookieLow: boolean;
    alertPlatformDown: boolean;
    errorSpikeThreshold: number;
    errorSpikeWindow: number;
    cookieLowThreshold: number;
    platformDownThreshold: number;
    cooldownMinutes: number;
    lastAlertAt: string | null;
    lastAlertType: string | null;
    healthCheckEnabled: boolean;
    healthCheckInterval: number;
    lastHealthCheckAt: string | null;
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
