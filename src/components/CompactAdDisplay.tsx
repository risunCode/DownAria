'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';

interface CompactAd {
    id: string;
    name: string;
    title: string;
    description?: string;
    image_url: string;
    link_url: string;
    preview_title?: string;
    preview_description?: string;
    preview_image?: string;
    placement: string;
    size: 'small' | 'medium' | 'large';
}

interface CompactAdDisplayProps {
    placement: 'home-input' | 'home-bottom' | 'about' | 'sidebar';
    maxAds?: number;
    className?: string;
}

// Track action (impression, click)
async function trackAction(id: string, action: 'impression' | 'click') {
    try {
        await api.post('/api/v1/communications', { type: 'compact', id, action });
    } catch {
        // Silent fail
    }
}

export default function CompactAdDisplay({ placement, maxAds = 3, className = '' }: CompactAdDisplayProps) {
    const [ads, setAds] = useState<CompactAd[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAds = async () => {
            try {
                const json = await api.get<{ success: boolean; data?: { compactAds: CompactAd[] } }>('/api/v1/communications?page=home');
                if (json.success && json.data?.compactAds) {
                    // Filter by placement or show all if placement is 'all'
                    const filtered = json.data.compactAds.filter(ad => 
                        ad.placement === 'all' || ad.placement === placement
                    ).slice(0, maxAds);
                    setAds(filtered);
                    
                    // Track impressions
                    filtered.forEach(ad => trackAction(ad.id, 'impression'));
                }
            } catch (err) {
                console.error('Failed to fetch compact ads:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAds();
    }, [placement, maxAds]);

    const handleClick = (ad: CompactAd) => {
        trackAction(ad.id, 'click');
        window.open(ad.link_url, '_blank');
    };

    if (loading || ads.length === 0) return null;

    // Different layouts based on placement
    if (placement === 'about') {
        // 3-column grid for about page
        return (
            <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className}`}>
                {ads.map((ad, idx) => (
                    <motion.div
                        key={ad.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => handleClick(ad)}
                        className="group cursor-pointer rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--accent-primary)]/50 transition-all"
                    >
                        <div className="aspect-video relative overflow-hidden">
                            <img 
                                src={ad.image_url} 
                                alt={ad.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute bottom-2 left-2 right-2">
                                <p className="text-white text-xs font-medium line-clamp-1">{ad.title}</p>
                            </div>
                        </div>
                        {ad.description && (
                            <div className="p-2">
                                <p className="text-[10px] text-[var(--text-muted)] line-clamp-2">{ad.description}</p>
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>
        );
    }

    if (placement === 'home-input') {
        // Banner ad below input - full width, natural aspect ratio
        const ad = ads[0];
        if (!ad) return null;
        
        return (
            <motion.a
                href={ad.link_url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => trackAction(ad.id, 'click')}
                className={`block cursor-pointer rounded-xl overflow-hidden border border-[var(--border-color)] hover:border-[var(--accent-primary)]/50 transition-all ${className}`}
            >
                {/* GIF/Image - full width, natural height */}
                <img 
                    src={ad.image_url} 
                    alt={ad.title}
                    className="w-full h-auto"
                />
            </motion.a>
        );
    }

    if (placement === 'home-bottom') {
        // Horizontal scroll or grid at bottom
        return (
            <div className={`space-y-3 ${className}`}>
                <p className="text-xs text-[var(--text-muted)] text-center">Sponsored</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {ads.map((ad, idx) => (
                        <motion.div
                            key={ad.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            onClick={() => handleClick(ad)}
                            className="group cursor-pointer rounded-xl overflow-hidden bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--accent-primary)]/50 transition-all"
                        >
                            <div className="flex items-center gap-3 p-3">
                                <img 
                                    src={ad.image_url} 
                                    alt={ad.title}
                                    className="w-12 h-12 rounded-lg object-cover shrink-0 group-hover:scale-105 transition-transform"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-1">{ad.title}</p>
                                    {ad.description && (
                                        <p className="text-[10px] text-[var(--text-muted)] line-clamp-1 mt-0.5">{ad.description}</p>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        );
    }

    // Default sidebar style
    return (
        <div className={`space-y-2 ${className}`}>
            {ads.map((ad, idx) => (
                <motion.div
                    key={ad.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    onClick={() => handleClick(ad)}
                    className="group cursor-pointer rounded-lg overflow-hidden bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--accent-primary)]/50 transition-all p-2"
                >
                    <div className="flex items-center gap-2">
                        <img 
                            src={ad.image_url} 
                            alt={ad.title}
                            className="w-10 h-10 rounded object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[var(--text-primary)] line-clamp-1">{ad.title}</p>
                            {ad.description && (
                                <p className="text-[10px] text-[var(--text-muted)] line-clamp-1">{ad.description}</p>
                            )}
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
}
