'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, ShoppingBag } from 'lucide-react';

interface Ad {
    id: string;
    title: string;
    description?: string;
    image_url: string;
    link_url: string;
    link_text?: string;
    platform?: string;
    badge_text?: string;
    badge_color?: string;
    dismissable?: boolean;
}

interface AdBannerCardProps {
    page?: 'home' | 'history' | 'advanced';
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Platform colors
const PLATFORM_COLORS: Record<string, { bg: string; text: string }> = {
    shopee: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
    tokopedia: { bg: 'bg-green-500/20', text: 'text-green-400' },
    lazada: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    bukalapak: { bg: 'bg-pink-500/20', text: 'text-pink-400' },
    blibli: { bg: 'bg-blue-600/20', text: 'text-blue-300' },
    default: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
};

// Badge colors
const BADGE_COLORS: Record<string, string> = {
    orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

export function AdBannerCard({ page = 'home' }: AdBannerCardProps) {
    const [ads, setAds] = useState<Ad[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dismissed, setDismissed] = useState(false);
    const [loading, setLoading] = useState(true);

    // Fetch ads on mount
    useEffect(() => {
        const fetchAds = async () => {
            try {
                const res = await fetch(`${API_URL}/api/v1/ads?limit=5&page=${page}`);
                const json = await res.json();
                if (json.success && json.data?.length > 0) {
                    setAds(json.data);
                }
            } catch (err) {
                console.error('[AdBanner] Failed to fetch ads:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAds();
    }, [page]);

    // Auto-rotate ads every 8 seconds
    useEffect(() => {
        if (ads.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % ads.length);
        }, 8000);
        return () => clearInterval(interval);
    }, [ads.length]);

    // Track click
    const handleClick = async (ad: Ad) => {
        // Track click (fire and forget)
        fetch(`${API_URL}/api/v1/ads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: ad.id }),
        }).catch(() => {});

        // Open link
        window.open(ad.link_url, '_blank', 'noopener,noreferrer');
    };

    // Don't render if no ads, loading, or dismissed
    if (loading || ads.length === 0 || dismissed) return null;

    const currentAd = ads[currentIndex];
    const platformStyle = PLATFORM_COLORS[currentAd.platform?.toLowerCase() || 'default'] || PLATFORM_COLORS.default;
    const badgeStyle = BADGE_COLORS[currentAd.badge_color || 'orange'] || BADGE_COLORS.orange;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass-card p-3 sm:p-4 overflow-hidden relative group"
            >
                {/* Dismiss button - only show if ad is dismissable */}
                {currentAd.dismissable !== false && (
                    <button
                        onClick={() => setDismissed(true)}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors opacity-0 group-hover:opacity-100 z-10"
                        title="Dismiss"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}

                {/* Sponsored label */}
                <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)] opacity-60">
                    Sponsored
                </div>

                {/* Content */}
                <div 
                    className="flex flex-col sm:flex-row gap-3 cursor-pointer"
                    onClick={() => handleClick(currentAd)}
                >
                    {/* Image */}
                    <div className="relative w-full sm:w-32 md:w-40 aspect-video sm:aspect-square rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)]">
                        <Image
                            src={currentAd.image_url}
                            alt={currentAd.title}
                            fill
                            className="object-cover hover:scale-105 transition-transform duration-300"
                            unoptimized
                        />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                        {/* Header with badges */}
                        <div>
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                {currentAd.badge_text && (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${badgeStyle}`}>
                                        {currentAd.badge_text}
                                    </span>
                                )}
                                {currentAd.platform && (
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${platformStyle.bg} ${platformStyle.text}`}>
                                        {currentAd.platform.charAt(0).toUpperCase() + currentAd.platform.slice(1)}
                                    </span>
                                )}
                            </div>

                            {/* Title */}
                            <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] line-clamp-1 mb-1">
                                {currentAd.title}
                            </h3>

                            {/* Description */}
                            {currentAd.description && (
                                <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                                    {currentAd.description}
                                </p>
                            )}
                        </div>

                        {/* CTA Button */}
                        <div className="mt-3 flex items-center justify-between">
                            <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-medium hover:opacity-90 transition-opacity">
                                <ShoppingBag className="w-3.5 h-3.5" />
                                {currentAd.link_text || 'Shop Now'}
                                <ExternalLink className="w-3 h-3" />
                            </button>

                            {/* Pagination dots */}
                            {ads.length > 1 && (
                                <div className="flex gap-1">
                                    {ads.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setCurrentIndex(idx);
                                            }}
                                            className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                                idx === currentIndex 
                                                    ? 'bg-[var(--accent-primary)]' 
                                                    : 'bg-[var(--bg-tertiary)] hover:bg-[var(--text-muted)]'
                                            }`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

export default AdBannerCard;
