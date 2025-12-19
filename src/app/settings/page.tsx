'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Sun, Moon, Sparkles, Database, Cookie, HardDrive, Trash2, Loader2, AlertCircle, Shield, HelpCircle, X, Download, Upload, Bell, BellOff, RefreshCw, Package, Settings2, Zap } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import { Button } from '@/components/ui/Button';
import { ThemeType, getTheme, saveTheme, savePlatformCookie, clearPlatformCookie, getAllCookieStatus, getSkipCache, setSkipCache, clearHistory, clearAllCache } from '@/lib/storage';
import { isPushSupported, getPermissionStatus, subscribeToPush, unsubscribeFromPush, isSubscribed } from '@/lib/utils/push-notifications';
import { FacebookIcon, WeiboIcon, InstagramIcon, XTwitterIcon } from '@/components/ui/Icons';
import Swal from 'sweetalert2';
import Announcements from '@/components/Announcements';
import { DiscordWebhookSettings } from '@/components/DiscordWebhookSettings';

// ═══════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════

type TabId = 'basic' | 'cookies' | 'storage' | 'integrations';
type CookiePlatform = 'facebook' | 'instagram' | 'twitter' | 'weibo';

const TABS: { id: TabId; label: string; icon: typeof Palette }[] = [
    { id: 'basic', label: 'Basic', icon: Settings2 },
    { id: 'cookies', label: 'Cookies', icon: Cookie },
    { id: 'storage', label: 'Storage', icon: Database },
    { id: 'integrations', label: 'Integrations', icon: Zap },
];

const THEMES: { id: ThemeType; label: string; icon: typeof Sun; desc: string }[] = [
    { id: 'dark', label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
    { id: 'light', label: 'Light', icon: Sun, desc: 'Classic bright' },
    { id: 'solarized', label: 'Solarized', icon: Sparkles, desc: 'Warm tones' },
];

const PLATFORMS = [
    { id: 'facebook' as const, icon: FacebookIcon, name: 'Facebook', desc: 'Stories & groups', color: 'text-blue-500' },
    { id: 'instagram' as const, icon: InstagramIcon, name: 'Instagram', desc: 'Private posts', color: 'text-pink-500' },
    { id: 'twitter' as const, icon: XTwitterIcon, name: 'Twitter/X', desc: 'Age-restricted', color: 'text-sky-400' },
    { id: 'weibo' as const, icon: WeiboIcon, name: 'Weibo', desc: 'Required', color: 'text-red-500' },
];

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<TabId>('basic');
    const [currentTheme, setCurrentTheme] = useState<ThemeType>('dark');
    const [isClearing, setIsClearing] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Cookie states
    const [userCookies, setUserCookies] = useState<Record<CookiePlatform, boolean>>({ facebook: false, instagram: false, weibo: false, twitter: false });
    const [adminCookies, setAdminCookies] = useState<Record<string, boolean>>({});
    const [editPlatform, setEditPlatform] = useState<CookiePlatform | null>(null);
    const [editValue, setEditValue] = useState('');
    const [skipCache, setSkipCacheState] = useState(false);

    // Push notification states
    const [pushSupported, setPushSupported] = useState(false);
    const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default');
    const [pushSubscribed, setPushSubscribed] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);

    useEffect(() => {
        setCurrentTheme(getTheme());
        setUserCookies(getAllCookieStatus());
        setSkipCacheState(getSkipCache());
        fetch('/api/status/cookies').then(r => r.json()).then(d => {
            if (d.success && d.data) {
                const status: Record<string, boolean> = {};
                Object.entries(d.data).forEach(([platform, info]) => {
                    status[platform] = (info as { available: boolean }).available;
                });
                setAdminCookies(status);
            }
        }).catch(() => { });

        const supported = isPushSupported();
        setPushSupported(supported);
        if (supported) {
            setPushPermission(getPermissionStatus());
            isSubscribed().then(setPushSubscribed).catch(() => { });
        }
    }, []);

    const handleThemeChange = (theme: ThemeType) => {
        saveTheme(theme);
        setCurrentTheme(theme);
    };

    const handleSaveCookie = (platform: CookiePlatform) => {
        if (!editValue.trim()) return;
        const trimmed = editValue.trim();
        let isValid = false;
        if (trimmed.startsWith('[')) {
            try { const arr = JSON.parse(trimmed); isValid = Array.isArray(arr) && arr.some((c: { name?: string; value?: string }) => c.name && c.value); } catch { }
        } else if (trimmed.includes('=')) { isValid = true; }
        if (!isValid) { Swal.fire({ icon: 'error', title: 'Invalid format', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' }); return; }
        savePlatformCookie(platform, trimmed);
        setUserCookies(prev => ({ ...prev, [platform]: true }));
        setEditPlatform(null);
        setEditValue('');
        Swal.fire({ icon: 'success', title: 'Saved!', timer: 1000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
    };

    const handleClearCookie = (platform: CookiePlatform) => {
        clearPlatformCookie(platform);
        setUserCookies(getAllCookieStatus());
    };

    const handlePushToggle = async () => {
        if (!pushSupported) return;
        setPushLoading(true);
        try {
            if (pushSubscribed) {
                await unsubscribeFromPush();
                setPushSubscribed(false);
                Swal.fire({ icon: 'success', title: 'Unsubscribed', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            } else {
                await subscribeToPush();
                setPushSubscribed(true);
                setPushPermission('granted');
                Swal.fire({ icon: 'success', title: 'Subscribed!', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed';
            if (msg.includes('denied')) setPushPermission('denied');
            Swal.fire({ icon: 'error', title: 'Error', text: msg, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        } finally {
            setPushLoading(false);
        }
    };

    const clearAllCookies = async () => {
        const result = await Swal.fire({
            icon: 'warning', title: 'Clear all cookies?', text: 'This will remove all saved platform cookies.',
            showCancelButton: true, confirmButtonText: 'Clear', confirmButtonColor: '#ef4444', background: 'var(--bg-card)', color: 'var(--text-primary)'
        });
        if (result.isConfirmed) {
            setIsClearing('cookies');
            try {
                const cookieKeys = ['xtfetch_fb_cookie', 'xtfetch_ig_cookie', 'xtfetch_weibo_cookie', 'xtfetch_cookies'];
                cookieKeys.forEach(key => localStorage.removeItem(key));
                setUserCookies({ facebook: false, instagram: false, weibo: false, twitter: false });
                await Swal.fire({ icon: 'success', title: 'Cookies Cleared', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            } finally {
                setIsClearing(null);
            }
        }
    };

    const clearLocalStorage = async () => {
        const result = await Swal.fire({
            icon: 'warning', title: 'Clear LocalStorage?', text: 'This will remove themes and settings.',
            showCancelButton: true, confirmButtonText: 'Clear', confirmButtonColor: '#ef4444', background: 'var(--bg-card)', color: 'var(--text-primary)'
        });
        if (result.isConfirmed) {
            setIsClearing('localstorage');
            localStorage.clear();
            await Swal.fire({ icon: 'success', title: 'Cleared', timer: 1000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            window.location.reload();
        }
    };

    const clearCacheAndHistory = async () => {
        const result = await Swal.fire({
            icon: 'warning', title: 'Clear History & Cache?', text: 'This will remove all download history and cached results.',
            showCancelButton: true, confirmButtonText: 'Clear', confirmButtonColor: '#ef4444', background: 'var(--bg-card)', color: 'var(--text-primary)'
        });
        if (result.isConfirmed) {
            setIsClearing('history_cache');
            try {
                await clearHistory();
                await clearAllCache();
                await Swal.fire({ icon: 'success', title: 'Cleared', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            } finally {
                setIsClearing(null);
            }
        }
    };

    const clearAllData = async () => {
        const result = await Swal.fire({
            icon: 'warning', title: 'Reset Everything?', html: 'All cookies, settings, and cache will be deleted.',
            showCancelButton: true, confirmButtonText: 'Reset All', confirmButtonColor: '#ef4444', background: 'var(--bg-card)', color: 'var(--text-primary)'
        });
        if (result.isConfirmed) {
            setIsClearing('all');
            localStorage.clear();
            sessionStorage.clear();
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }
            await Swal.fire({ icon: 'success', title: 'All Data Cleared', timer: 1000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            window.location.reload();
        }
    };

    const exportData = () => {
        try {
            const data: Record<string, string> = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) data[key] = localStorage.getItem(key) || '';
            }
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `xtfetch-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            Swal.fire({ icon: 'success', title: 'Exported!', timer: 1000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        } catch {
            Swal.fire({ icon: 'error', title: 'Export failed', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        }
    };

    const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const data = JSON.parse(ev.target?.result as string);
                if (typeof data !== 'object' || data === null) throw new Error('Invalid format');
                const result = await Swal.fire({
                    icon: 'question', title: 'Import Data?', text: `Found ${Object.keys(data).length} items.`,
                    showCancelButton: true, confirmButtonText: 'Import', background: 'var(--bg-card)', color: 'var(--text-primary)'
                });
                if (result.isConfirmed) {
                    Object.entries(data).forEach(([key, value]) => {
                        if (typeof value === 'string') localStorage.setItem(key, value);
                    });
                    await Swal.fire({ icon: 'success', title: 'Imported!', timer: 1000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
                    window.location.reload();
                }
            } catch {
                Swal.fire({ icon: 'error', title: 'Invalid file', background: 'var(--bg-card)', color: 'var(--text-primary)' });
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <SidebarLayout>
            <Announcements page="settings" />
            <div className="py-6 px-4 lg:px-8">
                <div className="max-w-3xl mx-auto">
                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
                        <h1 className="text-2xl font-bold gradient-text mb-1">Settings</h1>
                        <p className="text-sm text-[var(--text-muted)]">Customize your experience</p>
                    </motion.div>

                    {/* Tab Navigation */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6">
                        <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                        ? 'bg-[var(--accent-primary)] text-white shadow-lg'
                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                                        }`}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Tab Content */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="glass-card p-6"
                        >
                            {/* BASIC TAB */}
                            {activeTab === 'basic' && (
                                <div className="space-y-6">
                                    {/* Theme Section */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <Palette className="w-5 h-5 text-purple-400" />
                                            <h2 className="font-semibold">Theme</h2>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            {THEMES.map((theme) => (
                                                <button
                                                    key={theme.id}
                                                    onClick={() => handleThemeChange(theme.id)}
                                                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${currentTheme === theme.id
                                                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                                        : 'border-[var(--border-color)] hover:border-[var(--text-muted)]'
                                                        }`}
                                                >
                                                    <theme.icon className={`w-8 h-8 ${currentTheme === theme.id ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`} />
                                                    <span className={`text-sm font-medium ${currentTheme === theme.id ? 'text-[var(--accent-primary)]' : ''}`}>{theme.label}</span>
                                                    <span className="text-[10px] text-[var(--text-muted)]">{theme.desc}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Push Notifications */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Bell className="w-5 h-5 text-amber-400" />
                                            <h2 className="font-semibold">Notifications</h2>
                                        </div>
                                        <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {pushSubscribed ? <Bell className="w-5 h-5 text-green-400" /> : <BellOff className="w-5 h-5 text-[var(--text-muted)]" />}
                                                    <div>
                                                        <p className="text-sm font-medium">Push Notifications</p>
                                                        <p className="text-xs text-[var(--text-muted)]">
                                                            {!pushSupported ? 'Not supported' : pushPermission === 'denied' ? 'Blocked by browser' : pushSubscribed ? 'Receiving updates' : 'Get notified'}
                                                        </p>
                                                    </div>
                                                </div>
                                                {pushSupported && pushPermission !== 'denied' && (
                                                    <Button
                                                        variant={pushSubscribed ? 'secondary' : 'primary'}
                                                        size="sm"
                                                        onClick={handlePushToggle}
                                                        disabled={pushLoading}
                                                        leftIcon={pushLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (pushSubscribed ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />)}
                                                    >
                                                        {pushSubscribed ? 'Disable' : 'Enable'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Discord Webhook - Link to Integrations */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <svg className="w-5 h-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                                            </svg>
                                            <h2 className="font-semibold">Discord Webhook</h2>
                                        </div>
                                        <div className="p-4 rounded-lg bg-[var(--bg-secondary)]">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1">
                                                    <p className="text-sm">Get download notifications in your Discord server</p>
                                                </div>
                                                <button onClick={() => setActiveTab('integrations')} className="text-sm text-[#5865F2] hover:underline font-medium">
                                                    Configure →
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* COOKIES TAB */}
                            {activeTab === 'cookies' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Cookie className="w-5 h-5 text-amber-400" />
                                            <h2 className="font-semibold">Platform Cookies</h2>
                                        </div>
                                        <Button variant="secondary" size="sm" onClick={clearAllCookies} disabled={isClearing !== null}
                                            leftIcon={isClearing === 'cookies' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}>
                                            Clear All
                                        </Button>
                                    </div>

                                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
                                        <div className="flex items-center gap-2 text-blue-400 font-medium mb-1">
                                            <Shield className="w-3.5 h-3.5" />
                                            Priority: Your cookie → Admin cookie → Guest mode
                                        </div>
                                        <p className="text-[var(--text-secondary)]">Admin cookies are pre-configured for most platforms.</p>
                                    </div>

                                    <div className="space-y-2">
                                        {PLATFORMS.map((p) => {
                                            const hasUser = userCookies[p.id];
                                            const hasAdmin = adminCookies[p.id];
                                            const isEditing = editPlatform === p.id;

                                            return (
                                                <div key={p.id} className="p-3 rounded-lg bg-[var(--bg-secondary)]">
                                                    <div className="flex items-center gap-3">
                                                        <p.icon className={`w-5 h-5 ${p.color}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-medium text-sm">{p.name}</span>
                                                                {hasUser && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">Yours</span>}
                                                                {!hasUser && hasAdmin && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">Admin</span>}
                                                                {!hasUser && !hasAdmin && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Guest</span>}
                                                            </div>
                                                            <p className="text-xs text-[var(--text-muted)]">{p.desc}</p>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {hasUser && (
                                                                <button onClick={() => handleClearCookie(p.id)} className="p-1.5 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => { setEditPlatform(isEditing ? null : p.id); setEditValue(''); }}
                                                                className={`px-2 py-1 rounded text-xs ${isEditing ? 'bg-red-500/20 text-red-400' : 'hover:bg-[var(--bg-card)] text-[var(--text-muted)]'}`}
                                                            >
                                                                {isEditing ? <X className="w-3.5 h-3.5" /> : (hasUser ? 'Edit' : 'Add')}
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {isEditing && (
                                                        <div className="mt-2 flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                placeholder="Paste cookie (JSON or string)..."
                                                                className="flex-1 px-3 py-2 text-sm bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg font-mono"
                                                                onKeyDown={(e) => e.key === 'Enter' && handleSaveCookie(p.id)}
                                                            />
                                                            <Button size="sm" onClick={() => handleSaveCookie(p.id)} disabled={!editValue.trim()}>Save</Button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* How to get cookies */}
                                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                        <p className="text-xs text-emerald-400 font-medium flex items-center gap-1 mb-1">
                                            <HelpCircle className="w-3 h-3" /> How to get cookies
                                        </p>
                                        <p className="text-xs text-[var(--text-secondary)]">
                                            Install <span className="font-medium">Cookie Editor</span> extension → Go to platform → Click extension → <span className="font-medium">Export as Header String</span>
                                        </p>
                                    </div>

                                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                        <p className="text-xs text-red-400 font-medium flex items-center gap-1 mb-1">
                                            <AlertCircle className="w-3 h-3" /> Warning
                                        </p>
                                        <p className="text-xs text-[var(--text-secondary)]">
                                            Using cookies may violate platform ToS. Risk includes <span className="text-red-400">shadow ban</span> to <span className="text-red-400">permanent ban</span>.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* STORAGE TAB */}
                            {activeTab === 'storage' && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Database className="w-5 h-5 text-blue-400" />
                                        <h2 className="font-semibold">Data & Storage</h2>
                                    </div>

                                    {/* Skip Cache Toggle */}
                                    <div className="flex items-center justify-between p-4 rounded-lg bg-[var(--bg-secondary)]">
                                        <div className="flex items-center gap-3">
                                            <Zap className={`w-5 h-5 ${skipCache ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`} />
                                            <div>
                                                <p className="text-sm font-medium">Skip Cache</p>
                                                <p className="text-xs text-[var(--text-muted)]">Bypass Redis cache for fresh results</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { const v = !skipCache; setSkipCache(v); setSkipCacheState(v); }}
                                            className={`relative w-11 h-6 rounded-full transition-colors ${skipCache ? 'bg-emerald-500' : 'bg-[var(--bg-card)]'}`}
                                        >
                                            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${skipCache ? 'translate-x-5' : ''}`} />
                                        </button>
                                    </div>

                                    {/* Import/Export */}
                                    <div className="flex gap-2">
                                        <input type="file" ref={fileInputRef} accept=".json" onChange={importData} className="hidden" />
                                        <Button variant="secondary" size="sm" onClick={exportData} leftIcon={<Download className="w-4 h-4" />} className="flex-1">Export</Button>
                                        <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} leftIcon={<Upload className="w-4 h-4" />} className="flex-1">Import</Button>
                                    </div>

                                    {/* Storage Items */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] border border-transparent hover:border-[var(--border-color)] transition-all">
                                            <Cookie className="w-4 h-4 text-amber-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium">Cookies</p>
                                                <p className="text-[10px] text-[var(--text-muted)]">Platform auth</p>
                                            </div>
                                            <button onClick={clearAllCookies} disabled={isClearing !== null} className="p-1.5 rounded-md hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors" title="Clear cookies">
                                                {isClearing === 'cookies' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] border border-transparent hover:border-[var(--border-color)] transition-all">
                                            <HardDrive className="w-4 h-4 text-purple-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium">LocalStorage</p>
                                                <p className="text-[10px] text-[var(--text-muted)]">Themes & settings</p>
                                            </div>
                                            <button onClick={clearLocalStorage} disabled={isClearing !== null} className="p-1.5 rounded-md hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors" title="Clear local storage">
                                                {isClearing === 'localstorage' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] border border-transparent hover:border-[var(--border-color)] transition-all">
                                            <Package className="w-4 h-4 text-blue-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium">History & Cache</p>
                                                <p className="text-[10px] text-[var(--text-muted)]">Cached data</p>
                                            </div>
                                            <button onClick={clearCacheAndHistory} disabled={isClearing !== null} className="p-1.5 rounded-md hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors" title="Clear cache">
                                                {isClearing === 'history_cache' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10 hover:border-red-500/30 transition-all">
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-red-500">Reset All</p>
                                                <p className="text-[10px] text-[var(--text-muted)]">Factory reset</p>
                                            </div>
                                            <button onClick={clearAllData} disabled={isClearing !== null} className="p-1.5 rounded-md hover:bg-red-500/20 text-red-500 transition-colors" title="Reset everything">
                                                {isClearing === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    <StorageInfo />
                                </div>
                            )}

                            {/* INTEGRATIONS TAB */}
                            {activeTab === 'integrations' && (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Zap className="w-5 h-5 text-yellow-400" />
                                        <h2 className="font-semibold">Integrations</h2>
                                    </div>

                                    {/* Discord Webhook Settings */}
                                    <DiscordWebhookSettings />

                                    {/* Future integrations placeholder */}
                                    <div className="p-4 rounded-lg border border-dashed border-[var(--border-color)] text-center">
                                        <p className="text-sm text-[var(--text-muted)]">More integrations coming soon...</p>
                                    </div>
                                </div>
                            )}

                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </SidebarLayout>
    );
}

// ═══════════════════════════════════════════════════════════════
// STORAGE INFO COMPONENT
// ═══════════════════════════════════════════════════════════════

function StorageInfo() {
    const [sizes, setSizes] = useState({ cookies: '...', history: '...', settings: '...', total: '...' });

    useEffect(() => {
        try {
            const formatSize = (bytes: number) => {
                const kb = bytes / 1024;
                return kb < 1 ? `${bytes} B` : kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`;
            };

            const getSize = (key: string) => {
                const val = localStorage.getItem(key);
                return val ? (key.length + val.length) * 2 : 0;
            };

            let cookieSize = 0, historySize = 0, settingsSize = 0;
            const cookieKeys = ['xtfetch_fb_cookie', 'xtfetch_ig_cookie', 'xtfetch_weibo_cookie', 'xtfetch_tw_cookie', 'xtfetch_cookies'];
            // Updated to track new v2 keys
            const historyKeys = ['xtfetch_history', 'xt_history_v2', 'xt_cache_v2'];

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;
                const size = getSize(key);
                if (cookieKeys.includes(key)) cookieSize += size;
                else if (historyKeys.includes(key)) historySize += size;
                else settingsSize += size;
            }

            setSizes({
                cookies: formatSize(cookieSize),
                history: formatSize(historySize),
                settings: formatSize(settingsSize),
                total: formatSize(cookieSize + historySize + settingsSize)
            });
        } catch { setSizes({ cookies: '-', history: '-', settings: '-', total: '-' }); }
    }, []);

    return (
        <div className="pt-3 border-t border-[var(--border-color)]">
            <div className="flex justify-between text-xs text-[var(--text-muted)]">
                <span>Cookies: {sizes.cookies}</span>
                <span>History: {sizes.history}</span>
                <span>Settings: {sizes.settings}</span>
                <span className="font-medium text-[var(--text-secondary)]">Total: {sizes.total}</span>
            </div>
        </div>
    );
}
