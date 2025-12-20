/**
 * Admin Discord Alerts
 * ====================
 * Send alerts to Discord webhook for:
 * - Error spikes
 * - Cookie pool low
 * - Platform down
 */

import { supabase } from '@/core/database';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

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

interface DiscordEmbed {
    title: string;
    description?: string;
    color: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    footer?: { text: string; icon_url?: string };
    timestamp?: string;
}

type AlertType = 'error_spike' | 'cookie_low' | 'platform_down';

// ═══════════════════════════════════════════════════════════════
// ERROR TRACKING (in-memory)
// ═══════════════════════════════════════════════════════════════

interface ErrorEntry {
    timestamp: number;
    platform: string;
    error: string;
}

const errorBuffer: ErrorEntry[] = [];
const MAX_BUFFER_SIZE = 100;

// Platform consecutive failure tracking
const platformFailures = new Map<string, { count: number; lastError: string; since: number }>();
const FAILURE_TTL = 30 * 60 * 1000; // 30 minutes - auto cleanup old failures

// Cleanup old failure entries periodically
function cleanupOldFailures() {
    const now = Date.now();
    for (const [key, entry] of platformFailures.entries()) {
        if (now - entry.since > FAILURE_TTL) platformFailures.delete(key);
    }
}

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

let configCache: { data: AlertConfig | null; loadedAt: number } | null = null;
const CONFIG_CACHE_TTL = 60 * 1000; // 1 minute

export async function getAlertConfig(): Promise<AlertConfig | null> {
    if (configCache && Date.now() - configCache.loadedAt < CONFIG_CACHE_TTL) {
        return configCache.data;
    }

    if (!supabase) return null;

    try {
        const { data, error } = await supabase
            .from('admin_alerts_config')
            .select('*')
            .single();

        if (error || !data) {
            configCache = { data: null, loadedAt: Date.now() };
            return null;
        }

        const config: AlertConfig = {
            id: data.id,
            webhookUrl: data.webhook_url,
            enabled: data.enabled,
            alertErrorSpike: data.alert_error_spike,
            alertCookieLow: data.alert_cookie_low,
            alertPlatformDown: data.alert_platform_down,
            errorSpikeThreshold: data.error_spike_threshold,
            errorSpikeWindow: data.error_spike_window,
            cookieLowThreshold: data.cookie_low_threshold,
            platformDownThreshold: data.platform_down_threshold,
            cooldownMinutes: data.cooldown_minutes,
            lastAlertAt: data.last_alert_at,
            lastAlertType: data.last_alert_type,
            healthCheckEnabled: data.health_check_enabled,
            healthCheckInterval: data.health_check_interval,
            lastHealthCheckAt: data.last_health_check_at,
        };

        configCache = { data: config, loadedAt: Date.now() };
        return config;
    } catch {
        return null;
    }
}

export async function updateAlertConfig(updates: Partial<{
    webhook_url: string | null;
    enabled: boolean;
    alert_error_spike: boolean;
    alert_cookie_low: boolean;
    alert_platform_down: boolean;
    error_spike_threshold: number;
    error_spike_window: number;
    cookie_low_threshold: number;
    platform_down_threshold: number;
    cooldown_minutes: number;
    health_check_enabled: boolean;
    health_check_interval: number;
}>): Promise<boolean> {
    if (!supabase) return false;

    try {
        const { error } = await supabase
            .from('admin_alerts_config')
            .update(updates)
            .eq('id', '00000000-0000-0000-0000-000000000001');

        if (!error) {
            configCache = null; // Clear cache
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// COOLDOWN CHECK
// ═══════════════════════════════════════════════════════════════

function isInCooldown(config: AlertConfig, alertType: AlertType): boolean {
    if (!config.lastAlertAt) return false;
    
    const lastAlert = new Date(config.lastAlertAt).getTime();
    const cooldownMs = config.cooldownMinutes * 60 * 1000;
    const now = Date.now();
    
    // Same alert type has longer cooldown
    if (config.lastAlertType === alertType) {
        return now - lastAlert < cooldownMs * 2;
    }
    
    return now - lastAlert < cooldownMs;
}

async function updateLastAlert(alertType: AlertType): Promise<void> {
    if (!supabase) return;
    
    await supabase
        .from('admin_alerts_config')
        .update({
            last_alert_at: new Date().toISOString(),
            last_alert_type: alertType,
        })
        .eq('id', '00000000-0000-0000-0000-000000000001');
    
    configCache = null;
}

// ═══════════════════════════════════════════════════════════════
// SEND ALERT
// ═══════════════════════════════════════════════════════════════

async function sendDiscordAlert(webhookUrl: string, embed: DiscordEmbed): Promise<boolean> {
    try {
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'XTFetch Alerts',
                avatar_url: 'https://xt-fetch.vercel.app/icon.png',
                embeds: [embed],
            }),
        });
        return res.ok;
    } catch {
        console.error('[AdminAlerts] Failed to send Discord alert');
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// ERROR TRACKING
// ═══════════════════════════════════════════════════════════════

/**
 * Track an error for potential alert
 */
export async function trackError(platform: string, error: string): Promise<void> {
    const now = Date.now();
    
    // Add to buffer
    errorBuffer.push({ timestamp: now, platform, error });
    
    // Trim old entries
    while (errorBuffer.length > MAX_BUFFER_SIZE) {
        errorBuffer.shift();
    }
    
    // Track consecutive failures
    const failures = platformFailures.get(platform) || { count: 0, lastError: '', since: now };
    failures.count++;
    failures.lastError = error;
    if (failures.count === 1) failures.since = now;
    platformFailures.set(platform, failures);
    
    // Check for alerts
    await checkErrorSpike(platform);
    await checkPlatformDown(platform);
}

/**
 * Track a success (resets consecutive failure count)
 */
export function trackSuccess(platform: string): void {
    platformFailures.delete(platform);
}

// ═══════════════════════════════════════════════════════════════
// ALERT CHECKS
// ═══════════════════════════════════════════════════════════════

async function checkErrorSpike(platform: string): Promise<void> {
    const config = await getAlertConfig();
    if (!config?.enabled || !config.webhookUrl || !config.alertErrorSpike) return;
    if (isInCooldown(config, 'error_spike')) return;
    
    const windowMs = config.errorSpikeWindow * 60 * 1000;
    const cutoff = Date.now() - windowMs;
    
    // Count errors in window for this platform
    const recentErrors = errorBuffer.filter(e => 
        e.timestamp > cutoff && e.platform === platform
    );
    
    if (recentErrors.length >= config.errorSpikeThreshold) {
        // Group errors by message
        const errorCounts = new Map<string, number>();
        recentErrors.forEach(e => {
            errorCounts.set(e.error, (errorCounts.get(e.error) || 0) + 1);
        });
        
        // Find most common error
        let commonError = 'Unknown';
        let maxCount = 0;
        errorCounts.forEach((count, error) => {
            if (count > maxCount) {
                maxCount = count;
                commonError = error;
            }
        });
        
        const embed: DiscordEmbed = {
            title: '🚨 ERROR SPIKE DETECTED',
            color: 0xFF0000, // Red
            fields: [
                { name: 'Platform', value: platform.charAt(0).toUpperCase() + platform.slice(1), inline: true },
                { name: 'Errors', value: `${recentErrors.length} in ${config.errorSpikeWindow} min`, inline: true },
                { name: 'Common Error', value: commonError.substring(0, 100), inline: false },
            ],
            footer: { text: 'XTFetch Admin Alert' },
            timestamp: new Date().toISOString(),
        };
        
        const sent = await sendDiscordAlert(config.webhookUrl, embed);
        if (sent) {
            await updateLastAlert('error_spike');
            // Clear buffer for this platform to prevent repeat alerts
            const remaining = errorBuffer.filter(e => e.platform !== platform);
            errorBuffer.length = 0;
            errorBuffer.push(...remaining);
        }
    }
}

async function checkPlatformDown(platform: string): Promise<void> {
    const config = await getAlertConfig();
    if (!config?.enabled || !config.webhookUrl || !config.alertPlatformDown) return;
    if (isInCooldown(config, 'platform_down')) return;
    
    const failures = platformFailures.get(platform);
    if (!failures || failures.count < config.platformDownThreshold) return;
    
    const sinceTime = new Date(failures.since).toLocaleTimeString();
    
    const embed: DiscordEmbed = {
        title: '🔴 PLATFORM DOWN',
        color: 0x8B0000, // Dark red
        fields: [
            { name: 'Platform', value: platform.charAt(0).toUpperCase() + platform.slice(1), inline: true },
            { name: 'Consecutive Failures', value: failures.count.toString(), inline: true },
            { name: 'Since', value: sinceTime, inline: true },
            { name: 'Last Error', value: failures.lastError.substring(0, 200), inline: false },
        ],
        footer: { text: 'XTFetch Admin Alert' },
        timestamp: new Date().toISOString(),
    };
    
    const sent = await sendDiscordAlert(config.webhookUrl, embed);
    if (sent) {
        await updateLastAlert('platform_down');
        // Reset counter after alert
        platformFailures.delete(platform);
    }
}

/**
 * Check cookie pool health and alert if low
 */
export async function checkCookiePoolHealth(stats: Record<string, { total: number; healthy: number }>): Promise<void> {
    const config = await getAlertConfig();
    if (!config?.enabled || !config.webhookUrl || !config.alertCookieLow) return;
    if (isInCooldown(config, 'cookie_low')) return;
    
    const lowPlatforms: Array<{ platform: string; healthy: number; total: number }> = [];
    
    for (const [platform, data] of Object.entries(stats)) {
        if (data.total > 0 && data.healthy < config.cookieLowThreshold) {
            lowPlatforms.push({ platform, healthy: data.healthy, total: data.total });
        }
    }
    
    if (lowPlatforms.length === 0) return;
    
    const fields = lowPlatforms.map(p => ({
        name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
        value: `${p.healthy}/${p.total} healthy`,
        inline: true,
    }));
    
    const embed: DiscordEmbed = {
        title: '⚠️ COOKIE POOL LOW',
        description: `${lowPlatforms.length} platform(s) have less than ${config.cookieLowThreshold} healthy cookies`,
        color: 0xFFA500, // Orange
        fields,
        footer: { text: 'XTFetch Admin Alert • Add more cookies or wait for cooldown' },
        timestamp: new Date().toISOString(),
    };
    
    const sent = await sendDiscordAlert(config.webhookUrl, embed);
    if (sent) {
        await updateLastAlert('cookie_low');
    }
}

/**
 * Send test alert
 */
export async function sendTestAlert(webhookUrl: string): Promise<{ success: boolean; error?: string }> {
    const embed: DiscordEmbed = {
        title: '✅ TEST ALERT',
        description: 'This is a test alert from XTFetch Admin Panel.',
        color: 0x00FF00, // Green
        fields: [
            { name: 'Status', value: 'Webhook configured correctly!', inline: false },
        ],
        footer: { text: 'XTFetch Admin Alert' },
        timestamp: new Date().toISOString(),
    };
    
    try {
        const res = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'XTFetch Alerts',
                avatar_url: 'https://xt-fetch.vercel.app/icon.png',
                embeds: [embed],
            }),
        });
        
        if (res.ok) {
            return { success: true };
        }
        
        const text = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${text}` };
    } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
}

// ═══════════════════════════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════════════════════════

export async function updateLastHealthCheck(): Promise<void> {
    if (!supabase) return;
    
    await supabase
        .from('admin_alerts_config')
        .update({ last_health_check_at: new Date().toISOString() })
        .eq('id', '00000000-0000-0000-0000-000000000001');
    
    configCache = null;
}

export function clearConfigCache(): void {
    configCache = null;
}
