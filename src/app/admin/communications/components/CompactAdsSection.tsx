'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Eye, EyeOff, Zap, ExternalLink } from 'lucide-react';
import Swal from 'sweetalert2';
import { AdminModal, EmptyState } from '@/components/admin';

interface CompactAd {
    id: string;
    gif_url: string;
    link_url: string;
    is_active: boolean;
    click_count: number;
    created_at: string;
}

interface CompactAdsSectionProps {
    getAuthHeaders: () => Record<string, string>;
}

export function CompactAdsSection({ getAuthHeaders }: CompactAdsSectionProps) {
    const [ads, setAds] = useState<CompactAd[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingAd, setEditingAd] = useState<CompactAd | null>(null);
    const [form, setForm] = useState({ gif_url: '', link_url: '', is_active: true });

    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

    const fetchAds = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/ads?type=compact`, { headers: getAuthHeaders() });
            const json = await res.json();
            if (json.success) setAds(json.data || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, [API_URL, getAuthHeaders]);

    useEffect(() => { fetchAds(); }, [fetchAds]);

    const handleSubmit = async () => {
        if (!form.gif_url || !form.link_url) {
            Swal.fire({ title: 'Error', text: 'GIF URL and Link URL are required', icon: 'error', background: 'var(--bg-card)', color: 'var(--text-primary)' });
            return;
        }

        const method = editingAd ? 'PUT' : 'POST';
        const body = editingAd ? { id: editingAd.id, ...form, type: 'compact' } : { ...form, type: 'compact' };

        const res = await fetch(`${API_URL}/api/admin/ads`, { method, headers: getAuthHeaders(), body: JSON.stringify(body) });
        if ((await res.json()).success) {
            fetchAds();
            resetForm();
            Swal.fire({ title: editingAd ? 'Updated!' : 'Created!', icon: 'success', timer: 1000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        }
    };

    const handleDelete = async (id: string) => {
        const result = await Swal.fire({ title: 'Delete ad?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', background: 'var(--bg-card)', color: 'var(--text-primary)' });
        if (!result.isConfirmed) return;
        await fetch(`${API_URL}/api/admin/ads?id=${id}&type=compact`, { method: 'DELETE', headers: getAuthHeaders() });
        fetchAds();
    };

    const handleToggle = async (ad: CompactAd) => {
        await fetch(`${API_URL}/api/admin/ads`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ id: ad.id, is_active: !ad.is_active, type: 'compact' }) });
        fetchAds();
    };

    const resetForm = () => { setShowForm(false); setEditingAd(null); setForm({ gif_url: '', link_url: '', is_active: true }); };

    const startEdit = (ad: CompactAd) => {
        setEditingAd(ad);
        setForm({ gif_url: ad.gif_url, link_url: ad.link_url, is_active: ad.is_active });
        setShowForm(true);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <p className="text-sm text-[var(--text-muted)]">Simple GIF banners shown below download input</p>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm">
                    <Plus className="w-4 h-4" /> New Ad
                </button>
            </div>

            <AdminModal open={showForm} onClose={resetForm} title={`${editingAd ? 'Edit' : 'New'} Compact Ad`}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">GIF/Image URL *</label>
                        <input type="text" value={form.gif_url} onChange={e => setForm(f => ({ ...f, gif_url: e.target.value }))} placeholder="https://example.com/banner.gif" className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm font-mono" />
                    </div>
                    <div>
                        <label className="block text-xs text-[var(--text-muted)] mb-1">Link URL *</label>
                        <input type="text" value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} placeholder="https://shopee.co.id/..." className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-sm font-mono" />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4" /> Enabled
                    </label>
                    {form.gif_url && (
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-2">Preview</label>
                            <div className="rounded-lg overflow-hidden bg-[var(--bg-secondary)] p-2">
                                <img src={form.gif_url} alt="Preview" className="w-full h-auto max-h-24 object-contain" />
                            </div>
                        </div>
                    )}
                    <button onClick={handleSubmit} className="w-full py-2.5 bg-[var(--accent-primary)] text-white rounded-lg text-sm font-medium">
                        {editingAd ? 'Update' : 'Create'}
                    </button>
                </div>
            </AdminModal>

            <div className="space-y-2">
                {loading ? (
                    <div className="text-center py-8 text-[var(--text-muted)]">Loading...</div>
                ) : ads.length === 0 ? (
                    <EmptyState icon={<Zap className="w-8 h-8" />} title="No Compact Ads" description="Upload your first GIF banner" action={{ label: 'Add Ad', onClick: () => setShowForm(true) }} />
                ) : ads.map((ad, i) => (
                    <motion.div key={ad.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={`glass-card p-3 ${!ad.is_active ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-3">
                            <div className="w-24 h-16 rounded-lg overflow-hidden bg-[var(--bg-secondary)] flex-shrink-0">
                                <img src={ad.gif_url} alt="" className="w-full h-full object-contain" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs text-[var(--text-muted)] truncate font-mono">{ad.gif_url}</p>
                                <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline mt-1">
                                    <ExternalLink className="w-3 h-3" /> {ad.link_url.substring(0, 40)}...
                                </a>
                                <p className="text-[10px] text-[var(--text-muted)] mt-1">{ad.click_count || 0} clicks</p>
                            </div>
                            <div className="flex items-center gap-1">
                                <button onClick={() => handleToggle(ad)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
                                    {ad.is_active ? <Eye className="w-4 h-4 text-green-400" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                                <button onClick={() => startEdit(ad)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(ad.id)} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
