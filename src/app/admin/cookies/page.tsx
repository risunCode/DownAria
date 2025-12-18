'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, RefreshCw, Plus, Info, ChevronRight, Zap, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebook, faInstagram, faWeibo, faTwitter } from '@fortawesome/free-brands-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import AdminGuard from '@/components/AdminGuard';
import CookiePoolModal from './CookiePoolModal';

type CookiePlatform = 'facebook' | 'instagram' | 'weibo' | 'twitter';

interface CookiePoolStats {
    platform: string;
    total: number;
    enabled_count: number;
    healthy_count: number;
    cooldown_count: number;
    expired_count: number;
    disabled_count: number;
    total_uses: number;
    total_success: number;
    total_errors: number;
}

const PLATFORMS: { id: CookiePlatform; name: string; icon: IconDefinition; color: string; bgColor: string; required: string }[] = [
    { id: 'facebook', name: 'Facebook', icon: faFacebook, color: 'text-blue-500', bgColor: 'bg-blue-500/10', required: 'c_user, xs' },
    { id: 'instagram', name: 'Instagram', icon: faInstagram, color: 'text-pink-500', bgColor: 'bg-pink-500/10', required: 'sessionid' },
    { id: 'twitter', name: 'Twitter', icon: faTwitter, color: 'text-sky-400', bgColor: 'bg-sky-400/10', required: 'auth_token, ct0' },
    { id: 'weibo', name: 'Weibo', icon: faWeibo, color: 'text-orange-500', bgColor: 'bg-orange-500/10', required: 'SUB' },
];

export default function AdminCookiesPage() {
    return (
        <AdminGuard requiredRole="admin">
            <CookiesContent />
        </AdminGuard>
    );
}

function CookiesContent() {
    const [stats, setStats] = useState<CookiePoolStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPlatform, setSelectedPlatform] = useState<CookiePlatform | null>(null);

    const loadStats = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/admin/cookies/pool?stats=true');
            const data = await res.json();
            if (data.success) {
                setStats(data.data || []);
            } else {
                setError(data.error || 'Failed to load stats');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    const getStats = (platform: string): CookiePoolStats => {
        return stats.find(s => s.platform === platform) || {
            platform,
            total: 0,
            enabled_count: 0,
            healthy_count: 0,
            cooldown_count: 0,
            expired_count: 0,
            disabled_count: 0,
            total_uses: 0,
            total_success: 0,
            total_errors: 0
        };
    };

    const getSuccessRate = (s: CookiePoolStats) => {
        const total = s.total_success + s.total_errors;
        if (total === 0) return 0;
        return Math.round((s.total_success / total) * 100);
    };

    return (
        <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Cookie className="w-6 h-6 text-[var(--accent-primary)]" />
                        Cookie Pool
                    </h1>
                    <p className="text-sm text-[var(--text-muted)]">
                        Multi-cookie rotation with health tracking & rate limiting
                    </p>
                </div>
                <button
                    onClick={loadStats}
                    disabled={loading}
                    className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Platform Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PLATFORMS.map((platform, idx) => {
                    const s = getStats(platform.id);
                    const successRate = getSuccessRate(s);
                    
                    return (
                        <motion.button
                            key={platform.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            onClick={() => setSelectedPlatform(platform.id)}
                            className="glass-card p-5 text-left hover:border-[var(--accent-primary)]/50 transition-all group"
                        >
                            {/* Platform Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-xl ${platform.bgColor} flex items-center justify-center`}>
                                        <FontAwesomeIcon icon={platform.icon} className={`w-6 h-6 ${platform.color}`} />
                                    </div>
                                    <div>
                                        <span className="font-semibold text-lg">{platform.name}</span>
                                        <div className="text-xs text-[var(--text-muted)]">
                                            {s.total} cookie{s.total !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)] transition-colors" />
                            </div>

                            {/* Stats */}
                            {s.total > 0 ? (
                                <div className="space-y-3">
                                    {/* Health Status */}
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
                                                <span className="text-[var(--text-muted)]">cooldown</span>
                                            </div>
                                        )}
                                        {s.expired_count > 0 && (
                                            <div className="flex items-center gap-1.5">
                                                <AlertTriangle className="w-4 h-4 text-red-400" />
                                                <span className="text-red-400">{s.expired_count}</span>
                                                <span className="text-[var(--text-muted)]">expired</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Usage Stats */}
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                                            <Zap className="w-3.5 h-3.5" />
                                            <span>{s.total_uses.toLocaleString()} uses</span>
                                        </div>
                                        <div className={`font-medium ${successRate >= 90 ? 'text-green-400' : successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {successRate}% success
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
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

            {/* Info */}
            <div className="glass-card p-4">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-medium text-[var(--text-secondary)] mb-2">Cookie Pool System</p>
                        <ul className="space-y-1 text-xs text-[var(--text-muted)]">
                            <li>• <span className="text-green-400">Rotation</span> - Cookies are rotated automatically to avoid rate limits</li>
                            <li>• <span className="text-yellow-400">Cooldown</span> - Rate-limited cookies rest for 30 min before reuse</li>
                            <li>• <span className="text-red-400">Expired</span> - Session expired, needs re-login</li>
                            <li>• User cookies still take priority over admin pool</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Cookie Pool Modal */}
            <AnimatePresence>
                {selectedPlatform && (
                    <CookiePoolModal
                        platform={selectedPlatform}
                        platformInfo={PLATFORMS.find(p => p.id === selectedPlatform)!}
                        onClose={() => {
                            setSelectedPlatform(null);
                            loadStats(); // Refresh stats after modal closes
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
