'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    Server, RefreshCw, Power, Clock, Gauge, BarChart3, 
    CheckCircle, XCircle, AlertTriangle, RotateCcw, Wrench, MessageSquare, Edit3, Key
} from 'lucide-react';
import Swal from 'sweetalert2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebook, faInstagram, faYoutube, faWeibo, faTwitter } from '@fortawesome/free-brands-svg-icons';
import { faMusic, faGlobe } from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import AdminGuard from '@/components/AdminGuard';

interface PlatformConfig {
    id: string;
    name: string;
    enabled: boolean;
    method: string;
    rateLimit: number;
    cacheTime: number;
    disabledMessage: string;
    lastUpdated: string;
    stats: {
        totalRequests: number;
        successCount: number;
        errorCount: number;
        avgResponseTime: number;
    };
}

interface ServiceConfig {
    platforms: Record<string, PlatformConfig>;
    globalRateLimit: number;
    maintenanceMode: boolean;
    maintenanceMessage: string;
    apiKeyRequired: boolean;
    lastUpdated: string;
}

const PLATFORM_ICONS: Record<string, { icon: IconDefinition; color: string }> = {
    facebook: { icon: faFacebook, color: 'text-blue-500' },
    instagram: { icon: faInstagram, color: 'text-pink-500' },
    twitter: { icon: faTwitter, color: 'text-sky-400' },
    tiktok: { icon: faMusic, color: 'text-pink-400' },
    youtube: { icon: faYoutube, color: 'text-red-500' },
    weibo: { icon: faWeibo, color: 'text-orange-500' },
    douyin: { icon: faMusic, color: 'text-pink-400' },
};

export default function ServicesPage() {
    return (
        <AdminGuard requiredRole="admin">
            <ServicesContent />
        </AdminGuard>
    );
}

function ServicesContent() {
    const [config, setConfig] = useState<ServiceConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/services');
            const data = await res.json();
            if (data.success) setConfig(data.data);
        } catch {
            // Failed to fetch config
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchConfig(); }, []);

    const updatePlatform = async (platformId: string, updates: Partial<PlatformConfig>) => {
        setSaving(platformId);
        try {
            const res = await fetch('/api/admin/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'updatePlatform', platformId, ...updates })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setConfig(prev => prev ? {
                    ...prev,
                    platforms: {
                        ...prev.platforms,
                        [platformId]: { ...prev.platforms[platformId], ...updates }
                    }
                } : null);
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: `${platformId} updated`,
                    showConfirmButton: false,
                    timer: 1500,
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                });
            } else {
                throw new Error(data.error || 'Failed to save');
            }
        } catch {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: `Failed to update ${platformId}`,
                showConfirmButton: false,
                timer: 2000,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
        } finally {
            setSaving(null);
        }
    };

    const toggleApiKey = async () => {
        if (!config) return;
        setSaving('apikey');
        try {
            const res = await fetch('/api/admin/services', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKeyRequired: !config.apiKeyRequired })
            });
            const data = await res.json();
            if (data.success) {
                setConfig(data.data);
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: `API Key ${!config.apiKeyRequired ? 'Required' : 'Optional'}`,
                    showConfirmButton: false,
                    timer: 2000,
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                });
            } else {
                throw new Error(data.error || 'Failed to save');
            }
        } catch {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: 'Failed to save API Key setting',
                showConfirmButton: false,
                timer: 2000,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
        } finally {
            setSaving(null);
        }
    };

    const resetStats = async (platformId?: string) => {
        const result = await Swal.fire({
            title: platformId ? `Reset ${platformId} stats?` : 'Reset ALL stats?',
            text: 'This will clear all request statistics. This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, reset!',
            cancelButtonText: 'Cancel',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });

        if (!result.isConfirmed) return;

        setSaving(platformId || 'all');
        try {
            await fetch('/api/admin/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resetStats', platformId })
            });
            fetchConfig();
            Swal.fire({
                title: 'Reset!',
                text: 'Statistics have been cleared.',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
        } catch {
            // Failed to reset stats
        } finally {
            setSaving(null);
        }
    };

    const toggleMaintenance = async () => {
        if (!config) return;
        
        const newState = !config.maintenanceMode;
        if (newState) {
            const result = await Swal.fire({
                title: 'Enable Maintenance Mode?',
                text: 'All API requests will be blocked until you disable it.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#f59e0b',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Enable',
                cancelButtonText: 'Cancel',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
            if (!result.isConfirmed) return;
        }

        setSaving('maintenance');
        try {
            const res = await fetch('/api/admin/services', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maintenanceMode: newState })
            });
            const data = await res.json();
            if (data.success) {
                setConfig(data.data);
                Swal.fire({
                    toast: true,
                    position: 'top-end',
                    icon: 'success',
                    title: `Maintenance ${newState ? 'Enabled' : 'Disabled'}`,
                    showConfirmButton: false,
                    timer: 2000,
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                });
            } else {
                throw new Error(data.error || 'Failed to save');
            }
        } catch {
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'error',
                title: 'Failed to save Maintenance setting',
                showConfirmButton: false,
                timer: 2000,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
        } finally {
            setSaving(null);
        }
    };

    if (loading) {
        return (
            <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
                <RefreshCw className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            </div>
        );
    }

    if (!config) {
        return (
            <div className="p-6 lg:p-8">
                <div className="text-center text-red-400">Failed to load config</div>
            </div>
        );
    }

    const platforms = Object.values(config.platforms);
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

    return (
        <div className="p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Server className="w-6 h-6 text-[var(--accent-primary)]" />
                            Service Control
                        </h1>
                        <p className="text-[var(--text-muted)] text-sm">Manage platform services</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => resetStats()}
                            disabled={saving === 'all'}
                            className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm hover:bg-[var(--bg-card)] transition-colors flex items-center gap-2"
                        >
                            <RotateCcw className={`w-4 h-4 ${saving === 'all' ? 'animate-spin' : ''}`} />
                            Reset All Stats
                        </button>
                        <button
                            onClick={fetchConfig}
                            disabled={loading}
                            className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-card)] transition-colors"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Maintenance Mode Banner */}
                {config.maintenanceMode && (
                    <motion.div 
                        initial={{ opacity: 0, y: -10 }} 
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <AlertTriangle className="w-5 h-5 text-yellow-400" />
                            <span className="text-yellow-400 font-medium">Maintenance Mode Active</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-[var(--text-muted)]" />
                            <input
                                type="text"
                                value={config.maintenanceMessage}
                                onChange={(e) => {
                                    setConfig(prev => prev ? { ...prev, maintenanceMessage: e.target.value } : null);
                                }}
                                onBlur={(e) => {
                                    fetch('/api/admin/services', {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ maintenanceMessage: e.target.value })
                                    });
                                }}
                                className="flex-1 px-3 py-1.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                placeholder="Maintenance message..."
                            />
                        </div>
                    </motion.div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
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
                        label="Avg Success Rate" 
                        value={`${avgSuccessRate.toFixed(1)}%`}
                        color="text-emerald-400"
                    />
                    <StatCard 
                        icon={<Wrench className="w-5 h-5" />} 
                        label="Maintenance" 
                        value={config.maintenanceMode ? 'ON' : 'OFF'}
                        color={config.maintenanceMode ? 'text-yellow-400' : 'text-[var(--text-muted)]'}
                        onClick={toggleMaintenance}
                        loading={saving === 'maintenance'}
                    />
                    <StatCard 
                        icon={<Key className="w-5 h-5" />} 
                        label="API Key" 
                        value={config.apiKeyRequired ? 'Required' : 'Optional'}
                        color={config.apiKeyRequired ? 'text-purple-400' : 'text-[var(--text-muted)]'}
                        onClick={toggleApiKey}
                        loading={saving === 'apikey'}
                    />
                </div>

                {/* Platform Cards */}
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
                                    {PLATFORM_ICONS[platform.id] ? (
                                        <FontAwesomeIcon 
                                            icon={PLATFORM_ICONS[platform.id].icon} 
                                            className={`w-7 h-7 ${PLATFORM_ICONS[platform.id].color}`} 
                                        />
                                    ) : (
                                        <FontAwesomeIcon icon={faGlobe} className="w-7 h-7 text-[var(--text-muted)]" />
                                    )}
                                    <div>
                                        <h3 className="font-semibold">{platform.name}</h3>
                                        <p className="text-xs text-[var(--text-muted)]">{platform.method}</p>
                                    </div>
                                </div>

                                {/* Toggle */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => updatePlatform(platform.id, { enabled: !platform.enabled })}
                                        disabled={saving === platform.id}
                                        className={`relative w-12 h-6 rounded-full transition-colors ${
                                            platform.enabled ? 'bg-green-500' : 'bg-[var(--bg-secondary)]'
                                        }`}
                                    >
                                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                                            platform.enabled ? 'left-7' : 'left-1'
                                        }`} />
                                    </button>
                                    <span className={`text-sm font-medium ${platform.enabled ? 'text-green-400' : 'text-[var(--text-muted)]'}`}>
                                        {platform.enabled ? 'Active' : 'Disabled'}
                                    </span>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="flex items-center gap-2">
                                        <Gauge className="w-4 h-4 text-[var(--text-muted)]" />
                                        <input
                                            type="number"
                                            value={platform.rateLimit}
                                            onChange={(e) => updatePlatform(platform.id, { rateLimit: parseInt(e.target.value) || 10 })}
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
                                            value={platform.cacheTime}
                                            onChange={(e) => updatePlatform(platform.id, { cacheTime: parseInt(e.target.value) || 300 })}
                                            className="w-20 px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-center"
                                            min={0}
                                            max={3600}
                                        />
                                        <span className="text-xs text-[var(--text-muted)]">sec cache</span>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-1">
                                        <BarChart3 className="w-4 h-4 text-blue-400" />
                                        <span>{platform.stats.totalRequests}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <CheckCircle className="w-4 h-4 text-green-400" />
                                        <span>{platform.stats.successCount}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <XCircle className="w-4 h-4 text-red-400" />
                                        <span>{platform.stats.errorCount}</span>
                                    </div>
                                    <div className="text-[var(--text-muted)]">
                                        ~{platform.stats.avgResponseTime.toFixed(0)}ms
                                    </div>
                                </div>
                            </div>
                            
                            {/* Disabled Message (shown when platform is disabled) */}
                            {!platform.enabled && (
                                <div className="mt-3 pt-3 border-t border-[var(--border-color)]">
                                    <div className="flex items-center gap-2">
                                        <Edit3 className="w-4 h-4 text-[var(--text-muted)]" />
                                        <span className="text-xs text-[var(--text-muted)]">Disabled message:</span>
                                        <input
                                            type="text"
                                            value={platform.disabledMessage}
                                            onChange={(e) => {
                                                setConfig(prev => prev ? {
                                                    ...prev,
                                                    platforms: {
                                                        ...prev.platforms,
                                                        [platform.id]: { ...platform, disabledMessage: e.target.value }
                                                    }
                                                } : null);
                                            }}
                                            onBlur={(e) => updatePlatform(platform.id, { disabledMessage: e.target.value } as Partial<PlatformConfig>)}
                                            className="flex-1 px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                            placeholder="Message shown when disabled..."
                                        />
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>

                {/* Last Updated */}
                <div className="text-center text-xs text-[var(--text-muted)]">
                    Last updated: {new Date(config.lastUpdated).toLocaleString()}
                </div>
            </div>
        </div>
    );
}

function StatCard({ 
    icon, label, value, color, onClick, loading 
}: { 
    icon: React.ReactNode; 
    label: string; 
    value: string; 
    color: string;
    onClick?: () => void;
    loading?: boolean;
}) {
    const Component = onClick ? 'button' : 'div';
    return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Component 
                onClick={onClick}
                className={`glass-card p-4 w-full text-left ${onClick ? 'cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors' : ''}`}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-[var(--bg-secondary)] ${color}`}>
                        {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : icon}
                    </div>
                    <div>
                        <p className="text-xs text-[var(--text-muted)]">{label}</p>
                        <p className="text-xl font-bold">{value}</p>
                    </div>
                </div>
            </Component>
        </motion.div>
    );
}
