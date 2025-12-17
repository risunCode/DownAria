'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Cookie, RefreshCw, Save, Trash2, Power, PowerOff, Plus, X, Info } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebook, faInstagram, faWeibo, faTwitter } from '@fortawesome/free-brands-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import AdminGuard from '@/components/AdminGuard';

type CookiePlatform = 'facebook' | 'instagram' | 'weibo' | 'twitter';

interface AdminCookie {
    platform: string;
    cookie: string;
    enabled: boolean;
    note: string | null;
    updated_at: string;
}

const PLATFORMS: { id: CookiePlatform; name: string; icon: IconDefinition; color: string; required: string }[] = [
    { id: 'facebook', name: 'Facebook', icon: faFacebook, color: 'text-blue-500', required: 'c_user, xs' },
    { id: 'instagram', name: 'Instagram', icon: faInstagram, color: 'text-pink-500', required: 'sessionid' },
    { id: 'weibo', name: 'Weibo', icon: faWeibo, color: 'text-orange-500', required: 'SUB' },
    { id: 'twitter', name: 'Twitter', icon: faTwitter, color: 'text-sky-400', required: 'auth_token' },
];

export default function AdminCookiesPage() {
    return (
        <AdminGuard requiredRole="admin">
            <CookiesContent />
        </AdminGuard>
    );
}

function CookiesContent() {
    const [cookies, setCookies] = useState<AdminCookie[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [editPlatform, setEditPlatform] = useState<CookiePlatform | null>(null);
    const [editValue, setEditValue] = useState('');
    const [editNote, setEditNote] = useState('');
    const [error, setError] = useState<string | null>(null);

    const loadCookies = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/admin/cookies');
            const data = await res.json();
            if (data.success) {
                setCookies(data.data || []);
            } else {
                setError(data.error || 'Failed to load cookies');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCookies();
    }, [loadCookies]);

    const handleSave = async (platform: CookiePlatform) => {
        if (!editValue.trim()) return;
        
        setSaving(platform);
        setError(null);
        
        try {
            const res = await fetch('/api/admin/cookies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform, cookie: editValue, note: editNote || undefined })
            });
            const data = await res.json();
            
            if (data.success) {
                await loadCookies();
                setEditPlatform(null);
                setEditValue('');
                setEditNote('');
            } else {
                setError(data.error || 'Failed to save');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
        } finally {
            setSaving(null);
        }
    };

    const handleToggle = async (platform: CookiePlatform, enabled: boolean) => {
        setSaving(platform);
        try {
            const res = await fetch('/api/admin/cookies', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform, enabled })
            });
            const data = await res.json();
            if (data.success) {
                await loadCookies();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
        } finally {
            setSaving(null);
        }
    };

    const handleDelete = async (platform: CookiePlatform) => {
        if (!confirm(`Delete ${platform} cookie?`)) return;
        
        setSaving(platform);
        try {
            const res = await fetch(`/api/admin/cookies?platform=${platform}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                await loadCookies();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
        } finally {
            setSaving(null);
        }
    };

    const getCookie = (platform: string) => cookies.find(c => c.platform === platform);

    return (
        <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Cookie className="w-6 h-6 text-[var(--accent-primary)]" />
                        Admin Cookies
                    </h1>
                    <p className="text-sm text-[var(--text-muted)]">
                        Global cookies for platforms. Users can override with their own.
                    </p>
                </div>
                <button
                    onClick={loadCookies}
                    disabled={loading}
                    className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PLATFORMS.map((platform, idx) => {
                    const cookie = getCookie(platform.id);
                    const isEditing = editPlatform === platform.id;
                    const isSaving = saving === platform.id;
                    
                    return (
                        <motion.div
                            key={platform.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="glass-card p-5"
                        >
                            {/* Platform Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <FontAwesomeIcon icon={platform.icon} className={`w-6 h-6 ${platform.color}`} />
                                    <div>
                                        <span className="font-semibold">{platform.name}</span>
                                        {cookie && (
                                            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                                                cookie.enabled 
                                                    ? 'bg-green-500/20 text-green-400' 
                                                    : 'bg-red-500/20 text-red-400'
                                            }`}>
                                                {cookie.enabled ? 'Active' : 'Disabled'}
                                            </span>
                                        )}
                                        {!cookie && (
                                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                                                Not set
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-1">
                                    {cookie && !isEditing && (
                                        <>
                                            <button
                                                onClick={() => handleToggle(platform.id, !cookie.enabled)}
                                                disabled={isSaving}
                                                className="p-1.5 rounded hover:bg-[var(--bg-secondary)] transition-colors"
                                                title={cookie.enabled ? 'Disable' : 'Enable'}
                                            >
                                                {cookie.enabled ? <PowerOff className="w-4 h-4 text-yellow-400" /> : <Power className="w-4 h-4 text-green-400" />}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(platform.id)}
                                                disabled={isSaving}
                                                className="p-1.5 rounded hover:bg-[var(--bg-secondary)] transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4 text-red-400" />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => {
                                            if (isEditing) {
                                                setEditPlatform(null);
                                                setEditValue('');
                                                setEditNote('');
                                            } else {
                                                setEditPlatform(platform.id);
                                                setEditValue(cookie?.cookie || '');
                                                setEditNote(cookie?.note || '');
                                            }
                                        }}
                                        className={`p-1.5 rounded transition-colors ${isEditing ? 'bg-red-500/20 text-red-400' : 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'}`}
                                    >
                                        {isEditing ? <X className="w-4 h-4" /> : cookie ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* Required cookies info */}
                            <div className="text-xs text-[var(--text-muted)] mb-3">
                                Required: <span className="font-mono text-[var(--text-secondary)]">{platform.required}</span>
                            </div>

                            {/* Cookie Info (not editing) */}
                            {cookie && !isEditing && (
                                <div className="space-y-2">
                                    <div className="font-mono text-xs text-[var(--text-muted)] bg-[var(--bg-secondary)] px-3 py-2 rounded-lg truncate">
                                        {cookie.cookie.length > 60 ? cookie.cookie.substring(0, 60) + '...' : cookie.cookie}
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                                        {cookie.note && <span className="truncate">📝 {cookie.note}</span>}
                                        <span className="shrink-0">Updated: {new Date(cookie.updated_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            )}

                            {/* No cookie (not editing) */}
                            {!cookie && !isEditing && (
                                <div className="p-3 rounded-lg bg-[var(--bg-secondary)] text-center">
                                    <p className="text-sm text-[var(--text-muted)]">No cookie configured</p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">Click + to add</p>
                                </div>
                            )}

                            {/* Edit Form */}
                            {isEditing && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-[var(--text-muted)] mb-1 block">
                                            Cookie (JSON array or string)
                                        </label>
                                        <textarea
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            placeholder='[{"name":"c_user","value":"xxx"}] or c_user=xxx; xs=xxx'
                                            className="w-full h-20 px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg font-mono resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-[var(--text-muted)] mb-1 block">Note (optional)</label>
                                        <input
                                            type="text"
                                            value={editNote}
                                            onChange={(e) => setEditNote(e.target.value)}
                                            placeholder="e.g., Account: myaccount"
                                            className="w-full px-3 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg"
                                        />
                                    </div>
                                    <button
                                        onClick={() => handleSave(platform.id)}
                                        disabled={isSaving || !editValue.trim()}
                                        className="w-full px-4 py-2 text-sm rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white font-medium disabled:opacity-50 transition-colors"
                                    >
                                        {isSaving ? 'Saving...' : 'Save Cookie'}
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>

            {/* Info */}
            <div className="glass-card p-4">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm">
                        <p className="font-medium text-[var(--text-secondary)] mb-2">How it works</p>
                        <ul className="space-y-1 text-xs text-[var(--text-muted)]">
                            <li>• Admin cookies are fallback when users don&apos;t have their own</li>
                            <li>• User cookies (Settings page) take priority over admin cookies</li>
                            <li>• Cookies are cached 5 minutes server-side for performance</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
