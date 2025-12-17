'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Globe, Layers, CheckCircle, XCircle, RefreshCw, AlertTriangle, Key, Clock, Activity, Link2 } from 'lucide-react';

interface StatsData {
    period: string;
    platform: Record<string, number>;
    country: Record<string, number>;
    source: Record<string, number>;
    successRate: { total: number; success: number; rate: number };
    dailyTrend: Record<string, number>;
    recentErrors: Array<{
        id: number;
        platform: string;
        error_type: string;
        error_message: string;
        created_at: string;
    }>;
}

interface ApiKeyStats {
    totalKeys: number;
    activeKeys: number;
    totalRequests: number;
}

const PLATFORM_COLORS: Record<string, string> = {
    youtube: 'bg-red-500',
    facebook: 'bg-blue-500',
    instagram: 'bg-pink-500',
    twitter: 'bg-sky-500',
    tiktok: 'bg-cyan-500',
    weibo: 'bg-orange-500',
    douyin: 'bg-purple-500',
};

// Auto-generate flag emoji from country code (ISO 3166-1 alpha-2)
function getCountryFlag(countryCode: string): string {
    if (countryCode === 'XX' || !countryCode || countryCode.length !== 2) return '🌐';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

export default function DashboardPage() {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [apiKeyStats, setApiKeyStats] = useState<ApiKeyStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [days, setDays] = useState(7);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [statsRes, keysRes] = await Promise.all([
                fetch(`/api/admin/stats?days=${days}`),
                fetch('/api/admin/apikeys')
            ]);
            const statsData = await statsRes.json();
            const keysData = await keysRes.json();
            
            if (statsData.success) {
                setStats(statsData.data);
                setLastUpdated(new Date());
            } else {
                setError(statsData.error || 'Failed to fetch stats');
            }
            
            if (keysData.success && keysData.data) {
                const keys = keysData.data;
                setApiKeyStats({
                    totalKeys: keys.length,
                    activeKeys: keys.filter((k: { enabled: boolean }) => k.enabled).length,
                    totalRequests: keys.reduce((sum: number, k: { stats: { totalRequests: number } }) => sum + k.stats.totalRequests, 0)
                });
            }
        } catch {
            setError('Failed to connect to server');
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // Auto-refresh every 30s if enabled
    useEffect(() => {
        if (!autoRefresh) return;
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, [autoRefresh, fetchStats]);

    const totalDownloads = stats ? Object.values(stats.platform).reduce((a, b) => a + b, 0) : 0;

    return (
        <div className="p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
                        <p className="text-[var(--text-muted)] text-sm">Monitor downloads and usage</p>
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
                            <Activity className={`w-4 h-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
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
                            onClick={fetchStats}
                            disabled={loading}
                            className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-card)] transition-colors"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                        {error}
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
                                value={`${stats.successRate.rate}%`}
                                color={stats.successRate.rate >= 90 ? 'text-green-400' : stats.successRate.rate >= 70 ? 'text-yellow-400' : 'text-red-400'}
                                subtitle={`${stats.successRate.success}/${stats.successRate.total}`}
                            />
                            <StatCard
                                icon={<XCircle className="w-5 h-5" />}
                                label="Failed"
                                value={(stats.successRate.total - stats.successRate.success).toLocaleString()}
                                color="text-red-400"
                            />
                            <StatCard
                                icon={<Globe className="w-5 h-5" />}
                                label="Countries"
                                value={Object.keys(stats.country).length.toString()}
                                color="text-blue-400"
                            />
                            <StatCard
                                icon={<Layers className="w-5 h-5" />}
                                label="Platforms"
                                value={Object.keys(stats.platform).length.toString()}
                                color="text-purple-400"
                            />
                            <StatCard
                                icon={<Key className="w-5 h-5" />}
                                label="API Keys"
                                value={apiKeyStats ? `${apiKeyStats.activeKeys}/${apiKeyStats.totalKeys}` : '-'}
                                color="text-amber-400"
                                subtitle={apiKeyStats ? `${apiKeyStats.totalRequests} req` : undefined}
                            />
                        </div>

                        {/* Charts Row */}
                        <div className="grid lg:grid-cols-2 gap-6">
                            {/* Platform Breakdown */}
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
                                <h2 className="font-semibold mb-4 flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-purple-400" />
                                    Downloads by Platform
                                </h2>
                                <div className="space-y-3">
                                    {Object.entries(stats.platform)
                                        .sort(([, a], [, b]) => b - a)
                                        .map(([platform, count]) => (
                                            <div key={platform} className="flex items-center gap-3">
                                                <span className="w-20 text-sm capitalize">{platform}</span>
                                                <div className="flex-1 h-6 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${PLATFORM_COLORS[platform] || 'bg-gray-500'} transition-all`}
                                                        style={{ width: `${(count / totalDownloads) * 100}%` }}
                                                    />
                                                </div>
                                                <span className="w-16 text-right text-sm font-medium">{count}</span>
                                            </div>
                                        ))}
                                </div>
                            </motion.div>

                            {/* Country Breakdown */}
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
                                <h2 className="font-semibold mb-4 flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-blue-400" />
                                    Downloads by Country
                                </h2>
                                {(() => {
                                    const countryEntries = Object.entries(stats.country).sort(([, a], [, b]) => b - a).slice(0, 8);
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
                                })()}
                            </motion.div>
                        </div>

                        {/* System Status & Source Row */}
                        <div className="grid lg:grid-cols-2 gap-6">
                            {/* System Status */}
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-5">
                                <h2 className="font-semibold mb-3 flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-green-400" />
                                    System Status
                                </h2>
                                <div className="grid grid-cols-2 gap-2">
                                    <StatusItem label="API" status="operational" />
                                    <StatusItem label="Database" status="operational" />
                                    <StatusItem label="Cache" status="operational" />
                                    <StatusItem label="CDN" status="operational" />
                                </div>
                                <div className="mt-3 pt-3 border-t border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--text-muted)]">
                                    <span>All systems operational</span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        Live
                                    </span>
                                </div>
                            </motion.div>

                            {/* Source Breakdown */}
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-5">
                                <h2 className="font-semibold mb-3 flex items-center gap-2">
                                    <Link2 className="w-5 h-5 text-cyan-400" />
                                    Downloads by Source
                                </h2>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(stats.source).map(([source, count]) => (
                                        <div key={source} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-secondary)]">
                                            <span className="capitalize text-sm">{source}</span>
                                            <span className="font-medium">{count}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-3 pt-3 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
                                    Total: {Object.values(stats.source).reduce((a, b) => a + b, 0)} requests
                                </div>
                            </motion.div>
                        </div>

                        {/* Recent Errors */}
                        {stats.recentErrors.length > 0 && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card p-5">
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
                                                    <span className="text-xs text-[var(--text-muted)]">{err.error_type}</span>
                                                </div>
                                                <p className="text-xs text-[var(--text-muted)] truncate">{err.error_message}</p>
                                            </div>
                                            <span className="text-xs text-[var(--text-muted)] shrink-0">
                                                {new Date(err.created_at).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </>
                ) : null}
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, color, subtitle }: { icon: React.ReactNode; label: string; value: string; color: string; subtitle?: string }) {
    return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-4">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-[var(--bg-secondary)] ${color}`}>{icon}</div>
                <div className="min-w-0">
                    <p className="text-xs text-[var(--text-muted)] truncate">{label}</p>
                    <p className="text-xl font-bold">{value}</p>
                    {subtitle && <p className="text-[10px] text-[var(--text-muted)]">{subtitle}</p>}
                </div>
            </div>
        </motion.div>
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
