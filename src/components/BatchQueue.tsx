'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Play, Trash2, CheckCircle, XCircle, Loader2, ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { QueueItem, QueueItemStatus } from '@/lib/utils/batch-queue';
import { detectPlatform, sanitizeUrl } from '@/lib/types';
import { PlatformIcon } from '@/components/ui/Icons';

interface BatchQueueProps {
    items: QueueItem[];
    isProcessing: boolean;
    onAdd: (url: string) => void;
    onRemove: (id: string) => void;
    onClear: () => void;
    onStart: () => void;
}

const statusIcons: Record<QueueItemStatus, React.ReactNode> = {
    pending: <div className="w-3 h-3 rounded-full bg-gray-400" />,
    processing: <Loader2 className="w-4 h-4 animate-spin text-blue-400" />,
    completed: <CheckCircle className="w-4 h-4 text-green-400" />,
    failed: <XCircle className="w-4 h-4 text-red-400" />,
};

export function BatchQueue({ items, isProcessing, onAdd, onRemove, onClear, onStart }: BatchQueueProps) {
    const [inputUrl, setInputUrl] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    const handleAdd = () => {
        const clean = sanitizeUrl(inputUrl);
        if (clean && detectPlatform(clean)) {
            onAdd(clean);
            setInputUrl('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleAdd();
    };

    const stats = {
        total: items.length,
        completed: items.filter(i => i.status === 'completed').length,
        failed: items.filter(i => i.status === 'failed').length,
        pending: items.filter(i => i.status === 'pending').length,
    };

    if (items.length === 0 && !isExpanded) {
        return (
            <button
                onClick={() => setIsExpanded(true)}
                className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
            >
                <ListPlus className="w-4 h-4" />
                Batch Download
            </button>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="glass-card p-4 space-y-3"
        >
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <ListPlus className="w-4 h-4" />
                    Batch Queue
                    {stats.total > 0 && (
                        <span className="text-xs text-[var(--text-muted)]">
                            ({stats.completed}/{stats.total})
                        </span>
                    )}
                </h3>
                <button onClick={() => { onClear(); setIsExpanded(false); }} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Add URL input */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Paste URL to add to queue..."
                    disabled={isProcessing}
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] disabled:opacity-50"
                />
                <Button size="sm" variant="secondary" onClick={handleAdd} disabled={isProcessing || !inputUrl.trim()}>
                    <Plus className="w-4 h-4" />
                </Button>
            </div>

            {/* Queue list */}
            {items.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                    <AnimatePresence mode="popLayout">
                        {items.map((item) => {
                            const platform = detectPlatform(item.url);
                            return (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]"
                                >
                                    {statusIcons[item.status]}
                                    {platform && <PlatformIcon platform={platform} className="w-4 h-4" />}
                                    <span className="flex-1 text-xs text-[var(--text-secondary)] truncate">
                                        {item.url.length > 50 ? item.url.slice(0, 50) + '...' : item.url}
                                    </span>
                                    {item.status === 'pending' && !isProcessing && (
                                        <button onClick={() => onRemove(item.id)} className="text-[var(--text-muted)] hover:text-red-400">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    {item.status === 'failed' && (
                                        <span className="text-xs text-red-400">{item.error || 'Failed'}</span>
                                    )}
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}

            {/* Actions */}
            {items.length > 0 && (
                <div className="flex justify-between items-center pt-2 border-t border-[var(--border-color)]">
                    <Button size="sm" variant="ghost" onClick={onClear} disabled={isProcessing}>
                        <Trash2 className="w-4 h-4" /> Clear
                    </Button>
                    <Button size="sm" onClick={onStart} disabled={isProcessing || stats.pending === 0}>
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        {isProcessing ? 'Processing...' : `Start (${stats.pending})`}
                    </Button>
                </div>
            )}
        </motion.div>
    );
}
