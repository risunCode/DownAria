'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Info, AlertTriangle, CheckCircle, XCircle, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { getDismissedAnnouncements, dismissAnnouncement, isAnnouncementDismissed } from '@/lib/storage/settings';

interface Announcement {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'error' | 'promo';
    icon?: string;
    link_url?: string;
    link_text?: string;
    dismissable?: boolean;
    priority: number;
}

interface AnnouncementBannerProps {
    page: 'home' | 'history' | 'settings' | 'docs';
}

// Track action (impression, click, dismiss)
async function trackAction(id: string, action: 'impression' | 'click' | 'dismiss') {
    try {
        await api.post('/api/v1/communications', { type: 'announcement', id, action });
    } catch {
        // Silent fail
    }
}

export default function AnnouncementBanner({ page }: AnnouncementBannerProps) {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [visibleAnnouncements, setVisibleAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch announcements on mount
    useEffect(() => {
        const fetchAnnouncements = async () => {
            try {
                const json = await api.get<{ success: boolean; data?: { announcements: Announcement[] } }>(`/api/v1/communications?page=${page}`);
                if (json.success && json.data?.announcements) {
                    setAnnouncements(json.data.announcements);
                }
            } catch (err) {
                console.error('Failed to fetch announcements:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAnnouncements();
    }, [page]);

    // Filter out dismissed announcements
    useEffect(() => {
        const visible = announcements.filter(ann => !isAnnouncementDismissed(ann.id));
        setVisibleAnnouncements(visible);
        
        // Track impressions for visible announcements
        visible.forEach(ann => trackAction(ann.id, 'impression'));
    }, [announcements]);

    const handleDismiss = (id: string) => {
        dismissAnnouncement(id);
        trackAction(id, 'dismiss');
        setVisibleAnnouncements(prev => prev.filter(ann => ann.id !== id));
    };

    const handleClick = (id: string, url?: string) => {
        trackAction(id, 'click');
        if (url) window.open(url, '_blank');
    };

    if (loading || visibleAnnouncements.length === 0) return null;

    const typeConfig = {
        info: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-400', Icon: Info },
        warning: { bg: 'bg-yellow-500/10 border-yellow-500/30', text: 'text-yellow-400', Icon: AlertTriangle },
        success: { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-400', Icon: CheckCircle },
        error: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', Icon: XCircle },
        promo: { bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-400', Icon: Sparkles },
    };

    return (
        <div className="space-y-2 mb-4">
            <AnimatePresence>
                {visibleAnnouncements.map((ann) => {
                    const config = typeConfig[ann.type] || typeConfig.info;
                    const IconComponent = config.Icon;

                    return (
                        <motion.div
                            key={ann.id}
                            initial={{ opacity: 0, y: -10, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: 'auto' }}
                            exit={{ opacity: 0, y: -10, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className={`relative p-3 rounded-xl border ${config.bg} ${config.text}`}
                        >
                            <div className="flex items-start gap-3">
                                {/* Icon */}
                                <div className="shrink-0 mt-0.5">
                                    {ann.icon ? (
                                        <span className="text-lg">{ann.icon}</span>
                                    ) : (
                                        <IconComponent className="w-5 h-5" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">{ann.title}</p>
                                    <p className="text-xs opacity-80 mt-0.5">{ann.message}</p>
                                    
                                    {ann.link_url && (
                                        <button
                                            onClick={() => handleClick(ann.id, ann.link_url)}
                                            className="inline-flex items-center gap-1 mt-2 text-xs font-medium hover:underline"
                                        >
                                            {ann.link_text || 'Learn more'}
                                            <ExternalLink className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                {/* Dismiss button - only show if dismissable */}
                                {(ann.dismissable !== false) && (
                                    <button
                                        onClick={() => handleDismiss(ann.id)}
                                        className="shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
                                        title="Dismiss (will reappear in 12 hours)"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
