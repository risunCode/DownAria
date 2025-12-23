'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, Eye, EyeOff, MessageSquare } from 'lucide-react';
import Swal from 'sweetalert2';
import { AdminModal, StatusBadge, EmptyState } from '@/components/admin';

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

interface AnnouncementsSectionProps {
    announcements: Announcement[];
    loading: boolean;
    onRefresh: () => void;
    getAuthHeaders: () => Record<string, string>;
}

const PAGES = ['home', 'settings', 'about', 'history', 'advanced'];
const TYPES = ['info', 'success', 'warning', 'error'];

export function AnnouncementsSection({ 
    announcements, 
    loading, 
    onRefresh, 
    getAuthHeaders 
}: AnnouncementsSectionProps) {
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

    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

    const handleSubmit = async () => {
        if (!form.title || !form.message) {
            Swal.fire({ 
                title: 'Error', 
                text: 'Title and message required', 
                icon: 'error', 
                background: 'var(--bg-card)', 
                color: 'var(--text-primary)' 
            });
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
            onRefresh();
            resetForm();
            Swal.fire({ 
                title: editing ? 'Updated!' : 'Created!', 
                icon: 'success', 
                timer: 1000, 
                showConfirmButton: false, 
                background: 'var(--bg-card)', 
                color: 'var(--text-primary)' 
            });
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
        
        await fetch(`${API_URL}/api/admin/announcements?id=${id}`, { 
            method: 'DELETE', 
            headers: getAuthHeaders() 
        });
        onRefresh();
    };

    const handleToggle = async (ann: Announcement) => {
        await fetch(`${API_URL}/api/admin/announcements`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ id: ann.id, enabled: !ann.enabled }),
        });
        onRefresh();
    };

    const resetForm = () => {
        setShowForm(false);
        setEditing(null);
        setForm({ 
            title: '', 
            message: '', 
            type: 'info', 
            pages: ['home'], 
            enabled: true, 
            show_once: false 
        });
    };

    const startEdit = (ann: Announcement) => {
        setEditing(ann);
        setForm({ 
            title: ann.title, 
            message: ann.message, 
            type: ann.type, 
            pages: ann.pages, 
            enabled: ann.enabled, 
            show_once: ann.show_once 
        });
        setShowForm(true);
    };

    const togglePage = (page: string) => {
        setForm(f => ({ 
            ...f, 
            pages: f.pages.includes(page) 
                ? f.pages.filter(p => p !== page) 
                : [...f.pages, page] 
        }));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-end">
                <button 
                    onClick={() => setShowForm(true)} 
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm"
                >
                    <Plus className="w-4 h-4" /> New
                </button>
            </div>

            {/* Form Modal */}
            <AdminModal 
                open={showForm} 
                onClose={resetForm} 
                title={`${editing ? 'Edit' : 'New'} Announcement`}
            >
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
                                <input 
                                    type="checkbox" 
                                    checked={form.enabled} 
                                    onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))} 
                                /> 
                                Enabled
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input 
                                    type="checkbox" 
                                    checked={form.show_once} 
                                    onChange={e => setForm(f => ({ ...f, show_once: e.target.checked }))} 
                                /> 
                                Once
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
        </div>
    );
}