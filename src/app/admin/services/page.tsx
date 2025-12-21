'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Server, RefreshCw, Power, Clock, Gauge, BarChart3, 
    CheckCircle, XCircle, AlertTriangle, RotateCcw, Wrench, 
    MessageSquare, Edit3, Cookie, ChevronRight, Plus, Info, Zap,
    Settings, Play, Monitor, Smartphone, Tablet, Trash2
} from 'lucide-react';
import Swal from 'sweetalert2';
import AdminGuard from '@/components/AdminGuard';
import { StatCard, AdminCard, PlatformIcon, StatusBadge, type PlatformId } from '@/components/admin';
import { useServices, useCookieStats, useBrowserProfiles, PLATFORM_OPTIONS, BROWSER_OPTIONS, DEVICE_OPTIONS } from '@/hooks/admin';
import CookiePoolModal from '../cookies/CookiePoolModal';
import { faFacebook, faInstagram, faWeibo, faTwitter } from '@fortawesome/free-brands-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

type CookiePlatform = 'facebook' | 'instagram' | 'weibo' | 'twitter';

const COOKIE_PLATFORMS: { id: CookiePlatform; name: string; icon: IconDefinition; color: string; bgColor: string; required: string }[] = [
    { id: 'facebook', name: 'Facebook', icon: faFacebook, color: 'text-blue-500', bgColor: 'bg-blue-500/10', required: 'c_user, xs' },
    { id: 'instagram', name: 'Instagram', icon: faInstagram, color: 'text-pink-500', bgColor: 'bg-pink-500/10', required: 'sessionid' },
    { id: 'twitter', name: 'Twitter', icon: faTwitter, color: 'text-sky-400', bgColor: 'bg-sky-400/10', required: 'auth_token, ct0' },
    { id: 'weibo', name: 'Weibo', icon: faWeibo, color: 'text-orange-500', bgColor: 'bg-orange-500/10', required: 'SUB' },
];

export default function ServicesPage() {
    return (
        <AdminGuard requiredRole="admin">
            <ServicesContent />
        </AdminGuard>
    );
}

function ServicesContent() {
    const [activeTab, setActiveTab] = useState<'platforms' | 'pools' | 'settings'>('platforms');
    const [poolSubTab, setPoolSubTab] = useState<'cookies' | 'browserprofiles'>('cookies');
    const [selectedCookiePlatform, setSelectedCookiePlatform] = useState<CookiePlatform | null>(null);
    const [localConfig, setLocalConfig] = useState<Record<string, { rateLimit: number; cacheTime: number; disabledMessage: string }>>({});
    
    const { 
        config, platforms, loading, togglingPlatform, error, refetch,
        togglePlatform, updatePlatform, updateGlobal, resetStats 
    } = useServices();
    
    const { stats: cookieStats, refetch: refetchCookies, getStats } = useCookieStats();
    const { profiles: browserProfiles, totals: bpTotals, loading: bpLoading, deleteProfile, updateProfile, createProfile, refetch: refetchBP } = useBrowserProfiles();

    const handleResetStats = async (platformId?: string) => {
        const result = await Swal.fire({
            title: platformId ? `Reset ${platformId} stats?` : 'Reset ALL stats?',
            text: 'This will clear all request statistics.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (result.isConfirmed) {
            await resetStats(platformId);
        }
    };

    // Local state for inputs (debounced updates)
    const getLocalValue = (platformId: string, field: 'rateLimit' | 'cacheTime' | 'disabledMessage') => {
        const platform = platforms.find(p => p.id === platformId);
        return localConfig[platformId]?.[field] ?? platform?.[field] ?? (field === 'disabledMessage' ? '' : 0);
    };

    const setLocalValue = (platformId: string, field: 'rateLimit' | 'cacheTime' | 'disabledMessage', value: number | string) => {
        setLocalConfig(prev => ({
            ...prev,
            [platformId]: { ...prev[platformId], [field]: value }
        }));
    };

    const commitUpdate = (platformId: string, field: 'rateLimit' | 'cacheTime' | 'disabledMessage') => {
        const value = localConfig[platformId]?.[field];
        if (value !== undefined) {
            updatePlatform(platformId, { [field]: value });
        }
    };

    if (loading && !config) {
        return (
            <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
                <RefreshCw className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            </div>
        );
    }

    if (error || !config) {
        return (
            <div className="p-6 lg:p-8">
                <div className="text-center text-red-400">Failed to load config</div>
            </div>
        );
    }

    const enabledCount = platforms.filter(p => p.enabled).length;
    const totalRequests = platforms.reduce((sum, p) => sum + p.stats.totalRequests, 0);
    const avgSuccessRate = platforms.length > 0 
        ? platforms.reduce((sum, p) => {
            const rate = p.stats.totalRequests > 0 
                ? (p.stats.successCount / p.stats.totalRequests) * 100 
                : 100;
            return sum + rate;
        }, 0) / platforms.length
        : 100;

    // Cookie stats summary
    const totalCookies = cookieStats.reduce((sum, s) => sum + s.total, 0);
    const healthyCookies = cookieStats.reduce((sum, s) => sum + s.healthy_count, 0);

    return (
        <div className="p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Server className="w-6 h-6 text-[var(--accent-primary)]" />
                                Services
                            </h1>
                            <p className="text-[var(--text-muted)] text-sm">Platform control & cookie management</p>
                        </div>
                        {/* Status Badge */}
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            config.maintenanceType === 'off' 
                                ? 'bg-green-500/20 text-green-400' 
                                : config.maintenanceType === 'api'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : 'bg-red-500/20 text-red-400'
                        }`}>
                            {config.maintenanceType === 'off' ? 'ONLINE' : config.maintenanceType === 'api' ? 'API MAINTENANCE' : 'FULL MAINTENANCE'}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => handleResetStats()}
                            className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm hover:bg-[var(--bg-card)] transition-colors flex items-center gap-2"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset Stats
                        </button>
                        <button
                            onClick={() => { refetch(); refetchCookies(); refetchBP(); }}
                            disabled={loading}
                            className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-card)] transition-colors"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                    <StatCard 
                        icon={<Power className="w-5 h-5" />} 
                        label="Active Services" 
                        value={`${enabledCount}/${platforms.length}`}
                        color="text-green-400"
                    />
                    <StatCard 
                        icon={<BarChart3 className="w-5 h-5" />} 
                        label="Total Requests" 
                        value={totalRequests.toLocaleString()}
                        color="text-blue-400"
                    />
                    <StatCard 
                        icon={<CheckCircle className="w-5 h-5" />} 
                        label="Success Rate" 
                        value={`${avgSuccessRate.toFixed(1)}%`}
                        color="text-emerald-400"
                    />
                    <StatCard 
                        icon={<Cookie className="w-5 h-5" />} 
                        label="Cookies" 
                        value={`${healthyCookies}/${totalCookies}`}
                        color="text-orange-400"
                    />
                    <StatCard 
                        icon={<Wrench className="w-5 h-5" />} 
                        label="Maintenance" 
                        value={config.maintenanceType === 'off' ? 'OFF' : config.maintenanceType === 'api' ? 'API' : 'FULL'}
                        color={config.maintenanceType === 'full' ? 'text-red-400' : config.maintenanceType === 'api' ? 'text-yellow-400' : 'text-[var(--text-muted)]'}
                    />
                    <StatCard 
                        icon={<Play className="w-5 h-5" />} 
                        label="Playground" 
                        value={config.playgroundEnabled ? 'ON' : 'OFF'}
                        color={config.playgroundEnabled ? 'text-blue-400' : 'text-[var(--text-muted)]'}
                    />
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('platforms')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === 'platforms' 
                                ? 'bg-[var(--accent-primary)] text-white' 
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                        }`}
                    >
                        <Server className="w-4 h-4" /> Platforms
                    </button>
                    <button
                        onClick={() => setActiveTab('pools')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === 'pools' 
                                ? 'bg-[var(--accent-primary)] text-white' 
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                        }`}
                    >
                        <Cookie className="w-4 h-4" /> Pools
                        <span className="px-1.5 py-0.5 rounded text-xs bg-white/20">{totalCookies + bpTotals.total}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            activeTab === 'settings' 
                                ? 'bg-[var(--accent-primary)] text-white' 
                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                        }`}
                    >
                        <Settings className="w-4 h-4" /> Settings
                    </button>
                </div>

                {/* Platforms Tab */}
                {activeTab === 'platforms' && (
                    <div className="grid gap-4">
                        {platforms.map((platform, idx) => (
                            <motion.div
                                key={platform.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="glass-card p-5"
                            >
                                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                    {/* Platform Info */}
                                    <div className="flex items-center gap-3 lg:w-48">
                                        <PlatformIcon platform={platform.id as PlatformId} size="lg" />
                                        <div>
                                            <h3 className="font-semibold">{platform.name}</h3>
                                            <p className="text-xs text-[var(--text-muted)]">{platform.method}</p>
                                        </div>
                                    </div>

                                    {/* Toggle */}
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => togglePlatform(platform.id, !platform.enabled)}
                                            disabled={togglingPlatform === platform.id}
                                            className={`relative w-12 h-6 rounded-full transition-colors ${
                                                platform.enabled ? 'bg-green-500' : 'bg-[var(--bg-secondary)]'
                                            } ${togglingPlatform === platform.id ? 'opacity-70' : ''}`}
                                        >
                                            {togglingPlatform === platform.id ? (
                                                <span className="absolute inset-0 flex items-center justify-center">
                                                    <RefreshCw className="w-3 h-3 animate-spin text-white" />
                                                </span>
                                            ) : (
                                                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                                                    platform.enabled ? 'left-7' : 'left-1'
                                                }`} />
                                            )}
                                        </button>
                                        <StatusBadge status={platform.enabled ? 'active' : 'inactive'} />
                                    </div>

                                    {/* Spacer */}
                                    <div className="flex-1" />

                                    {/* Controls - moved to right */}
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <Gauge className="w-4 h-4 text-[var(--text-muted)]" />
                                            <input
                                                type="number"
                                                value={getLocalValue(platform.id, 'rateLimit')}
                                                onChange={(e) => setLocalValue(platform.id, 'rateLimit', parseInt(e.target.value) || 10)}
                                                onBlur={() => commitUpdate(platform.id, 'rateLimit')}
                                                className="w-16 px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-center"
                                                min={1}
                                                max={100}
                                            />
                                            <span className="text-xs text-[var(--text-muted)]">req/min</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                                            <input
                                                type="number"
                                                value={getLocalValue(platform.id, 'cacheTime')}
                                                onChange={(e) => setLocalValue(platform.id, 'cacheTime', parseInt(e.target.value) || 300)}
                                                onBlur={() => commitUpdate(platform.id, 'cacheTime')}
                                                className="w-20 px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-center"
                                                min={0}
                                                max={3600}
                                            />
                                            <span className="text-xs text-[var(--text-muted)]">sec cache</span>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Disabled Message */}
                                {!platform.enabled && (
                                    <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                                        <div className="flex items-center gap-2">
                                            <Edit3 className="w-4 h-4 text-[var(--text-muted)]" />
                                            <span className="text-xs text-[var(--text-muted)]">Disabled message:</span>
                                            <input
                                                type="text"
                                                value={getLocalValue(platform.id, 'disabledMessage')}
                                                onChange={(e) => setLocalValue(platform.id, 'disabledMessage', e.target.value)}
                                                onBlur={() => commitUpdate(platform.id, 'disabledMessage')}
                                                className="flex-1 px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                                placeholder="Message shown when disabled..."
                                            />
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Pools Tab (Cookies + User-Agents) */}
                {activeTab === 'pools' && (
                    <div className="space-y-6">
                        {/* Sub-tabs */}
                        <div className="flex gap-2 p-1 rounded-lg bg-[var(--bg-secondary)] w-fit">
                            <button
                                onClick={() => setPoolSubTab('cookies')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    poolSubTab === 'cookies' 
                                        ? 'bg-[var(--bg-card)] shadow-sm' 
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <Cookie className="w-4 h-4" />
                                Cookies
                                <span className="px-1.5 py-0.5 rounded text-xs bg-orange-500/20 text-orange-400">{totalCookies}</span>
                            </button>
                            <button
                                onClick={() => setPoolSubTab('browserprofiles')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                    poolSubTab === 'browserprofiles' 
                                        ? 'bg-[var(--bg-card)] shadow-sm' 
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                            >
                                <Monitor className="w-4 h-4" />
                                Browser Profiles
                                <span className="px-1.5 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">{bpTotals.total}</span>
                            </button>
                        </div>

                        {/* Cookie Pool Sub-tab */}
                        {poolSubTab === 'cookies' && (
                            <>
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
                                                onClick={() => setSelectedCookiePlatform(platform.id)}
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
                            </>
                        )}

                        {/* Browser Profiles Sub-tab */}
                        {poolSubTab === 'browserprofiles' && (
                            <BrowserProfilesSection 
                                profiles={browserProfiles}
                                totals={bpTotals}
                                loading={bpLoading}
                                onDelete={deleteProfile}
                                onUpdate={updateProfile}
                                onAdd={createProfile}
                                onRefresh={refetchBP}
                            />
                        )}
                    </div>
                )}

                {/* Settings Tab */}
                {activeTab === 'settings' && (
                    <div className="space-y-6">
                        {/* Maintenance Mode Section */}
                        <MaintenanceModeCard config={config} refetch={refetch} />

                        {/* Guest Playground Section */}
                        <AdminCard className="p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-2 rounded-lg bg-blue-500/10">
                                    <Play className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold">Guest Playground</h3>
                                    <p className="text-xs text-[var(--text-muted)]">Settings for /advanced page API testing</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {/* Playground Enabled */}
                                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                                    <div>
                                        <div className="font-medium text-sm">Enable Playground</div>
                                        <div className="text-xs text-[var(--text-muted)]">Allow guests to test API on /advanced</div>
                                    </div>
                                    <button
                                        onClick={() => updateGlobal({ playgroundEnabled: !config.playgroundEnabled })}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${
                                            config.playgroundEnabled ? 'bg-green-500' : 'bg-[var(--bg-card)]'
                                        }`}
                                    >
                                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                                            config.playgroundEnabled ? 'left-7' : 'left-1'
                                        }`} />
                                    </button>
                                </div>

                                {/* Playground Rate Limit */}
                                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                                    <div>
                                        <div className="font-medium text-sm">Playground Rate Limit</div>
                                        <div className="text-xs text-[var(--text-muted)]">Max requests per 2 minutes</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            defaultValue={config.playgroundRateLimit}
                                            onBlur={(e) => updateGlobal({ playgroundRateLimit: parseInt(e.target.value) || 5 })}
                                            className="w-20 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-sm text-center"
                                            min={1}
                                            max={50}
                                        />
                                        <span className="text-xs text-[var(--text-muted)]">req/2min</span>
                                    </div>
                                </div>
                            </div>
                        </AdminCard>

                        {/* Info */}
                        <AdminCard>
                            <div className="flex items-start gap-3">
                                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                                <div className="text-sm flex-1">
                                    <p className="font-medium text-[var(--text-secondary)] mb-2">Settings Info</p>
                                    <ul className="space-y-1 text-xs text-[var(--text-muted)]">
                                        <li>• <span className="text-yellow-400">Maintenance API</span> - Blocks /api requests, pages still accessible</li>
                                        <li>• <span className="text-red-400">Maintenance Full</span> - Redirects all users to /maintenance page</li>
                                        <li>• <span className="text-blue-400">Playground</span> - Guest API testing at /advanced (separate rate limit)</li>
                                    </ul>
                                </div>
                            </div>
                        </AdminCard>
                    </div>
                )}

                {/* Last Updated */}
                <div className="text-center text-xs text-[var(--text-muted)]">
                    Last updated: {new Date(config.lastUpdated).toLocaleString()}
                </div>
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

// Simple Maintenance Details Component
function MaintenanceDetails() {
    const [fields, setFields] = useState({
        content: '',
        lastUpdated: '',
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await fetch('/api/admin/settings');
                const data = await res.json();
                if (data.success && data.data) {
                    setFields({
                        content: data.data.maintenance_content || '',
                        lastUpdated: data.data.maintenance_last_updated || '',
                    });
                }
            } catch { /* ignore */ }
            setLoading(false);
        };
        fetchDetails();
    }, []);

    const saveField = async (key: string, value: string) => {
        await fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [key]: value })
        });
    };

    const updateField = (key: keyof typeof fields, value: string) => {
        setFields(prev => ({ ...prev, [key]: value }));
    };

    const updateLastUpdated = () => {
        const now = new Date().toLocaleString('id-ID', { 
            dateStyle: 'medium', 
            timeStyle: 'short' 
        });
        updateField('lastUpdated', now);
        saveField('maintenance_last_updated', now);
    };

    if (loading) return <div className="h-32 bg-[var(--bg-secondary)] rounded-lg animate-pulse" />;

    return (
        <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
            {/* Content (Full message) */}
            <div>
                <label className="text-sm text-[var(--text-muted)] mb-2 block">Content (Full message)</label>
                <textarea
                    value={fields.content}
                    onChange={(e) => updateField('content', e.target.value)}
                    onBlur={() => {
                        saveField('maintenance_content', fields.content);
                        updateLastUpdated();
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm resize-none"
                    rows={3}
                    placeholder="Detailed maintenance message shown to users..."
                />
            </div>

            {/* Last Updated */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                <div>
                    <div className="text-sm text-[var(--text-muted)]">Last Status Updated</div>
                    <div className="text-sm font-medium">
                        {fields.lastUpdated || 'Never'}
                    </div>
                </div>
                <button
                    onClick={updateLastUpdated}
                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs hover:border-[var(--accent-primary)]/50 transition-colors"
                >
                    Update Now
                </button>
            </div>
        </div>
    );
}


// Maintenance Mode Card with loading states
interface MaintenanceModeCardProps {
    config: { maintenanceType: string; maintenanceMessage: string };
    refetch: () => void;
}

function MaintenanceModeCard({ config, refetch }: MaintenanceModeCardProps) {
    const [updating, setUpdating] = useState<string | null>(null);

    const handleTypeChange = async (value: string) => {
        setUpdating(value);
        try {
            await fetch('/api/admin/services', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maintenanceType: value })
            });
            refetch();
        } finally {
            setUpdating(null);
        }
    };

    const options = [
        { value: 'off', label: 'Off', desc: 'All services running', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30' },
        { value: 'api', label: 'API Only', desc: 'Block API, pages OK', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
        { value: 'full', label: 'Full', desc: 'Redirect all users', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
    ];

    return (
        <AdminCard className="p-5">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Wrench className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                    <h3 className="font-semibold">Maintenance Mode</h3>
                    <p className="text-xs text-[var(--text-muted)]">Control site availability</p>
                </div>
            </div>
            
            <div className="space-y-4">
                {/* Type Selector */}
                <div className="grid grid-cols-3 gap-3">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => handleTypeChange(opt.value)}
                            disabled={updating !== null}
                            className={`p-3 rounded-xl border text-left transition-all relative ${
                                config.maintenanceType === opt.value 
                                    ? opt.bg 
                                    : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--accent-primary)]/50'
                            } ${updating !== null ? 'opacity-70' : ''}`}
                        >
                            {updating === opt.value && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                </div>
                            )}
                            <div className={`font-medium ${config.maintenanceType === opt.value ? opt.color : ''}`}>
                                {opt.label}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">{opt.desc}</div>
                        </button>
                    ))}
                </div>

                {/* Message */}
                <div>
                    <label className="text-sm text-[var(--text-muted)] mb-2 block">Maintenance Message</label>
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-[var(--text-muted)]" />
                        <input
                            type="text"
                            defaultValue={config.maintenanceMessage}
                            onBlur={async (e) => {
                                await fetch('/api/admin/services', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ maintenanceMessage: e.target.value })
                                });
                                refetch();
                            }}
                            className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                            placeholder="Message shown during maintenance..."
                        />
                    </div>
                </div>

                {/* Details (shown when maintenance is active) */}
                {config.maintenanceType !== 'off' && (
                    <MaintenanceDetails />
                )}
            </div>
        </AdminCard>
    );
}


// Browser Profiles Section Component
interface BrowserProfilesSectionProps {
    profiles: Array<{
        id: string;
        platform: string;
        label: string;
        user_agent: string;
        sec_ch_ua: string | null;
        sec_ch_ua_platform: string | null;
        sec_ch_ua_mobile: string;
        accept_language: string;
        browser: string;
        device_type: string;
        os: string | null;
        is_chromium: boolean;
        priority: number;
        enabled: boolean;
        use_count: number;
        success_count: number;
        error_count: number;
        note: string | null;
    }>;
    totals: { total: number; enabled: number; totalUses: number; totalSuccess: number; totalErrors: number };
    loading: boolean;
    onDelete: (id: string) => Promise<boolean>;
    onUpdate: (id: string, updates: Record<string, unknown>) => Promise<boolean>;
    onAdd: (data: { label: string; user_agent: string; platform?: string; browser?: string; device_type?: string; sec_ch_ua?: string | null; sec_ch_ua_platform?: string | null; sec_ch_ua_mobile?: string; accept_language?: string; os?: string | null; is_chromium?: boolean; priority?: number; note?: string | null }) => Promise<unknown>;
    onRefresh: () => void;
}

function BrowserProfilesSection({ profiles, totals, loading, onDelete, onUpdate, onAdd, onRefresh }: BrowserProfilesSectionProps) {
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newProfile, setNewProfile] = useState({
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
        note: '',
    });
    const [saving, setSaving] = useState(false);

    const resetForm = () => {
        setNewProfile({
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
            note: '',
        });
    };

    const handleAdd = async () => {
        if (!newProfile.user_agent.trim() || !newProfile.label.trim()) return;
        setSaving(true);
        const result = await onAdd({
            ...newProfile,
            sec_ch_ua: newProfile.sec_ch_ua || null,
            sec_ch_ua_platform: newProfile.sec_ch_ua_platform || null,
            os: newProfile.os || null,
            note: newProfile.note || null,
        });
        if (result) {
            resetForm();
            setShowAddForm(false);
        }
        setSaving(false);
    };

    const handleDelete = async (id: string) => {
        const result = await Swal.fire({
            title: 'Delete Profile?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (result.isConfirmed) {
            await onDelete(id);
        }
    };

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
            <div className="text-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[var(--accent-primary)]" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="glass-card p-3 text-center">
                    <div className="text-2xl font-bold">{totals.total}</div>
                    <div className="text-xs text-[var(--text-muted)]">Total</div>
                </div>
                <div className="glass-card p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">{totals.enabled}</div>
                    <div className="text-xs text-[var(--text-muted)]">Enabled</div>
                </div>
                <div className="glass-card p-3 text-center">
                    <div className="text-2xl font-bold text-blue-400">{totals.totalUses.toLocaleString()}</div>
                    <div className="text-xs text-[var(--text-muted)]">Uses</div>
                </div>
                <div className="glass-card p-3 text-center">
                    <div className="text-2xl font-bold text-green-400">{totals.totalSuccess.toLocaleString()}</div>
                    <div className="text-xs text-[var(--text-muted)]">Success</div>
                </div>
                <div className="glass-card p-3 text-center">
                    <div className="text-2xl font-bold text-red-400">{totals.totalErrors.toLocaleString()}</div>
                    <div className="text-xs text-[var(--text-muted)]">Errors</div>
                </div>
            </div>

            {/* Add Button */}
            <div className="flex justify-end">
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Add Browser Profile
                </button>
            </div>

            {/* Add Form */}
            <AnimatePresence>
                {showAddForm && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="glass-card p-4 space-y-4"
                    >
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className="text-xs text-[var(--text-muted)] mb-1 block">Label *</label>
                                <input
                                    type="text"
                                    value={newProfile.label}
                                    onChange={(e) => setNewProfile(p => ({ ...p, label: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                    placeholder="Chrome 143 Windows"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[var(--text-muted)] mb-1 block">Platform</label>
                                <select
                                    value={newProfile.platform}
                                    onChange={(e) => setNewProfile(p => ({ ...p, platform: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                >
                                    {PLATFORM_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-[var(--text-muted)] mb-1 block">Browser</label>
                                <select
                                    value={newProfile.browser}
                                    onChange={(e) => {
                                        const browser = e.target.value;
                                        const isChromium = ['chrome', 'edge', 'opera'].includes(browser);
                                        setNewProfile(p => ({ ...p, browser, is_chromium: isChromium }));
                                    }}
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                >
                                    {BROWSER_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-[var(--text-muted)] mb-1 block">Device</label>
                                <select
                                    value={newProfile.device_type}
                                    onChange={(e) => setNewProfile(p => ({ ...p, device_type: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                >
                                    {DEVICE_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-[var(--text-muted)] mb-1 block">User-Agent String *</label>
                            <textarea
                                value={newProfile.user_agent}
                                onChange={(e) => setNewProfile(p => ({ ...p, user_agent: e.target.value }))}
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm resize-none font-mono"
                                rows={2}
                                placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36..."
                            />
                        </div>

                        {/* Chromium-specific headers */}
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                            <input
                                type="checkbox"
                                id="is_chromium"
                                checked={newProfile.is_chromium}
                                onChange={(e) => setNewProfile(p => ({ ...p, is_chromium: e.target.checked }))}
                                className="w-4 h-4 rounded"
                            />
                            <label htmlFor="is_chromium" className="text-sm">
                                Is Chromium-based (has Sec-Ch-* headers)
                            </label>
                        </div>

                        {newProfile.is_chromium && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-[var(--text-muted)] mb-1 block">Sec-Ch-Ua</label>
                                    <input
                                        type="text"
                                        value={newProfile.sec_ch_ua}
                                        onChange={(e) => setNewProfile(p => ({ ...p, sec_ch_ua: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono"
                                        placeholder='"Google Chrome";v="143", "Chromium";v="143"...'
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--text-muted)] mb-1 block">Sec-Ch-Ua-Platform</label>
                                    <input
                                        type="text"
                                        value={newProfile.sec_ch_ua_platform}
                                        onChange={(e) => setNewProfile(p => ({ ...p, sec_ch_ua_platform: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono"
                                        placeholder='"Windows"'
                                    />
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                                <label className="text-xs text-[var(--text-muted)] mb-1 block">OS</label>
                                <select
                                    value={newProfile.os}
                                    onChange={(e) => setNewProfile(p => ({ ...p, os: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                >
                                    <option value="windows">Windows</option>
                                    <option value="macos">macOS</option>
                                    <option value="linux">Linux</option>
                                    <option value="ios">iOS</option>
                                    <option value="android">Android</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-[var(--text-muted)] mb-1 block">Accept-Language</label>
                                <input
                                    type="text"
                                    value={newProfile.accept_language}
                                    onChange={(e) => setNewProfile(p => ({ ...p, accept_language: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                    placeholder="en-US,en;q=0.9"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[var(--text-muted)] mb-1 block">Priority</label>
                                <input
                                    type="number"
                                    value={newProfile.priority}
                                    onChange={(e) => setNewProfile(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                    min={0}
                                    max={100}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-[var(--text-muted)] mb-1 block">Note</label>
                                <input
                                    type="text"
                                    value={newProfile.note}
                                    onChange={(e) => setNewProfile(p => ({ ...p, note: e.target.value }))}
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                    placeholder="Optional note..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button onClick={() => { setShowAddForm(false); resetForm(); }} className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] text-sm">
                                Cancel
                            </button>
                            <button 
                                onClick={handleAdd} 
                                disabled={saving || !newProfile.user_agent.trim() || !newProfile.label.trim()} 
                                className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm disabled:opacity-50"
                            >
                                {saving ? 'Adding...' : 'Add Profile'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Profile List */}
            {profiles.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)]">
                    No browser profiles found. Run migration sql-7-browser-profiles.sql first!
                </div>
            ) : (
                <div className="space-y-2">
                    {profiles.map((profile) => (
                        <motion.div
                            key={profile.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-card p-4"
                        >
                            {editingId === profile.id ? (
                                <ProfileEditForm 
                                    profile={profile} 
                                    onSave={async (updates) => {
                                        await onUpdate(profile.id, updates);
                                        setEditingId(null);
                                    }}
                                    onCancel={() => setEditingId(null)}
                                />
                            ) : (
                                <div className="flex items-center gap-4">
                                    <div className="p-2 rounded-lg bg-[var(--bg-secondary)]">
                                        <DeviceIcon type={profile.device_type} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{profile.label}</span>
                                            <span className={`text-xs ${getBrowserColor(profile.browser)}`}>
                                                {profile.browser}
                                            </span>
                                            {profile.is_chromium && (
                                                <span className="px-1.5 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
                                                    Chromium
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)] truncate font-mono mt-1">
                                            {profile.user_agent.substring(0, 60)}...
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mt-1">
                                            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)]">{profile.platform}</span>
                                            <span className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)]">{profile.device_type}</span>
                                            <span>Priority: {profile.priority}</span>
                                            <span>{profile.use_count} uses</span>
                                            <span className="text-green-400">{profile.success_count} ✓</span>
                                            <span className="text-red-400">{profile.error_count} ✗</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setEditingId(profile.id)}
                                            className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg text-[var(--text-muted)]"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => onUpdate(profile.id, { enabled: !profile.enabled })}
                                            className={`w-10 h-5 rounded-full transition-colors ${profile.enabled ? 'bg-green-500' : 'bg-gray-600'}`}
                                        >
                                            <span className={`block w-4 h-4 rounded-full bg-white transition-all ${profile.enabled ? 'ml-5' : 'ml-0.5'}`} />
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(profile.id)} 
                                            className="p-2 hover:bg-red-500/20 rounded-lg text-red-400"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Info */}
            <AdminCard>
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm flex-1">
                        <p className="font-medium text-[var(--text-secondary)] mb-2">Browser Profiles System</p>
                        <ul className="space-y-1 text-xs text-[var(--text-muted)]">
                            <li>• <span className="text-purple-400">Full Headers</span> - Complete browser fingerprint including Sec-Ch-* headers</li>
                            <li>• <span className="text-blue-400">Priority</span> - Higher priority profiles are selected more often</li>
                            <li>• <span className="text-green-400">Platform-specific</span> - Set profiles for specific platforms or use &quot;all&quot;</li>
                            <li>• <span className="text-orange-400">Chromium</span> - Chrome, Edge, Opera have Sec-Ch-* headers; Firefox/Safari don&apos;t</li>
                        </ul>
                    </div>
                </div>
            </AdminCard>
        </div>
    );
}

// Profile Edit Form (inline)
interface ProfileEditFormProps {
    profile: {
        id: string;
        platform: string;
        label: string;
        user_agent: string;
        sec_ch_ua: string | null;
        sec_ch_ua_platform: string | null;
        accept_language: string;
        browser: string;
        device_type: string;
        os: string | null;
        is_chromium: boolean;
        priority: number;
        note: string | null;
    };
    onSave: (updates: Record<string, unknown>) => Promise<void>;
    onCancel: () => void;
}

function ProfileEditForm({ profile, onSave, onCancel }: ProfileEditFormProps) {
    const [form, setForm] = useState({
        label: profile.label,
        platform: profile.platform,
        browser: profile.browser,
        device_type: profile.device_type,
        user_agent: profile.user_agent,
        sec_ch_ua: profile.sec_ch_ua || '',
        sec_ch_ua_platform: profile.sec_ch_ua_platform || '',
        accept_language: profile.accept_language,
        os: profile.os || 'windows',
        is_chromium: profile.is_chromium,
        priority: profile.priority,
        note: profile.note || '',
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await onSave({
            ...form,
            sec_ch_ua: form.sec_ch_ua || null,
            sec_ch_ua_platform: form.sec_ch_ua_platform || null,
            os: form.os || null,
            note: form.note || null,
        });
        setSaving(false);
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                    <label className="text-xs text-[var(--text-muted)] mb-1 block">Label</label>
                    <input
                        type="text"
                        value={form.label}
                        onChange={(e) => setForm(p => ({ ...p, label: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                    />
                </div>
                <div>
                    <label className="text-xs text-[var(--text-muted)] mb-1 block">Platform</label>
                    <select
                        value={form.platform}
                        onChange={(e) => setForm(p => ({ ...p, platform: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                    >
                        {PLATFORM_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-[var(--text-muted)] mb-1 block">Browser</label>
                    <select
                        value={form.browser}
                        onChange={(e) => {
                            const browser = e.target.value;
                            const isChromium = ['chrome', 'edge', 'opera'].includes(browser);
                            setForm(p => ({ ...p, browser, is_chromium: isChromium }));
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                    >
                        {BROWSER_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-xs text-[var(--text-muted)] mb-1 block">Priority</label>
                    <input
                        type="number"
                        value={form.priority}
                        onChange={(e) => setForm(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                        min={0}
                        max={100}
                    />
                </div>
            </div>
            <div>
                <label className="text-xs text-[var(--text-muted)] mb-1 block">User-Agent</label>
                <textarea
                    value={form.user_agent}
                    onChange={(e) => setForm(p => ({ ...p, user_agent: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm resize-none font-mono"
                    rows={2}
                />
            </div>
            {form.is_chromium && (
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-[var(--text-muted)] mb-1 block">Sec-Ch-Ua</label>
                        <input
                            type="text"
                            value={form.sec_ch_ua}
                            onChange={(e) => setForm(p => ({ ...p, sec_ch_ua: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-[var(--text-muted)] mb-1 block">Sec-Ch-Ua-Platform</label>
                        <input
                            type="text"
                            value={form.sec_ch_ua_platform}
                            onChange={(e) => setForm(p => ({ ...p, sec_ch_ua_platform: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono"
                        />
                    </div>
                </div>
            )}
            <div className="flex gap-2 justify-end">
                <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] text-sm">
                    Cancel
                </button>
                <button 
                    onClick={handleSave} 
                    disabled={saving} 
                    className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    );
}
