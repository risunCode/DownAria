'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, RefreshCw, Bell, Megaphone } from 'lucide-react';
import AdminGuard from '@/components/AdminGuard';
import { AnnouncementsSection, PushNotificationsSection, AdsSection } from './components';

interface Announcement {
    id: number;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    pages: string[];
    enabled: boolean;
    show_once: boolean;
    created_at: string;
}

interface Ad {
    id: number;
    title: string;
    description: string;
    image_url: string;
    link_url: string;
    badge_text: string;
    badge_color: string;
    is_active: boolean;
    dismissable: boolean;
    pages: string[];
    priority: number;
    impressions: number;
    clicks: number;
    created_at: string;
}

interface PushStats {
    isConfigured: boolean;
    subscriberCount: number;
}

type TabType = 'announcements' | 'push' | 'ads';

export default function CommunicationsPage() {
    return (
        <AdminGuard requiredRole="admin">
            <CommunicationsContent />
        </AdminGuard>
    );
}

function CommunicationsContent() {
    const [activeTab, setActiveTab] = useState<TabType>('announcements');
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [ads, setAds] = useState<Ad[]>([]);
    const [pushStats, setPushStats] = useState<PushStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [adsLoading, setAdsLoading] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

    // Get auth token from Supabase session
    const getAuthHeaders = useCallback((): Record<string, string> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const supabaseKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        if (supabaseKey) {
            try {
                const session = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
                const token = session?.access_token;
                if (token) headers['Authorization'] = `Bearer ${token}`;
            } catch { /* ignore */ }
        }
        return headers;
    }, []);

    const fetchAnnouncements = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/announcements`, { headers: getAuthHeaders() });
            const json = await res.json();
            if (json.success) setAnnouncements(json.data || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, [API_URL, getAuthHeaders]);

    const fetchPushStats = useCallback(async () => {
        setPushLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/push`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) setPushStats(data.data);
        } catch { /* ignore */ }
        setPushLoading(false);
    }, [API_URL, getAuthHeaders]);

    const fetchAds = useCallback(async () => {
        setAdsLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/ads`, { headers: getAuthHeaders() });
            const json = await res.json();
            if (json.success) setAds(json.data || []);
        } catch { /* ignore */ }
        setAdsLoading(false);
    }, [API_URL, getAuthHeaders]);

    const refreshAll = useCallback(() => {
        fetchAnnouncements();
        fetchPushStats();
        fetchAds();
    }, [fetchAnnouncements, fetchPushStats, fetchAds]);

    useEffect(() => {
        refreshAll();
    }, [refreshAll]);

    return (
        <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
                        <MessageSquare className="w-5 h-5 text-[var(--accent-primary)]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Communications</h1>
                        <p className="text-sm text-[var(--text-muted)]">Announcements & push notifications</p>
                    </div>
                </div>
                <button 
                    onClick={refreshAll} 
                    className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]"
                >
                    <RefreshCw className={`w-4 h-4 ${loading || pushLoading || adsLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2">
                <TabButton
                    active={activeTab === 'announcements'}
                    onClick={() => setActiveTab('announcements')}
                    icon={<MessageSquare className="w-4 h-4" />}
                    label="Announcements"
                />
                <TabButton
                    active={activeTab === 'push'}
                    onClick={() => setActiveTab('push')}
                    icon={<Bell className="w-4 h-4" />}
                    label="Push Notifications"
                />
                <TabButton
                    active={activeTab === 'ads'}
                    onClick={() => setActiveTab('ads')}
                    icon={<Megaphone className="w-4 h-4" />}
                    label="Advertising"
                />
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'announcements' && (
                        <AnnouncementsSection
                            announcements={announcements}
                            loading={loading}
                            onRefresh={fetchAnnouncements}
                            getAuthHeaders={getAuthHeaders}
                        />
                    )}
                    {activeTab === 'push' && (
                        <PushNotificationsSection
                            pushStats={pushStats}
                            pushLoading={pushLoading}
                            onRefresh={fetchPushStats}
                            getAuthHeaders={getAuthHeaders}
                        />
                    )}
                    {activeTab === 'ads' && (
                        <AdsSection
                            ads={ads}
                            adsLoading={adsLoading}
                            onRefresh={fetchAds}
                            getAuthHeaders={getAuthHeaders}
                        />
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

function TabButton({ 
    active, 
    onClick, 
    icon, 
    label 
}: { 
    active: boolean; 
    onClick: () => void; 
    icon: React.ReactNode; 
    label: string; 
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                    ? 'bg-[var(--accent-primary)] text-white'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
            }`}
        >
            {icon}
            {label}
        </button>
    );
}