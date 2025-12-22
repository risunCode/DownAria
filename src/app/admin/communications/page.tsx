'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    MessageSquare, Plus, Edit, Trash2, RefreshCw, X, Eye, EyeOff, 
    Bell, Send, Users, AlertCircle, Loader2, Settings, Megaphone, ExternalLink, MousePointer, BarChart3
} from 'lucide-react';
import Swal from 'sweetalert2';
import AdminGuard from '@/components/AdminGuard';
import { AdminCard, AdminModal, StatCard, StatusBadge, EmptyState } from '@/components/admin';

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

const PAGES = ['home', 'settings', 'about', 'history', 'advanced'];
const TYPES = ['info', 'success', 'warning', 'error'];
const AD_PAGES = ['home', 'history', 'advanced'];

export default function CommunicationsPage() {
    return (
        <AdminGuard requiredRole="admin">
            <CommunicationsContent />
        </AdminGuard>
    );
}

function CommunicationsContent() {
    const [activeTab, setActiveTab] = useState<'announcements' | 'push' | 'ads'>('announcements');
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Announcement | null>(null);
    const [form, setForm] = useState({
        title: '',
        message: '',
        type: 'info',
        pages: ['home'],
        enabled: true,
        show_once: false,
    });

    // Push notification state
    const [pushStats, setPushStats] = useState<PushStats | null>(null);
    const [pushLoading, setPushLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [pushForm, setPushForm] = useState({ title: '', body: '', url: '/' });

    // Ads state
    const [ads, setAds] = useState<Ad[]>([]);
    const [adsLoading, setAdsLoading] = useState(false);
    const [showAdForm, setShowAdForm] = useState(false);
    const [editingAd, setEditingAd] = useState<Ad | null>(null);
    const [adForm, setAdForm] = useState({
        title: '',
        description: '',
        image_url: '',
        link_url: '',
        badge_text: '',
        badge_color: '#f97316',
        is_active: true,
        dismissable: true,
        pages: ['home'],
        priority: 0,
    });

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

    useEffect(() => {
        fetchAnnouncements();
        fetchPushStats();
        fetchAds();
    }, [fetchAnnouncements, fetchPushStats, fetchAds]);

    const handleSubmit = async () => {
        if (!form.title || !form.message) {
            Swal.fire({ title: 'Error', text: 'Title and message required', icon: 'error', background: 'var(--bg-card)', color: 'var(--text-primary)' });
            return;
        }
        const method = editing ? 'PUT' : 'POST';
        const body = editing ? { id: editing.id, ...form } : form;
        const res = await fetch(`${API_URL}/api/admin/announcements`, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(body),
        });
        if ((await res.json()).success) {
            fetchAnnouncements();
            resetForm();
            Swal.fire({ title: editing ? 'Updated!' : 'Created!', icon: 'success', timer: 1000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        }
    };

    const handleDelete = async (id: number) => {
        const result = await Swal.fire({
            title: 'Delete announcement?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!result.isConfirmed) return;
        await fetch(`${API_URL}/api/admin/announcements?id=${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        fetchAnnouncements();
    };

    const handleToggle = async (ann: Announcement) => {
        await fetch(`${API_URL}/api/admin/announcements`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ id: ann.id, enabled: !ann.enabled }),
        });
        fetchAnnouncements();
    };

    const resetForm = () => {
        setShowForm(false);
        setEditing(null);
        setForm({ title: '', message: '', type: 'info', pages: ['home'], enabled: true, show_once: false });
    };

    const startEdit = (ann: Announcement) => {
        setEditing(ann);
        setForm({ title: ann.title, message: ann.message, type: ann.type, pages: ann.pages, enabled: ann.enabled, show_once: ann.show_once });
        setShowForm(true);
    };

    const togglePage = (page: string) => {
        setForm(f => ({ ...f, pages: f.pages.includes(page) ? f.pages.filter(p => p !== page) : [...f.pages, page] }));
    };

    // Ads handlers
    const handleAdSubmit = async () => {
        if (!adForm.title || !adForm.image_url || !adForm.link_url) {
            Swal.fire({ title: 'Error', text: 'Title, image URL, and link URL are required', icon: 'error', background: 'var(--bg-card)', color: 'var(--text-primary)' });
            return;
        }
        const method = editingAd ? 'PUT' : 'POST';
        const body = editingAd ? { id: editingAd.id, ...adForm } : adForm;
        const res = await fetch(`${API_URL}/api/admin/ads`, {
            method,
            headers: getAuthHeaders(),
            body: JSON.stringify(body),
        });
        if ((await res.json()).success) {
            fetchAds();
            resetAdForm();
            Swal.fire({ title: editingAd ? 'Updated!' : 'Created!', icon: 'success', timer: 1000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        }
    };

    const handleAdDelete = async (id: number) => {
        const result = await Swal.fire({
            title: 'Delete ad?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!result.isConfirmed) return;
        await fetch(`${API_URL}/api/admin/ads?id=${id}`, { method: 'DELETE', headers: getAuthHeaders() });
        fetchAds();
    };

    const handleAdToggle = async (ad: Ad) => {
        await fetch(`${API_URL}/api/admin/ads`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ id: ad.id, is_active: !ad.is_active }),
        });
        fetchAds();
    };

    const resetAdForm = () => {
        setShowAdForm(false);
        setEditingAd(null);
        setAdForm({ title: '', description: '', image_url: '', link_url: '', badge_text: '', badge_color: '#f97316', is_active: true, dismissable: true, pages: ['home'], priority: 0 });
    };

    const startEditAd = (ad: Ad) => {
        setEditingAd(ad);
        setAdForm({ 
            title: ad.title || '', 
            description: ad.description || '', 
            image_url: ad.image_url || '', 
            link_url: ad.link_url || '', 
            badge_text: ad.badge_text || '', 
            badge_color: ad.badge_color || '#f97316', 
            is_active: ad.is_active ?? true, 
            dismissable: ad.dismissable ?? true,
            pages: ad.pages || ['home'],
            priority: ad.priority ?? 0 
        });
        setShowAdForm(true);
    };

    const toggleAdPage = (page: string) => {
        setAdForm(f => ({ 
            ...f, 
            pages: f.pages.includes(page) 
                ? f.pages.filter(p => p !== page) 
                : [...f.pages, page] 
        }));
    };

    const sendPushNotification = async () => {
        if (!pushForm.title.trim()) {
            Swal.fire({ icon: 'warning', title: 'Title Required', background: 'var(--bg-card)', color: 'var(--text-primary)' });
            return;
        }
        const confirm = await Swal.fire({
            icon: 'question',
            title: 'Send Push Notification?',
            html: `<p class="text-sm">This will send to <b>${pushStats?.subscriberCount || 0}</b> subscribers</p>`,
            showCancelButton: true,
            confirmButtonText: 'Send',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)'
        });
        if (!confirm.isConfirmed) return;

        setSending(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/push`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(pushForm)
            });
            const data = await res.json();
            if (data.success) {
                Swal.fire({ icon: 'success', title: 'Sent!', html: `Sent: ${data.sent} | Failed: ${data.failed}`, background: 'var(--bg-card)', color: 'var(--text-primary)' });
                setPushForm({ title: '', body: '', url: '/' });
                fetchPushStats();
            } else throw new Error(data.error);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Failed', text: error instanceof Error ? error.message : 'Unknown error', background: 'var(--bg-card)', color: 'var(--text-primary)' });
        } finally {
            setSending(false);
        }
    };

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
                    onClick={() => { fetchAnnouncements(); fetchPushStats(); fetchAds(); }} 
                    className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]"
                >
                    <RefreshCw className={`w-4 h-4 ${loading || pushLoading || adsLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('announcements')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'announcements' 
                            ? 'bg-[var(--accent-primary)] text-white' 
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                    }`}
                >
                    <MessageSquare className="w-4 h-4" /> Announcements
                </button>
                <button
                    onClick={() => setActiveTab('push')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'push' 
                            ? 'bg-[var(--accent-primary)] text-white' 
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                    }`}
                >
                    <Bell className="w-4 h-4" /> Push Notifications
                </button>
                <button
                    onClick={() => setActiveTab('ads')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        activeTab === 'ads' 
                            ? 'bg-[var(--accent-primary)] text-white' 
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                    }`}
                >
                    <Megaphone className="w-4 h-4" /> Advertising
                </button>
            </div>

            {/* Announcements Tab */}
            {activeTab === 'announcements' && (
                <>
                    <div className="flex justify-end">
                        <button 
                            onClick={() => setShowForm(true)} 
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm"
                        >
                            <Plus className="w-4 h-4" /> New
                        </button>
                    </div>

                    {/* Form Modal */}
                    <AdminModal open={showForm} onClose={resetForm} title={`${editing ? 'Edit' : 'New'} Announcement`}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Title</label>
                                <input 
                                    type="text" 
                                    value={form.title} 
                                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                    className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Message</label>
                                <textarea 
                                    value={form.message} 
                                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                                    className="w-full h-24 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm resize-none" 
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-[var(--text-muted)] mb-1">Type</label>
                                    <select 
                                        value={form.type} 
                                        onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                        className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm"
                                    >
                                        {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-end gap-4">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} /> Enabled
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input type="checkbox" checked={form.show_once} onChange={e => setForm(f => ({ ...f, show_once: e.target.checked }))} /> Once
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-2">Pages</label>
                                <div className="flex flex-wrap gap-2">
                                    {PAGES.map(p => (
                                        <button 
                                            key={p} 
                                            onClick={() => togglePage(p)}
                                            className={`px-3 py-1 rounded-full text-xs ${
                                                form.pages.includes(p) 
                                                    ? 'bg-[var(--accent-primary)] text-white' 
                                                    : 'bg-[var(--bg-secondary)]'
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button 
                                onClick={handleSubmit} 
                                className="w-full py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm"
                            >
                                {editing ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </AdminModal>

                    {/* List */}
                    <div className="space-y-3">
                        {loading ? (
                            <div className="text-center py-12 text-[var(--text-muted)]">Loading...</div>
                        ) : announcements.length === 0 ? (
                            <EmptyState
                                icon={<MessageSquare className="w-8 h-8" />}
                                title="No Announcements"
                                description="Create your first announcement"
                                action={{ label: 'Create Announcement', onClick: () => setShowForm(true) }}
                            />
                        ) : announcements.map((ann, i) => (
                            <motion.div 
                                key={ann.id} 
                                initial={{ opacity: 0, y: 10 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                transition={{ delay: i * 0.05 }}
                                className={`glass-card p-4 ${!ann.enabled ? 'opacity-50' : ''}`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <StatusBadge status={ann.type as 'info' | 'success' | 'warning' | 'error'} />
                                            {ann.show_once && <span className="text-xs text-[var(--text-muted)]">once</span>}
                                        </div>
                                        <h3 className="font-medium">{ann.title}</h3>
                                        <p className="text-sm text-[var(--text-muted)] truncate">{ann.message}</p>
                                        <div className="flex gap-1 mt-2">
                                            {ann.pages.map(p => (
                                                <span key={p} className="px-2 py-0.5 bg-[var(--bg-secondary)] rounded text-xs">{p}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleToggle(ann)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
                                            {ann.enabled ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => startEdit(ann)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(ann.id)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </>
            )}

            {/* Push Notifications Tab */}
            {activeTab === 'push' && (
                <div className="space-y-6">
                    {/* Config Warning */}
                    {!pushStats?.isConfigured && (
                        <AdminCard className="border-amber-500/30 bg-amber-500/10">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                                <div>
                                    <p className="font-medium text-amber-400">VAPID Keys Not Configured</p>
                                    <p className="text-sm text-[var(--text-muted)] mt-1">
                                        Add to backend .env (api-xtfetch): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
                                    </p>
                                </div>
                            </div>
                        </AdminCard>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <StatCard
                            icon={<Users className="w-5 h-5" />}
                            label="Subscribers"
                            value={(pushStats?.subscriberCount || 0).toString()}
                            color="text-blue-400"
                        />
                        <StatCard
                            icon={<Settings className="w-5 h-5" />}
                            label="VAPID Status"
                            value={pushStats?.isConfigured ? 'Ready' : 'Not Configured'}
                            color={pushStats?.isConfigured ? 'text-green-400' : 'text-red-400'}
                        />
                    </div>

                    {/* Send Form */}
                    <AdminCard>
                        <h2 className="font-semibold mb-4 flex items-center gap-2">
                            <Send className="w-5 h-5 text-[var(--accent-primary)]" /> Send Push Notification
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Title *</label>
                                <input 
                                    type="text" 
                                    value={pushForm.title} 
                                    onChange={e => setPushForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="New Feature Available!" 
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" 
                                    maxLength={100} 
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Body</label>
                                <textarea 
                                    value={pushForm.body} 
                                    onChange={e => setPushForm(f => ({ ...f, body: e.target.value }))}
                                    placeholder="Check out the latest updates..." 
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] resize-none" 
                                    rows={3} 
                                    maxLength={200} 
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Click URL</label>
                                <input 
                                    type="text" 
                                    value={pushForm.url} 
                                    onChange={e => setPushForm(f => ({ ...f, url: e.target.value }))}
                                    placeholder="/" 
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] font-mono text-sm" 
                                />
                            </div>
                            <button 
                                onClick={sendPushNotification} 
                                disabled={sending || !pushStats?.isConfigured || !pushStats?.subscriberCount}
                                className="w-full py-2.5 bg-[var(--accent-primary)] text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {sending ? 'Sending...' : `Send to ${pushStats?.subscriberCount || 0} Subscribers`}
                            </button>
                        </div>
                    </AdminCard>
                </div>
            )}

            {/* Advertising Tab */}
            {activeTab === 'ads' && (
                <>
                    <div className="flex justify-between items-center">
                        <p className="text-sm text-[var(--text-muted)]">Manage banner ads shown on homepage</p>
                        <button 
                            onClick={() => setShowAdForm(true)} 
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm"
                        >
                            <Plus className="w-4 h-4" /> New Ad
                        </button>
                    </div>

                    {/* Ad Form Modal - Wide with Preview */}
                    <AdminModal open={showAdForm} onClose={resetAdForm} title={`${editingAd ? 'Edit' : 'New'} Advertisement`} size="3xl">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Form */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs text-[var(--text-muted)] mb-1">Title *</label>
                                        <input 
                                            type="text" 
                                            value={adForm.title} 
                                            onChange={e => setAdForm(f => ({ ...f, title: e.target.value }))}
                                            placeholder="Shopee 12.12 Sale!"
                                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm" 
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-[var(--text-muted)] mb-1">Badge Text</label>
                                        <input 
                                            type="text" 
                                            value={adForm.badge_text} 
                                            onChange={e => setAdForm(f => ({ ...f, badge_text: e.target.value }))}
                                            placeholder="🔥 Hot Deal"
                                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-[var(--text-muted)] mb-1">Description</label>
                                    <textarea 
                                        value={adForm.description} 
                                        onChange={e => setAdForm(f => ({ ...f, description: e.target.value }))}
                                        placeholder="Get up to 90% off on all items!"
                                        className="w-full h-16 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm resize-none" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-[var(--text-muted)] mb-1">Image URL *</label>
                                    <input 
                                        type="text" 
                                        value={adForm.image_url} 
                                        onChange={e => setAdForm(f => ({ ...f, image_url: e.target.value }))}
                                        placeholder="https://example.com/banner.jpg"
                                        className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-xs font-mono" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-[var(--text-muted)] mb-1">Link URL *</label>
                                    <input 
                                        type="text" 
                                        value={adForm.link_url} 
                                        onChange={e => setAdForm(f => ({ ...f, link_url: e.target.value }))}
                                        placeholder="https://shopee.co.id/..."
                                        className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-xs font-mono" 
                                    />
                                </div>
                                <div className="grid grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-xs text-[var(--text-muted)] mb-1">Badge Color</label>
                                        <div className="flex gap-1">
                                            <input 
                                                type="color" 
                                                value={adForm.badge_color} 
                                                onChange={e => setAdForm(f => ({ ...f, badge_color: e.target.value }))}
                                                className="w-9 h-9 rounded cursor-pointer border-0" 
                                            />
                                            <input 
                                                type="text" 
                                                value={adForm.badge_color} 
                                                onChange={e => setAdForm(f => ({ ...f, badge_color: e.target.value }))}
                                                className="flex-1 px-2 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-xs font-mono" 
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-[var(--text-muted)] mb-1">Priority</label>
                                        <input 
                                            type="number" 
                                            value={adForm.priority} 
                                            onChange={e => setAdForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm" 
                                        />
                                    </div>
                                    <div className="flex items-end pb-1">
                                        <label className="flex items-center gap-2 text-xs">
                                            <input 
                                                type="checkbox" 
                                                checked={adForm.dismissable} 
                                                onChange={e => setAdForm(f => ({ ...f, dismissable: e.target.checked }))} 
                                                className="w-4 h-4"
                                            /> 
                                            Dismissable
                                        </label>
                                    </div>
                                    <div className="flex items-end pb-1">
                                        <label className="flex items-center gap-2 text-xs">
                                            <input 
                                                type="checkbox" 
                                                checked={adForm.is_active} 
                                                onChange={e => setAdForm(f => ({ ...f, is_active: e.target.checked }))} 
                                                className="w-4 h-4"
                                            /> 
                                            Enabled
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-[var(--text-muted)] mb-2">Show on Pages</label>
                                    <div className="flex flex-wrap gap-2">
                                        {AD_PAGES.map(p => (
                                            <button 
                                                key={p} 
                                                type="button"
                                                onClick={() => toggleAdPage(p)}
                                                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                                                    adForm.pages.includes(p) 
                                                        ? 'bg-[var(--accent-primary)] text-white' 
                                                        : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <button 
                                    onClick={handleAdSubmit} 
                                    className="w-full py-2.5 bg-[var(--accent-primary)] text-white rounded-lg text-sm font-medium"
                                >
                                    {editingAd ? 'Update' : 'Create'}
                                </button>
                            </div>

                            {/* Live Preview */}
                            <div className="space-y-3">
                                <label className="block text-xs text-[var(--text-muted)]">Live Preview</label>
                                <div className="glass-card p-4 rounded-xl overflow-hidden">
                                    {/* Banner Image */}
                                    <div className="relative w-full aspect-[2/1] rounded-lg overflow-hidden bg-[var(--bg-secondary)] mb-3">
                                        {adForm.image_url ? (
                                            <img 
                                                src={adForm.image_url} 
                                                alt="Preview" 
                                                className="w-full h-full object-cover"
                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] text-sm">
                                                No image
                                            </div>
                                        )}
                                        {/* Badge */}
                                        {adForm.badge_text && (
                                            <div 
                                                className="absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium text-white"
                                                style={{ backgroundColor: adForm.badge_color }}
                                            >
                                                {adForm.badge_text}
                                            </div>
                                        )}
                                    </div>
                                    {/* Content */}
                                    <h3 className="font-semibold text-[var(--text-primary)] mb-1">
                                        {adForm.title || 'Ad Title'}
                                    </h3>
                                    {adForm.description && (
                                        <p className="text-sm text-[var(--text-muted)] line-clamp-2 mb-3">
                                            {adForm.description}
                                        </p>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-[var(--text-muted)]">Sponsored</span>
                                        <button className="px-4 py-1.5 bg-[var(--accent-primary)] text-white text-sm rounded-lg">
                                            Shop Now →
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-[var(--text-muted)] text-center">
                                    This is how the ad will appear on homepage
                                </p>
                            </div>
                        </div>
                    </AdminModal>

                    {/* Ads List */}
                    <div className="space-y-3">
                        {adsLoading ? (
                            <div className="text-center py-12 text-[var(--text-muted)]">Loading...</div>
                        ) : ads.length === 0 ? (
                            <EmptyState
                                icon={<Megaphone className="w-8 h-8" />}
                                title="No Advertisements"
                                description="Create your first ad banner"
                                action={{ label: 'Create Ad', onClick: () => setShowAdForm(true) }}
                            />
                        ) : ads.map((ad, i) => (
                            <motion.div 
                                key={ad.id} 
                                initial={{ opacity: 0, y: 10 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                transition={{ delay: i * 0.05 }}
                                className={`glass-card p-4 ${!ad.is_active ? 'opacity-50' : ''}`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Thumbnail */}
                                    <div className="w-24 h-16 rounded-lg overflow-hidden bg-[var(--bg-secondary)] flex-shrink-0">
                                        {ad.image_url && (
                                            <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                                        )}
                                    </div>
                                    
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-medium truncate">{ad.title}</h3>
                                            {ad.badge_text && (
                                                <span 
                                                    className="px-2 py-0.5 rounded text-xs text-white"
                                                    style={{ backgroundColor: ad.badge_color || '#f97316' }}
                                                >
                                                    {ad.badge_text}
                                                </span>
                                            )}
                                        </div>
                                        {ad.description && (
                                            <p className="text-sm text-[var(--text-muted)] truncate">{ad.description}</p>
                                        )}
                                        <div className="flex items-center gap-4 mt-2 text-xs text-[var(--text-muted)]">
                                            <span className="flex items-center gap-1">
                                                <BarChart3 className="w-3 h-3" /> {ad.impressions || 0} views
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <MousePointer className="w-3 h-3" /> {ad.clicks || 0} clicks
                                            </span>
                                            <a 
                                                href={ad.link_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-[var(--accent-primary)] hover:underline"
                                            >
                                                <ExternalLink className="w-3 h-3" /> Link
                                            </a>
                                        </div>
                                        {ad.pages && ad.pages.length > 0 && (
                                            <div className="flex gap-1 mt-2">
                                                {ad.pages.map(p => (
                                                    <span key={p} className="px-2 py-0.5 bg-[var(--bg-secondary)] rounded text-[10px] text-[var(--text-muted)]">{p}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Actions */}
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleAdToggle(ad)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
                                            {ad.is_active ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => startEditAd(ad)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleAdDelete(ad.id)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
                                            <Trash2 className="w-4 h-4 text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
