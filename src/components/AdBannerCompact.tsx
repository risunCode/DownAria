'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';

interface CompactAd {
    id: string;
    gif_url: string;
    link_url: string;
}

export function AdBannerCompact() {
    const [ads, setAds] = useState<CompactAd[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAds = async () => {
            try {
                const json = await api.get<{ success: boolean; data: CompactAd[] }>('/api/v1/ads?placement=compact');
                if (json.success && json.data?.length > 0) {
                    setAds(json.data);
                }
            } catch {
                // Silent fail
            } finally {
                setLoading(false);
            }
        };
        fetchAds();
    }, []);

    // Auto-rotate every 5 seconds
    useEffect(() => {
        if (ads.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % ads.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [ads.length]);

    const handleClick = (ad: CompactAd) => {
        api.post('/api/v1/ads', { id: ad.id, placement: 'compact' }).catch(() => {});
        window.open(ad.link_url, '_blank', 'noopener,noreferrer');
    };

    if (loading || ads.length === 0) return null;

    const ad = ads[currentIndex];

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={ad.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={() => handleClick(ad)}
                className="cursor-pointer rounded-lg overflow-hidden"
            >
                <img 
                    src={ad.gif_url} 
                    alt="Ad" 
                    className="w-full h-auto max-h-20 object-contain"
                />
            </motion.div>
        </AnimatePresence>
    );
}

export default AdBannerCompact;
