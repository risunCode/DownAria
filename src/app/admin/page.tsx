'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    BarChart3, Layers, CheckCircle, XCircle, RefreshCw, 
    AlertTriangle, Key, Clock, Activity, Globe, Link2
} from 'lucide-react';
import { StatCard, AdminCard } from '@/components/admin';
import { useStats, getCountryFlag, PLATFORM_COLORS, useApiKeys } from '@/hooks/admin';

export default function AdminOverviewPage() {
    const [days, setDays] = useState(7);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    
    const { 
        stats, loading, error, refetch, 
        autoRefresh, setAutoRefresh,
        totalDownloads, platformCount, failedCount, successRate, uniqueUsers
    } = useStats(days);
    
    // Calculate country count from stats
    const countryCount = stats?.byCountry ? Object.keys(stats.byCountry).length : 0;
    
    // Use SWR hook for API keys (cached, deduplicated)
    const { stats: apiKeyStats, refetch: refetchApiKeys } = useApiKeys();

    const handleRefresh = async () => {
        await refetch();
        await refetchApiKeys();
        setLastUpdated(new Date());
    };

    // Update lastUpdated when stats change
    useEffect(() => {
        if (stats) setLastUpdated(new Date());
    }, [stats]);

    return (
        <div className="p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Overview</h1>
                        <p className="text-[var(--text-muted)] text-sm">Monitor downloads and system status</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {lastUpdated && (
                            <span className="text-xs text-[var(--text-muted)] hidden sm:flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {lastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={() => setAutoRefresh(!autoRefresh)}
                            className={`p-2 rounded-lg border transition-colors ${
                                autoRefresh 
                                    ? 'bg-green-500/10 border-green-500/30 text-green-400' 
                                    : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-muted)]'
                            }`}
                            title={autoRefresh ? 'Auto-refresh ON (30s)' : 'Auto-refresh OFF'}
                        >
                            <Activity className="w-4 h-4" />
                        </button>
                        <select
                            value={days}
                            onChange={(e) => setDays(Number(e.target.value))}
                            className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                        >
                            <option value={1}>Last 24h</option>
                            <option value={7}>Last 7 days</option>
                            <option value={30}>Last 30 days</option>
                        </select>
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-card)] transition-colors"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {error.message}
                    </div>
                )}

                {loading && !stats ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
                    </div>
                ) : stats ? (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                            <StatCard
                                icon={<BarChart3 className="w-5 h-5" />}
                                label="Total Downloads"
                                value={totalDownloads.toLocaleString()}
                                color="text-[var(--accent-primary)]"
                            />
                            <StatCard
                                icon={<CheckCircle className="w-5 h-5" />}
                                label="Success Rate"
                                value={`${successRate}%`}
                                color={successRate >= 90 ? 'text-green-400' : successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}
                            />
                            <StatCard
                                icon={<XCircle className="w-5 h-5" />}
                                label="Failed"
                                value={failedCount.toLocaleString()}
                                color="text-red-400"
                            />
                            <StatCard
                                icon={<Globe className="w-5 h-5" />}
                                label="Countries"
                                value={countryCount.toString()}
                                color="text-blue-400"
                            />
                            <StatCard
                                icon={<Layers className="w-5 h-5" />}
                                label="Platforms"
                                value={platformCount.toString()}
                                color="text-purple-400"
                            />
                            <StatCard
                                icon={<Key className="w-5 h-5" />}
                                label="API Keys"
                                value={`${apiKeyStats.activeKeys}/${apiKeyStats.totalKeys}`}
                                color="text-amber-400"
                            />
                        </div>

                        {/* Charts Row */}
                        <div className="grid lg:grid-cols-2 gap-6">
                            {/* Platform Breakdown */}
                            <AdminCard>
                                <h2 className="font-semibold mb-4 flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-purple-400" />
                                    Downloads by Platform
                                </h2>
                                <div className="space-y-3">
                                    {stats.byPlatform && Object.entries(stats.byPlatform)
                                        .sort(([, a], [, b]) => b.total - a.total)
                                        .map(([platform, data]) => (
                                            <div key={platform} className="flex items-center gap-3">
                                                <span className="w-20 text-sm capitalize">{platform}</span>
                                                <div className="flex-1 h-6 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${PLATFORM_COLORS[platform] || 'bg-gray-500'} transition-all`}
                                                        style={{ width: `${totalDownloads > 0 ? (data.total / totalDownloads) * 100 : 0}%` }}
                                                    />
                                                </div>
                                                <span className="w-16 text-right text-sm font-medium">{data.total}</span>
                                            </div>
                                        ))}
                                    {(!stats.byPlatform || Object.keys(stats.byPlatform).length === 0) && (
                                        <p className="text-sm text-[var(--text-muted)]">No data available</p>
                                    )}
                                </div>
                            </AdminCard>

                            {/* Request vs Download Bar Chart */}
                            <AdminCard>
                                <h2 className="font-semibold mb-4 flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-cyan-400" />
                                    Downloads Overview
                                </h2>
                                <RequestDownloadChart 
                                    apiRequests={apiKeyStats.totalRequests || 0}
                                    downloads={totalDownloads}
                                    failed={failedCount}
                                    successRate={successRate}
                                />
                            </AdminCard>
                        </div>

                        {/* Country & Source Row */}
                        <div className="grid lg:grid-cols-2 gap-6">
                            {/* Country Breakdown */}
                            <AdminCard>
                                <h2 className="font-semibold mb-4 flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-blue-400" />
                                    Downloads by Country
                                </h2>
                                {stats.byCountry && Object.keys(stats.byCountry).length > 0 ? (
                                    (() => {
                                        const countryEntries = Object.entries(stats.byCountry).sort(([, a], [, b]) => b - a).slice(0, 8);
                                        const maxCountry = countryEntries.length > 0 ? countryEntries[0][1] : 1;
                                        return (
                                            <div className="space-y-3">
                                                {countryEntries.map(([country, count]) => (
                                                    <div key={country} className="flex items-center gap-3">
                                                        <span className="w-8 text-lg">{getCountryFlag(country)}</span>
                                                        <span className="w-10 text-sm">{country}</span>
                                                        <div className="flex-1 h-6 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-500 transition-all"
                                                                style={{ width: `${(count / maxCountry) * 100}%` }}
                                                            />
                                                        </div>
                                                        <span className="w-16 text-right text-sm font-medium">{count}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <p className="text-sm text-[var(--text-muted)]">No data available</p>
                                )}
                            </AdminCard>

                            {/* Source Breakdown */}
                            <AdminCard>
                                <h2 className="font-semibold mb-3 flex items-center gap-2">
                                    <Link2 className="w-5 h-5 text-cyan-400" />
                                    Downloads by Source
                                </h2>
                                {stats.bySource && Object.keys(stats.bySource).length > 0 ? (
                                    <>
                                        <div className="grid grid-cols-2 gap-2">
                                            {Object.entries(stats.bySource).map(([source, count]) => {
                                                const sourceLabels: Record<string, { label: string; color: string }> = {
                                                    web: { label: '🌐 Guest (Home)', color: 'text-blue-400' },
                                                    api: { label: '🔑 API Key', color: 'text-amber-400' },
                                                    playground: { label: '🧪 Playground', color: 'text-purple-400' },
                                                    telegram: { label: '🤖 Telegram Bot', color: 'text-cyan-400' },
                                                };
                                                const info = sourceLabels[source] || { label: source, color: 'text-gray-400' };
                                                return (
                                                    <div key={source} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-secondary)]">
                                                        <span className={`text-sm ${info.color}`}>{info.label}</span>
                                                        <span className="font-medium">{count}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
                                            Total: {Object.values(stats.bySource).reduce((a, b) => a + b, 0)} requests
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-sm text-[var(--text-muted)]">No data available</p>
                                )}
                            </AdminCard>
                        </div>

                        {/* Recent Errors */}
                        {stats.recentErrors && stats.recentErrors.length > 0 && (
                            <AdminCard>
                                <h2 className="font-semibold mb-4 flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                    Recent Errors
                                </h2>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {stats.recentErrors.map((err) => (
                                        <div key={err.id} className="flex items-start gap-3 p-2 rounded-lg bg-[var(--bg-secondary)] text-sm">
                                            <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium capitalize">{err.platform}</span>
                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">{err.error_type}</span>
                                                    <span className="text-xs text-[var(--text-muted)]">{err.error_code}</span>
                                                </div>
                                                <p className="text-xs text-[var(--text-muted)] truncate">{err.error_message}</p>
                                                {err.request_url && (
                                                    <p className="text-xs text-[var(--text-muted)] truncate opacity-60">{err.request_url}</p>
                                                )}
                                            </div>
                                            <span className="text-xs text-[var(--text-muted)] shrink-0">
                                                {err.timestamp ? new Date(err.timestamp).toLocaleTimeString() : '-'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </AdminCard>
                        )}
                    </>
                ) : null}
            </div>
        </div>
    );
}

function StatusItem({ label, status }: { label: string; status: 'operational' | 'degraded' | 'down' }) {
    const colors = {
        operational: 'bg-green-500',
        degraded: 'bg-yellow-500',
        down: 'bg-red-500'
    };
    return (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--bg-secondary)]">
            <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
            <span className="text-sm">{label}</span>
        </div>
    );
}

// Bar Chart Component for API Requests vs Downloads
function RequestDownloadChart({ apiRequests, downloads, failed, successRate }: { apiRequests: number; downloads: number; failed: number; successRate: number }) {
    const maxValue = Math.max(downloads, failed, 1);
    
    const bars = [
        { label: 'Downloads', value: downloads, color: 'bg-green-500', icon: '✅' },
        { label: 'Failed', value: failed, color: 'bg-red-500', icon: '❌' },
    ];

    return (
        <div className="space-y-4">
            {/* Vertical Bar Chart */}
            <div className="flex items-end justify-center gap-8 h-40">
                {bars.map((bar) => (
                    <div key={bar.label} className="flex flex-col items-center gap-2">
                        <span className="text-sm font-bold">{bar.value.toLocaleString()}</span>
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max((bar.value / maxValue) * 100, 5)}%` }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            className={`w-20 ${bar.color} rounded-t-lg min-h-[8px]`}
                        />
                        <span className="text-xs text-[var(--text-muted)] text-center">{bar.label}</span>
                    </div>
                ))}
            </div>

            {/* API Key Requests Info */}
            {apiRequests > 0 && (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-secondary)] text-sm">
                    <span className="text-[var(--text-muted)]">🔑 API Key Requests</span>
                    <span className="font-medium text-amber-400">{apiRequests.toLocaleString()}</span>
                </div>
            )}

            {/* Success Rate Indicator */}
            <div className="pt-4 border-t border-[var(--border-color)]">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[var(--text-muted)]">Success Rate</span>
                    <span className={`text-lg font-bold ${successRate >= 90 ? 'text-green-400' : successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {successRate}%
                    </span>
                </div>
                <div className="h-2 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${successRate}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className={`h-full ${successRate >= 90 ? 'bg-green-500' : successRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    />
                </div>
            </div>
        </div>
    );
}
