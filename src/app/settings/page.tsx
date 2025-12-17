'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Palette, Sun, Moon, Sparkles, Database, Cookie, HardDrive, Trash2, Loader2, AlertCircle, Shield, HelpCircle, X, Download, Upload } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import { Button } from '@/components/ui/Button';
import { ThemeType, getTheme, saveTheme, savePlatformCookie, clearPlatformCookie, getAllCookieStatus } from '@/lib/utils/storage';
import { FacebookIcon, WeiboIcon, InstagramIcon, XTwitterIcon } from '@/components/ui/Icons';
import Swal from 'sweetalert2';
import Announcements from '@/components/Announcements';

const THEMES: { id: ThemeType; label: string; icon: typeof Sun; desc: string }[] = [
    { id: 'dark', label: 'Dark', icon: Moon, desc: 'Easy on the eyes' },
    { id: 'light', label: 'Light', icon: Sun, desc: 'Classic bright' },
    { id: 'solarized', label: 'Solarized', icon: Sparkles, desc: 'Warm tones' },
];

type CookiePlatform = 'facebook' | 'instagram' | 'weibo' | 'twitter';

export default function SettingsPage() {
    const [currentTheme, setCurrentTheme] = useState<ThemeType>('dark');
    const [isClearing, setIsClearing] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Cookie states
    const [userCookies, setUserCookies] = useState<Record<CookiePlatform, boolean>>({ facebook: false, instagram: false, weibo: false, twitter: false });
    const [adminCookies, setAdminCookies] = useState<Record<string, boolean>>({});
    const [editPlatform, setEditPlatform] = useState<CookiePlatform | null>(null);
    const [editValue, setEditValue] = useState('');

    useEffect(() => {
        setCurrentTheme(getTheme());
        setUserCookies(getAllCookieStatus());
        // Fetch admin cookie status
        fetch('/api/admin/cookies').then(r => r.json()).then(d => {
            if (d.success && d.data) {
                const status: Record<string, boolean> = {};
                d.data.forEach((c: { platform: string; enabled: boolean }) => { status[c.platform] = c.enabled; });
                setAdminCookies(status);
            }
        }).catch(() => {});
    }, []);

    const handleThemeChange = (theme: ThemeType) => {
        saveTheme(theme);
        setCurrentTheme(theme);
    };

    // Cookie handlers
    const handleSaveCookie = (platform: CookiePlatform) => {
        if (!editValue.trim()) return;
        const trimmed = editValue.trim();
        let isValid = false;
        if (trimmed.startsWith('[')) {
            try { const arr = JSON.parse(trimmed); isValid = Array.isArray(arr) && arr.some((c: { name?: string; value?: string }) => c.name && c.value); } catch {}
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

    const clearAllCookies = async () => {
        setIsClearing('cookies');
        try {
            const cookieKeys = ['xtfetch_fb_cookie', 'xtfetch_ig_cookie', 'xtfetch_weibo_cookie', 'xtfetch_cookies'];
            cookieKeys.forEach(key => localStorage.removeItem(key));
            setUserCookies({ facebook: false, instagram: false, weibo: false, twitter: false });
            await Swal.fire({ icon: 'success', title: 'Cookies Cleared', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        } finally {
            setIsClearing(null);
        }
    };

    const clearLocalStorage = async () => {
        const result = await Swal.fire({
            icon: 'warning', title: 'Clear LocalStorage?', text: 'This will remove download history, settings, and saved cookies.',
            showCancelButton: true, confirmButtonText: 'Clear', confirmButtonColor: '#ef4444', background: 'var(--bg-card)', color: 'var(--text-primary)'
        });
        if (result.isConfirmed) {
            setIsClearing('localstorage');
            localStorage.clear();
            await Swal.fire({ icon: 'success', title: 'Cleared', timer: 1000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            window.location.reload();
        }
    };

    const clearAllData = async () => {
        const result = await Swal.fire({
            icon: 'warning', title: 'Clear ALL Data?', html: 'This will remove:<br>• All cookies<br>• LocalStorage<br>• Cache',
            showCancelButton: true, confirmButtonText: 'Clear Everything', confirmButtonColor: '#ef4444', background: 'var(--bg-card)', color: 'var(--text-primary)'
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
                    icon: 'question', title: 'Import Data?', text: `Found ${Object.keys(data).length} items. This will overwrite existing data.`,
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
                Swal.fire({ icon: 'error', title: 'Invalid file', text: 'Please select a valid XTFetch backup file.', background: 'var(--bg-card)', color: 'var(--text-primary)' });
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const platforms = [
        { id: 'facebook' as const, icon: FacebookIcon, name: 'Facebook', desc: 'Stories & groups', color: 'text-blue-500' },
        { id: 'instagram' as const, icon: InstagramIcon, name: 'Instagram', desc: 'Private posts', color: 'text-pink-500' },
        { id: 'twitter' as const, icon: XTwitterIcon, name: 'Twitter/X', desc: 'Age-restricted', color: 'text-sky-400' },
        { id: 'weibo' as const, icon: WeiboIcon, name: 'Weibo', desc: 'Required', color: 'text-red-500' },
    ];

    return (
        <SidebarLayout>
            <Announcements page="settings" />
            <div className="py-6 px-4 lg:px-8">
                <div className="max-w-5xl mx-auto space-y-6">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                        <h1 className="text-2xl font-bold gradient-text mb-2">Settings</h1>
                        <p className="text-sm text-[var(--text-muted)]">Customize your experience</p>
                    </motion.div>

                    {/* Grid Layout - Left (Theme + Storage) & Right (Cookies) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column - Theme & Storage */}
                        <div className="space-y-6">
                            {/* Theme Section */}
                            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                                <div className="flex items-center gap-2 mb-4">
                                    <Palette className="w-5 h-5 text-purple-400" />
                                    <h2 className="font-semibold">Appearance</h2>
                                </div>
                                <div className="glass-card p-5">
                                    <div className="grid grid-cols-3 gap-3">
                                        {THEMES.map((theme) => (
                                            <button
                                                key={theme.id}
                                                onClick={() => handleThemeChange(theme.id)}
                                                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                                                    currentTheme === theme.id
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
                                    <p className="mt-3 text-xs text-[var(--text-muted)]">
                                        Current: <span className="text-[var(--text-secondary)] font-medium capitalize">{currentTheme}</span>
                                    </p>
                                </div>
                            </motion.section>

                            {/* Data & Storage Section */}
                            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                                <div className="flex items-center gap-2 mb-4">
                                    <Database className="w-5 h-5 text-blue-400" />
                                    <h2 className="font-semibold">Data & Storage</h2>
                                </div>
                                <div className="glass-card p-5 space-y-3">
                                    <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                        <p className="text-xs text-[var(--text-secondary)] flex items-center gap-2">
                                            <AlertCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                            All data stored locally in your browser
                                        </p>
                                    </div>

                                    {/* Import/Export */}
                                    <div className="flex gap-2">
                                        <input type="file" ref={fileInputRef} accept=".json" onChange={importData} className="hidden" />
                                        <Button variant="secondary" size="sm" onClick={exportData} leftIcon={<Download className="w-4 h-4" />} className="flex-1">
                                            Export
                                        </Button>
                                        <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} leftIcon={<Upload className="w-4 h-4" />} className="flex-1">
                                            Import
                                        </Button>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                                            <div className="flex items-center gap-3">
                                                <Cookie className="w-5 h-5 text-amber-400" />
                                                <div>
                                                    <p className="text-sm font-medium">Cookies</p>
                                                    <p className="text-xs text-[var(--text-muted)]">Platform auth</p>
                                                </div>
                                            </div>
                                            <Button variant="secondary" size="sm" onClick={clearAllCookies} disabled={isClearing !== null}
                                                leftIcon={isClearing === 'cookies' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}>
                                                Clear
                                            </Button>
                                        </div>

                                        <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                                            <div className="flex items-center gap-3">
                                                <HardDrive className="w-5 h-5 text-purple-400" />
                                                <div>
                                                    <p className="text-sm font-medium">Storage</p>
                                                    <p className="text-xs text-[var(--text-muted)]">History, settings</p>
                                                </div>
                                            </div>
                                            <Button variant="secondary" size="sm" onClick={clearLocalStorage} disabled={isClearing !== null}
                                                leftIcon={isClearing === 'localstorage' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}>
                                                Clear
                                            </Button>
                                        </div>

                                        <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                            <div className="flex items-center gap-3">
                                                <Trash2 className="w-5 h-5 text-red-400" />
                                                <div>
                                                    <p className="text-sm font-medium text-red-400">Reset All</p>
                                                    <p className="text-xs text-[var(--text-muted)]">Everything</p>
                                                </div>
                                            </div>
                                            <Button variant="secondary" size="sm" onClick={clearAllData} disabled={isClearing !== null}
                                                className="!border-red-500/50 !text-red-400 hover:!bg-red-500/20"
                                                leftIcon={isClearing === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}>
                                                Clear
                                            </Button>
                                        </div>
                                    </div>

                                    <StorageInfo />
                                </div>
                            </motion.section>
                        </div>

                        {/* Right Column - Cookies Section */}
                        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                            <div className="flex items-center gap-2 mb-4">
                                <Cookie className="w-5 h-5 text-amber-400" />
                                <h2 className="font-semibold">Platform Cookies</h2>
                            </div>
                            <div className="glass-card p-5 space-y-3">
                                {/* Info Banner */}
                                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                    <p className="text-xs text-[var(--text-secondary)] mb-2">
                                        <span className="text-blue-400 font-medium">Admin cookies are pre-configured</span> for most platforms. 
                                        You can still add your own cookie to override if needed.
                                    </p>
                                    <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                                        <Shield className="w-3 h-3 text-emerald-500" />
                                        <span>Priority: Your cookie → Admin cookie → Guest mode</span>
                                    </div>
                                </div>
                                
                                <div className="space-y-2">
                                    {platforms.map((p) => {
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
                                                            {hasUser && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">Using yours</span>}
                                                            {!hasUser && hasAdmin && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">Admin ready</span>}
                                                            {!hasUser && !hasAdmin && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Guest mode</span>}
                                                        </div>
                                                        <p className="text-xs text-[var(--text-muted)]">{p.desc}</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {hasUser && (
                                                            <button 
                                                                onClick={() => handleClearCookie(p.id)} 
                                                                className="flex items-center gap-1 px-2 py-1 rounded text-xs hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                                                                title="Remove your cookie"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                                <span>Remove</span>
                                                            </button>
                                                        )}
                                                        <button 
                                                            onClick={() => { setEditPlatform(isEditing ? null : p.id); setEditValue(''); }}
                                                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                                                                isEditing 
                                                                    ? 'bg-red-500/20 text-red-400' 
                                                                    : 'hover:bg-[var(--bg-card)] text-[var(--text-muted)]'
                                                            }`}
                                                        >
                                                            {isEditing ? (
                                                                <><X className="w-3 h-3" /><span>Cancel</span></>
                                                            ) : (
                                                                <><Cookie className="w-3 h-3" /><span>{hasUser ? 'Edit' : 'Add'}</span></>
                                                            )}
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
                                    <p className="text-xs text-emerald-400 font-medium mb-1 flex items-center gap-1">
                                        <HelpCircle className="w-3 h-3" />
                                        How to get cookies
                                    </p>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        Install <span className="font-medium">Cookie Editor</span> extension → Go to platform → Click extension → <span className="font-medium">Export as Header String</span>
                                    </p>
                                </div>

                                {/* Warning */}
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                    <p className="text-xs text-red-400 font-medium mb-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Warning
                                    </p>
                                    <p className="text-xs text-[var(--text-secondary)]">
                                        Using cookies for scraping may violate platform ToS. Risk includes <span className="text-red-400 font-medium">shadow ban</span> to <span className="text-red-400 font-medium">permanent ban</span>. Use at your own risk and responsibility.
                                    </p>
                                </div>
                            </div>
                        </motion.section>
                    </div>
                </div>
            </div>
        </SidebarLayout>
    );
}

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
            
            // Calculate by category
            let cookieSize = 0, historySize = 0, settingsSize = 0;
            const cookieKeys = ['xtfetch_fb_cookie', 'xtfetch_ig_cookie', 'xtfetch_weibo_cookie', 'xtfetch_tw_cookie', 'xtfetch_cookies'];
            const historyKeys = ['xtfetch_history'];
            
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
        <div className="pt-3 mt-3 border-t border-[var(--border-color)] space-y-2">
            <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center p-2 rounded bg-[var(--bg-primary)]">
                    <p className="text-amber-400 font-medium">{sizes.cookies}</p>
                    <p className="text-[var(--text-muted)]">Cookies</p>
                </div>
                <div className="text-center p-2 rounded bg-[var(--bg-primary)]">
                    <p className="text-purple-400 font-medium">{sizes.history}</p>
                    <p className="text-[var(--text-muted)]">History</p>
                </div>
                <div className="text-center p-2 rounded bg-[var(--bg-primary)]">
                    <p className="text-blue-400 font-medium">{sizes.settings}</p>
                    <p className="text-[var(--text-muted)]">Settings</p>
                </div>
            </div>
            <p className="text-center text-[10px] text-[var(--text-muted)]">
                Total: {sizes.total} • Browser limit: ~5 MB
            </p>
        </div>
    );
}
