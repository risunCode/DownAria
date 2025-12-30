'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
    Server, RefreshCw, Wrench, 
    CheckCircle, ShieldOff, ShieldAlert
} from 'lucide-react';
import Swal from 'sweetalert2';
import AdminGuard from '@/components/AdminGuard';
import { PlatformIcon, StatusBadge, type PlatformId } from '@/components/admin';
import { useServices } from '@/hooks/admin';

const ALL_PLATFORMS: PlatformId[] = [
    'facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'weibo',
    'bilibili', 'reddit', 'soundcloud', 'threads', 'pixiv',
    'eporner', 'pornhub', 'rule34video', 'erome'
];

type MaintenanceMode = 'off' | 'api' | 'all';

const MAINTENANCE_OPTIONS: { value: MaintenanceMode; label: string; description: string; icon: typeof CheckCircle; color: string }[] = [
    { value: 'off', label: 'Normal', description: 'All services operational', icon: CheckCircle, color: 'text-green-400' },
    { value: 'api', label: 'API Only', description: 'API disabled, pages accessible', icon: ShieldOff, color: 'text-yellow-400' },
    { value: 'all', label: 'Full Maintenance', description: 'Show maintenance page on homepage', icon: ShieldAlert, color: 'text-red-400' },
];

export default function PlatformsPage() {
    return (
        <AdminGuard requiredRole="admin">
            <PlatformsContent />
        </AdminGuard>
    );
}

function PlatformsContent() {
    const { 
        config, platforms, loading, togglingPlatform, error, refetch,
        togglePlatform, setMaintenanceMode 
    } = useServices();

    const [updatingMaintenance, setUpdatingMaintenance] = useState(false);

    const handleTogglePlatform = async (platformId: string, currentEnabled: boolean) => {
        const result = await Swal.fire({
            title: `${currentEnabled ? 'Disable' : 'Enable'} ${platformId}?`,
            text: currentEnabled 
                ? 'Users will not be able to download from this platform.' 
                : 'This platform will be available for downloads.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: currentEnabled ? '#ef4444' : '#22c55e',
            confirmButtonText: currentEnabled ? 'Disable' : 'Enable',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (result.isConfirmed) {
            await togglePlatform(platformId, !currentEnabled);
        }
    };

    const handleSetMaintenanceMode = async (mode: MaintenanceMode) => {
        if (mode === config?.maintenanceType) return;
        
        const option = MAINTENANCE_OPTIONS.find(o => o.value === mode)!;
        const result = await Swal.fire({
            title: `Set to ${option.label}?`,
            text: option.description,
            icon: mode === 'off' ? 'success' : 'warning',
            showCancelButton: true,
            confirmButtonColor: mode === 'off' ? '#22c55e' : mode === 'api' ? '#eab308' : '#ef4444',
            confirmButtonText: 'Confirm',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        
        if (result.isConfirmed) {
            setUpdatingMaintenance(true);
            await setMaintenanceMode(mode);
            setUpdatingMaintenance(false);
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
                <div className="text-center text-red-400">Failed to load platform configuration</div>
            </div>
        );
    }

    // Create a map for quick platform lookup
    const platformMap = new Map(platforms.map(p => [p.id, p]));
    const enabledCount = platforms.filter(p => p.enabled).length;

    return (
        <div className="p-6 lg:p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Server className="w-6 h-6 text-[var(--accent-primary)]" />
                                Platforms
                            </h1>
                            <p className="text-[var(--text-muted)] text-sm">
                                Manage platform availability • {enabledCount}/{platforms.length} active
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => refetch()}
                        disabled={loading}
                        className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-card)] transition-colors"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Maintenance Mode - At Top */}
                <div className="glass-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Wrench className="w-5 h-5 text-[var(--accent-primary)]" />
                        <h2 className="font-semibold">Maintenance Mode</h2>
                        {updatingMaintenance && <RefreshCw className="w-4 h-4 animate-spin text-[var(--text-muted)]" />}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {MAINTENANCE_OPTIONS.map((option) => {
                            const isSelected = config.maintenanceType === option.value;
                            const Icon = option.icon;
                            return (
                                <button
                                    key={option.value}
                                    onClick={() => handleSetMaintenanceMode(option.value)}
                                    disabled={updatingMaintenance}
                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                        isSelected
                                            ? option.value === 'off'
                                                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                                : option.value === 'api'
                                                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                                                    : 'bg-red-500/20 text-red-400 border border-red-500/50'
                                            : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-transparent hover:border-[var(--border-color)]'
                                    } ${updatingMaintenance ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{option.label}</span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                        {MAINTENANCE_OPTIONS.find(o => o.value === config.maintenanceType)?.description}
                    </p>
                </div>

                {/* Platform List - Vertical */}
                <div className="space-y-3">
                    {ALL_PLATFORMS.map((platformId, idx) => {
                        const platform = platformMap.get(platformId);
                        const isEnabled = platform?.enabled ?? false;
                        const isToggling = togglingPlatform === platformId;
                        
                        // Determine status
                        let status: 'active' | 'disabled' | 'warning' = 'disabled';
                        let statusLabel = 'Disabled';
                        
                        if (isEnabled) {
                            if (config.maintenanceType !== 'off') {
                                status = 'warning';
                                statusLabel = 'Maintenance';
                            } else {
                                status = 'active';
                                statusLabel = 'Active';
                            }
                        }

                        return (
                            <motion.div
                                key={platformId}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="glass-card p-4 hover:border-[var(--accent-primary)]/30 transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    {/* Left: Platform Info */}
                                    <div className="flex items-center gap-4">
                                        <PlatformIcon platform={platformId} size="lg" showBg />
                                        <div>
                                            <h3 className="font-semibold capitalize">{platformId}</h3>
                                            <StatusBadge status={status} label={statusLabel} />
                                        </div>
                                    </div>

                                    {/* Right: Stats + Toggle */}
                                    <div className="flex items-center gap-6">
                                        {/* Stats */}
                                        {platform && (
                                            <div className="hidden sm:flex items-center gap-4 text-xs">
                                                <div className="text-center">
                                                    <div className="text-[var(--text-muted)]">Requests</div>
                                                    <div className="font-semibold">{platform.stats.totalRequests.toLocaleString()}</div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-[var(--text-muted)]">Success</div>
                                                    <div className={`font-semibold ${
                                                        platform.stats.totalRequests > 0
                                                            ? (platform.stats.successCount / platform.stats.totalRequests) >= 0.9
                                                                ? 'text-green-400'
                                                                : (platform.stats.successCount / platform.stats.totalRequests) >= 0.7
                                                                    ? 'text-yellow-400'
                                                                    : 'text-red-400'
                                                            : 'text-[var(--text-muted)]'
                                                    }`}>
                                                        {platform.stats.totalRequests > 0
                                                            ? `${Math.round((platform.stats.successCount / platform.stats.totalRequests) * 100)}%`
                                                            : 'N/A'}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Toggle Switch */}
                                        <button
                                            onClick={() => handleTogglePlatform(platformId, isEnabled)}
                                            disabled={isToggling}
                                            className={`relative w-14 h-7 rounded-full transition-colors ${
                                                isEnabled ? 'bg-green-500' : 'bg-[var(--bg-secondary)] border border-[var(--border-color)]'
                                            } ${isToggling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            <span
                                                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                                                    isEnabled ? 'left-auto right-1' : 'left-1'
                                                }`}
                                            />
                                            {isToggling && (
                                                <RefreshCw className="absolute inset-0 m-auto w-3 h-3 animate-spin text-white" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Last Updated */}
                <div className="text-center text-xs text-[var(--text-muted)]">
                    Last updated: {new Date(config.lastUpdated).toLocaleString()}
                </div>
            </div>
        </div>
    );
}
