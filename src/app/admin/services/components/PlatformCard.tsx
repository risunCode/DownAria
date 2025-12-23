'use client';

import { motion } from 'framer-motion';
import { 
    RefreshCw, Clock, Gauge, Edit3
} from 'lucide-react';
import { PlatformIcon, StatusBadge, type PlatformId } from '@/components/admin';

interface Platform {
    id: string;
    name: string;
    method: string;
    enabled: boolean;
    rateLimit: number;
    cacheTime: number;
    disabledMessage: string;
    stats: {
        totalRequests: number;
        successCount: number;
    };
}

interface PlatformCardProps {
    platform: Platform;
    index: number;
    togglingPlatform: string | null;
    localConfig: Record<string, { rateLimit: number; cacheTime: number; disabledMessage: string }>;
    onTogglePlatform: (platformId: string, enabled: boolean) => void;
    onSetLocalValue: (platformId: string, field: 'rateLimit' | 'cacheTime' | 'disabledMessage', value: number | string) => void;
    onCommitUpdate: (platformId: string, field: 'rateLimit' | 'cacheTime' | 'disabledMessage') => void;
}

export default function PlatformCard({
    platform,
    index,
    togglingPlatform,
    localConfig,
    onTogglePlatform,
    onSetLocalValue,
    onCommitUpdate
}: PlatformCardProps) {
    // Local state for inputs (debounced updates)
    const getLocalValue = (field: 'rateLimit' | 'cacheTime' | 'disabledMessage') => {
        return localConfig[platform.id]?.[field] ?? platform[field] ?? (field === 'disabledMessage' ? '' : 0);
    };

    return (
        <motion.div
            key={platform.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
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
                        onClick={() => onTogglePlatform(platform.id, !platform.enabled)}
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
                            value={getLocalValue('rateLimit')}
                            onChange={(e) => onSetLocalValue(platform.id, 'rateLimit', parseInt(e.target.value) || 10)}
                            onBlur={() => onCommitUpdate(platform.id, 'rateLimit')}
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
                            value={getLocalValue('cacheTime')}
                            onChange={(e) => onSetLocalValue(platform.id, 'cacheTime', parseInt(e.target.value) || 300)}
                            onBlur={() => onCommitUpdate(platform.id, 'cacheTime')}
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
                            value={getLocalValue('disabledMessage')}
                            onChange={(e) => onSetLocalValue(platform.id, 'disabledMessage', e.target.value)}
                            onBlur={() => onCommitUpdate(platform.id, 'disabledMessage')}
                            className="flex-1 px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                            placeholder="Message shown when disabled..."
                        />
                    </div>
                </div>
            )}
        </motion.div>
    );
}