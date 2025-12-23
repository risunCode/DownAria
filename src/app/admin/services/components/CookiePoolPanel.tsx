'use client';

import { motion } from 'framer-motion';
import { 
    CheckCircle, AlertTriangle, Clock, Plus, Info, Zap, ChevronRight
} from 'lucide-react';
import { AdminCard, PlatformIcon, type PlatformId } from '@/components/admin';
import { faFacebook, faInstagram, faWeibo, faTwitter } from '@fortawesome/free-brands-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

type CookiePlatform = 'facebook' | 'instagram' | 'weibo' | 'twitter';

const COOKIE_PLATFORMS: { id: CookiePlatform; name: string; icon: IconDefinition; color: string; bgColor: string; required: string }[] = [
    { id: 'facebook', name: 'Facebook', icon: faFacebook, color: 'text-blue-500', bgColor: 'bg-blue-500/10', required: 'c_user, xs' },
    { id: 'instagram', name: 'Instagram', icon: faInstagram, color: 'text-pink-500', bgColor: 'bg-pink-500/10', required: 'sessionid' },
    { id: 'twitter', name: 'Twitter', icon: faTwitter, color: 'text-sky-400', bgColor: 'bg-sky-400/10', required: 'auth_token, ct0' },
    { id: 'weibo', name: 'Weibo', icon: faWeibo, color: 'text-orange-500', bgColor: 'bg-orange-500/10', required: 'SUB' },
];

interface CookieStats {
    platform: string;
    total: number;
    healthy_count: number;
    cooldown_count: number;
    expired_count: number;
    total_uses: number;
    total_success: number;
    total_errors: number;
}

interface CookiePoolPanelProps {
    onSelectPlatform: (platform: CookiePlatform) => void;
    getStats: (platform: string) => CookieStats;
}

export default function CookiePoolPanel({ 
    onSelectPlatform,
    getStats 
}: CookiePoolPanelProps) {
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