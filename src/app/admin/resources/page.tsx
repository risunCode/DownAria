'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    RefreshCw, Cookie, Monitor, Database, 
    CheckCircle, AlertTriangle, Clock, Plus, Info, Zap, ChevronRight,
    Smartphone, Tablet, Filter, Edit3, Trash2, Sparkles, Key, Eye, EyeOff, User, Hash, Calendar
} from 'lucide-react';
import Swal from 'sweetalert2';
import AdminGuard from '@/components/AdminGuard';
import { AdminCard, AdminModal, PlatformIcon, type PlatformId } from '@/components/admin';
import { 
    useCookies,
    useCookieStats, 
    useBrowserProfiles,
    useAiKeys,
    PLATFORM_OPTIONS, BROWSER_OPTIONS, DEVICE_OPTIONS, OS_OPTIONS,
    type CookiePoolStats, type PooledCookie,
    type BrowserProfile, type CreateProfileInput,
    type AiApiKey, type AiProvider,
} from '@/hooks/admin';
import { faFacebook, faInstagram, faWeibo, faTwitter } from '@fortawesome/free-brands-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

type CookiePlatform = 'facebook' | 'instagram' | 'weibo' | 'twitter';
type TabType = 'cookies' | 'browserprofiles' | 'aikeys';

const COOKIE_PLATFORMS: { id: CookiePlatform; name: string; icon: IconDefinition; color: string; bgColor: string; required: string }[] = [
    { id: 'facebook', name: 'Facebook', icon: faFacebook, color: 'text-blue-500', bgColor: 'bg-blue-500/10', required: 'c_user, xs' },
    { id: 'instagram', name: 'Instagram', icon: faInstagram, color: 'text-pink-500', bgColor: 'bg-pink-500/10', required: 'sessionid' },
    { id: 'twitter', name: 'Twitter', icon: faTwitter, color: 'text-sky-400', bgColor: 'bg-sky-400/10', required: 'auth_token, ct0' },
    { id: 'weibo', name: 'Weibo', icon: faWeibo, color: 'text-orange-500', bgColor: 'bg-orange-500/10', required: 'SUB' },
];

// ============================================
// COOKIE PARSER - Extract session info from cookie string
// ============================================
interface ParsedCookieInfo {
    userId?: string;
    sessionId?: string;
    expires?: string;
    csrfToken?: string;
}

function parseCookieInfo(cookieStr: string, platform: CookiePlatform): ParsedCookieInfo {
    const info: ParsedCookieInfo = {};
    
    // Parse cookie string into key-value pairs
    const cookies: Record<string, string> = {};
    cookieStr.split(';').forEach(part => {
        const [key, ...valueParts] = part.trim().split('=');
        if (key) cookies[key.trim()] = valueParts.join('=');
    });

    switch (platform) {
        case 'twitter':
            // Twitter: auth_token (session), ct0 (csrf), twid (user id)
            if (cookies['auth_token']) info.sessionId = cookies['auth_token'].substring(0, 12) + '...';
            if (cookies['ct0']) info.csrfToken = cookies['ct0'].substring(0, 8) + '...';
            if (cookies['twid']) {
                // twid format: u%3D1234567890 -> extract user id
                const match = cookies['twid'].match(/u%3D(\d+)/);
                if (match) info.userId = match[1];
            }
            break;
            
        case 'instagram':
            // Instagram: sessionid, ds_user_id, csrftoken
            if (cookies['sessionid']) info.sessionId = cookies['sessionid'].substring(0, 12) + '...';
            if (cookies['ds_user_id']) info.userId = cookies['ds_user_id'];
            if (cookies['csrftoken']) info.csrfToken = cookies['csrftoken'].substring(0, 8) + '...';
            break;
            
        case 'facebook':
            // Facebook: c_user (user id), xs (session)
            if (cookies['c_user']) info.userId = cookies['c_user'];
            if (cookies['xs']) info.sessionId = cookies['xs'].substring(0, 12) + '...';
            break;
            
        case 'weibo':
            // Weibo: SUB (session), _T_WM
            if (cookies['SUB']) info.sessionId = cookies['SUB'].substring(0, 12) + '...';
            if (cookies['_T_WM']) info.csrfToken = cookies['_T_WM'].substring(0, 8) + '...';
            break;
    }

    return info;
}

export default function ResourcesPage() {
    return (
        <AdminGuard requiredRole="admin">
            <ResourcesContent />
        </AdminGuard>
    );
}

function ResourcesContent() {
    const [activeTab, setActiveTab] = useState<TabType>('cookies');
    const [selectedCookiePlatform, setSelectedCookiePlatform] = useState<CookiePlatform | null>(null);

    // Hooks
    const { stats: cookieStats, refetch: refetchCookies, getStats: getCookieStats } = useCookieStats();
    const { profiles: browserProfiles, totals: bpTotals, loading: bpLoading, deleteProfile, updateProfile, createProfile, refetch: refetchBP } = useBrowserProfiles();
    const { keys: aiKeys, loading: aiLoading, saving: aiSaving, addKey: addAiKey, toggleKey: toggleAiKey, deleteKey: deleteAiKey, stats: aiStats, refetch: refetchAi } = useAiKeys();

    // Calculate totals for tabs
    const totalCookies = cookieStats.reduce((sum, s) => sum + s.total, 0);

    const handleRefreshAll = () => {
        refetchCookies();
        refetchBP();
        refetchAi();
    };

    return (
        <div className="p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Database className="w-6 h-6 text-[var(--accent-primary)]" />
                            Resources
                        </h1>
                        <p className="text-[var(--text-muted)] text-sm">Manage cookies & browser profiles</p>
                    </div>
                    <button
                        onClick={handleRefreshAll}
                        className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-card)] transition-colors"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('cookies')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === 'cookies' 
                                ? 'bg-[var(--accent-primary)] text-white' 
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                        }`}
                    >
                        <Cookie className="w-4 h-4" />
                        Cookies
                        <span className={`px-1.5 py-0.5 rounded text-xs ${activeTab === 'cookies' ? 'bg-white/20' : 'bg-orange-500/20 text-orange-400'}`}>
                            {totalCookies}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('browserprofiles')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === 'browserprofiles' 
                                ? 'bg-[var(--accent-primary)] text-white' 
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                        }`}
                    >
                        <Monitor className="w-4 h-4" />
                        Browser Profiles
                        <span className={`px-1.5 py-0.5 rounded text-xs ${activeTab === 'browserprofiles' ? 'bg-white/20' : 'bg-purple-500/20 text-purple-400'}`}>
                            {bpTotals.total}
                        </span>
                    </button>
                    <button
                        onClick={() => setActiveTab('aikeys')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === 'aikeys' 
                                ? 'bg-[var(--accent-primary)] text-white' 
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                        }`}
                    >
                        <Sparkles className="w-4 h-4" />
                        AI Keys
                        <span className={`px-1.5 py-0.5 rounded text-xs ${activeTab === 'aikeys' ? 'bg-white/20' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {aiStats.totalKeys}
                        </span>
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'cookies' && (
                    <CookiesTab 
                        getStats={getCookieStats}
                        onSelectPlatform={setSelectedCookiePlatform}
                    />
                )}

                {activeTab === 'browserprofiles' && (
                    <BrowserProfilesTab
                        profiles={browserProfiles}
                        totals={bpTotals}
                        loading={bpLoading}
                        onRefresh={refetchBP}
                        onAdd={createProfile}
                        onUpdate={updateProfile}
                        onDelete={deleteProfile}
                    />
                )}

                {activeTab === 'aikeys' && (
                    <AIKeysTab
                        keys={aiKeys}
                        stats={aiStats}
                        loading={aiLoading}
                        saving={aiSaving}
                        onRefresh={refetchAi}
                        onAdd={addAiKey}
                        onToggle={toggleAiKey}
                        onDelete={deleteAiKey}
                    />
                )}
            </div>

            {/* Cookie Pool Modal */}
            <AnimatePresence>
                {selectedCookiePlatform && (
                    <CookiePoolModal
                        platform={selectedCookiePlatform}
                        platformInfo={COOKIE_PLATFORMS.find(p => p.id === selectedCookiePlatform)!}
                        onClose={() => {
                            setSelectedCookiePlatform(null);
                            refetchCookies();
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================
// COOKIES TAB
// ============================================
interface CookiesTabProps {
    getStats: (platform: string) => CookiePoolStats;
    onSelectPlatform: (platform: CookiePlatform) => void;
}

function CookiesTab({ getStats, onSelectPlatform }: CookiesTabProps) {
    return (
        <div className="space-y-6">
            {/* Cookie Platform Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {COOKIE_PLATFORMS.map((platform, idx) => {
                    const s = getStats(platform.id);
                    const successRate = s.total_success + s.total_errors > 0 
                        ? Math.round((s.total_success / (s.total_success + s.total_errors)) * 100) 
                        : 0;
                    
                    return (
                        <motion.button
                            key={platform.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            onClick={() => onSelectPlatform(platform.id)}
                            className="glass-card p-5 text-left hover:border-[var(--accent-primary)]/50 transition-all group"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <PlatformIcon platform={platform.id as PlatformId} size="lg" />
                                    <div>
                                        <span className="font-semibold text-lg">{platform.name}</span>
                                        <div className="text-xs text-[var(--text-muted)]">
                                            {s.total} cookie{s.total !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors" />
                            </div>

                            {s.total > 0 ? (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="flex items-center gap-1.5">
                                            <CheckCircle className="w-4 h-4 text-green-400" />
                                            <span className="text-green-400">{s.healthy_count}</span>
                                            <span className="text-[var(--text-muted)]">healthy</span>
                                        </div>
                                        {s.cooldown_count > 0 && (
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-4 h-4 text-yellow-400" />
                                                <span className="text-yellow-400">{s.cooldown_count}</span>
                                            </div>
                                        )}
                                        {s.expired_count > 0 && (
                                            <div className="flex items-center gap-1.5">
                                                <AlertTriangle className="w-4 h-4 text-red-400" />
                                                <span className="text-red-400">{s.expired_count}</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                                            <Zap className="w-3.5 h-3.5" />
                                            <span>{s.total_uses.toLocaleString()} uses</span>
                                        </div>
                                        <div className={`font-medium ${successRate >= 90 ? 'text-green-400' : successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {successRate}% success
                                        </div>
                                    </div>
                                    <div className="h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all"
                                            style={{ width: `${(s.healthy_count / s.total) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-4">
                                    <div className="text-[var(--text-muted)] text-sm mb-2">No cookies configured</div>
                                    <div className="flex items-center justify-center gap-1 text-xs text-[var(--accent-primary)]">
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Click to add</span>
                                    </div>
                                </div>
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {/* Cookie Info */}
            <AdminCard>
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm flex-1">
                        <p className="font-medium text-[var(--text-secondary)] mb-2">Cookie Pool System</p>
                        <ul className="space-y-1 text-xs text-[var(--text-muted)]">
                            <li>• <span className="text-green-400">Rotation</span> - Cookies are rotated automatically to avoid rate limits</li>
                            <li>• <span className="text-yellow-400">Cooldown</span> - Rate-limited cookies rest for 30 min before reuse</li>
                            <li>• <span className="text-red-400">Expired</span> - Session expired, needs re-login</li>
                            <li>• <span className="text-purple-400">Encrypted</span> - All cookies are encrypted at rest (AES-256-GCM)</li>
                        </ul>
                    </div>
                </div>
            </AdminCard>
        </div>
    );
}


// ============================================
// BROWSER PROFILES TAB
// ============================================
interface BrowserProfilesTabProps {
    profiles: BrowserProfile[];
    totals: { 
        total: number; 
        enabled: number; 
        totalUses: number; 
        totalSuccess: number;
        totalErrors: number;
    };
    loading: boolean;
    onRefresh: () => void;
    onAdd: (profile: CreateProfileInput) => Promise<BrowserProfile | null>;
    onUpdate: (id: string, updates: Partial<CreateProfileInput>) => Promise<boolean>;
    onDelete: (id: string) => Promise<boolean>;
}

function BrowserProfilesTab({
    profiles,
    totals,
    loading,
    onRefresh,
    onAdd,
    onUpdate,
    onDelete,
}: BrowserProfilesTabProps) {
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProfile, setEditingProfile] = useState<BrowserProfile | null>(null);
    const [filterPlatform, setFilterPlatform] = useState('all');
    const [filterBrowser, setFilterBrowser] = useState('all');
    const [filterDevice, setFilterDevice] = useState('all');
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        platform: 'all',
        label: '',
        user_agent: '',
        sec_ch_ua: '',
        sec_ch_ua_platform: '',
        sec_ch_ua_mobile: '?0',
        accept_language: 'en-US,en;q=0.9',
        browser: 'chrome',
        device_type: 'desktop',
        os: 'windows',
        is_chromium: true,
        priority: 5,
        enabled: true,
        note: '',
    });

    const resetForm = () => {
        setFormData({
            platform: 'all',
            label: '',
            user_agent: '',
            sec_ch_ua: '',
            sec_ch_ua_platform: '',
            sec_ch_ua_mobile: '?0',
            accept_language: 'en-US,en;q=0.9',
            browser: 'chrome',
            device_type: 'desktop',
            os: 'windows',
            is_chromium: true,
            priority: 5,
            enabled: true,
            note: '',
        });
    };

    const handleOpenAdd = () => {
        resetForm();
        setEditingProfile(null);
        setShowAddModal(true);
    };

    const handleOpenEdit = (profile: BrowserProfile) => {
        setFormData({
            platform: profile.platform,
            label: profile.label,
            user_agent: profile.user_agent,
            sec_ch_ua: profile.sec_ch_ua || '',
            sec_ch_ua_platform: profile.sec_ch_ua_platform || '',
            sec_ch_ua_mobile: profile.sec_ch_ua_mobile,
            accept_language: profile.accept_language,
            browser: profile.browser,
            device_type: profile.device_type,
            os: profile.os || 'windows',
            is_chromium: profile.is_chromium,
            priority: profile.priority,
            enabled: profile.enabled,
            note: profile.note || '',
        });
        setEditingProfile(profile);
        setShowAddModal(true);
    };

    const handleSave = async () => {
        if (!formData.label.trim() || !formData.user_agent.trim()) {
            await Swal.fire({
                title: 'Validation Error',
                text: 'Label and User-Agent are required',
                icon: 'error',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
            return;
        }

        setSaving(true);
        try {
            const profileData: CreateProfileInput = {
                ...formData,
                sec_ch_ua: formData.sec_ch_ua || null,
                sec_ch_ua_platform: formData.sec_ch_ua_platform || null,
                os: formData.os || null,
                note: formData.note || null,
            };

            if (editingProfile) {
                const success = await onUpdate(editingProfile.id, profileData);
                if (success) {
                    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Profile updated', showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
                    setShowAddModal(false);
                    resetForm();
                }
            } else {
                const result = await onAdd(profileData);
                if (result) {
                    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Profile added', showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
                    setShowAddModal(false);
                    resetForm();
                }
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (profile: BrowserProfile) => {
        const result = await Swal.fire({
            title: 'Delete Profile?',
            text: `Delete "${profile.label}"? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Delete',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });

        if (result.isConfirmed) {
            const success = await onDelete(profile.id);
            if (success) {
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Profile deleted', showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            }
        }
    };

    const handleToggle = async (profile: BrowserProfile) => {
        await onUpdate(profile.id, { enabled: !profile.enabled });
    };

    const filteredProfiles = profiles.filter(profile => {
        if (filterPlatform !== 'all' && profile.platform !== filterPlatform) return false;
        if (filterBrowser !== 'all' && profile.browser !== filterBrowser) return false;
        if (filterDevice !== 'all' && profile.device_type !== filterDevice) return false;
        return true;
    });

    const DeviceIcon = ({ type }: { type: string }) => {
        if (type === 'mobile') return <Smartphone className="w-4 h-4" />;
        if (type === 'tablet') return <Tablet className="w-4 h-4" />;
        return <Monitor className="w-4 h-4" />;
    };

    const getBrowserColor = (browser: string) => {
        const colors: Record<string, string> = {
            chrome: 'text-green-400',
            firefox: 'text-orange-400',
            safari: 'text-blue-400',
            edge: 'text-cyan-400',
            opera: 'text-red-400',
        };
        return colors[browser] || 'text-gray-400';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold text-[var(--text-primary)]">{totals.total}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Total Profiles</div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">{totals.enabled}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Enabled</div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">{totals.totalUses.toLocaleString()}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Total Uses</div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">{totals.totalSuccess.toLocaleString()}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Success</div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold text-red-400">{totals.totalErrors.toLocaleString()}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Errors</div>
                </motion.div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-[var(--text-muted)]" />
                    <select value={filterPlatform} onChange={(e) => setFilterPlatform(e.target.value)} className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm">
                        {PLATFORM_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                    <select value={filterBrowser} onChange={(e) => setFilterBrowser(e.target.value)} className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm">
                        <option value="all">All Browsers</option>
                        {BROWSER_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                    <select value={filterDevice} onChange={(e) => setFilterDevice(e.target.value)} className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm">
                        <option value="all">All Devices</option>
                        {DEVICE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onRefresh} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors" title="Refresh">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button onClick={handleOpenAdd} className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Profile
                    </button>
                </div>
            </div>

            {/* Profile List */}
            {filteredProfiles.length === 0 ? (
                <AdminCard>
                    <div className="text-center py-8 text-[var(--text-muted)]">
                        {profiles.length === 0 ? 'No browser profiles found. Click "Add Profile" to create one.' : 'No profiles match the current filters.'}
                    </div>
                </AdminCard>
            ) : (
                <div className="space-y-3">
                    {filteredProfiles.map((profile, idx) => {
                        const successRate = profile.success_count + profile.error_count > 0
                            ? Math.round((profile.success_count / (profile.success_count + profile.error_count)) * 100)
                            : 0;

                        return (
                            <motion.div
                                key={profile.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className="glass-card p-4 hover:border-[var(--accent-primary)]/30 transition-all"
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-lg ${profile.enabled ? 'bg-[var(--accent-primary)]/10' : 'bg-[var(--bg-secondary)]'}`}>
                                        <DeviceIcon type={profile.device_type} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-[var(--text-primary)]">{profile.label}</span>
                                            {profile.platform !== 'all' && <PlatformIcon platform={profile.platform as PlatformId} size="sm" />}
                                            <span className={`text-xs font-medium ${getBrowserColor(profile.browser)}`}>{profile.browser}</span>
                                            {profile.is_chromium && <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400 font-medium">Chromium</span>}
                                            {!profile.enabled && <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">Disabled</span>}
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)] truncate font-mono mb-2">{profile.user_agent}</div>
                                        <div className="flex flex-wrap items-center gap-3 text-xs">
                                            <span className="px-2 py-1 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">{profile.platform === 'all' ? 'All Platforms' : profile.platform}</span>
                                            <span className="px-2 py-1 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">{profile.device_type}</span>
                                            {profile.os && <span className="px-2 py-1 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">{profile.os}</span>}
                                            <span className="text-[var(--text-muted)]">Uses: <span className="text-blue-400 font-medium">{profile.use_count}</span></span>
                                            {profile.use_count > 0 && <span className={`font-medium ${successRate >= 90 ? 'text-green-400' : successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{successRate}% success</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleOpenEdit(profile)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors" title="Edit">
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleToggle(profile)} className={`relative w-11 h-6 rounded-full transition-colors ${profile.enabled ? 'bg-green-500' : 'bg-gray-600'}`} title={profile.enabled ? 'Disable' : 'Enable'}>
                                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${profile.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                        <button onClick={() => handleDelete(profile)} className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors" title="Delete">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Info Card */}
            <AdminCard>
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm flex-1">
                        <p className="font-medium text-[var(--text-secondary)] mb-2">Browser Profiles System</p>
                        <ul className="space-y-1 text-xs text-[var(--text-muted)]">
                            <li>• <span className="text-purple-400">Full Headers</span> - Complete browser fingerprint including Sec-Ch-* headers</li>
                            <li>• <span className="text-blue-400">Priority</span> - Higher priority profiles are selected more often</li>
                            <li>• <span className="text-green-400">Platform-specific</span> - Set profiles for specific platforms or use &quot;all&quot;</li>
                        </ul>
                    </div>
                </div>
            </AdminCard>

            {/* Add/Edit Modal */}
            <AdminModal
                open={showAddModal}
                onClose={() => !saving && setShowAddModal(false)}
                title={editingProfile ? 'Edit Browser Profile' : 'Add Browser Profile'}
                subtitle="Configure browser fingerprint for anti-detection"
                size="xl"
                footer={
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-sm font-medium transition-colors" disabled={saving}>Cancel</button>
                        <button onClick={handleSave} disabled={saving || !formData.label.trim() || !formData.user_agent.trim()} className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2">
                            {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                            {saving ? 'Saving...' : editingProfile ? 'Update' : 'Add'}
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Label <span className="text-red-400">*</span></label>
                            <input type="text" value={formData.label} onChange={(e) => setFormData(f => ({ ...f, label: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm" placeholder="Chrome 143 Windows Desktop" disabled={saving} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Platform</label>
                            <select value={formData.platform} onChange={(e) => setFormData(f => ({ ...f, platform: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm" disabled={saving}>
                                {PLATFORM_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Browser</label>
                            <select value={formData.browser} onChange={(e) => { const browser = e.target.value; const isChromium = ['chrome', 'edge', 'opera'].includes(browser); setFormData(f => ({ ...f, browser, is_chromium: isChromium })); }} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm" disabled={saving}>
                                {BROWSER_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Device Type</label>
                            <select value={formData.device_type} onChange={(e) => setFormData(f => ({ ...f, device_type: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm" disabled={saving}>
                                {DEVICE_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">OS</label>
                            <select value={formData.os} onChange={(e) => setFormData(f => ({ ...f, os: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm" disabled={saving}>
                                {OS_OPTIONS.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">User-Agent String <span className="text-red-400">*</span></label>
                        <textarea value={formData.user_agent} onChange={(e) => setFormData(f => ({ ...f, user_agent: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono resize-none" rows={3} placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64)..." disabled={saving} />
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <input type="checkbox" id="is_chromium" checked={formData.is_chromium} onChange={(e) => setFormData(f => ({ ...f, is_chromium: e.target.checked }))} className="w-4 h-4 rounded accent-[var(--accent-primary)]" disabled={saving} />
                        <label htmlFor="is_chromium" className="text-sm text-[var(--text-secondary)] cursor-pointer">Is Chromium-based browser (has Sec-Ch-* headers)</label>
                    </div>
                    {formData.is_chromium && (
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Sec-Ch-Ua</label>
                                <input type="text" value={formData.sec_ch_ua} onChange={(e) => setFormData(f => ({ ...f, sec_ch_ua: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono" placeholder='"Google Chrome";v="143"...' disabled={saving} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Sec-Ch-Ua-Platform</label>
                                    <input type="text" value={formData.sec_ch_ua_platform} onChange={(e) => setFormData(f => ({ ...f, sec_ch_ua_platform: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono" placeholder='"Windows"' disabled={saving} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Sec-Ch-Ua-Mobile</label>
                                    <select value={formData.sec_ch_ua_mobile} onChange={(e) => setFormData(f => ({ ...f, sec_ch_ua_mobile: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm" disabled={saving}>
                                        <option value="?0">?0 (Desktop)</option>
                                        <option value="?1">?1 (Mobile)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Accept-Language</label>
                            <input type="text" value={formData.accept_language} onChange={(e) => setFormData(f => ({ ...f, accept_language: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm" placeholder="en-US,en;q=0.9" disabled={saving} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Priority (0-100)</label>
                            <input type="number" value={formData.priority} onChange={(e) => setFormData(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm" min={0} max={100} disabled={saving} />
                        </div>
                        <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={formData.enabled} onChange={(e) => setFormData(f => ({ ...f, enabled: e.target.checked }))} className="w-4 h-4 rounded accent-[var(--accent-primary)]" disabled={saving} />
                                <span className="text-sm text-[var(--text-secondary)]">Enabled</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Note (Optional)</label>
                        <input type="text" value={formData.note} onChange={(e) => setFormData(f => ({ ...f, note: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm" placeholder="Optional note..." disabled={saving} />
                    </div>
                </div>
            </AdminModal>
        </div>
    );
}


// ============================================
// AI KEYS TAB
// ============================================
const PROVIDER_CONFIG: Record<AiProvider, { label: string; color: string; bgColor: string; placeholder: string }> = {
    gemini: { label: 'Gemini', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', placeholder: 'AIza...' },
    openai: { label: 'OpenAI', color: 'text-green-400', bgColor: 'bg-green-500/10', placeholder: 'sk-...' },
    anthropic: { label: 'Anthropic', color: 'text-orange-400', bgColor: 'bg-orange-500/10', placeholder: 'sk-ant-...' },
    other: { label: 'Other', color: 'text-gray-400', bgColor: 'bg-gray-500/10', placeholder: 'API key...' },
};

interface AIKeysTabProps {
    keys: AiApiKey[];
    stats: { totalKeys: number; activeKeys: number; totalUsage: number; byProvider?: Record<AiProvider, number> };
    loading: boolean;
    saving: string | null;
    onRefresh: () => void;
    onAdd: (name: string, key: string, provider: AiProvider) => Promise<boolean>;
    onToggle: (id: string, enabled: boolean) => Promise<boolean>;
    onDelete: (id: string, name: string) => Promise<boolean>;
}

function AIKeysTab({ keys, stats, loading, saving, onRefresh, onAdd, onToggle, onDelete }: AIKeysTabProps) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [newKeyValue, setNewKeyValue] = useState('');
    const [newKeyProvider, setNewKeyProvider] = useState<AiProvider>('gemini');
    const [filterProvider, setFilterProvider] = useState<AiProvider | 'all'>('all');
    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

    const handleAddKey = async () => {
        if (!newKeyName.trim() || !newKeyValue.trim()) return;
        const success = await onAdd(newKeyName.trim(), newKeyValue.trim(), newKeyProvider);
        if (success) {
            setNewKeyName('');
            setNewKeyValue('');
            setNewKeyProvider('gemini');
            setShowAddForm(false);
        }
    };

    const toggleKeyVisibility = (id: string) => {
        setVisibleKeys(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const filteredKeys = filterProvider === 'all' ? keys : keys.filter(k => k.provider === filterProvider);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Summary */}
            <div className="grid grid-cols-3 gap-3">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold text-[var(--text-primary)]">{stats.totalKeys}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Total Keys</div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">{stats.activeKeys}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Active</div>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">{stats.totalUsage.toLocaleString()}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Total Requests</div>
                </motion.div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-[var(--text-muted)]" />
                    <select 
                        value={filterProvider} 
                        onChange={(e) => setFilterProvider(e.target.value as AiProvider | 'all')}
                        className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                    >
                        <option value="all">All Providers</option>
                        <option value="gemini">Gemini</option>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="other">Other</option>
                    </select>
                    <span className="text-sm text-[var(--text-muted)]">
                        {filteredKeys.length} key{filteredKeys.length !== 1 ? 's' : ''}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={onRefresh} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors" title="Refresh">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowAddForm(!showAddForm)} className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
                        <Plus className={`w-4 h-4 transition-transform ${showAddForm ? 'rotate-45' : ''}`} />
                        {showAddForm ? 'Cancel' : 'Add Key'}
                    </button>
                </div>
            </div>

            {/* Add Key Form */}
            <AnimatePresence>
                {showAddForm && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <AdminCard>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Provider</label>
                                    <select
                                        value={newKeyProvider}
                                        onChange={e => setNewKeyProvider(e.target.value as AiProvider)}
                                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                    >
                                        <option value="gemini">Gemini</option>
                                        <option value="openai">OpenAI</option>
                                        <option value="anthropic">Anthropic</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Key Name</label>
                                        <input
                                            type="text"
                                            value={newKeyName}
                                            onChange={e => setNewKeyName(e.target.value)}
                                            placeholder="Primary, Backup, etc."
                                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">API Key</label>
                                        <input
                                            type="password"
                                            value={newKeyValue}
                                            onChange={e => setNewKeyValue(e.target.value)}
                                            placeholder={PROVIDER_CONFIG[newKeyProvider].placeholder}
                                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleAddKey}
                                        disabled={saving === 'create' || !newKeyName.trim() || !newKeyValue.trim()}
                                        className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {saving === 'create' && <RefreshCw className="w-4 h-4 animate-spin" />}
                                        {saving === 'create' ? 'Adding...' : 'Add Key'}
                                    </button>
                                </div>
                            </div>
                        </AdminCard>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Keys List */}
            {filteredKeys.length === 0 ? (
                <AdminCard>
                    <div className="text-center py-8 text-[var(--text-muted)]">
                        <Key className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">{keys.length === 0 ? 'No AI keys configured' : 'No keys match the filter'}</p>
                        <p className="text-sm">{keys.length === 0 ? 'Add a key to enable AI-powered features' : 'Try selecting a different provider'}</p>
                    </div>
                </AdminCard>
            ) : (
                <div className="space-y-3">
                    {filteredKeys.map((key, idx) => {
                        const providerConfig = PROVIDER_CONFIG[key.provider] || PROVIDER_CONFIG.other;
                        return (
                            <motion.div
                                key={key.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className="glass-card p-4 hover:border-[var(--accent-primary)]/30 transition-all"
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-lg ${key.enabled ? providerConfig.bgColor : 'bg-[var(--bg-secondary)]'}`}>
                                        <Sparkles className={`w-5 h-5 ${key.enabled ? providerConfig.color : 'text-gray-500'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-[var(--text-primary)]">{key.name}</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${providerConfig.bgColor} ${providerConfig.color}`}>
                                                {providerConfig.label}
                                            </span>
                                            {!key.enabled && <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">Disabled</span>}
                                        </div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <code className="text-xs text-[var(--text-muted)] font-mono">
                                                {visibleKeys.has(key.id) ? key.key : key.key.replace(/(.{4}).*(.{4})/, '$1••••••••$2')}
                                            </code>
                                            <button onClick={() => toggleKeyVisibility(key.id)} className="p-0.5 hover:text-[var(--accent-primary)]">
                                                {visibleKeys.has(key.id) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-xs">
                                            <span className="text-[var(--text-muted)]">Requests: <span className="text-blue-400 font-medium">{key.usageCount.toLocaleString()}</span></span>
                                            {key.lastUsed && <span className="text-[var(--text-muted)]">Last used: {new Date(key.lastUsed).toLocaleDateString()}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => onToggle(key.id, !key.enabled)}
                                            disabled={saving === key.id}
                                            className={`relative w-11 h-6 rounded-full transition-colors ${key.enabled ? 'bg-green-500' : 'bg-gray-600'}`}
                                            title={key.enabled ? 'Disable' : 'Enable'}
                                        >
                                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${key.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                        <button
                                            onClick={() => onDelete(key.id, key.name)}
                                            disabled={saving === key.id}
                                            className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors disabled:opacity-50"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Info Card */}
            <AdminCard>
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm flex-1">
                        <p className="font-medium text-[var(--text-secondary)] mb-2">AI Keys Integration</p>
                        <ul className="space-y-1 text-xs text-[var(--text-muted)]">
                            <li>• <span className="text-yellow-400">Gemini</span>, <span className="text-green-400">OpenAI</span>, <span className="text-orange-400">Anthropic</span> - Multiple providers supported</li>
                            <li>• <span className="text-blue-400">Rotation</span> - Keys are rotated automatically for load balancing</li>
                            <li>• <span className="text-green-400">Fallback</span> - If one key fails, system tries the next enabled key</li>
                            <li>• <span className="text-purple-400">Encrypted</span> - All API keys are encrypted at rest</li>
                        </ul>
                    </div>
                </div>
            </AdminCard>
        </div>
    );
}


// ============================================
// COOKIE POOL MODAL
// ============================================
interface CookiePoolModalProps {
    platform: CookiePlatform;
    platformInfo: { id: CookiePlatform; name: string; icon: IconDefinition; color: string; bgColor: string; required: string };
    onClose: () => void;
}

function CookiePoolModal({ platform, platformInfo, onClose }: CookiePoolModalProps) {
    const { cookies, loading, saving, addCookie, updateCookie, deleteCookie, testCookie, refetch } = useCookies(platform);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingCookie, setEditingCookie] = useState<PooledCookie | null>(null);
    const [formData, setFormData] = useState({
        cookie: '',
        label: '',
        note: '',
        max_uses_per_hour: 60,
    });

    const resetForm = () => {
        setFormData({ cookie: '', label: '', note: '', max_uses_per_hour: 60 });
        setShowAddForm(false);
        setEditingCookie(null);
    };

    const handleSave = async () => {
        if (!formData.cookie.trim()) {
            await Swal.fire({
                title: 'Validation Error',
                text: 'Cookie string is required',
                icon: 'error',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
            return;
        }

        if (editingCookie) {
            const success = await updateCookie(editingCookie.id, {
                cookie: formData.cookie,
                label: formData.label || null,
                note: formData.note || null,
                max_uses_per_hour: formData.max_uses_per_hour,
            });
            if (success) resetForm();
        } else {
            const success = await addCookie({
                cookie: formData.cookie,
                label: formData.label || undefined,
                note: formData.note || undefined,
                max_uses_per_hour: formData.max_uses_per_hour,
            });
            if (success) resetForm();
        }
    };

    const handleEdit = (cookie: PooledCookie) => {
        setFormData({
            cookie: cookie.cookie,
            label: cookie.label || '',
            note: cookie.note || '',
            max_uses_per_hour: cookie.max_uses_per_hour,
        });
        setEditingCookie(cookie);
        setShowAddForm(true);
    };

    const handleToggle = async (cookie: PooledCookie) => {
        await updateCookie(cookie.id, { enabled: !cookie.enabled });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy': return 'text-green-400 bg-green-500/20';
            case 'cooldown': return 'text-yellow-400 bg-yellow-500/20';
            case 'expired': return 'text-red-400 bg-red-500/20';
            case 'disabled': return 'text-gray-400 bg-gray-500/20';
            default: return 'text-gray-400 bg-gray-500/20';
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                    <div className="flex items-center gap-3">
                        <PlatformIcon platform={platform as PlatformId} size="lg" />
                        <div>
                            <h3 className="font-semibold text-lg">{platformInfo.name} Cookies</h3>
                            <p className="text-xs text-[var(--text-muted)]">Required: {platformInfo.required}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={refetch} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors" title="Refresh">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
                            <Plus className="w-5 h-5 rotate-45" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Add/Edit Form */}
                    {showAddForm ? (
                        <AdminCard>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-medium">{editingCookie ? 'Edit Cookie' : 'Add New Cookie'}</h4>
                                    <button onClick={resetForm} className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)]">Cancel</button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Label</label>
                                        <input type="text" value={formData.label} onChange={(e) => setFormData(f => ({ ...f, label: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm" placeholder="Account name or identifier" disabled={saving} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Max Uses/Hour</label>
                                        <input type="number" value={formData.max_uses_per_hour} onChange={(e) => setFormData(f => ({ ...f, max_uses_per_hour: parseInt(e.target.value) || 60 }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm" min={1} max={1000} disabled={saving} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Cookie String <span className="text-red-400">*</span></label>
                                    <textarea value={formData.cookie} onChange={(e) => setFormData(f => ({ ...f, cookie: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono resize-none" rows={4} placeholder="Paste cookie string here..." disabled={saving} />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Note (Optional)</label>
                                    <input type="text" value={formData.note} onChange={(e) => setFormData(f => ({ ...f, note: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm" placeholder="Optional note..." disabled={saving} />
                                </div>
                                <div className="flex justify-end">
                                    <button onClick={handleSave} disabled={saving || !formData.cookie.trim()} className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2">
                                        {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                                        {saving ? 'Saving...' : editingCookie ? 'Update Cookie' : 'Add Cookie'}
                                    </button>
                                </div>
                            </div>
                        </AdminCard>
                    ) : (
                        <button onClick={() => setShowAddForm(true)} className="w-full p-4 rounded-lg border-2 border-dashed border-[var(--border-color)] hover:border-[var(--accent-primary)]/50 transition-colors flex items-center justify-center gap-2 text-[var(--text-muted)] hover:text-[var(--accent-primary)]">
                            <Plus className="w-5 h-5" />
                            <span>Add New Cookie</span>
                        </button>
                    )}

                    {/* Cookie List */}
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent-primary)]" />
                        </div>
                    ) : cookies.length === 0 ? (
                        <div className="text-center py-8 text-[var(--text-muted)]">
                            No cookies configured for {platformInfo.name}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {cookies.map((cookie, idx) => {
                                const successRate = cookie.success_count + cookie.error_count > 0
                                    ? Math.round((cookie.success_count / (cookie.success_count + cookie.error_count)) * 100)
                                    : 0;
                                const parsedInfo = parseCookieInfo(cookie.cookie, platform);

                                return (
                                    <motion.div
                                        key={cookie.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className="glass-card p-4"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-semibold text-[var(--text-primary)]">{cookie.label || 'Unnamed'}</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(cookie.status)}`}>{cookie.status}</span>
                                                </div>
                                                {/* Parsed Cookie Info */}
                                                <div className="flex flex-wrap items-center gap-3 text-xs mb-2">
                                                    {parsedInfo.userId && (
                                                        <span className="flex items-center gap-1 text-cyan-400">
                                                            <User className="w-3 h-3" />
                                                            <span className="font-mono">{parsedInfo.userId}</span>
                                                        </span>
                                                    )}
                                                    {parsedInfo.sessionId && (
                                                        <span className="flex items-center gap-1 text-purple-400">
                                                            <Hash className="w-3 h-3" />
                                                            <span className="font-mono">{parsedInfo.sessionId}</span>
                                                        </span>
                                                    )}
                                                    {parsedInfo.csrfToken && (
                                                        <span className="flex items-center gap-1 text-amber-400">
                                                            <Key className="w-3 h-3" />
                                                            <span className="font-mono">{parsedInfo.csrfToken}</span>
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-[var(--text-muted)] truncate font-mono mb-2">{cookie.cookiePreview || cookie.cookie.substring(0, 50) + '...'}</div>
                                                <div className="flex flex-wrap items-center gap-3 text-xs">
                                                    <span className="text-[var(--text-muted)]">Uses: <span className="text-blue-400 font-medium">{cookie.use_count}</span></span>
                                                    <span className="text-[var(--text-muted)]">Success: <span className="text-green-400 font-medium">{cookie.success_count}</span></span>
                                                    {cookie.error_count > 0 && <span className="text-[var(--text-muted)]">Errors: <span className="text-red-400 font-medium">{cookie.error_count}</span></span>}
                                                    {cookie.use_count > 0 && <span className={`font-medium ${successRate >= 90 ? 'text-green-400' : successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>{successRate}% success</span>}
                                                    {cookie.cooldown_until && <span className="text-yellow-400">Cooldown until {new Date(cookie.cooldown_until).toLocaleTimeString()}</span>}
                                                </div>
                                                {cookie.last_error && <div className="mt-2 text-xs text-red-400 truncate">Last error: {cookie.last_error}</div>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => testCookie(cookie.id)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg text-[var(--text-muted)] hover:text-green-400 transition-colors" title="Test Cookie">
                                                    <CheckCircle className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleEdit(cookie)} className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors" title="Edit">
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleToggle(cookie)} className={`relative w-11 h-6 rounded-full transition-colors ${cookie.enabled ? 'bg-green-500' : 'bg-gray-600'}`} title={cookie.enabled ? 'Disable' : 'Enable'}>
                                                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${cookie.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </button>
                                                <button onClick={() => deleteCookie(cookie.id)} className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors" title="Delete">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
