/**
 * Hook for managing admin alert configuration
 */

import { useState, useEffect, useCallback } from 'react';
import { adminFetch } from '@/lib/utils/admin-fetch';

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
    const [config, setConfig] = useState<AlertConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [testing, setTesting] = useState(false);
    const [runningHealthCheck, setRunningHealthCheck] = useState(false);

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminFetch('/api/admin/alerts');
            if (!res) throw new Error('Not authenticated');
            const data = await res.json();
            if (data.success) {
                setConfig(data.data);
            } else {
                throw new Error(data.error || 'Failed to fetch config');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch config');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    const updateConfig = useCallback(async (updates: Partial<AlertConfig>): Promise<boolean> => {
        try {
            const res = await adminFetch('/api/admin/alerts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!res) throw new Error('Not authenticated');
            const data = await res.json();
            if (data.success) {
                // Update local state
                setConfig(prev => prev ? { ...prev, ...updates } : null);
                return true;
            }
            throw new Error(data.error || 'Failed to update');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update');
            return false;
        }
    }, []);

    const testWebhook = useCallback(async (webhookUrl: string): Promise<{ success: boolean; error?: string }> => {
        setTesting(true);
        try {
            const res = await adminFetch('/api/admin/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'test', webhookUrl }),
            });
            if (!res) throw new Error('Not authenticated');
            const data = await res.json();
            return { success: data.success, error: data.error };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Test failed' };
        } finally {
            setTesting(false);
        }
    }, []);

    const runHealthCheck = useCallback(async (): Promise<HealthCheckResult | null> => {
        setRunningHealthCheck(true);
        try {
            const res = await adminFetch('/api/admin/cookies/health-check', {
                method: 'POST',
            });
            if (!res) throw new Error('Not authenticated');
            const data = await res.json();
            if (data.success) {
                // Refresh config to get updated lastHealthCheckAt
                await fetchConfig();
                return data.data;
            }
            throw new Error(data.error || 'Health check failed');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Health check failed');
            return null;
        } finally {
            setRunningHealthCheck(false);
        }
    }, [fetchConfig]);

    const getHealthStatus = useCallback(async (): Promise<Record<string, { total: number; healthy: number; cooldown: number; expired: number }> | null> => {
        try {
            const res = await adminFetch('/api/admin/cookies/health-check');
            if (!res) throw new Error('Not authenticated');
            const data = await res.json();
            if (data.success) {
                return data.data;
            }
            return null;
        } catch {
            return null;
        }
    }, []);

    return {
        config,
        loading,
        error,
        testing,
        runningHealthCheck,
        refetch: fetchConfig,
        updateConfig,
        testWebhook,
        runHealthCheck,
        getHealthStatus,
    };
}
