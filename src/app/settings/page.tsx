'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Sun, Moon, Sparkles, Database, Cookie, HardDrive, Trash2, Loader2, AlertCircle, Shield, HelpCircle, X, Download, Upload, Bell, BellOff, RefreshCw, Package, Settings2, Zap, Globe as GlobeIcon, EyeOff, Smartphone, History, MessageSquare, Clock, Volume2, VolumeX, Image } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import { Button } from '@/components/ui/Button';
import { ThemeType, getTheme, saveTheme, getResolvedTheme, getTimeBasedTheme, savePlatformCookie, clearPlatformCookie, getAllCookieStatus, getSkipCache, setSkipCache, clearHistory, clearAllCache, getHistoryCount, downloadFullBackupAsZip, importFullBackupFromZip, getLanguagePreference, setLanguagePreference, getSettings, saveSettings, type LanguagePreference, resetSeasonalSettings, deleteBackgroundBlob, getSeasonalSettings, setBackgroundOpacity, setBackgroundBlur } from '@/lib/storage';
import { isPushSupported, getPermissionStatus, subscribeToPush, unsubscribeFromPush, isSubscribed } from '@/lib/utils/push-notifications';
import { FacebookIcon, WeiboIcon, InstagramIcon, XTwitterIcon } from '@/components/ui/Icons';
import Swal from 'sweetalert2';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import { DiscordWebhookSettings } from '@/components/DiscordWebhookSettings';
import { SeasonalSettings } from '@/components/SeasonalSettings';
import { setAdaptText as setAdaptTextSetting } from '@/components/AdaptText';
import { locales, localeNames, localeFlags } from '@/i18n/config';
import { useLocaleRefresh } from '@/components/IntlProvider';
import { useTranslations } from 'next-intl';
import { useCookieStatus } from '@/hooks';
import { getUserDiscordSettings } from '@/lib/utils/discord-webhook';

// ═══════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════════

type TabId = 'basic' | 'cookies' | 'storage' | 'integrations';
type CookiePlatform = 'facebook' | 'instagram' | 'twitter' | 'weibo';

// PWA install prompt event type
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const TABS: { id: TabId; label: string; icon: typeof Palette }[] = [
    { id: 'basic', label: 'Basic', icon: Settings2 },
    { id: 'cookies', label: 'Cookies', icon: Cookie },
    { id: 'storage', label: 'Storage', icon: Database },
    { id: 'integrations', label: 'Integrations', icon: Zap },
];

const THEMES: { id: ThemeType; label: string; icon: typeof Sun; desc: string }[] = [
    { id: 'auto', label: 'Auto', icon: Clock, desc: 'Based on time' },
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
    const [resolvedAutoTheme, setResolvedAutoTheme] = useState<string>('');
    const [isClearing, setIsClearing] = useState<string | null>(null);
    const t = useTranslations('settings');
    const tCommon = useTranslations('common');

    // Cookie states
    const [userCookies, setUserCookies] = useState<Record<CookiePlatform, boolean>>({ facebook: false, instagram: false, weibo: false, twitter: false });
    const [adminCookies, setAdminCookies] = useState<Record<string, boolean>>({});
    const [editPlatform, setEditPlatform] = useState<CookiePlatform | null>(null);
    const [editValue, setEditValue] = useState('');
    const [skipCache, setSkipCacheState] = useState(false);
    
    // History states
    const [historyCount, setHistoryCount] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const backupFileInputRef = useRef<HTMLInputElement>(null);

    // Push notification states
    const [pushSupported, setPushSupported] = useState(false);
    const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default');
    const [pushSubscribed, setPushSubscribed] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);
    
    // Language state
    const [currentLanguage, setCurrentLanguage] = useState<LanguagePreference>('auto');
    const refreshLocale = useLocaleRefresh();
    
    // PWA install state
    const [canInstall, setCanInstall] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstalled, setIsInstalled] = useState(false);
    
    // Discord webhook state
    const [discordConfigured, setDiscordConfigured] = useState(false);
    
    // Highlight level state
    const [adaptTextEnabled, setAdaptTextEnabled] = useState(false);
    
    // Use SWR for admin cookie status
    const { cookieStatus: adminCookieData } = useCookieStatus();

    useEffect(() => {
        setCurrentTheme(getTheme());
        setResolvedAutoTheme(getTimeBasedTheme());
        setUserCookies(getAllCookieStatus());
        setSkipCacheState(getSkipCache());

        const supported = isPushSupported();
        setPushSupported(supported);
        if (supported) {
            setPushPermission(getPermissionStatus());
            isSubscribed().then(setPushSubscribed).catch(() => { });
        }
        
        // Load history count
        getHistoryCount().then(setHistoryCount).catch(() => setHistoryCount(0));
        
        // Load language preference
        setCurrentLanguage(getLanguagePreference());
        
        // Check discord webhook configuration
        const discordSettings = getUserDiscordSettings();
        setDiscordConfigured(!!discordSettings?.webhookUrl);
        
        // Load adapt text setting
        import('@/components/AdaptText').then(({ getAdaptText }) => {
            setAdaptTextEnabled(getAdaptText());
        });
        
        // PWA install prompt listener
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setCanInstall(true);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstall);
        
        // Check if already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                            (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
        setIsInstalled(isStandalone);
        if (isStandalone) {
            setCanInstall(false);
        }
        
        // Listen for app installed event
        const handleAppInstalled = () => {
            setIsInstalled(true);
            setCanInstall(false);
            setDeferredPrompt(null);
        };
        window.addEventListener('appinstalled', handleAppInstalled);
        
        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);
    
    // Update admin cookies when SWR data changes
    useEffect(() => {
        if (adminCookieData && Object.keys(adminCookieData).length > 0) {
            const status: Record<string, boolean> = {};
            Object.entries(adminCookieData).forEach(([platform, info]) => {
                const cookieInfo = info as { available: boolean } | boolean;
                status[platform] = typeof cookieInfo === 'boolean' ? cookieInfo : cookieInfo.available;
            });
            setAdminCookies(status);
        }
    }, [adminCookieData]);

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
                const cookieKeys = ['downaria_fb_cookie', 'downaria_ig_cookie', 'downaria_weibo_cookie', 'downaria_cookies'];
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
                setHistoryCount(0);
                await Swal.fire({ icon: 'success', title: 'Cleared', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            } finally {
                setIsClearing(null);
            }
        }
    };

    const clearIndexedDB = async () => {
        const result = await Swal.fire({
            icon: 'warning', title: 'Clear IndexedDB?', 
            html: '<p>This will delete <strong>all</strong> IndexedDB data including history and cache.</p><p class="text-sm mt-2 text-red-400">This action cannot be undone!</p>',
            showCancelButton: true, confirmButtonText: 'Delete All', confirmButtonColor: '#ef4444', background: 'var(--bg-card)', color: 'var(--text-primary)'
        });
        if (result.isConfirmed) {
            setIsClearing('indexeddb');
            try {
                // Get all IndexedDB databases and delete them
                if ('indexedDB' in window) {
                    const databases = await window.indexedDB.databases();
                    await Promise.all(
                        databases.map(db => {
                            if (!db.name) return Promise.resolve();
                            return new Promise<void>((resolve) => {
                                const req = window.indexedDB.deleteDatabase(db.name!);
                                req.onsuccess = () => resolve();
                                req.onerror = () => resolve(); // Don't block on error
                                req.onblocked = () => resolve(); // Don't block if DB is in use
                                // Timeout fallback
                                setTimeout(resolve, 2000);
                            });
                        })
                    );
                }
                setHistoryCount(0);
                await Swal.fire({ icon: 'success', title: 'IndexedDB Cleared', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            } catch (err) {
                await Swal.fire({ icon: 'error', title: 'Failed', text: err instanceof Error ? err.message : 'Could not clear IndexedDB', background: 'var(--bg-card)', color: 'var(--text-primary)' });
            } finally {
                setIsClearing(null);
            }
        }
    };

    const clearSeasonalData = async () => {
        const result = await Swal.fire({
            icon: 'warning', title: 'Clear Seasonal Effects?', 
            text: 'This will remove custom background and reset seasonal settings.',
            showCancelButton: true, confirmButtonText: 'Clear', confirmButtonColor: '#ef4444', background: 'var(--bg-card)', color: 'var(--text-primary)'
        });
        if (result.isConfirmed) {
            setIsClearing('seasonal');
            try {
                // Clear IndexedDB background
                await deleteBackgroundBlob();
                // Reset localStorage settings
                resetSeasonalSettings();
                await Swal.fire({ icon: 'success', title: 'Seasonal Effects Cleared', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            } catch (err) {
                await Swal.fire({ icon: 'error', title: 'Failed', text: err instanceof Error ? err.message : 'Could not clear seasonal data', background: 'var(--bg-card)', color: 'var(--text-primary)' });
            } finally {
                setIsClearing(null);
            }
        }
    };

    const handleExportHistory = async () => {
        setIsExporting(true);
        try {
            await downloadFullBackupAsZip();
            Swal.fire({ icon: 'success', title: 'Backup Created!', text: 'History + Settings exported as ZIP.', timer: 2000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        } catch {
            Swal.fire({ icon: 'error', title: 'Export Failed', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportHistory = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        if (!file.name.endsWith('.zip')) {
            Swal.fire({ icon: 'error', title: 'Invalid File', text: 'Please select a .zip backup file.', background: 'var(--bg-card)', color: 'var(--text-primary)' });
            if (backupFileInputRef.current) backupFileInputRef.current.value = '';
            return;
        }
        
        const result = await Swal.fire({
            icon: 'question', title: 'Restore Backup?', 
            html: `<p>File: <strong>${file.name}</strong></p><p class="text-sm mt-2">This will restore history and settings. Duplicates will be skipped.</p>`,
            showCancelButton: true, confirmButtonText: 'Restore', background: 'var(--bg-card)', color: 'var(--text-primary)'
        });
        
        if (result.isConfirmed) {
            setIsImporting(true);
            try {
                const { historyImported, historySkipped, settingsImported, sensitiveImported } = await importFullBackupFromZip(file, { mergeHistory: true });
                const newCount = await getHistoryCount();
                setHistoryCount(newCount);
                
                // Build result message
                const parts = [
                    `<p><strong>${historyImported}</strong> history items</p>`,
                    `<p><strong>${settingsImported}</strong> settings</p>`,
                ];
                if (sensitiveImported > 0) {
                    parts.push(`<p><strong>${sensitiveImported}</strong> cookies restored</p>`);
                }
                if (historySkipped > 0) {
                    parts.push(`<p class="text-sm text-gray-400">${historySkipped} duplicates skipped</p>`);
                }
                
                Swal.fire({ 
                    icon: 'success', 
                    title: 'Restored!', 
                    html: parts.join(''),
                    timer: 3000, 
                    showConfirmButton: false, 
                    background: 'var(--bg-card)', 
                    color: 'var(--text-primary)' 
                });
                // Reload to apply settings
                setTimeout(() => window.location.reload(), 3000);
            } catch (err) {
                Swal.fire({ icon: 'error', title: 'Restore Failed', text: err instanceof Error ? err.message : 'Invalid backup file', background: 'var(--bg-card)', color: 'var(--text-primary)' });
            } finally {
                setIsImporting(false);
            }
        }
        
        if (backupFileInputRef.current) backupFileInputRef.current.value = '';
    };

    const clearAllData = async () => {
        const result = await Swal.fire({
            icon: 'warning', title: 'Reset Everything?', html: 'All cookies, settings, history, and cache will be deleted.',
            showCancelButton: true, confirmButtonText: 'Reset All', confirmButtonColor: '#ef4444', background: 'var(--bg-card)', color: 'var(--text-primary)'
        });
        if (result.isConfirmed) {
            setIsClearing('all');
            
            // Clear localStorage & sessionStorage
            localStorage.clear();
            sessionStorage.clear();
            
            // Clear Service Worker caches
            if ('caches' in window) {
                try {
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));
                } catch { /* ignore */ }
            }
            
            // Clear IndexedDB - with timeout to prevent hanging
            if ('indexedDB' in window) {
                try {
                    const databases = await window.indexedDB.databases();
                    await Promise.all(
                        databases.map(db => {
                            if (!db.name) return Promise.resolve();
                            return new Promise<void>((resolve) => {
                                const req = window.indexedDB.deleteDatabase(db.name!);
                                req.onsuccess = () => resolve();
                                req.onerror = () => resolve(); // Don't block on error
                                req.onblocked = () => resolve(); // Don't block if DB is in use
                                // Timeout fallback - resolve after 2s regardless
                                setTimeout(resolve, 2000);
                            });
                        })
                    );
                } catch { /* ignore */ }
            }
            
            await Swal.fire({ icon: 'success', title: 'All Data Cleared', timer: 1000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            window.location.reload();
        }
    };

    return (
        <SidebarLayout>
            <div className="py-6 px-4 lg:px-8">
                <div className="max-w-3xl mx-auto">
                    {/* Announcements */}
                    <AnnouncementBanner page="settings" />
                    
                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
                        <h1 className="text-2xl font-bold gradient-text mb-1">{t('title')}</h1>
                        <p className="text-sm text-[var(--text-muted)]">{t('subtitle')}</p>
                    </motion.div>
                    
                    {/* Settings Overview Card */}
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ delay: 0.02 }}
                        className="glass-card p-4 mb-6"
                    >
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {/* Theme */}
                            <div className="flex items-center gap-2">
                                <Palette className="w-4 h-4 text-purple-400 flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{t('theme.title')}</p>
                                    <p className="text-sm font-medium truncate">{t(`theme.${currentTheme}`)}</p>
                                </div>
                            </div>
                            
                            {/* Language */}
                            <div className="flex items-center gap-2">
                                <GlobeIcon className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{t('language.title')}</p>
                                    <p className="text-sm font-medium truncate">
                                        {currentLanguage === 'auto' ? 'Auto' : localeNames[currentLanguage as keyof typeof localeNames] || currentLanguage}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Push Notifications */}
                            <div className="flex items-center gap-2">
                                {pushSubscribed ? (
                                    <Bell className="w-4 h-4 text-green-400 flex-shrink-0" />
                                ) : (
                                    <BellOff className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0" />
                                )}
                                <div className="min-w-0">
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Push</p>
                                    <p className={`text-sm font-medium truncate ${pushSubscribed ? 'text-green-400' : 'text-[var(--text-muted)]'}`}>
                                        {pushSubscribed ? 'On' : 'Off'}
                                    </p>
                                </div>
                            </div>
                            
                            {/* PWA Status */}
                            <div className="flex items-center gap-2">
                                <Smartphone className={`w-4 h-4 flex-shrink-0 ${isInstalled ? 'text-green-400' : 'text-[var(--text-muted)]'}`} />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">PWA</p>
                                    <p className={`text-sm font-medium truncate ${isInstalled ? 'text-green-400' : 'text-[var(--text-muted)]'}`}>
                                        {isInstalled ? 'Installed' : 'Not installed'}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Cookies */}
                            <div className="flex items-center gap-2">
                                <Cookie className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">{t('tabs.cookies')}</p>
                                    <p className="text-sm font-medium truncate">
                                        {Object.values(userCookies).filter(Boolean).length}/4 configured
                                    </p>
                                </div>
                            </div>
                            
                            {/* History */}
                            <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">History</p>
                                    <p className="text-sm font-medium truncate">{historyCount} items</p>
                                </div>
                            </div>
                            
                            {/* Skip Cache */}
                            <div className="flex items-center gap-2">
                                <Zap className={`w-4 h-4 flex-shrink-0 ${skipCache ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`} />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Skip Cache</p>
                                    <p className={`text-sm font-medium truncate ${skipCache ? 'text-emerald-400' : 'text-[var(--text-muted)]'}`}>
                                        {skipCache ? 'On' : 'Off'}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Discord */}
                            <div className="flex items-center gap-2">
                                <MessageSquare className={`w-4 h-4 flex-shrink-0 ${discordConfigured ? 'text-[#5865F2]' : 'text-[var(--text-muted)]'}`} />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Discord</p>
                                    <p className={`text-sm font-medium truncate ${discordConfigured ? 'text-[#5865F2]' : 'text-[var(--text-muted)]'}`}>
                                        {discordConfigured ? 'Configured' : 'Not configured'}
                                    </p>
                                </div>
                            </div>
                        </div>
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
                                    <span className="hidden sm:inline">{t(`tabs.${tab.id}`)}</span>
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
                                            <h2 className="font-semibold">{t('theme.title')}</h2>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {THEMES.map((theme) => (
                                                <button
                                                    key={theme.id}
                                                    onClick={() => handleThemeChange(theme.id)}
                                                    className={`flex items-center gap-3 px-4 py-3 rounded-full border-2 transition-all ${currentTheme === theme.id
                                                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                                        : 'border-[var(--border-color)] hover:border-[var(--text-muted)] bg-[var(--bg-secondary)]'
                                                        }`}
                                                >
                                                    <theme.icon className={`w-5 h-5 flex-shrink-0 ${currentTheme === theme.id ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`} />
                                                    <div className="flex flex-col items-start min-w-0">
                                                        <span className={`text-sm font-medium ${currentTheme === theme.id ? 'text-[var(--accent-primary)]' : ''}`}>
                                                            {t(`theme.${theme.id}`)}
                                                            {theme.id === 'auto' && currentTheme === 'auto' && resolvedAutoTheme && (
                                                                <span className="text-[10px] ml-1 text-[var(--text-muted)]">→ {resolvedAutoTheme}</span>
                                                            )}
                                                        </span>
                                                        <span className="text-[10px] text-[var(--text-muted)]">{theme.desc}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Language Section */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <GlobeIcon className="w-5 h-5 text-blue-400" />
                                            <h2 className="font-semibold">{t('language.title')}</h2>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {/* Auto-detect option */}
                                            <button
                                                onClick={() => {
                                                    setLanguagePreference('auto');
                                                    setCurrentLanguage('auto');
                                                    refreshLocale();
                                                }}
                                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${currentLanguage === 'auto'
                                                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                                    : 'border-[var(--border-color)] hover:border-[var(--text-muted)]'
                                                    }`}
                                            >
                                                <span className="text-base">🌐</span>
                                                <span className={`text-sm font-medium ${currentLanguage === 'auto' ? 'text-[var(--accent-primary)]' : ''}`}>Auto</span>
                                            </button>
                                            {/* Language options */}
                                            {locales.map((locale) => (
                                                <button
                                                    key={locale}
                                                    onClick={() => {
                                                        setLanguagePreference(locale);
                                                        setCurrentLanguage(locale);
                                                        refreshLocale();
                                                    }}
                                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${currentLanguage === locale
                                                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                                        : 'border-[var(--border-color)] hover:border-[var(--text-muted)]'
                                                        }`}
                                                >
                                                    <span className="text-base">{localeFlags[locale]}</span>
                                                    <span className={`text-sm font-medium ${currentLanguage === locale ? 'text-[var(--accent-primary)]' : ''}`}>{localeNames[locale]}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* App & Features Section */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Settings2 className="w-5 h-5 text-cyan-400" />
                                            <h2 className="font-semibold">{t('features.title') || 'App & Features'}</h2>
                                        </div>
                                        <div className="space-y-2">
                                            {/* Install PWA */}
                                            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                                                <div className="flex items-center gap-3">
                                                    <img src="/icon.png" alt="DownAria" className="w-8 h-8 rounded-lg" />
                                                    <div>
                                                        <p className="text-sm font-medium">{t('pwa.title')}</p>
                                                        <p className="text-xs text-[var(--text-muted)]">
                                                            {isInstalled 
                                                                ? <span className="text-green-400">{t('pwa.installed')}</span>
                                                                : t('pwa.notInstalled')}
                                                        </p>
                                                    </div>
                                                </div>
                                                {canInstall && deferredPrompt ? (
                                                    <Button
                                                        variant="primary"
                                                        size="sm"
                                                        onClick={async () => {
                                                            if (deferredPrompt) {
                                                                await deferredPrompt.prompt();
                                                                const { outcome } = await deferredPrompt.userChoice;
                                                                if (outcome === 'accepted') {
                                                                    setCanInstall(false);
                                                                    setIsInstalled(true);
                                                                    Swal.fire({ icon: 'success', title: 'Installed!', text: 'App added to home screen', timer: 2000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
                                                                }
                                                                setDeferredPrompt(null);
                                                            }
                                                        }}
                                                        leftIcon={<Download className="w-4 h-4" />}
                                                    >
                                                        Install
                                                    </Button>
                                                ) : isInstalled ? (
                                                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">✓</span>
                                                ) : null}
                                            </div>
                                            
                                            {/* Manual install hint */}
                                            {!isInstalled && !canInstall && (
                                                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                                    <p className="text-xs text-amber-400 font-medium mb-2">📲 {t('pwa.manualInstall')}</p>
                                                    <div className="text-xs text-[var(--text-secondary)] space-y-1">
                                                        <p><strong>Chrome:</strong> Menu (⋮) → &quot;Install app&quot; or &quot;Add to Home screen&quot;</p>
                                                        <p><strong>Safari:</strong> Share (↑) → &quot;Add to Home Screen&quot;</p>
                                                        <p><strong>Edge:</strong> Menu (...) → &quot;Apps&quot; → &quot;Install this site&quot;</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Push Notifications */}
                                            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                                                <div className="flex items-center gap-3">
                                                    {pushSubscribed ? <Bell className="w-5 h-5 text-green-400" /> : <BellOff className="w-5 h-5 text-[var(--text-muted)]" />}
                                                    <div>
                                                        <p className="text-sm font-medium">{t('notifications.push')}</p>
                                                        <p className="text-xs text-[var(--text-muted)]">
                                                            {!pushSupported ? t('notifications.notSupported') : pushPermission === 'denied' ? t('notifications.blocked') : pushSubscribed ? t('notifications.enabled') : t('notifications.disabled')}
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
                                                        {pushSubscribed ? tCommon('disable') : tCommon('enable')}
                                                    </Button>
                                                )}
                                            </div>

                                            {/* Discord Webhook */}
                                            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                                                <div className="flex items-center gap-3">
                                                    <svg className="w-5 h-5 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                                                    </svg>
                                                    <div>
                                                        <p className="text-sm font-medium">{t('discord.title')}</p>
                                                        <p className="text-xs text-[var(--text-muted)]">{t('discord.description')}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => setActiveTab('integrations')} className="text-xs text-[#5865F2] hover:underline font-medium">
                                                    Configure →
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Experimental Section - All experimental features consolidated */}
                                    <div className="pt-4 border-t border-[var(--border-color)]">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Sparkles className="w-5 h-5 text-purple-400" />
                                            <div>
                                                <h2 className="font-semibold text-sm">Experimental</h2>
                                                <p className="text-[10px] text-[var(--text-muted)]">Beta features - may change or be removed</p>
                                            </div>
                                        </div>
                                        
                                        <div className="space-y-4">
                                            {/* Seasonal Effects & Custom Background */}
                                            <SeasonalSettings />
                                            
                                            {/* Wallpaper Settings - Only show if custom background exists */}
                                            <WallpaperSettingsInline />
                                            
                                            {/* Adapt Text Toggle */}
                                            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                                                <div className="flex items-center gap-3">
                                                    <Sparkles className="w-5 h-5 text-yellow-400" />
                                                    <div>
                                                        <p className="text-sm font-medium">Adapt Text</p>
                                                        <p className="text-[10px] text-[var(--text-muted)]">Auto-adjust text for custom background</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const newValue = !adaptTextEnabled;
                                                        setAdaptTextEnabled(newValue);
                                                        setAdaptTextSetting(newValue);
                                                    }}
                                                    className={`relative w-11 h-6 rounded-full transition-colors ${
                                                        adaptTextEnabled 
                                                            ? 'bg-yellow-500' 
                                                            : 'bg-[var(--bg-card)] border border-[var(--border-color)]'
                                                    }`}
                                                >
                                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                                        adaptTextEnabled ? 'translate-x-6' : 'translate-x-1'
                                                    }`} />
                                                </button>
                                            </div>
                                            {adaptTextEnabled && (
                                                <p className="text-[10px] text-yellow-500/80 px-3">
                                                    ✨ Text shadow enabled for better visibility on custom backgrounds
                                                </p>
                                            )}
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

                                    {/* Full Backup Section */}
                                    <div className="p-4 rounded-lg bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/20 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Package className="w-5 h-5 text-emerald-400" />
                                                <div>
                                                    <p className="text-sm font-medium">Full Backup</p>
                                                    <p className="text-xs text-[var(--text-muted)]">{historyCount} history + settings</p>
                                                </div>
                                            </div>
                                            <RefreshCw 
                                                className="w-4 h-4 text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)] transition-colors" 
                                                onClick={() => getHistoryCount().then(setHistoryCount)}
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <input type="file" ref={backupFileInputRef} accept=".zip" onChange={handleImportHistory} className="hidden" />
                                            <Button 
                                                variant="secondary" 
                                                size="sm" 
                                                onClick={handleExportHistory} 
                                                disabled={isExporting}
                                                leftIcon={isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 
                                                className="flex-1"
                                            >
                                                Export
                                            </Button>
                                            <Button 
                                                variant="secondary" 
                                                size="sm" 
                                                onClick={() => backupFileInputRef.current?.click()} 
                                                disabled={isImporting}
                                                leftIcon={isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} 
                                                className="flex-1"
                                            >
                                                Import
                                            </Button>
                                        </div>
                                        <p className="text-[10px] text-[var(--text-muted)]">
                                            Export as ZIP containing history.json + settings.json. Import will merge data.
                                        </p>
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
                                            <Database className="w-4 h-4 text-cyan-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium">Download History</p>
                                                <p className="text-[10px] text-[var(--text-muted)]">IndexedDB storage</p>
                                            </div>
                                            <button onClick={clearIndexedDB} disabled={isClearing !== null} className="p-1.5 rounded-md hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors" title="Clear history">
                                                {isClearing === 'indexeddb' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] border border-transparent hover:border-[var(--border-color)] transition-all">
                                            <Sparkles className="w-4 h-4 text-pink-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium">Seasonal Effects</p>
                                                <p className="text-[10px] text-[var(--text-muted)]">Background & particles</p>
                                            </div>
                                            <button onClick={clearSeasonalData} disabled={isClearing !== null} className="p-1.5 rounded-md hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors" title="Clear seasonal">
                                                {isClearing === 'seasonal' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] border border-transparent hover:border-[var(--border-color)] transition-all">
                                            <Package className="w-4 h-4 text-blue-400" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium">Service Worker</p>
                                                <p className="text-[10px] text-[var(--text-muted)]">Offline cache</p>
                                            </div>
                                            <button onClick={clearCacheAndHistory} disabled={isClearing !== null} className="p-1.5 rounded-md hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-colors" title="Clear SW cache">
                                                {isClearing === 'history_cache' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Reset All - Full Width */}
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10 hover:border-red-500/30 transition-all">
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-red-500">Reset All Data</p>
                                            <p className="text-[10px] text-[var(--text-muted)]">Factory reset - clears everything</p>
                                        </div>
                                        <button onClick={clearAllData} disabled={isClearing !== null} className="p-1.5 rounded-md hover:bg-red-500/20 text-red-500 transition-colors" title="Reset everything">
                                            {isClearing === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                        </button>
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
// WALLPAPER SETTINGS COMPONENT
// ═══════════════════════════════════════════════════════════════

function WallpaperSettingsInline() {
    const [mounted, setMounted] = useState(false);
    const [settings, setSettingsState] = useState<ReturnType<typeof getSettings> | null>(null);
    const [seasonalSettings, setSeasonalSettingsState] = useState<ReturnType<typeof getSeasonalSettings> | null>(null);
    
    // Load settings after mount to avoid hydration mismatch
    useEffect(() => {
        setSettingsState(getSettings());
        setSeasonalSettingsState(getSeasonalSettings());
        setMounted(true);
    }, []);
    
    // Only show if mounted and custom background exists
    if (!mounted || !settings || !seasonalSettings || !seasonalSettings.customBackground) return null;
    
    const handleOpacityChange = (value: number) => {
        setBackgroundOpacity(value);
        setSeasonalSettingsState(getSeasonalSettings());
        saveSettings({ wallpaperOpacity: value });
        setSettingsState(getSettings());
    };
    
    const handleBlurChange = (value: number) => {
        setBackgroundBlur(value);
        setSeasonalSettingsState(getSeasonalSettings());
        saveSettings({ backgroundBlur: value });
        setSettingsState(getSettings());
    };
    
    const handleSoundToggle = () => {
        const newValue = !settings.allowVideoSound;
        saveSettings({ allowVideoSound: newValue });
        setSettingsState(getSettings());
        // Dispatch event for SeasonalEffects to pick up
        window.dispatchEvent(new CustomEvent('wallpaper-sound-changed', { detail: { enabled: newValue } }));
    };
    
    const isVideo = seasonalSettings.customBackground?.type === 'video';
    
    return (
        <div className="space-y-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
            <div className="flex items-center gap-2 mb-2">
                <Image className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium">Wallpaper Settings</span>
            </div>
            
            {/* Wallpaper Opacity */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--text-secondary)]">Wallpaper Opacity</span>
                    <span className="text-xs text-[var(--text-muted)] font-mono">{seasonalSettings.backgroundOpacity || 8}%</span>
                </div>
                <input 
                    type="range" 
                    min="5" 
                    max="25" 
                    value={seasonalSettings.backgroundOpacity || 8} 
                    onChange={e => handleOpacityChange(Number(e.target.value))} 
                    className="w-full accent-[var(--accent-primary)] h-1.5 rounded-full" 
                />
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
                    <span>Subtle</span>
                    <span>Visible</span>
                </div>
            </div>
            
            {/* Background Blur */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[var(--text-secondary)]">Background Blur</span>
                    <span className="text-xs text-[var(--text-muted)] font-mono">{seasonalSettings.backgroundBlur || 0}px</span>
                </div>
                <input 
                    type="range" 
                    min="0" 
                    max="20" 
                    value={seasonalSettings.backgroundBlur || 0} 
                    onChange={e => handleBlurChange(Number(e.target.value))} 
                    className="w-full accent-[var(--accent-primary)] h-1.5 rounded-full" 
                />
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
                    <span>Sharp</span>
                    <span>Blurry</span>
                </div>
            </div>
            
            {/* Allow Sound - Only for video backgrounds */}
            {isVideo && (
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]/50">
                    <div className="flex items-center gap-2">
                        {settings.allowVideoSound ? (
                            <Volume2 className="w-4 h-4 text-green-400" />
                        ) : (
                            <VolumeX className="w-4 h-4 text-[var(--text-muted)]" />
                        )}
                        <div>
                            <p className="text-sm font-medium">Allow Sound</p>
                            <p className="text-[10px] text-[var(--text-muted)]">Play video with audio</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSoundToggle}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                            settings.allowVideoSound 
                                ? 'bg-green-500' 
                                : 'bg-[var(--bg-card)] border border-[var(--border-color)]'
                        }`}
                    >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            settings.allowVideoSound ? 'translate-x-6' : 'translate-x-1'
                        }`} />
                    </button>
                </div>
            )}
            {isVideo && settings.allowVideoSound && (
                <p className="text-[10px] text-amber-500/80">
                    ⚠️ Sound will play when video background is visible
                </p>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// STORAGE INFO COMPONENT
// ═══════════════════════════════════════════════════════════════

function StorageInfo() {
    const [sizes, setSizes] = useState({ localStorage: '...', indexedDB: '...', total: '...' });

    useEffect(() => {
        const loadStats = async () => {
            try {
                const formatSize = (bytes: number) => {
                    const kb = bytes / 1024;
                    return kb < 1 ? `${bytes} B` : kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`;
                };

                // LocalStorage size
                let localStorageSize = 0;
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key) {
                        const val = localStorage.getItem(key);
                        localStorageSize += (key.length + (val?.length || 0)) * 2;
                    }
                }

                // IndexedDB size estimate
                let indexedDBSize = 'Unknown';
                if ('storage' in navigator && 'estimate' in navigator.storage) {
                    try {
                        const estimate = await navigator.storage.estimate();
                        if (estimate.usage) {
                            indexedDBSize = formatSize(estimate.usage);
                        }
                    } catch { /* ignore */ }
                }

                setSizes({
                    localStorage: formatSize(localStorageSize),
                    indexedDB: indexedDBSize,
                    total: indexedDBSize !== 'Unknown' ? indexedDBSize : formatSize(localStorageSize)
                });
            } catch { 
                setSizes({ localStorage: '-', indexedDB: '-', total: '-' }); 
            }
        };
        
        loadStats();
    }, []);

    return (
        <div className="pt-3 border-t border-[var(--border-color)]">
            <div className="flex justify-between text-xs text-[var(--text-muted)]">
                <span>LocalStorage: {sizes.localStorage}</span>
                <span>IndexedDB: {sizes.indexedDB}</span>
                <span className="font-medium text-[var(--text-secondary)]">Est. Total: {sizes.total}</span>
            </div>
        </div>
    );
}
