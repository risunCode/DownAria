'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Play, ZoomIn, Download } from 'lucide-react';
import { Platform } from '@/lib/types';

interface GalleryItem {
    id: string;
    type: 'video' | 'image';
    url: string;
    thumbnail?: string;
    quality?: string;
}

interface MediaGalleryProps {
    items: GalleryItem[];
    initialIndex?: number;
    isOpen: boolean;
    onClose: () => void;
    platform: Platform;
    onDownload?: (item: GalleryItem) => void;
}

// Proxy thumbnail for platforms that block direct access
function getProxiedUrl(url: string | undefined, platform: Platform): string {
    if (!url) return '';
    // Instagram & Weibo CDN blocks direct browser access
    if (platform === 'instagram' && (url.includes('instagram') || url.includes('cdninstagram') || url.includes('fbcdn'))) {
        return `/api/proxy?url=${encodeURIComponent(url)}&platform=instagram&inline=1`;
    }
    if (platform === 'weibo' && url.includes('sinaimg')) {
        return `/api/proxy?url=${encodeURIComponent(url)}&platform=weibo&inline=1`;
    }
    return url;
}

export function MediaGallery({ 
    items, 
    initialIndex = 0, 
    isOpen, 
    onClose, 
    platform,
    onDownload 
}: MediaGalleryProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [isPlaying, setIsPlaying] = useState(false);

    // Reset index when opening
    useEffect(() => {
        if (isOpen) {
            setCurrentIndex(initialIndex);
            setIsPlaying(false);
        }
    }, [isOpen, initialIndex]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;
        
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') goToPrev();
            else if (e.key === 'ArrowRight') goToNext();
            else if (e.key === 'Escape') onClose();
            else if (e.key === ' ') {
                e.preventDefault();
                setIsPlaying(p => !p);
            }
        };
        
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, items.length]);

    const goToPrev = useCallback(() => {
        setIsPlaying(false);
        setCurrentIndex(prev => (prev - 1 + items.length) % items.length);
    }, [items.length]);

    const goToNext = useCallback(() => {
        setIsPlaying(false);
        setCurrentIndex(prev => (prev + 1) % items.length);
    }, [items.length]);

    if (!isOpen || items.length === 0) return null;

    const currentItem = items[currentIndex];
    const isVideo = currentItem.type === 'video';
    const displayUrl = getProxiedUrl(isVideo ? currentItem.thumbnail : currentItem.url, platform);

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
                onClick={onClose}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
                >
                    <X className="w-6 h-6 text-white" />
                </button>

                {/* Counter */}
                <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-white/10 text-white text-sm">
                    {currentIndex + 1} / {items.length}
                </div>

                {/* Main content */}
                <div 
                    className="relative max-w-[90vw] max-h-[85vh] flex items-center justify-center"
                    onClick={e => e.stopPropagation()}
                >
                    {isVideo && isPlaying ? (
                        <video
                            src={getProxiedUrl(currentItem.url, platform)}
                            controls
                            autoPlay
                            className="max-w-full max-h-[85vh] rounded-lg"
                        />
                    ) : (
                        <div className="relative">
                            {displayUrl ? (
                                <Image
                                    src={displayUrl}
                                    alt={`Item ${currentIndex + 1}`}
                                    width={800}
                                    height={600}
                                    className="max-w-full max-h-[85vh] object-contain rounded-lg"
                                    unoptimized
                                />
                            ) : (
                                <div className="w-[400px] h-[300px] bg-[var(--bg-secondary)] rounded-lg flex items-center justify-center">
                                    <span className="text-[var(--text-muted)]">No preview</span>
                                </div>
                            )}
                            
                            {/* Play button overlay for videos */}
                            {isVideo && (
                                <button
                                    onClick={() => setIsPlaying(true)}
                                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors rounded-lg"
                                >
                                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                                        <Play className="w-8 h-8 text-black ml-1" />
                                    </div>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Navigation arrows */}
                {items.length > 1 && (
                    <>
                        <button
                            onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            <ChevronLeft className="w-6 h-6 text-white" />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); goToNext(); }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                        >
                            <ChevronRight className="w-6 h-6 text-white" />
                        </button>
                    </>
                )}

                {/* Bottom bar with download */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
                    {currentItem.quality && (
                        <span className="px-3 py-1 rounded-full bg-white/10 text-white text-sm">
                            {currentItem.quality}
                        </span>
                    )}
                    {onDownload && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDownload(currentItem); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            Download
                        </button>
                    )}
                </div>

                {/* Thumbnail strip */}
                {items.length > 1 && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 max-w-[80vw] overflow-x-auto p-2">
                        {items.map((item, idx) => (
                            <button
                                key={item.id}
                                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); setIsPlaying(false); }}
                                className={`relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                                    idx === currentIndex 
                                        ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)] ring-opacity-50' 
                                        : 'border-transparent opacity-60 hover:opacity-100'
                                }`}
                            >
                                {item.thumbnail || item.url ? (
                                    <Image
                                        src={getProxiedUrl(item.thumbnail || item.url, platform)}
                                        alt={`Thumb ${idx + 1}`}
                                        fill
                                        className="object-cover"
                                        unoptimized
                                    />
                                ) : (
                                    <div className="w-full h-full bg-[var(--bg-secondary)] flex items-center justify-center">
                                        {item.type === 'video' ? <Play className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}

export default MediaGallery;
