'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    MessageSquare, Bell, Image, LayoutGrid, Plus, RefreshCw, 
    Edit2, Trash2, Eye, EyeOff, ExternalLink, Send, Users,
    Clock, CheckCircle, XCircle, AlertTriangle
} from 'lucide-react';
import Swal from 'sweetalert2';

import AdminGuard from '@/components/AdminGuard';
import { AdminCard, AdminModal } from '@/components/admin';
import { 
    useCommunications, 
    useAnnouncements, 
    useBannerAds, 
    useCompactAds, 
    usePushNotifications,
    type Announcement,
    type BannerAd,
    type CompactAd,
} from '@/hooks/admin';

type TabType = 'announcements' | 'push' | 'banner' | 'compact';

export default function CommunicationsPage() {
    return (
        <AdminGuard requiredRole="admin">
            <CommunicationsContent />
        </AdminGuard>
    );
}

function CommunicationsContent() {
    const [activeTab, setActiveTab] = useState<TabType>('announcements');
    const { refetch: refetchAll } = useCommunications();

    const tabs = [
        { id: 'announcements' as TabType, label: 'Announcements', icon: MessageSquare },
        { id: 'push' as TabType, label: 'Push Notifications', icon: Bell },
        { id: 'banner' as TabType, label: 'Banner Ads', icon: Image },
        { id: 'compact' as TabType, label: 'Compact Ads', icon: LayoutGrid },
    ];

    return (
        <div className="p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <MessageSquare className="w-6 h-6 text-[var(--accent-primary)]" />
                            Communications
                        </h1>
                        <p className="text-[var(--text-muted)] text-sm">Announcements & push notifications</p>
                    </div>
                    <button
                        onClick={() => refetchAll()}
                        className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-card)] transition-colors"
                    >
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap items-center gap-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-[var(--accent-primary)] text-white'
                                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                            }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
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
                        {activeTab === 'announcements' && <AnnouncementsTab />}
                        {activeTab === 'push' && <PushNotificationsTab />}
                        {activeTab === 'banner' && <BannerAdsTab />}
                        {activeTab === 'compact' && <CompactAdsTab />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

// ============================================================================
// ANNOUNCEMENTS TAB
// ============================================================================
function AnnouncementsTab() {
    const { announcements, loading, refetch, create, update, remove } = useAnnouncements();
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        type: 'info' as Announcement['type'],
        icon: '📢',
        link_url: '',
        link_text: '',
        show_on_home: true,
        show_on_history: false,
        show_on_settings: false,
        show_on_docs: false,
        priority: 0,
        enabled: true,
    });

    const resetForm = () => {
        setFormData({ title: '', message: '', type: 'info', icon: '📢', link_url: '', link_text: '', show_on_home: true, show_on_history: false, show_on_settings: false, show_on_docs: false, priority: 0, enabled: true });
        setEditingId(null);
    };

    const handleOpenCreate = () => {
        resetForm();
        setShowModal(true);
    };

    const handleOpenEdit = (ann: Announcement) => {
        setEditingId(ann.id);
        setFormData({
            title: ann.title,
            message: ann.message,
            type: ann.type,
            icon: ann.icon || '📢',
            link_url: ann.link_url || '',
            link_text: ann.link_text || '',
            show_on_home: ann.show_on_home,
            show_on_history: ann.show_on_history,
            show_on_settings: ann.show_on_settings,
            show_on_docs: ann.show_on_docs,
            priority: ann.priority,
            enabled: ann.enabled,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.title || !formData.message) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Title and message are required', background: 'var(--bg-card)', color: 'var(--text-primary)' });
            return;
        }
        
        const result = editingId 
            ? await update(editingId, formData)
            : await create(formData);
            
        if (result.success) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: editingId ? 'Updated!' : 'Created!', showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            setShowModal(false);
            resetForm();
        }
    };

    const handleToggleEnabled = async (ann: Announcement) => {
        const result = await update(ann.id, { enabled: !ann.enabled });
        if (result.success) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: ann.enabled ? 'Disabled' : 'Enabled', showConfirmButton: false, timer: 1000, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        }
    };

    const handleDelete = async (ann: Announcement) => {
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Delete Announcement?',
            text: `"${ann.title}" will be permanently deleted.`,
            showCancelButton: true,
            confirmButtonText: 'Delete',
            confirmButtonColor: '#ef4444',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        
        if (result.isConfirmed) {
            const deleteResult = await remove(ann.id);
            if (deleteResult.success) {
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Deleted!', showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            }
        }
    };

    const typeColors = {
        info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        success: 'bg-green-500/20 text-green-400 border-green-500/30',
        error: 'bg-red-500/20 text-red-400 border-red-500/30',
        promo: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    };

    if (loading) {
        return <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={handleOpenCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-90">
                    <Plus className="w-4 h-4" /> New Announcement
                </button>
            </div>

            {announcements.length === 0 ? (
                <AdminCard>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <MessageSquare className="w-12 h-12 text-[var(--text-muted)] mb-4" />
                        <h3 className="font-semibold text-lg mb-2">No Announcements</h3>
                        <p className="text-[var(--text-muted)] text-sm">Create your first announcement to show alerts to users</p>
                    </div>
                </AdminCard>
            ) : (
                <div className="space-y-3">
                    {announcements.map((ann) => (
                        <AdminCard key={ann.id}>
                            <div className="flex items-start gap-4">
                                <span className="text-2xl">{ann.icon || '📢'}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <h3 className="font-semibold">{ann.title}</h3>
                                        <span className={`px-2 py-0.5 rounded text-xs border ${typeColors[ann.type]}`}>{ann.type}</span>
                                        {!ann.enabled && <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">Disabled</span>}
                                    </div>
                                    <p className="text-sm text-[var(--text-muted)] mb-2">{ann.message}</p>
                                    <div className="flex flex-wrap gap-2 text-xs text-[var(--text-muted)]">
                                        {ann.show_on_home && <span className="px-2 py-1 rounded bg-[var(--bg-secondary)]">Home</span>}
                                        {ann.show_on_history && <span className="px-2 py-1 rounded bg-[var(--bg-secondary)]">History</span>}
                                        {ann.show_on_settings && <span className="px-2 py-1 rounded bg-[var(--bg-secondary)]">Settings</span>}
                                        {ann.show_on_docs && <span className="px-2 py-1 rounded bg-[var(--bg-secondary)]">Docs</span>}
                                    </div>
                                </div>
                                
                                {/* Stats */}
                                <div className="flex flex-col items-end gap-1 text-xs text-[var(--text-muted)] shrink-0">
                                    <div className="flex items-center gap-1"><Eye className="w-3 h-3" /> {ann.views}</div>
                                    <div className="flex items-center gap-1"><XCircle className="w-3 h-3" /> {ann.dismisses}</div>
                                    <div className="flex items-center gap-1"><ExternalLink className="w-3 h-3" /> {ann.clicks}</div>
                                </div>
                                
                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => handleToggleEnabled(ann)}
                                        className={`p-2 rounded-lg transition-colors ${ann.enabled ? 'hover:bg-yellow-500/20 text-yellow-400' : 'hover:bg-green-500/20 text-green-400'}`}
                                        title={ann.enabled ? 'Disable' : 'Enable'}
                                    >
                                        {ann.enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                    <button
                                        onClick={() => handleOpenEdit(ann)}
                                        className="p-2 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors"
                                        title="Edit"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(ann)}
                                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </AdminCard>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            <AdminModal open={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingId ? 'Edit Announcement' : 'Create Announcement'} size="lg">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Title *</label>
                            <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" placeholder="Announcement title" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Type</label>
                            <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as Announcement['type'] })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                                <option value="info">Info</option>
                                <option value="warning">Warning</option>
                                <option value="success">Success</option>
                                <option value="error">Error</option>
                                <option value="promo">Promo</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Message *</label>
                        <textarea value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] min-h-[80px]" placeholder="Announcement message" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Icon</label>
                            <input type="text" value={formData.icon} onChange={(e) => setFormData({ ...formData, icon: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" placeholder="📢" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Link URL</label>
                            <input type="text" value={formData.link_url} onChange={(e) => setFormData({ ...formData, link_url: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" placeholder="https://..." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Link Text</label>
                            <input type="text" value={formData.link_text} onChange={(e) => setFormData({ ...formData, link_text: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" placeholder="Learn more" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Show on pages</label>
                        <div className="flex flex-wrap gap-3">
                            {['home', 'history', 'settings', 'docs'].map((page) => (
                                <label key={page} className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={formData[`show_on_${page}` as keyof typeof formData] as boolean} onChange={(e) => setFormData({ ...formData, [`show_on_${page}`]: e.target.checked })} className="rounded" />
                                    <span className="text-sm capitalize">{page}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border-color)]">
                        <button onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)]">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-90">{editingId ? 'Save Changes' : 'Create'}</button>
                    </div>
                </div>
            </AdminModal>
        </div>
    );
}

// ============================================================================
// PUSH NOTIFICATIONS TAB
// ============================================================================
function PushNotificationsTab() {
    const { notifications, subscriberCount, vapidConfigured, loading, send } = usePushNotifications();
    const [showModal, setShowModal] = useState(false);
    const [sending, setSending] = useState(false);
    const [formData, setFormData] = useState({ title: '', body: '', icon: '', image: '', click_url: '' });

    const handleSend = async () => {
        if (!formData.title || !formData.body) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Title and body are required', background: 'var(--bg-card)', color: 'var(--text-primary)' });
            return;
        }
        setSending(true);
        const result = await send({ ...formData, send_now: true });
        setSending(false);
        if (result.success) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Sent to ${(result as { stats?: { sent: number } }).stats?.sent || 0} subscribers`, showConfirmButton: false, timer: 2000, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            setShowModal(false);
            setFormData({ title: '', body: '', icon: '', image: '', click_url: '' });
        }
    };

    if (loading) {
        return <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <AdminCard>
                    <div className="text-center">
                        <Users className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                        <div className="text-2xl font-bold">{subscriberCount}</div>
                        <div className="text-xs text-[var(--text-muted)]">Subscribers</div>
                    </div>
                </AdminCard>
                <AdminCard>
                    <div className="text-center">
                        <Send className="w-6 h-6 mx-auto mb-2 text-green-400" />
                        <div className="text-2xl font-bold">{notifications.filter(n => n.status === 'sent').length}</div>
                        <div className="text-xs text-[var(--text-muted)]">Sent</div>
                    </div>
                </AdminCard>
                <AdminCard>
                    <div className="text-center">
                        <Clock className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
                        <div className="text-2xl font-bold">{notifications.filter(n => n.status === 'scheduled').length}</div>
                        <div className="text-xs text-[var(--text-muted)]">Scheduled</div>
                    </div>
                </AdminCard>
                <AdminCard>
                    <div className="text-center">
                        {vapidConfigured ? <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-400" /> : <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-400" />}
                        <div className="text-sm font-medium">{vapidConfigured ? 'Configured' : 'Not Set'}</div>
                        <div className="text-xs text-[var(--text-muted)]">VAPID</div>
                    </div>
                </AdminCard>
            </div>

            <div className="flex justify-end">
                <button onClick={() => setShowModal(true)} disabled={!vapidConfigured} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-90 disabled:opacity-50">
                    <Send className="w-4 h-4" /> Send Notification
                </button>
            </div>

            {notifications.length === 0 ? (
                <AdminCard>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Bell className="w-12 h-12 text-[var(--text-muted)] mb-4" />
                        <h3 className="font-semibold text-lg mb-2">No Push Notifications</h3>
                        <p className="text-[var(--text-muted)] text-sm">Send your first push notification to subscribers</p>
                    </div>
                </AdminCard>
            ) : (
                <div className="space-y-3">
                    {notifications.map((notif) => (
                        <AdminCard key={notif.id}>
                            <div className="flex items-start gap-4">
                                <Bell className="w-5 h-5 text-[var(--accent-primary)] mt-1" />
                                <div className="flex-1">
                                    <h3 className="font-semibold">{notif.title}</h3>
                                    <p className="text-sm text-[var(--text-muted)]">{notif.body}</p>
                                    <div className="flex gap-4 mt-2 text-xs text-[var(--text-muted)]">
                                        <span>Sent: {notif.total_sent}</span>
                                        <span>Clicked: {notif.total_clicked}</span>
                                        <span>Failed: {notif.total_failed}</span>
                                    </div>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs ${notif.status === 'sent' ? 'bg-green-500/20 text-green-400' : notif.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                    {notif.status}
                                </span>
                            </div>
                        </AdminCard>
                    ))}
                </div>
            )}

            {/* Send Modal */}
            <AdminModal open={showModal} onClose={() => setShowModal(false)} title="Send Push Notification">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Title *</label>
                        <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" placeholder="Notification title" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Body *</label>
                        <textarea value={formData.body} onChange={(e) => setFormData({ ...formData, body: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] min-h-[80px]" placeholder="Notification message" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Click URL</label>
                        <input type="text" value={formData.click_url} onChange={(e) => setFormData({ ...formData, click_url: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" placeholder="https://..." />
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border-color)]">
                        <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)]">Cancel</button>
                        <button onClick={handleSend} disabled={sending} className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white disabled:opacity-50">
                            {sending ? 'Sending...' : `Send to ${subscriberCount} subscribers`}
                        </button>
                    </div>
                </div>
            </AdminModal>
        </div>
    );
}

// ============================================================================
// BANNER ADS TAB
// ============================================================================
function BannerAdsTab() {
    const { banners, loading, create, update, remove } = useBannerAds();
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '', image_url: '', link_url: '', alt_text: '',
        placement: 'home' as BannerAd['placement'], position: 'bottom' as BannerAd['position'],
        badge_text: '', badge_color: 'yellow', sponsor_text: '', priority: 0, enabled: true,
    });

    const resetForm = () => {
        setFormData({ name: '', image_url: '', link_url: '', alt_text: '', placement: 'home', position: 'bottom', badge_text: '', badge_color: 'yellow', sponsor_text: '', priority: 0, enabled: true });
        setEditingId(null);
    };

    const handleOpenEdit = (banner: BannerAd) => {
        setEditingId(banner.id);
        setFormData({
            name: banner.name, image_url: banner.image_url, link_url: banner.link_url, alt_text: banner.alt_text || '',
            placement: banner.placement, position: banner.position, badge_text: banner.badge_text || '',
            badge_color: banner.badge_color, sponsor_text: banner.sponsor_text || '', priority: banner.priority, enabled: banner.enabled,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.image_url || !formData.link_url) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Name, image URL, and link URL are required', background: 'var(--bg-card)', color: 'var(--text-primary)' });
            return;
        }
        const result = editingId ? await update(editingId, formData) : await create(formData);
        if (result.success) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: editingId ? 'Updated!' : 'Created!', showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            setShowModal(false);
            resetForm();
        }
    };

    const handleToggleEnabled = async (banner: BannerAd) => {
        const result = await update(banner.id, { enabled: !banner.enabled });
        if (result.success) Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: banner.enabled ? 'Disabled' : 'Enabled', showConfirmButton: false, timer: 1000, background: 'var(--bg-card)', color: 'var(--text-primary)' });
    };

    const handleDelete = async (banner: BannerAd) => {
        const result = await Swal.fire({ icon: 'warning', title: 'Delete Banner?', text: `"${banner.name}" will be permanently deleted.`, showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#ef4444', background: 'var(--bg-card)', color: 'var(--text-primary)' });
        if (result.isConfirmed) {
            const deleteResult = await remove(banner.id);
            if (deleteResult.success) Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Deleted!', showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        }
    };

    if (loading) {
        return <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-90">
                    <Plus className="w-4 h-4" /> New Banner
                </button>
            </div>

            {banners.length === 0 ? (
                <AdminCard>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Image className="w-12 h-12 text-[var(--text-muted)] mb-4" />
                        <h3 className="font-semibold text-lg mb-2">No Banner Ads</h3>
                        <p className="text-[var(--text-muted)] text-sm">Create banner advertisements</p>
                    </div>
                </AdminCard>
            ) : (
                <div className="grid md:grid-cols-2 gap-4">
                    {banners.map((banner) => (
                        <AdminCard key={banner.id}>
                            <div className="space-y-3">
                                <img src={banner.image_url} alt={banner.alt_text || banner.name} className="w-full h-32 object-cover rounded-lg" />
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold">{banner.name}</h3>
                                            {!banner.enabled && <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">Disabled</span>}
                                        </div>
                                        {banner.badge_text && <span className="inline-block px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400 mt-1">{banner.badge_text}</span>}
                                        <div className="flex gap-4 mt-2 text-xs text-[var(--text-muted)]">
                                            <span>👁 {banner.impressions}</span>
                                            <span>🖱 {banner.clicks}</span>
                                            <span className="capitalize">{banner.placement}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => handleToggleEnabled(banner)} className={`p-2 rounded-lg transition-colors ${banner.enabled ? 'hover:bg-yellow-500/20 text-yellow-400' : 'hover:bg-green-500/20 text-green-400'}`} title={banner.enabled ? 'Disable' : 'Enable'}>
                                            {banner.enabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                        <button onClick={() => handleOpenEdit(banner)} className="p-2 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors" title="Edit">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(banner)} className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors" title="Delete">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </AdminCard>
                    ))}
                </div>
            )}

            <AdminModal open={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingId ? 'Edit Banner Ad' : 'Create Banner Ad'} size="lg">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Name *</label>
                            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Placement</label>
                            <select value={formData.placement} onChange={(e) => setFormData({ ...formData, placement: e.target.value as BannerAd['placement'] })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                                <option value="home">Home</option>
                                <option value="result">Result</option>
                                <option value="history">History</option>
                                <option value="all">All Pages</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Image URL *</label>
                        <input type="text" value={formData.image_url} onChange={(e) => setFormData({ ...formData, image_url: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" placeholder="https://..." />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Link URL *</label>
                        <input type="text" value={formData.link_url} onChange={(e) => setFormData({ ...formData, link_url: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" placeholder="https://..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Badge Text</label>
                            <input type="text" value={formData.badge_text} onChange={(e) => setFormData({ ...formData, badge_text: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" placeholder="🔥 Hot Deal" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Sponsor</label>
                            <input type="text" value={formData.sponsor_text} onChange={(e) => setFormData({ ...formData, sponsor_text: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" placeholder="Shopee" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border-color)]">
                        <button onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)]">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white">{editingId ? 'Save Changes' : 'Create'}</button>
                    </div>
                </div>
            </AdminModal>
        </div>
    );
}

// ============================================================================
// COMPACT ADS TAB
// ============================================================================
function CompactAdsTab() {
    const { compactAds, loading, create, update, remove } = useCompactAds();
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '', title: '', description: '', image_url: '', link_url: '',
        preview_title: '', preview_description: '', preview_image: '',
        placement: 'all' as CompactAd['placement'], size: 'medium' as CompactAd['size'], priority: 0, enabled: true,
    });

    const resetForm = () => {
        setFormData({ name: '', title: '', description: '', image_url: '', link_url: '', preview_title: '', preview_description: '', preview_image: '', placement: 'all', size: 'medium', priority: 0, enabled: true });
        setEditingId(null);
    };

    const handleOpenEdit = (ad: CompactAd) => {
        setEditingId(ad.id);
        setFormData({
            name: ad.name, title: ad.title, description: ad.description || '', image_url: ad.image_url, link_url: ad.link_url,
            preview_title: ad.preview_title || '', preview_description: ad.preview_description || '', preview_image: ad.preview_image || '',
            placement: ad.placement, size: ad.size, priority: ad.priority, enabled: ad.enabled,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.title || !formData.image_url || !formData.link_url) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Name, title, image URL, and link URL are required', background: 'var(--bg-card)', color: 'var(--text-primary)' });
            return;
        }
        const result = editingId ? await update(editingId, formData) : await create(formData);
        if (result.success) {
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: editingId ? 'Updated!' : 'Created!', showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            setShowModal(false);
            resetForm();
        }
    };

    const handleToggleEnabled = async (ad: CompactAd) => {
        const result = await update(ad.id, { enabled: !ad.enabled });
        if (result.success) Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: ad.enabled ? 'Disabled' : 'Enabled', showConfirmButton: false, timer: 1000, background: 'var(--bg-card)', color: 'var(--text-primary)' });
    };

    const handleDelete = async (ad: CompactAd) => {
        const result = await Swal.fire({ icon: 'warning', title: 'Delete Compact Ad?', text: `"${ad.title}" will be permanently deleted.`, showCancelButton: true, confirmButtonText: 'Delete', confirmButtonColor: '#ef4444', background: 'var(--bg-card)', color: 'var(--text-primary)' });
        if (result.isConfirmed) {
            const deleteResult = await remove(ad.id);
            if (deleteResult.success) Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Deleted!', showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        }
    };

    if (loading) {
        return <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-90">
                    <Plus className="w-4 h-4" /> New Compact Ad
                </button>
            </div>

            {compactAds.length === 0 ? (
                <AdminCard>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <LayoutGrid className="w-12 h-12 text-[var(--text-muted)] mb-4" />
                        <h3 className="font-semibold text-lg mb-2">No Compact Ads</h3>
                        <p className="text-[var(--text-muted)] text-sm">Create compact advertisements with GIF/image support</p>
                    </div>
                </AdminCard>
            ) : (
                <div className="grid md:grid-cols-3 gap-4">
                    {compactAds.map((ad) => (
                        <AdminCard key={ad.id}>
                            <div className="space-y-3">
                                <img src={ad.image_url} alt={ad.title} className="w-full h-24 object-cover rounded-lg" />
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-sm">{ad.title}</h3>
                                            {!ad.enabled && <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">Off</span>}
                                        </div>
                                        {ad.description && <p className="text-xs text-[var(--text-muted)] line-clamp-2">{ad.description}</p>}
                                        <div className="flex gap-3 mt-2 text-xs text-[var(--text-muted)]">
                                            <span>👁 {ad.impressions}</span>
                                            <span>🖱 {ad.clicks}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => handleToggleEnabled(ad)} className={`p-1.5 rounded-lg transition-colors ${ad.enabled ? 'hover:bg-yellow-500/20 text-yellow-400' : 'hover:bg-green-500/20 text-green-400'}`} title={ad.enabled ? 'Disable' : 'Enable'}>
                                            {ad.enabled ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </button>
                                        <button onClick={() => handleOpenEdit(ad)} className="p-1.5 rounded-lg hover:bg-blue-500/20 text-blue-400 transition-colors" title="Edit">
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(ad)} className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors" title="Delete">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </AdminCard>
                    ))}
                </div>
            )}

            <AdminModal open={showModal} onClose={() => { setShowModal(false); resetForm(); }} title={editingId ? 'Edit Compact Ad' : 'Create Compact Ad'} size="lg">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Name *</label>
                            <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Title *</label>
                            <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Description</label>
                        <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" rows={2} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Image/GIF URL *</label>
                        <input type="text" value={formData.image_url} onChange={(e) => setFormData({ ...formData, image_url: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" placeholder="https://..." />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Link URL *</label>
                        <input type="text" value={formData.link_url} onChange={(e) => setFormData({ ...formData, link_url: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" placeholder="https://..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Placement</label>
                            <select value={formData.placement} onChange={(e) => setFormData({ ...formData, placement: e.target.value as CompactAd['placement'] })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                                <option value="home-input">Home (Below Input)</option>
                                <option value="home-bottom">Home (Bottom)</option>
                                <option value="about">About Page</option>
                                <option value="all">All Pages</option>
                            </select>
                            <p className="text-[10px] text-[var(--text-muted)] mt-1">Where the ad will appear</p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Size</label>
                            <select value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value as CompactAd['size'] })} className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                                <option value="large">Large</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border-color)]">
                        <button onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)]">Cancel</button>
                        <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white">{editingId ? 'Save Changes' : 'Create'}</button>
                    </div>
                </div>
            </AdminModal>
        </div>
    );
}
