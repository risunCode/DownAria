'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
    X, Plus, Trash2, Edit3, RefreshCw, CheckCircle, Clock, 
    AlertTriangle, XCircle, Save, TestTube, ToggleLeft, ToggleRight,
    Copy, Eye, EyeOff
} from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

type CookieStatus = 'healthy' | 'cooldown' | 'expired' | 'disabled';

interface PooledCookie {
    id: string;
    platform: string;
    cookie: string;
    cookiePreview?: string;
    label: string | null;
    user_id: string | null;
    status: CookieStatus;
    last_used_at: string | null;
    use_count: number;
    success_count: number;
    error_count: number;
    last_error: string | null;
    cooldown_until: string | null;
    max_uses_per_hour: number;
    enabled: boolean;
    note: string | null;
    created_at: string;
}

interface Props {
    platform: string;
    platformInfo: { id: string; name: string; icon: IconDefinition; color: string; bgColor: string; required: string };
    onClose: () => void;
}

export default function CookiePoolModal({ platform, platformInfo, onClose }: Props) {
    const [cookies, setCookies] = useState<PooledCookie[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [testingId, setTestingId] = useState<string | null>(null);
    const [showCookie, setShowCookie] = useState<string | null>(null);

    // Form state
    const [formCookie, setFormCookie] = useState('');
    const [formLabel, setFormLabel] = useState('');
    const [formNote, setFormNote] = useState('');
    const [formMaxUses, setFormMaxUses] = useState(60);
    const [saving, setSaving] = useState(false);

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

    const loadCookies = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`${API_URL}/api/admin/cookies/pool?platform=${platform}`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) {
                setCookies(data.data || []);
            } else {
                setError(data.error || 'Failed to load');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
        } finally {
            setLoading(false);
        }
    }, [platform, API_URL, getAuthHeaders]);

    useEffect(() => {
        loadCookies();
    }, [loadCookies]);

    const handleAdd = async () => {
        if (!formCookie.trim()) return;
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/cookies/pool`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    platform,
                    cookie: formCookie,
                    label: formLabel || null,
                    note: formNote || null,
                    max_uses_per_hour: formMaxUses
                })
            });
            const data = await res.json();
            if (data.success) {
                setShowAddForm(false);
                resetForm();
                loadCookies();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add');
        } finally {
            setSaving(false);
        }
    };


    const handleUpdate = async (id: string, updates: Record<string, unknown>) => {
        setSaving(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/cookies/pool/${id}`, {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify(updates)
            });
            const data = await res.json();
            if (data.success) {
                setEditingId(null);
                resetForm();
                loadCookies();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this cookie?')) return;
        try {
            const res = await fetch(`${API_URL}/api/admin/cookies/pool/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) {
                loadCookies();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
        }
    };

    const handleTest = async (id: string) => {
        setTestingId(id);
        try {
            const res = await fetch(`${API_URL}/api/admin/cookies/pool/${id}?test=true`, { headers: getAuthHeaders() });
            const data = await res.json();
            if (data.success) {
                if (data.data.healthy) {
                    alert('✅ Cookie is healthy!');
                } else {
                    alert(`❌ Cookie unhealthy: ${data.data.error}`);
                }
                loadCookies();
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Test failed');
        } finally {
            setTestingId(null);
        }
    };

    const handleToggle = async (id: string, enabled: boolean) => {
        await handleUpdate(id, { enabled: !enabled });
    };

    const handleResetStatus = async (id: string) => {
        await handleUpdate(id, { status: 'healthy' });
    };

    const resetForm = () => {
        setFormCookie('');
        setFormLabel('');
        setFormNote('');
        setFormMaxUses(60);
    };

    const startEdit = (cookie: PooledCookie) => {
        setEditingId(cookie.id);
        setFormLabel(cookie.label || '');
        setFormNote(cookie.note || '');
        setFormMaxUses(cookie.max_uses_per_hour);
    };

    const getStatusIcon = (status: CookieStatus, enabled: boolean) => {
        if (!enabled) return <XCircle className="w-4 h-4 text-gray-500" />;
        switch (status) {
            case 'healthy': return <CheckCircle className="w-4 h-4 text-green-400" />;
            case 'cooldown': return <Clock className="w-4 h-4 text-yellow-400" />;
            case 'expired': return <AlertTriangle className="w-4 h-4 text-red-400" />;
            default: return <XCircle className="w-4 h-4 text-gray-500" />;
        }
    };

    const getStatusText = (status: CookieStatus, enabled: boolean) => {
        if (!enabled) return 'Disabled';
        return status.charAt(0).toUpperCase() + status.slice(1);
    };

    const formatTime = (iso: string | null) => {
        if (!iso) return 'Never';
        const d = new Date(iso);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return d.toLocaleDateString();
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="glass-card w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${platformInfo.bgColor} flex items-center justify-center`}>
                            <FontAwesomeIcon icon={platformInfo.icon} className={`w-5 h-5 ${platformInfo.color}`} />
                        </div>
                        <div>
                            <h2 className="font-semibold text-lg">{platformInfo.name} Cookies</h2>
                            <p className="text-xs text-[var(--text-muted)]">Required: {platformInfo.required}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadCookies}
                            disabled={loading}
                            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>


                {/* Error */}
                {error && (
                    <div className="mx-4 mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center justify-between">
                        <span>{error}</span>
                        <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading ? (
                        <div className="text-center py-8 text-[var(--text-muted)]">Loading...</div>
                    ) : cookies.length === 0 && !showAddForm ? (
                        <div className="text-center py-8">
                            <p className="text-[var(--text-muted)] mb-4">No cookies configured</p>
                            <button
                                onClick={() => setShowAddForm(true)}
                                className="btn-primary px-4 py-2 rounded-lg flex items-center gap-2 mx-auto"
                            >
                                <Plus className="w-4 h-4" /> Add First Cookie
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Cookie List */}
                            {cookies.map((cookie) => (
                                <div
                                    key={cookie.id}
                                    className={`p-4 rounded-xl border transition-all ${
                                        !cookie.enabled 
                                            ? 'bg-[var(--bg-secondary)]/50 border-[var(--border-primary)] opacity-60' 
                                            : cookie.status === 'expired'
                                            ? 'bg-red-500/5 border-red-500/30'
                                            : cookie.status === 'cooldown'
                                            ? 'bg-yellow-500/5 border-yellow-500/30'
                                            : 'bg-[var(--bg-secondary)] border-[var(--border-primary)]'
                                    }`}
                                >
                                    {editingId === cookie.id ? (
                                        /* Edit Mode */
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                value={formLabel}
                                                onChange={(e) => setFormLabel(e.target.value)}
                                                placeholder="Label (optional)"
                                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm"
                                            />
                                            <input
                                                type="text"
                                                value={formNote}
                                                onChange={(e) => setFormNote(e.target.value)}
                                                placeholder="Note (optional)"
                                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm"
                                            />
                                            <div className="flex items-center gap-2">
                                                <label className="text-sm text-[var(--text-muted)]">Max uses/hour:</label>
                                                <input
                                                    type="number"
                                                    value={formMaxUses}
                                                    onChange={(e) => setFormMaxUses(Number(e.target.value))}
                                                    className="w-20 px-2 py-1 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleUpdate(cookie.id, { label: formLabel || null, note: formNote || null, max_uses_per_hour: formMaxUses })}
                                                    disabled={saving}
                                                    className="btn-primary px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
                                                >
                                                    <Save className="w-3.5 h-3.5" /> Save
                                                </button>
                                                <button
                                                    onClick={() => { setEditingId(null); resetForm(); }}
                                                    className="px-3 py-1.5 rounded-lg text-sm bg-[var(--bg-primary)] hover:bg-[var(--bg-secondary)]"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* View Mode */
                                        <>
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        {getStatusIcon(cookie.status, cookie.enabled)}
                                                        <span className="font-medium text-sm">
                                                            {cookie.label || cookie.cookiePreview || `Cookie #${cookie.id.slice(0, 8)}`}
                                                        </span>
                                                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                                                            !cookie.enabled ? 'bg-gray-500/20 text-gray-400' :
                                                            cookie.status === 'healthy' ? 'bg-green-500/20 text-green-400' :
                                                            cookie.status === 'cooldown' ? 'bg-yellow-500/20 text-yellow-400' :
                                                            'bg-red-500/20 text-red-400'
                                                        }`}>
                                                            {getStatusText(cookie.status, cookie.enabled)}
                                                        </span>
                                                    </div>
                                                    {cookie.user_id && (
                                                        <p className="text-xs text-[var(--text-muted)] mb-1">User ID: {cookie.user_id}</p>
                                                    )}
                                                    {cookie.note && (
                                                        <p className="text-xs text-[var(--text-muted)] italic">{cookie.note}</p>
                                                    )}
                                                </div>
                                            </div>


                                            {/* Stats Row */}
                                            <div className="flex items-center gap-4 mt-3 text-xs text-[var(--text-muted)]">
                                                <span>Uses: {cookie.use_count}</span>
                                                <span className="text-green-400">✓ {cookie.success_count}</span>
                                                <span className="text-red-400">✗ {cookie.error_count}</span>
                                                <span>Last: {formatTime(cookie.last_used_at)}</span>
                                            </div>

                                            {/* Error Message */}
                                            {cookie.last_error && (
                                                <p className="mt-2 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
                                                    {cookie.last_error}
                                                </p>
                                            )}

                                            {/* Cooldown Timer */}
                                            {cookie.status === 'cooldown' && cookie.cooldown_until && (
                                                <p className="mt-2 text-xs text-yellow-400">
                                                    Cooldown until: {new Date(cookie.cooldown_until).toLocaleTimeString()}
                                                </p>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-primary)]">
                                                <button
                                                    onClick={() => handleTest(cookie.id)}
                                                    disabled={testingId === cookie.id}
                                                    className="p-1.5 rounded hover:bg-[var(--bg-primary)] transition-colors"
                                                    title="Test Health"
                                                >
                                                    <TestTube className={`w-4 h-4 ${testingId === cookie.id ? 'animate-pulse' : ''}`} />
                                                </button>
                                                <button
                                                    onClick={() => handleToggle(cookie.id, cookie.enabled)}
                                                    className="p-1.5 rounded hover:bg-[var(--bg-primary)] transition-colors"
                                                    title={cookie.enabled ? 'Disable' : 'Enable'}
                                                >
                                                    {cookie.enabled ? <ToggleRight className="w-4 h-4 text-green-400" /> : <ToggleLeft className="w-4 h-4" />}
                                                </button>
                                                {(cookie.status === 'cooldown' || cookie.status === 'expired') && (
                                                    <button
                                                        onClick={() => handleResetStatus(cookie.id)}
                                                        className="p-1.5 rounded hover:bg-[var(--bg-primary)] transition-colors text-yellow-400"
                                                        title="Reset to Healthy"
                                                    >
                                                        <RefreshCw className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={async () => {
                                                        if (showCookie === cookie.id) {
                                                            setShowCookie(null);
                                                        } else {
                                                            // Fetch decrypted cookie from API
                                                            try {
                                                                const res = await fetch(`${API_URL}/api/admin/cookies/pool/${cookie.id}?decrypt=true`, { headers: getAuthHeaders() });
                                                                const data = await res.json();
                                                                if (data.success) {
                                                                    // Update cookie in local state with decrypted value
                                                                    setCookies(prev => prev.map(c => 
                                                                        c.id === cookie.id ? { ...c, cookie: data.data.cookie } : c
                                                                    ));
                                                                }
                                                            } catch {
                                                                // Fallback to showing masked value
                                                            }
                                                            setShowCookie(cookie.id);
                                                        }
                                                    }}
                                                    className="p-1.5 rounded hover:bg-[var(--bg-primary)] transition-colors"
                                                    title="Show Cookie"
                                                >
                                                    {showCookie === cookie.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                                <button
                                                    onClick={() => startEdit(cookie)}
                                                    className="p-1.5 rounded hover:bg-[var(--bg-primary)] transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(cookie.id)}
                                                    className="p-1.5 rounded hover:bg-[var(--bg-primary)] transition-colors text-red-400"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {/* Show Full Cookie */}
                                            {showCookie === cookie.id && (
                                                <div className="mt-3 p-2 bg-[var(--bg-primary)] rounded-lg">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-xs text-[var(--text-muted)]">Full Cookie:</span>
                                                        <button
                                                            onClick={() => navigator.clipboard.writeText(cookie.cookie)}
                                                            className="text-xs text-[var(--accent-primary)] flex items-center gap-1"
                                                        >
                                                            <Copy className="w-3 h-3" /> Copy
                                                        </button>
                                                    </div>
                                                    <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                                                        {cookie.cookie}
                                                    </pre>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            ))}


                            {/* Add Form */}
                            {showAddForm && (
                                <div className="p-4 rounded-xl border border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/5">
                                    <h3 className="font-medium mb-3 flex items-center gap-2">
                                        <Plus className="w-4 h-4" /> Add New Cookie
                                    </h3>
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs text-[var(--text-muted)] mb-1 block">Cookie Value *</label>
                                            <textarea
                                                value={formCookie}
                                                onChange={(e) => setFormCookie(e.target.value)}
                                                placeholder="Paste cookie JSON or string format..."
                                                rows={4}
                                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm font-mono"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs text-[var(--text-muted)] mb-1 block">Label</label>
                                                <input
                                                    type="text"
                                                    value={formLabel}
                                                    onChange={(e) => setFormLabel(e.target.value)}
                                                    placeholder="e.g. Account 1"
                                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-[var(--text-muted)] mb-1 block">Max Uses/Hour</label>
                                                <input
                                                    type="number"
                                                    value={formMaxUses}
                                                    onChange={(e) => setFormMaxUses(Number(e.target.value))}
                                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-[var(--text-muted)] mb-1 block">Note</label>
                                            <input
                                                type="text"
                                                value={formNote}
                                                onChange={(e) => setFormNote(e.target.value)}
                                                placeholder="Optional note..."
                                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-primary)] text-sm"
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleAdd}
                                                disabled={saving || !formCookie.trim()}
                                                className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                                            >
                                                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                Add Cookie
                                            </button>
                                            <button
                                                onClick={() => { setShowAddForm(false); resetForm(); }}
                                                className="px-4 py-2 rounded-lg text-sm bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)]"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                {cookies.length > 0 && !showAddForm && (
                    <div className="p-4 border-t border-[var(--border-primary)]">
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="btn-primary w-full py-2.5 rounded-lg flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add Cookie
                        </button>
                    </div>
                )}
            </motion.div>
        </motion.div>
    );
}
