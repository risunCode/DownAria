'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Plus, Edit, Trash2, RefreshCw, X, Eye, EyeOff, Bell, Send, Users, AlertCircle, CheckCircle, Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Swal from 'sweetalert2';
import AdminGuard from '@/components/AdminGuard';

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

interface PushStats {
    isConfigured: boolean;
    subscriberCount: number;
}

const PAGES = ['home', 'settings', 'about', 'history', 'advanced'];
const TYPES = ['info', 'success', 'warning', 'error'];

export default function AnnouncementsPage() {
    return (
        <AdminGuard requiredRole="admin">
            <AnnouncementsContent />
        </AdminGuard>
    );
}

function AnnouncementsContent() {
    const [activeTab, setActiveTab] = useState<'announcements' | 'push'>('announcements');
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

    const fetchAnnouncements = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/announcements');
            const json = await res.json();
            if (json.success) setAnnouncements(json.data || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    const fetchPushStats = useCallback(async () => {
        setPushLoading(true);
        try {
            const res = await fetch('/api/admin/push');
            const data = await res.json();
            if (data.success) setPushStats(data.data);
        } catch { /* ignore */ }
        setPushLoading(false);
    }, []);

    useEffect(() => {
        fetchAnnouncements();
        fetchPushStats();
    }, [fetchAnnouncements, fetchPushStats]);

    const handleSubmit = async () => {
        if (!form.title || !form.message) {
            Swal.fire({ title: 'Error', text: 'Title and message required', icon: 'error', background: 'var(--bg-card)', color: 'var(--text-primary)' });
            return;
        }
        const method = editing ? 'PUT' : 'POST';
        const body = editing ? { id: editing.id, ...form } : form;
        const res = await fetch('/api/announcements', {
            method,
            headers: { 'Content-Type': 'application/json' },
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
        await fetch(`/api/announcements?id=${id}`, { method: 'DELETE' });
        fetchAnnouncements();
    };

    const handleToggle = async (ann: Announcement) => {
        await fetch('/api/announcements', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
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
            const res = await fetch('/api/admin/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                        <Megaphone className="w-5 h-5 text-[var(--accent-primary)]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold">Announcements & Push</h1>
                        <p className="text-sm text-[var(--text-muted)]">Manage site alerts and push notifications</p>
                    </div>
                </div>
                <button onClick={() => { fetchAnnouncements(); fetchPushStats(); }} className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                    <RefreshCw className={`w-4 h-4 ${loading || pushLoading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('announcements')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'announcements' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}
                >
                    <Megaphone className="w-4 h-4" /> Announcements
                </button>
                <button
                    onClick={() => setActiveTab('push')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'push' ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}
                >
                    <Bell className="w-4 h-4" /> Push Notifications
                </button>
            </div>

            {/* Announcements Tab */}
            {activeTab === 'announcements' && (
                <>
                    <div className="flex justify-end">
                        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm">
                            <Plus className="w-4 h-4" /> New
                        </button>
                    </div>

                    {/* Form Modal */}
                    {showForm && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={resetForm}>
                            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                                    <h3 className="font-semibold">{editing ? 'Edit' : 'New'} Announcement</h3>
                                    <button onClick={resetForm} className="p-1 rounded hover:bg-[var(--bg-secondary)]"><X className="w-4 h-4" /></button>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">Title</label>
                                        <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                                            className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-[var(--text-muted)] mb-1">Message</label>
                                        <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                                            className="w-full h-24 px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm resize-none" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm text-[var(--text-muted)] mb-1">Type</label>
                                            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                                                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm">
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
                                                <button key={p} onClick={() => togglePage(p)}
                                                    className={`px-3 py-1 rounded-full text-xs ${form.pages.includes(p) ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-secondary)]'}`}>
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <button onClick={handleSubmit} className="w-full py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm">
                                        {editing ? 'Update' : 'Create'}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}

                    {/* List */}
                    <div className="space-y-3">
                        {loading ? (
                            <div className="text-center py-12 text-[var(--text-muted)]">Loading...</div>
                        ) : announcements.length === 0 ? (
                            <div className="text-center py-12 text-[var(--text-muted)]">No announcements yet</div>
                        ) : announcements.map((ann, i) => (
                            <motion.div key={ann.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                className={`glass-card p-4 ${!ann.enabled ? 'opacity-50' : ''}`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded text-xs ${
                                                ann.type === 'error' ? 'bg-red-500/20 text-red-400' :
                                                ann.type === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                                                ann.type === 'success' ? 'bg-green-500/20 text-green-400' :
                                                'bg-blue-500/20 text-blue-400'
                                            }`}>{ann.type}</span>
                                            {ann.show_once && <span className="text-xs text-[var(--text-muted)]">once</span>}
                                        </div>
                                        <h3 className="font-medium">{ann.title}</h3>
                                        <p className="text-sm text-[var(--text-muted)] truncate">{ann.message}</p>
                                        <div className="flex gap-1 mt-2">
                                            {ann.pages.map(p => <span key={p} className="px-2 py-0.5 bg-[var(--bg-secondary)] rounded text-xs">{p}</span>)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleToggle(ann)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
                                            {ann.enabled ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => startEdit(ann)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"><Edit className="w-4 h-4" /></button>
                                        <button onClick={() => handleDelete(ann.id)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"><Trash2 className="w-4 h-4 text-red-400" /></button>
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
                        <div className="glass-card p-4 border-amber-500/30 bg-amber-500/10">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                                <div>
                                    <p className="font-medium text-amber-400">VAPID Keys Not Configured</p>
                                    <p className="text-sm text-[var(--text-muted)] mt-1">Add to .env: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass-card p-4 flex items-center gap-3">
                            <div className="p-3 rounded-xl bg-blue-500/20"><Users className="w-6 h-6 text-blue-400" /></div>
                            <div>
                                <p className="text-2xl font-bold">{pushStats?.subscriberCount || 0}</p>
                                <p className="text-sm text-[var(--text-muted)]">Subscribers</p>
                            </div>
                        </div>
                        <div className="glass-card p-4 flex items-center gap-3">
                            <div className={`p-3 rounded-xl ${pushStats?.isConfigured ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                <Settings className={`w-6 h-6 ${pushStats?.isConfigured ? 'text-green-400' : 'text-red-400'}`} />
                            </div>
                            <div>
                                <p className="text-lg font-bold">{pushStats?.isConfigured ? 'Ready' : 'Not Configured'}</p>
                                <p className="text-sm text-[var(--text-muted)]">VAPID Status</p>
                            </div>
                        </div>
                    </div>

                    {/* Send Form */}
                    <div className="glass-card p-5">
                        <h2 className="font-semibold mb-4 flex items-center gap-2">
                            <Send className="w-5 h-5 text-[var(--accent-primary)]" /> Send Push Notification
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Title *</label>
                                <input type="text" value={pushForm.title} onChange={e => setPushForm(f => ({ ...f, title: e.target.value }))}
                                    placeholder="New Feature Available!" className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" maxLength={100} />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Body</label>
                                <textarea value={pushForm.body} onChange={e => setPushForm(f => ({ ...f, body: e.target.value }))}
                                    placeholder="Check out the latest updates..." className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] resize-none" rows={3} maxLength={200} />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-muted)] mb-1">Click URL</label>
                                <input type="text" value={pushForm.url} onChange={e => setPushForm(f => ({ ...f, url: e.target.value }))}
                                    placeholder="/" className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] font-mono text-sm" />
                            </div>
                            <Button onClick={sendPushNotification} disabled={sending || !pushStats?.isConfigured || !pushStats?.subscriberCount}
                                leftIcon={sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} className="w-full">
                                {sending ? 'Sending...' : `Send to ${pushStats?.subscriberCount || 0} Subscribers`}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
