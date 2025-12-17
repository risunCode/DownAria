'use client';

import { useState, useEffect } from 'react';
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
    Filter,
    X,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { HistoryItem, PLATFORMS, formatRelativeTime, Platform } from '@/lib/types';
import { getHistory, removeFromHistory, clearHistory } from '@/lib/utils/storage';
import { PlatformIcon, VideoIcon, ImageIcon, MusicIcon } from '@/components/ui/Icons';
import Swal from 'sweetalert2';

// Proxy thumbnail for platforms that block direct access (Instagram CDN)
function getProxiedThumbnail(url: string | undefined, platform: Platform): string {
    if (!url) return '';
    // Instagram CDN blocks direct browser access, need to proxy
    if (platform === 'instagram' && (url.includes('instagram') || url.includes('cdninstagram') || url.includes('fbcdn'))) {
        return `/api/proxy?url=${encodeURIComponent(url)}&platform=instagram&inline=1`;
    }
    return url;
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
    const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

    useEffect(() => {
        setHistory(getHistory());
        setIsLoaded(true);
    }, [refreshTrigger]);

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
            title: 'Delete this item?',
            text: title.substring(0, 50) + (title.length > 50 ? '...' : ''),
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6366f1',
            confirmButtonText: 'Delete',
            background: '#242424',
            color: '#ffffff',
        });

        if (result.isConfirmed) {
            removeFromHistory(id);
            setHistory(getHistory());
        }
    };

    const handleClearAll = async () => {
        const result = await Swal.fire({
            title: 'Clear all history?',
            text: 'This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6366f1',
            confirmButtonText: 'Clear All',
            background: '#242424',
            color: '#ffffff',
        });

        if (result.isConfirmed) {
            clearHistory();
            setHistory([]);
            Swal.fire({
                icon: 'success',
                title: 'History Cleared',
                timer: 1500,
                showConfirmButton: false,
                background: '#242424',
                color: '#ffffff',
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
                background: '#242424',
                color: '#ffffff',
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
                    No download history yet
                </h3>
                <p className="text-[var(--text-secondary)]">
                    Your downloaded videos will appear here
                </p>
            </motion.div>
        );
    }

    const displayedHistory = compact ? filteredHistory.slice(0, 3) : filteredHistory;

    // Gallery navigation
    const openGallery = (index: number) => setGalleryIndex(index);
    const closeGallery = () => setGalleryIndex(null);
    const prevItem = () => setGalleryIndex(i => i !== null ? (i - 1 + filteredHistory.length) % filteredHistory.length : null);
    const nextItem = () => setGalleryIndex(i => i !== null ? (i + 1) % filteredHistory.length : null);
    const currentGalleryItem = galleryIndex !== null ? filteredHistory[galleryIndex] : null;

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
                    Download History
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
                                placeholder="Search history..."
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
                        Clear
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
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    mediaFilter === type
                                        ? 'bg-[var(--accent-primary)] text-white'
                                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
                                }`}
                            >
                                {icons[type]}
                                {labels[type]}
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                    mediaFilter === type 
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
                                        {/* Thumbnail - clickable to open gallery */}
                                        <button
                                            onClick={() => openGallery(filteredHistory.findIndex(h => h.id === item.id))}
                                            className="relative w-20 h-14 sm:w-24 sm:h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)] cursor-pointer hover:ring-2 hover:ring-[var(--accent-primary)] transition-all"
                                        >
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
                                            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                <Search className="w-4 h-4 text-white" />
                                            </div>
                                        </button>

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

            {/* Gallery Modal - Fullscreen on mobile, centered modal on desktop */}
            <AnimatePresence>
                {galleryIndex !== null && currentGalleryItem && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-0 md:p-8"
                        onClick={closeGallery}
                    >
                        {/* Modal container - fullscreen mobile, centered modal desktop */}
                        <div
                            className="w-full h-full md:w-full md:max-w-4xl md:h-auto md:max-h-[85vh] bg-neutral-900 md:rounded-2xl md:shadow-2xl flex flex-col overflow-hidden border-0 md:border md:border-white/10"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header - with title */}
                            <div className="flex-shrink-0 p-3 md:p-4 text-white border-b border-white/10">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-sm font-medium">{galleryIndex + 1} / {filteredHistory.length}</span>
                                        <span 
                                            className="px-2 py-0.5 rounded text-xs"
                                            style={{ 
                                                backgroundColor: `${PLATFORMS.find(p => p.id === currentGalleryItem.platform)?.color}30`,
                                                color: PLATFORMS.find(p => p.id === currentGalleryItem.platform)?.color 
                                            }}
                                        >
                                            {PLATFORMS.find(p => p.id === currentGalleryItem.platform)?.name}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={closeGallery} 
                                        className="p-2 hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                                    >
                                        <X className="w-5 h-5 md:w-6 md:h-6" />
                                    </button>
                                </div>
                                <h3 className="text-white font-medium line-clamp-1 text-sm md:text-base">
                                    {currentGalleryItem.title}
                                </h3>
                                <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                                    <span>{currentGalleryItem.quality}</span>
                                    <span>•</span>
                                    <span>{formatRelativeTime(currentGalleryItem.downloadedAt)}</span>
                                </div>
                            </div>

                            {/* Main content area - flex-1 to fill remaining space */}
                            <div className="flex-1 flex items-center justify-center gap-2 md:gap-4 px-2 md:px-4 py-3">
                                {/* Left arrow */}
                                {filteredHistory.length > 1 && (
                                    <button
                                        onClick={prevItem}
                                        className="flex-shrink-0 p-2 md:p-3 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-white" />
                                    </button>
                                )}

                                {/* Image - balanced size */}
                                <div className="relative flex items-center justify-center overflow-hidden">
                                    <AnimatePresence mode="popLayout" initial={false}>
                                        <motion.div
                                            key={currentGalleryItem.id}
                                            initial={{ opacity: 0, x: 30 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -30 }}
                                            transition={{ duration: 0.15 }}
                                            className="flex items-center justify-center"
                                        >
                                            {currentGalleryItem.thumbnail ? (
                                                <Image
                                                    src={getProxiedThumbnail(currentGalleryItem.thumbnail, currentGalleryItem.platform)}
                                                    alt={currentGalleryItem.title}
                                                    width={800}
                                                    height={600}
                                                    className="max-w-[90vw] md:max-w-[70vw] max-h-[55vh] md:max-h-[50vh] object-contain rounded-lg"
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className="w-64 h-48 flex items-center justify-center bg-white/5 rounded-lg">
                                                    {getTypeIcon(currentGalleryItem.type)}
                                                </div>
                                            )}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                {/* Right arrow */}
                                {filteredHistory.length > 1 && (
                                    <button
                                        onClick={nextItem}
                                        className="flex-shrink-0 p-2 md:p-3 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full transition-colors"
                                    >
                                        <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white" />
                                    </button>
                                )}
                            </div>

                            {/* Thumbnail strip - only show if multiple items */}
                            {filteredHistory.length > 1 && (
                                <div className="p-2 md:p-3 overflow-x-auto border-t border-white/10">
                                    <div className="flex gap-1 md:gap-2 justify-center min-w-max">
                                        {filteredHistory.slice(0, 10).map((item, idx) => (
                                            <button
                                                key={item.id}
                                                onClick={() => setGalleryIndex(idx)}
                                                className={`relative w-10 h-10 md:w-12 md:h-12 rounded-lg overflow-hidden flex-shrink-0 transition-all ${
                                                    idx === galleryIndex
                                                        ? 'ring-2 ring-[var(--accent-primary)] opacity-100'
                                                        : 'opacity-50 hover:opacity-80'
                                                }`}
                                            >
                                                {item.thumbnail ? (
                                                    <Image 
                                                        src={getProxiedThumbnail(item.thumbnail, item.platform)} 
                                                        alt={`#${idx + 1}`} 
                                                        fill 
                                                        className="object-cover" 
                                                        unoptimized 
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-white/10 flex items-center justify-center">
                                                        <span className="text-white text-xs">{idx + 1}</span>
                                                    </div>
                                                )}
                                            </button>
                                        ))}
                                        {filteredHistory.length > 10 && (
                                            <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-white/10 flex items-center justify-center text-white/50 text-xs">
                                                +{filteredHistory.length - 10}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
