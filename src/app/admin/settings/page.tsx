'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Shield, Database, Globe, Save, RefreshCw, Webhook, ExternalLink, Bell } from 'lucide-react';
import Swal from 'sweetalert2';
import AdminGuard from '@/components/AdminGuard';

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
    const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    
    // Security settings (from service_config)
    const [apiKeyRequired, setApiKeyRequired] = useState(false);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState('');
    const [securitySaving, setSecuritySaving] = useState(false);

    // Load settings from DB
    useEffect(() => {
        // Load global settings
        fetch('/api/admin/settings')
            .then(r => r.json())
            .then(data => {
                if (data.success && data.data) {
                    setSettings(prev => ({ ...prev, ...data.data }));
                }
            })
            .catch(() => {});
        
        // Load service config (security settings)
        fetch('/api/admin/services')
            .then(r => r.json())
            .then(data => {
                if (data.success && data.data) {
                    setApiKeyRequired(data.data.apiKeyRequired ?? false);
                    setMaintenanceMode(data.data.maintenanceMode ?? false);
                    setMaintenanceMessage(data.data.maintenanceMessage ?? '');
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);
    
    const saveSecuritySettings = async (updates: { apiKeyRequired?: boolean; maintenanceMode?: boolean; maintenanceMessage?: string }) => {
        setSecuritySaving(true);
        try {
            const res = await fetch('/api/admin/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updateGlobal', ...updates })
            });
            const data = await res.json();
            if (data.success) {
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Saved', showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            }
        } catch {
            Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Failed to save', showConfirmButton: false, timer: 2000 });
        } finally {
            setSecuritySaving(false);
        }
    };

    const updateSetting = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings })
            });
            const data = await res.json();
            if (data.success) {
                setHasChanges(false);
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: 'Settings saved',
                    showConfirmButton: false,
                    timer: 1500,
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
                title: err instanceof Error ? err.message : 'Failed to save',
                showConfirmButton: false,
                timer: 2000,
            });
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
                                value={settings.site_name}
                                onChange={e => updateSetting('site_name', e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Description</label>
                            <input
                                type="text"
                                value={settings.site_description}
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
                                value={settings.discord_invite}
                                onChange={e => updateSetting('discord_invite', e.target.value)}
                                placeholder="https://discord.gg/xxx"
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Telegram Channel</label>
                            <input
                                type="url"
                                value={settings.telegram_channel}
                                onChange={e => updateSetting('telegram_channel', e.target.value)}
                                placeholder="https://t.me/xxx"
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">GitHub Repo</label>
                            <input
                                type="url"
                                value={settings.github_repo}
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
                                value={settings.discord_webhook_url}
                                onChange={e => updateSetting('discord_webhook_url', e.target.value)}
                                placeholder="https://discord.com/api/webhooks/..."
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono"
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={settings.discord_notify_enabled === 'true'}
                                onChange={e => updateSetting('discord_notify_enabled', e.target.checked ? 'true' : 'false')}
                                className="rounded"
                            />
                            Enable download notifications
                        </label>
                    </div>
                </motion.div>

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
                                onClick={() => updateSetting('update_prompt_enabled', settings.update_prompt_enabled === 'true' ? 'false' : 'true')}
                                className={`relative w-12 h-6 rounded-full transition-colors ${settings.update_prompt_enabled === 'true' ? 'bg-cyan-500' : 'bg-gray-600'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${settings.update_prompt_enabled === 'true' ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>

                        {settings.update_prompt_enabled === 'true' && (
                            <>
                                {/* Mode Selection */}
                                <div>
                                    <label className="block text-xs text-[var(--text-muted)] mb-1">Display Mode</label>
                                    <select
                                        value={settings.update_prompt_mode}
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
                                        value={settings.update_prompt_delay_seconds}
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
                                        checked={settings.update_prompt_dismissable === 'true'}
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
                                        value={settings.update_prompt_custom_message}
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
                                value={settings.cache_ttl}
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
                                    checked={settings.logging_enabled === 'true'}
                                    onChange={e => updateSetting('logging_enabled', e.target.checked ? 'true' : 'false')}
                                    className="rounded"
                                />
                                Enable request logging
                            </label>
                        </div>
                    </div>
                </motion.div>

                {/* Security */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-4 h-4 text-amber-400" />
                        <h2 className="font-semibold text-sm">Security & Access Control</h2>
                    </div>
                    <div className="space-y-4">
                        {/* API Key Required Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                            <div>
                                <p className="text-sm font-medium">Require API Key for Downloads</p>
                                <p className="text-xs text-[var(--text-muted)]">When enabled, all download requests need valid API key</p>
                            </div>
                            <button
                                onClick={() => {
                                    const newValue = !apiKeyRequired;
                                    setApiKeyRequired(newValue);
                                    saveSecuritySettings({ apiKeyRequired: newValue });
                                }}
                                disabled={securitySaving}
                                className={`relative w-12 h-6 rounded-full transition-colors ${apiKeyRequired ? 'bg-amber-500' : 'bg-gray-600'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${apiKeyRequired ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                        
                        {/* Maintenance Mode Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                            <div>
                                <p className="text-sm font-medium">Maintenance Mode</p>
                                <p className="text-xs text-[var(--text-muted)]">Temporarily disable all services</p>
                            </div>
                            <button
                                onClick={() => {
                                    const newValue = !maintenanceMode;
                                    setMaintenanceMode(newValue);
                                    saveSecuritySettings({ maintenanceMode: newValue });
                                }}
                                disabled={securitySaving}
                                className={`relative w-12 h-6 rounded-full transition-colors ${maintenanceMode ? 'bg-red-500' : 'bg-gray-600'}`}
                            >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${maintenanceMode ? 'left-7' : 'left-1'}`} />
                            </button>
                        </div>
                        
                        {/* Maintenance Message */}
                        {maintenanceMode && (
                            <div>
                                <label className="block text-xs text-[var(--text-muted)] mb-1">Maintenance Message</label>
                                <input
                                    type="text"
                                    value={maintenanceMessage}
                                    onChange={e => setMaintenanceMessage(e.target.value)}
                                    onBlur={() => saveSecuritySettings({ maintenanceMessage })}
                                    placeholder="We're updating things..."
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-sm"
                                />
                            </div>
                        )}
                        
                        <p className="text-[10px] text-[var(--text-muted)] p-2 rounded bg-blue-500/10 border border-blue-500/20">
                            API Key Required adds extra security layer. Public endpoints (/api, /api/playground) will require valid API key when enabled.
                        </p>
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
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
