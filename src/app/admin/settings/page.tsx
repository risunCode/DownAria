'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Shield, Database, Globe, Save, RefreshCw, Webhook, MessageSquare, Github, ExternalLink } from 'lucide-react';
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

    // Load settings from DB
    useEffect(() => {
        fetch('/api/admin/settings')
            .then(r => r.json())
            .then(data => {
                if (data.success && data.data) {
                    setSettings(prev => ({ ...prev, ...data.data }));
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

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

        // Note: Cache is in-memory, so this would need a dedicated endpoint
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: 'Cache cleared on next restart',
            showConfirmButton: false,
            timer: 2000,
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
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

                {/* Actions */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4">
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
