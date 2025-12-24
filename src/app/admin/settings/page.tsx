'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Settings, Shield, Database, Globe, Save, RefreshCw, Webhook, 
    ExternalLink, Bell, Lock, AlertTriangle, ChevronDown, Trash2
} from 'lucide-react';
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

// Reusable Card Component
function SettingsCard({ 
    icon: Icon, 
    title, 
    color, 
    children,
    collapsible = false,
    defaultOpen = true
}: { 
    icon: React.ElementType;
    title: string;
    color: string;
    children: React.ReactNode;
    collapsible?: boolean;
    defaultOpen?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="glass-card overflow-hidden"
        >
            <div 
                className={`flex items-center justify-between p-4 border-b border-[var(--border-color)] ${collapsible ? 'cursor-pointer hover:bg-[var(--bg-secondary)]/50' : ''}`}
                onClick={() => collapsible && setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <h2 className="font-semibold text-sm">{title}</h2>
                </div>
                {collapsible && (
                    <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </div>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 space-y-3">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// Toggle Switch Component
function Toggle({ checked, onChange, label, description }: {
    checked: boolean;
    onChange: (val: boolean) => void;
    label: string;
    description?: string;
}) {
    return (
        <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
            <div>
                <p className="text-sm font-medium">{label}</p>
                {description && <p className="text-xs text-[var(--text-muted)]">{description}</p>}
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-[var(--accent-primary)]' : 'bg-gray-600'}`}
            >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'left-6' : 'left-1'}`} />
            </button>
        </div>
    );
}

function SettingsContent() {
    const [localSettings, setLocalSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    
    const { settings: dbSettings, loading, updateSettings: saveToDb } = useSettings();
    
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

    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

    const getAuthHeaders = (): Record<string, string> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const supabaseKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (supabaseKey) {
            try {
                const session = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
                const token = session?.access_token;
                if (token) headers['Authorization'] = `Bearer ${token}`;
            } catch { /* ignore */ }
        }
        return headers;
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
            const res = await fetch(`${API_URL}/api/admin/cache`, { method: 'DELETE', headers: getAuthHeaders() });
            const data = await res.json();
            
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: data.success ? 'success' : 'error',
                title: data.success ? `Cache cleared (${data.cleared?.total || 0} entries)` : 'Failed to clear cache',
                showConfirmButton: false,
                timer: 2000,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
        } catch {
            Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Failed to clear cache', showConfirmButton: false, timer: 2000 });
        }
    };

    const migrateCookies = async () => {
        const result = await Swal.fire({
            title: 'Encrypt Cookies?',
            text: 'This will encrypt all unencrypted cookies in the pool.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#8b5cf6',
            confirmButtonText: 'Encrypt',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!result.isConfirmed) return;
        
        try {
            const res = await fetch(`${API_URL}/api/admin/cookies/migrate`, { method: 'POST', headers: getAuthHeaders() });
            const data = await res.json();
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: data.success ? 'success' : 'error',
                title: data.success ? data.message : (data.error || 'Migration failed'),
                showConfirmButton: false,
                timer: 3000,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
        } catch {
            Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Migration failed', showConfirmButton: false, timer: 2000 });
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
            <div className="max-w-5xl mx-auto space-y-5">
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

                {/* Grid Layout */}
                <div className="grid md:grid-cols-2 gap-4">
                    {/* Site Information */}
                    <SettingsCard icon={Globe} title="Site Information" color="text-blue-400">
                        <p className="text-xs text-[var(--text-muted)] -mt-1 mb-1">Basic site identity shown in browser and SEO</p>
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
                    </SettingsCard>

                    {/* Social Links */}
                    <SettingsCard icon={ExternalLink} title="Social Links" color="text-purple-400">
                        <p className="text-xs text-[var(--text-muted)] -mt-1 mb-1">Links shown in footer and about page</p>
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
                    </SettingsCard>

                    {/* Discord Webhook */}
                    <SettingsCard icon={Webhook} title="Discord Webhook" color="text-[#5865F2]">
                        <p className="text-xs text-[var(--text-muted)] -mt-1 mb-1">Get notified when users download content</p>
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Webhook URL</label>
                            <input
                                type="url"
                                value={localSettings.discord_webhook_url}
                                onChange={e => updateSetting('discord_webhook_url', e.target.value)}
                                placeholder="https://discord.com/api/webhooks/..."
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono text-xs"
                            />
                        </div>
                        <Toggle
                            checked={localSettings.discord_notify_enabled === 'true'}
                            onChange={val => updateSetting('discord_notify_enabled', val ? 'true' : 'false')}
                            label="Download Notifications"
                            description="Send notification on each download"
                        />
                    </SettingsCard>

                    {/* Admin Alerts */}
                    <AdminAlertsCard />

                    {/* PWA Update Prompt */}
                    <SettingsCard icon={Bell} title="PWA Update Prompt" color="text-cyan-400">
                        <p className="text-xs text-[var(--text-muted)] -mt-1 mb-1">Control &quot;New version available&quot; notification</p>
                        <Toggle
                            checked={localSettings.update_prompt_enabled === 'true'}
                            onChange={val => updateSetting('update_prompt_enabled', val ? 'true' : 'false')}
                            label="Show Update Prompt"
                            description="Display notification when new version available"
                        />
                        
                        {localSettings.update_prompt_enabled === 'true' && (
                            <>
                                <div>
                                    <label className="block text-xs text-[var(--text-muted)] mb-1">Display Mode</label>
                                    <select
                                        value={localSettings.update_prompt_mode}
                                        onChange={e => updateSetting('update_prompt_mode', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                    >
                                        <option value="always">Always show</option>
                                        <option value="once">Once only</option>
                                        <option value="session">Per session</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-[var(--text-muted)] mb-1">Delay (sec)</label>
                                        <input
                                            type="number"
                                            value={localSettings.update_prompt_delay_seconds}
                                            onChange={e => updateSetting('update_prompt_delay_seconds', e.target.value)}
                                            min={0}
                                            max={60}
                                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <label className="flex items-center gap-2 text-sm p-2">
                                            <input
                                                type="checkbox"
                                                checked={localSettings.update_prompt_dismissable === 'true'}
                                                onChange={e => updateSetting('update_prompt_dismissable', e.target.checked ? 'true' : 'false')}
                                                className="rounded"
                                            />
                                            Dismissable
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-[var(--text-muted)] mb-1">Custom Message</label>
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
                    </SettingsCard>

                    {/* System */}
                    <SettingsCard icon={Database} title="System" color="text-green-400">
                        <p className="text-xs text-[var(--text-muted)] -mt-1 mb-1">Cache and logging configuration</p>
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
                        <Toggle
                            checked={localSettings.logging_enabled === 'true'}
                            onChange={val => updateSetting('logging_enabled', val ? 'true' : 'false')}
                            label="Request Logging"
                            description="Log all API requests to database"
                        />
                    </SettingsCard>
                </div>

                {/* Danger Zone - Full Width, Collapsible */}
                <SettingsCard icon={Shield} title="Danger Zone" color="text-red-400" collapsible defaultOpen={false}>
                    <p className="text-xs text-[var(--text-muted)]">
                        These actions are irreversible. Proceed with caution.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={clearCache}
                            className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm flex items-center gap-2 hover:border-red-500/50 hover:text-red-400 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear Cache
                        </button>
                        <button
                            onClick={migrateCookies}
                            className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm flex items-center gap-2 hover:border-purple-500/50 hover:text-purple-400 transition-colors"
                        >
                            <Lock className="w-4 h-4" />
                            Encrypt Cookies
                        </button>
                    </div>
                </SettingsCard>
            </div>
        </div>
    );
}


// Admin Alerts Card Component
function AdminAlertsCard() {
    const { config, loading, testing, updateConfig, testWebhook } = useAlerts();
    const [localWebhook, setLocalWebhook] = useState('');
    const [showThresholds, setShowThresholds] = useState(false);

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

    if (loading) {
        return (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
                <div className="flex items-center gap-2 p-4 border-b border-[var(--border-color)]">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    <h2 className="font-semibold text-sm">Admin Alerts</h2>
                </div>
                <div className="p-4 h-32 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 animate-spin text-[var(--accent-primary)]" />
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-400" />
                    <h2 className="font-semibold text-sm">Admin Alerts</h2>
                </div>
                <button
                    onClick={() => updateConfig({ enabled: !config?.enabled })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${config?.enabled ? 'bg-[var(--accent-primary)]' : 'bg-gray-600'}`}
                >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${config?.enabled ? 'left-6' : 'left-1'}`} />
                </button>
            </div>
            <div className="p-4 space-y-3">
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
                            className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-mono"
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

                {/* Alert Types - Compact */}
                <div className="flex flex-wrap gap-2">
                    <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-xs cursor-pointer hover:bg-[var(--bg-secondary)]/80">
                        <input
                            type="checkbox"
                            checked={config?.alertErrorSpike ?? true}
                            onChange={e => updateConfig({ alertErrorSpike: e.target.checked })}
                            className="rounded w-3.5 h-3.5"
                        />
                        Error Spike
                    </label>
                    <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-xs cursor-pointer hover:bg-[var(--bg-secondary)]/80">
                        <input
                            type="checkbox"
                            checked={config?.alertCookieLow ?? true}
                            onChange={e => updateConfig({ alertCookieLow: e.target.checked })}
                            className="rounded w-3.5 h-3.5"
                        />
                        Cookie Low
                    </label>
                    <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-xs cursor-pointer hover:bg-[var(--bg-secondary)]/80">
                        <input
                            type="checkbox"
                            checked={config?.alertPlatformDown ?? true}
                            onChange={e => updateConfig({ alertPlatformDown: e.target.checked })}
                            className="rounded w-3.5 h-3.5"
                        />
                        Platform Down
                    </label>
                </div>

                {/* Thresholds - Collapsible */}
                <button
                    onClick={() => setShowThresholds(!showThresholds)}
                    className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                    <ChevronDown className={`w-3 h-3 transition-transform ${showThresholds ? 'rotate-180' : ''}`} />
                    Advanced Thresholds
                </button>
                
                <AnimatePresence>
                    {showThresholds && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="grid grid-cols-2 gap-2 pt-2">
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
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
