'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Shield, Database, Globe, Save, RefreshCw, Webhook, ExternalLink, Bell, Lock, AlertTriangle, Activity } from 'lucide-react';
import Swal from 'sweetalert2';
import AdminGuard from '@/components/AdminGuard';
import { useSettings, useAlerts } from '@/hooks/admin';

interface GlobalSettings {
    site_name: string;
    site_description: string;
    discord_invite: string;
    telegram_channel: string;
    github_repo: string;
    discord_webhook_url: string;
    discord_notify_enabled: string;
    logging_enabled: string;
    cache_ttl: string;
    // Update prompt settings
    update_prompt_enabled: string;
    update_prompt_mode: string;
    update_prompt_delay_seconds: string;
    update_prompt_dismissable: string;
    update_prompt_custom_message: string;
    [key: string]: string;
}

const DEFAULT_SETTINGS: GlobalSettings = {
    site_name: 'XTFetch',
    site_description: 'Social Media Video Downloader',
    discord_invite: '',
    telegram_channel: '',
    github_repo: '',
    discord_webhook_url: '',
    discord_notify_enabled: 'false',
    logging_enabled: 'true',
    cache_ttl: '259200',
    // Update prompt defaults
    update_prompt_enabled: 'true',
    update_prompt_mode: 'always',
    update_prompt_delay_seconds: '0',
    update_prompt_dismissable: 'true',
    update_prompt_custom_message: '',
};

export default function AdminSettingsPage() {
    return (
        <AdminGuard requiredRole="admin">
            <SettingsContent />
        </AdminGuard>
    );
}

function SettingsContent() {
    const [localSettings, setLocalSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    
    // Use SWR hooks for data fetching
    const { settings: dbSettings, loading, updateSettings: saveToDb } = useSettings();
    
    // Sync DB settings to local state
    useEffect(() => {
        if (dbSettings) {
            setLocalSettings(prev => ({ ...prev, ...dbSettings }));
        }
    }, [dbSettings]);

    const updateSetting = (key: string, value: string) => {
        setLocalSettings(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            await saveToDb(localSettings);
            setHasChanges(false);
        } finally {
            setSaving(false);
        }
    };

    const clearCache = async () => {
        const result = await Swal.fire({
            title: 'Clear Cache?',
            text: 'This will clear all cached API responses.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Clear',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!result.isConfirmed) return;

        try {
            const res = await fetch('/api/admin/cache', { method: 'DELETE' });
            const data = await res.json();
            
            if (data.success) {
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: `Cache cleared (${data.cleared?.total || 0} entries)`,
                    showConfirmButton: false,
                    timer: 2000,
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                });
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: 'Failed to clear cache',
                showConfirmButton: false,
                timer: 2000,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
        }
    };

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[60vh]">
                <RefreshCw className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6">
            <div className="max-w-4xl mx-auto space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Settings className="w-5 h-5 text-[var(--accent-primary)]" />
                            Global Settings
                        </h1>
                        <p className="text-[var(--text-muted)] text-xs">System configuration stored in database</p>
                    </div>
                    <button
                        onClick={saveSettings}
                        disabled={saving || !hasChanges}
                        className="btn-gradient flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Saved'}
                    </button>
                </div>

                {/* Site Info */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-4 h-4 text-blue-400" />
                        <h2 className="font-semibold text-sm">Site Information</h2>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Site Name</label>
                            <input
                                type="text"
                                value={localSettings.site_name}
                                onChange={e => updateSetting('site_name', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Description</label>
                            <input
                                type="text"
                                value={localSettings.site_description}
                                onChange={e => updateSetting('site_description', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                            />
                        </div>
                    </div>
                </motion.div>

                {/* Social Links */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <ExternalLink className="w-4 h-4 text-purple-400" />
                        <h2 className="font-semibold text-sm">Social Links</h2>
                    </div>
                    <div className="grid md:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Discord Invite</label>
                            <input
                                type="url"
                                value={localSettings.discord_invite}
                                onChange={e => updateSetting('discord_invite', e.target.value)}
                                placeholder="https://discord.gg/xxx"
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Telegram Channel</label>
                            <input
                                type="url"
                                value={localSettings.telegram_channel}
                                onChange={e => updateSetting('telegram_channel', e.target.value)}
                                placeholder="https://t.me/xxx"
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">GitHub Repo</label>
                            <input
                                type="url"
                                value={localSettings.github_repo}
                                onChange={e => updateSetting('github_repo', e.target.value)}
                                placeholder="https://github.com/xxx"
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                            />
                        </div>
                    </div>
                </motion.div>

                {/* Discord Webhook */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Webhook className="w-4 h-4 text-[#5865F2]" />
                        <h2 className="font-semibold text-sm">Discord Webhook</h2>
                    </div>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Webhook URL</label>
                            <input
                                type="url"
                                value={localSettings.discord_webhook_url}
                                onChange={e => updateSetting('discord_webhook_url', e.target.value)}
                                placeholder="https://discord.com/api/webhooks/..."
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono"
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={localSettings.discord_notify_enabled === 'true'}
                                onChange={e => updateSetting('discord_notify_enabled', e.target.checked ? 'true' : 'false')}
                                className="rounded"
                            />
                            Enable download notifications
                        </label>
                    </div>
                </motion.div>

                {/* Admin Alerts */}
                <AdminAlertsSection />

                {/* PWA Update Prompt */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Bell className="w-4 h-4 text-cyan-400" />
                        <h2 className="font-semibold text-sm">PWA Update Prompt</h2>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mb-3">
                        Control the &quot;New version available&quot; notification behavior
                    </p>
                    <div className="space-y-3">
                        {/* Enable/Disable */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                            <div>
                                <p className="text-sm font-medium">Show Update Prompt</p>
                                <p className="text-xs text-[var(--text-muted)]">Display notification when new version available</p>
                            </div>
                            <button
                                onClick={() => updateSetting('update_prompt_enabled', localSettings.update_prompt_enabled === 'true' ? 'false' : 'true')}
                                className={`relative w-12 h-6 rounded-full transition-colors ${localSettings.update_prompt_enabled === 'true' ? 'bg-cyan-500' : 'bg-gray-600'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${localSettings.update_prompt_enabled === 'true' ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>

                        {localSettings.update_prompt_enabled === 'true' && (
                            <>
                                {/* Mode Selection */}
                                <div>
                                    <label className="block text-xs text-[var(--text-muted)] mb-1">Display Mode</label>
                                    <select
                                        value={localSettings.update_prompt_mode}
                                        onChange={e => updateSetting('update_prompt_mode', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                    >
                                        <option value="always">Always show (setiap ada update)</option>
                                        <option value="once">Once only (dismiss = gone forever)</option>
                                        <option value="session">Per session (dismiss = gone until refresh)</option>
                                    </select>
                                </div>

                                {/* Delay */}
                                <div>
                                    <label className="block text-xs text-[var(--text-muted)] mb-1">Delay (seconds)</label>
                                    <input
                                        type="number"
                                        value={localSettings.update_prompt_delay_seconds}
                                        onChange={e => updateSetting('update_prompt_delay_seconds', e.target.value)}
                                        min={0}
                                        max={60}
                                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                    />
                                    <p className="text-[10px] text-[var(--text-muted)] mt-1">Delay before showing prompt (0 = immediate)</p>
                                </div>

                                {/* Dismissable */}
                                <label className="flex items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={localSettings.update_prompt_dismissable === 'true'}
                                        onChange={e => updateSetting('update_prompt_dismissable', e.target.checked ? 'true' : 'false')}
                                        className="rounded"
                                    />
                                    Allow dismiss (show &quot;Later&quot; button)
                                </label>

                                {/* Custom Message */}
                                <div>
                                    <label className="block text-xs text-[var(--text-muted)] mb-1">Custom Message (optional)</label>
                                    <input
                                        type="text"
                                        value={localSettings.update_prompt_custom_message}
                                        onChange={e => updateSetting('update_prompt_custom_message', e.target.value)}
                                        placeholder="Refresh to get the latest features."
                                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>

                {/* System */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Database className="w-4 h-4 text-green-400" />
                        <h2 className="font-semibold text-sm">System</h2>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Cache TTL (seconds)</label>
                            <input
                                type="number"
                                value={localSettings.cache_ttl}
                                onChange={e => updateSetting('cache_ttl', e.target.value)}
                                min={0}
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                            />
                            <p className="text-[10px] text-[var(--text-muted)] mt-1">Default: 259200 (3 days)</p>
                        </div>
                        <div className="flex flex-col justify-center">
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={localSettings.logging_enabled === 'true'}
                                    onChange={e => updateSetting('logging_enabled', e.target.checked ? 'true' : 'false')}
                                    className="rounded"
                                />
                                Enable request logging
                            </label>
                        </div>
                    </div>
                </motion.div>

                {/* Danger Zone */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-4 h-4 text-red-400" />
                        <h2 className="font-semibold text-sm">Danger Zone</h2>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={clearCache}
                            className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm flex items-center gap-2 hover:border-red-500/50 hover:text-red-400 transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Clear Cache
                        </button>
                        <button
                            onClick={async () => {
                                const result = await Swal.fire({
                                    title: 'Migrate Cookies?',
                                    text: 'This will encrypt all unencrypted cookies in the pool.',
                                    icon: 'question',
                                    showCancelButton: true,
                                    confirmButtonColor: '#8b5cf6',
                                    confirmButtonText: 'Migrate',
                                    background: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                });
                                if (!result.isConfirmed) return;
                                
                                try {
                                    const res = await fetch('/api/admin/cookies/migrate', { method: 'POST' });
                                    const data = await res.json();
                                    if (data.success) {
                                        Swal.fire({
                                            toast: true,
                                            position: 'top-end',
                                            icon: 'success',
                                            title: data.message,
                                            showConfirmButton: false,
                                            timer: 3000,
                                            background: 'var(--bg-card)',
                                            color: 'var(--text-primary)',
                                        });
                                    } else {
                                        throw new Error(data.error);
                                    }
                                } catch (err) {
                                    Swal.fire({
                                        toast: true,
                                        position: 'top-end',
                                        icon: 'error',
                                        title: err instanceof Error ? err.message : 'Migration failed',
                                        showConfirmButton: false,
                                        timer: 2000,
                                    });
                                }
                            }}
                            className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm flex items-center gap-2 hover:border-purple-500/50 hover:text-purple-400 transition-colors"
                        >
                            <Lock className="w-4 h-4" />
                            Encrypt Cookies
                        </button>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-3">
                        Cookie encryption uses AES-256-GCM. Run &quot;Encrypt Cookies&quot; once to migrate existing unencrypted cookies.
                    </p>
                </motion.div>
            </div>
        </div>
    );
}


// Admin Alerts Section Component
function AdminAlertsSection() {
    const { config, loading, testing, runningHealthCheck, updateConfig, testWebhook, runHealthCheck } = useAlerts();
    const [localWebhook, setLocalWebhook] = useState('');

    useEffect(() => {
        if (config?.webhookUrl) {
            setLocalWebhook(config.webhookUrl);
        }
    }, [config?.webhookUrl]);

    const handleTest = async () => {
        if (!localWebhook) return;
        const result = await testWebhook(localWebhook);
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: result.success ? 'success' : 'error',
            title: result.success ? 'Test alert sent!' : result.error || 'Test failed',
            showConfirmButton: false,
            timer: 2000,
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
    };

    const handleHealthCheck = async () => {
        const result = await runHealthCheck();
        if (result) {
            Swal.fire({
                title: 'Health Check Complete',
                html: `
                    <div class="text-left text-sm space-y-2">
                        <p><strong>Checked:</strong> ${result.summary.totalChecked} cookies</p>
                        <p class="text-green-400"><strong>Healthy:</strong> ${result.summary.totalHealthy}</p>
                        <p class="text-red-400"><strong>Failed:</strong> ${result.summary.totalFailed}</p>
                    </div>
                `,
                icon: result.summary.totalFailed > 0 ? 'warning' : 'success',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
        }
    };

    if (loading) {
        return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }} className="glass-card p-4">
                <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    <h2 className="font-semibold text-sm">Admin Alerts</h2>
                </div>
                <div className="h-32 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 animate-spin text-[var(--accent-primary)]" />
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }} className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    <h2 className="font-semibold text-sm">Admin Alerts</h2>
                </div>
                <button
                    onClick={() => updateConfig({ enabled: !config?.enabled })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${config?.enabled ? 'bg-green-500' : 'bg-gray-600'}`}
                >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${config?.enabled ? 'left-5' : 'left-0.5'}`} />
                </button>
            </div>
            
            <p className="text-xs text-[var(--text-muted)] mb-3">
                Get Discord alerts for errors, low cookie pool, and platform issues
            </p>

            <div className="space-y-3">
                {/* Webhook URL */}
                <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Alert Webhook URL</label>
                    <div className="flex gap-2">
                        <input
                            type="url"
                            value={localWebhook}
                            onChange={e => setLocalWebhook(e.target.value)}
                            onBlur={() => {
                                if (localWebhook !== config?.webhookUrl) {
                                    updateConfig({ webhookUrl: localWebhook || null });
                                }
                            }}
                            placeholder="https://discord.com/api/webhooks/..."
                            className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono"
                        />
                        <button
                            onClick={handleTest}
                            disabled={testing || !localWebhook}
                            className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm hover:border-[var(--accent-primary)]/50 disabled:opacity-50"
                        >
                            {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Test'}
                        </button>
                    </div>
                </div>

                {/* Alert Types */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)] text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config?.alertErrorSpike ?? true}
                            onChange={e => updateConfig({ alertErrorSpike: e.target.checked })}
                            className="rounded"
                        />
                        <span>Error Spike</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)] text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config?.alertCookieLow ?? true}
                            onChange={e => updateConfig({ alertCookieLow: e.target.checked })}
                            className="rounded"
                        />
                        <span>Cookie Low</span>
                    </label>
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)] text-sm cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config?.alertPlatformDown ?? true}
                            onChange={e => updateConfig({ alertPlatformDown: e.target.checked })}
                            className="rounded"
                        />
                        <span>Platform Down</span>
                    </label>
                </div>

                {/* Thresholds */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                        <label className="block text-[10px] text-[var(--text-muted)] mb-1">Error Threshold</label>
                        <input
                            type="number"
                            value={config?.errorSpikeThreshold ?? 10}
                            onChange={e => updateConfig({ errorSpikeThreshold: parseInt(e.target.value) || 10 })}
                            min={1}
                            max={100}
                            className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] text-[var(--text-muted)] mb-1">Window (min)</label>
                        <input
                            type="number"
                            value={config?.errorSpikeWindow ?? 5}
                            onChange={e => updateConfig({ errorSpikeWindow: parseInt(e.target.value) || 5 })}
                            min={1}
                            max={60}
                            className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] text-[var(--text-muted)] mb-1">Cookie Low</label>
                        <input
                            type="number"
                            value={config?.cookieLowThreshold ?? 2}
                            onChange={e => updateConfig({ cookieLowThreshold: parseInt(e.target.value) || 2 })}
                            min={1}
                            max={10}
                            className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] text-[var(--text-muted)] mb-1">Cooldown (min)</label>
                        <input
                            type="number"
                            value={config?.cooldownMinutes ?? 15}
                            onChange={e => updateConfig({ cooldownMinutes: parseInt(e.target.value) || 15 })}
                            min={1}
                            max={120}
                            className="w-full px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                        />
                    </div>
                </div>

                {/* Cookie Health Check */}
                <div className="pt-3 border-t border-[var(--border-color)]">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm font-medium">Cookie Health Check</span>
                        </div>
                        <button
                            onClick={handleHealthCheck}
                            disabled={runningHealthCheck}
                            className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                        >
                            {runningHealthCheck ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                            {runningHealthCheck ? 'Checking...' : 'Run Now'}
                        </button>
                    </div>
                    {config?.lastHealthCheckAt && (
                        <p className="text-[10px] text-[var(--text-muted)]">
                            Last check: {new Date(config.lastHealthCheckAt).toLocaleString()}
                        </p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
