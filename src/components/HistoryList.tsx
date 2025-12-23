'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Trash2,
    ExternalLink,
    Search,
    Clock,
    Copy,
    XCircle,
    Check,
    Filter
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { HistoryItem, PLATFORMS, PlatformId } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils/format';
import {
    getHistory,
    deleteHistory,
    clearHistory,
    initStorage,
    type HistoryEntry
} from '@/lib/storage';
import { PlatformIcon, VideoIcon, ImageIcon, MusicIcon } from '@/components/ui/Icons';
import { getProxiedThumbnail } from '@/lib/api/proxy';
import { useTranslations } from 'next-intl';
import Swal from 'sweetalert2';

// Convert IndexedDB entry to HistoryItem format
function idbToHistoryItem(entry: HistoryEntry): HistoryItem {
    return {
        id: entry.id,
        platform: entry.platform,
        title: entry.title,
        thumbnail: entry.thumbnail,
        url: entry.resolvedUrl,
        downloadedAt: new Date(entry.downloadedAt).toISOString(),
        quality: entry.quality || 'Unknown',
        type: entry.type || 'video',
    };
}



interface HistoryListProps {
    refreshTrigger?: number;
    compact?: boolean;
}

type MediaFilter = 'all' | 'video' | 'image' | 'audio';

export function HistoryList({ refreshTrigger, compact = false }: HistoryListProps) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
    const [isLoaded, setIsLoaded] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const t = useTranslations('history');
    const tCommon = useTranslations('common');
    // Load history from IndexedDB
    const loadHistory = useCallback(async () => {
        try {
            await initStorage();
            const entries = await getHistory(500);
            setHistory(entries.map(idbToHistoryItem));
        } catch (err) {
            console.error('Failed to load history:', err);
            setHistory([]);
        }
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        loadHistory();
    }, [refreshTrigger, loadHistory]);

    const filteredHistory = history.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.platform.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = mediaFilter === 'all' || item.type === mediaFilter;
        return matchesSearch && matchesType;
    });

    // Count by type for filter badges
    const typeCounts = {
        all: history.length,
        video: history.filter(h => h.type === 'video').length,
        image: history.filter(h => h.type === 'image').length,
        audio: history.filter(h => h.type === 'audio').length,
    };

    const handleDelete = async (id: string, title: string) => {
        const result = await Swal.fire({
            title: t('item.delete') + '?',
            text: title.substring(0, 50) + (title.length > 50 ? '...' : ''),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: tCommon('delete'),
            cancelButtonText: tCommon('cancel'),
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            confirmButtonColor: 'var(--error)',
            cancelButtonColor: 'var(--accent-primary)',
        });

        if (result.isConfirmed) {
            await deleteHistory(id);
            await loadHistory();
        }
    };

    const handleClearAll = async () => {
        const result = await Swal.fire({
            title: t('clearConfirm'),
            text: t('clearConfirmDesc'),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: tCommon('clearAll'),
            cancelButtonText: tCommon('cancel'),
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            confirmButtonColor: 'var(--error)',
            cancelButtonColor: 'var(--accent-primary)',
        });

        if (result.isConfirmed) {
            await clearHistory();
            setHistory([]);
            Swal.fire({
                icon: 'success',
                title: t('clearHistory'),
                timer: 1500,
                showConfirmButton: false,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
        }
    };

    const getTypeIcon = (type: HistoryItem['type']) => {
        switch (type) {
            case 'video': return <VideoIcon className="w-3.5 h-3.5" />;
            case 'audio': return <MusicIcon className="w-3.5 h-3.5" />;
            case 'image': return <ImageIcon className="w-3.5 h-3.5" />;
        }
    };

    const handleCopyUrl = async (id: string, url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
            // Show small toast
            const toast = document.createElement('div');
            toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg shadow-lg z-[100] animate-fade-in';
            toast.textContent = '✓ Copied to clipboard';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 1500);
        } catch {
            Swal.fire({
                icon: 'error',
                title: 'Failed to copy',
                timer: 1500,
                showConfirmButton: false,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
        }
    };

    if (!isLoaded) {
        return <div className="skeleton h-32 rounded-xl" />;
    }

    if (history.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card p-8 text-center"
            >
                <Clock className="w-12 h-12 mx-auto text-[var(--text-muted)] mb-4" />
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                    {t('empty')}
                </h3>
                <p className="text-[var(--text-secondary)]">
                    {t('emptyDesc')}
                </p>
            </motion.div>
        );
    }

    const displayedHistory = compact ? filteredHistory.slice(0, 3) : filteredHistory;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    {t('title')}
                    <span className="text-sm font-normal text-[var(--text-muted)]">
                        ({filteredHistory.length}{mediaFilter !== 'all' ? `/${history.length}` : ''})
                    </span>
                </h2>

                <div className="flex gap-2 w-full sm:w-auto">
                    {!compact && (
                        <div className="relative flex-1 sm:flex-none">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                            <input
                                type="text"
                                placeholder={t('title') + '...'}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full sm:w-64 pl-10 pr-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
                            />
                        </div>
                    )}
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={handleClearAll}
                        leftIcon={<Trash2 className="w-4 h-4" />}
                    >
                        {tCommon('clear')}
                    </Button>
                </div>
            </div>

            {/* Media Type Filter */}
            {!compact && (
                <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="w-4 h-4 text-[var(--text-muted)]" />
                    {(['all', 'video', 'image', 'audio'] as MediaFilter[]).map((type) => {
                        const count = typeCounts[type];
                        if (type !== 'all' && count === 0) return null;

                        const icons = {
                            all: null,
                            video: <VideoIcon className="w-3.5 h-3.5" />,
                            image: <ImageIcon className="w-3.5 h-3.5" />,
                            audio: <MusicIcon className="w-3.5 h-3.5" />,
                        };
                        const labels = { all: 'All', video: 'Videos', image: 'Images', audio: 'Audio' };

                        return (
                            <button
                                key={type}
                                onClick={() => setMediaFilter(type)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${mediaFilter === type
                                    ? 'bg-[var(--accent-primary)] text-white'
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
                                    }`}
                            >
                                {icons[type]}
                                {labels[type]}
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${mediaFilter === type
                                    ? 'bg-white/20'
                                    : 'bg-[var(--bg-card)]'
                                    }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* List */}
            <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                    {displayedHistory.map((item, index) => {
                        const platformConfig = PLATFORMS.find(p => p.id === item.platform);

                        return (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ delay: index * 0.05 }}
                                className="glass-card p-3 sm:p-4 group"
                            >
                                {/* Mobile: Stack layout, Desktop: Flex row */}
                                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                    {/* Top row on mobile: Thumbnail + Info */}
                                    <div className="flex gap-3 sm:gap-4 flex-1 min-w-0">
                                        {/* Thumbnail */}
                                        <div className="relative w-20 h-14 sm:w-24 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)]">
                                            {item.thumbnail ? (
                                                <Image
                                                    src={getProxiedThumbnail(item.thumbnail, item.platform)}
                                                    alt={item.title}
                                                    fill
                                                    className="object-cover"
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    {getTypeIcon(item.type)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-medium text-[var(--text-primary)] line-clamp-2 sm:line-clamp-1">
                                                {item.title}
                                            </h4>
                                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1 text-xs text-[var(--text-muted)]">
                                                <span
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
                                                    style={{
                                                        backgroundColor: `${platformConfig?.color}20`,
                                                        color: platformConfig?.color,
                                                    }}
                                                >
                                                    <PlatformIcon platform={item.platform} className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                    <span className="hidden xs:inline">{platformConfig?.name}</span>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    {getTypeIcon(item.type)} {item.quality}
                                                </span>
                                                <span className="hidden sm:inline">{formatRelativeTime(item.downloadedAt)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions - bottom row on mobile, inline on desktop */}
                                    <div className="flex items-center justify-end gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity border-t sm:border-0 border-[var(--border-color)] pt-2 sm:pt-0 -mx-3 px-3 sm:mx-0 sm:px-0">
                                        <span className="text-xs text-[var(--text-muted)] mr-auto sm:hidden">
                                            {formatRelativeTime(item.downloadedAt)}
                                        </span>
                                        <button
                                            onClick={() => handleCopyUrl(item.id, item.url)}
                                            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
                                            title="Copy URL"
                                        >
                                            {copiedId === item.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                        </button>
                                        <a
                                            href={item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                                            title="Open original"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                        <button
                                            onClick={() => handleDelete(item.id, item.title)}
                                            className="p-2 rounded-lg hover:bg-red-500/20 text-[var(--text-muted)] hover:text-[var(--error)] transition-colors"
                                            title="Delete"
                                        >
                                            <XCircle className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Show more link */}
            {compact && history.length > 3 && (
                <motion.a
                    href="/history"
                    whileHover={{ x: 5 }}
                    className="inline-flex items-center gap-2 text-sm text-[var(--accent-primary)] hover:text-[var(--accent-secondary)]"
                >
                    View all {history.length} items →
                </motion.a>
            )}
        </motion.div>
    );
}
