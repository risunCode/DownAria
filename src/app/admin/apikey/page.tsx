'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Key, Plus, Copy, Trash2, Check, RefreshCw,
    Power, BarChart3, Clock, AlertTriangle, RotateCcw,
    Shield, Zap, Calendar, Hash, Eye, EyeOff, Info
} from 'lucide-react';
import Swal from 'sweetalert2';

interface ApiKey {
    id: string;
    name: string;
    key: string;
    enabled: boolean;
    rateLimit: number;
    created: string;
    lastUsed: string | null;
    expiresAt: string | null;
    stats: {
        totalRequests: number;
        successCount: number;
        errorCount: number;
    };
}

export default function ApiKeyPage() {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState<string | null>(null);
    const [newKeyModal, setNewKeyModal] = useState(false);
    const [newKeyResult, setNewKeyResult] = useState<{ key: ApiKey; plainKey: string } | null>(null);
    const [saving, setSaving] = useState<string | null>(null);
    const [showDocs, setShowDocs] = useState(false);

    // Form state
    const [newName, setNewName] = useState('');
    const [newRateLimit, setNewRateLimit] = useState(60);
    const [newIsTest, setNewIsTest] = useState(false);
    const [newKeyLength, setNewKeyLength] = useState(32);
    const [newKeyFormat, setNewKeyFormat] = useState<'alphanumeric' | 'hex' | 'base64'>('alphanumeric');
    const [newValidity, setNewValidity] = useState<number | null>(null);
    const [newPrefix, setNewPrefix] = useState('');

    const fetchKeys = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/apikeys');
            const data = await res.json();
            if (data.success) setKeys(data.data);
        } catch {
            // Failed to fetch keys
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchKeys(); }, []);

    const createKey = async () => {
        if (!newName.trim()) return;
        setSaving('create');
        try {
            const res = await fetch('/api/admin/apikeys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    name: newName,
                    rateLimit: newRateLimit,
                    isTest: newIsTest,
                    keyLength: newKeyLength,
                    keyFormat: newKeyFormat,
                    validityDays: newValidity,
                    prefix: newPrefix || undefined
                })
            });
            const data = await res.json();
            if (data.success) {
                setNewKeyResult({ key: data.data, plainKey: data.plainKey });
                setNewKeyModal(false);
                setNewName('');
                setNewRateLimit(60);
                setNewIsTest(false);
                setNewKeyLength(32);
                setNewKeyFormat('alphanumeric');
                setNewValidity(null);
                fetchKeys();
            }
        } catch {
            // Failed to create key
        } finally {
            setSaving(null);
        }
    };

    const toggleKey = async (id: string, enabled: boolean) => {
        setSaving(id);
        try {
            await fetch('/api/admin/apikeys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update', id, enabled })
            });
            setKeys(prev => prev.map(k => k.id === id ? { ...k, enabled } : k));
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: enabled ? 'Key enabled' : 'Key disabled', showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        } catch {
            // Failed to toggle key
        } finally {
            setSaving(null);
        }
    };

    const deleteKey = async (id: string, name: string) => {
        const result = await Swal.fire({
            title: 'Delete API Key?',
            html: `<p class="text-sm">Key "<b>${name}</b>" will be permanently deleted.</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Delete',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!result.isConfirmed) return;

        setSaving(id);
        try {
            await fetch('/api/admin/apikeys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', id })
            });
            setKeys(prev => prev.filter(k => k.id !== id));
        } catch {
            // Failed to delete key
        } finally {
            setSaving(null);
        }
    };

    const regenerateKey = async (id: string, name: string) => {
        const result = await Swal.fire({
            title: 'Regenerate Key?',
            html: `<p class="text-sm">The old key for "<b>${name}</b>" will stop working immediately.</p>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f59e0b',
            confirmButtonText: 'Regenerate',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
        if (!result.isConfirmed) return;

        setSaving(id);
        try {
            const res = await fetch('/api/admin/apikeys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'regenerate', id })
            });
            const data = await res.json();
            if (data.success) {
                setNewKeyResult({ key: data.data, plainKey: data.plainKey });
                fetchKeys();
            }
        } catch {
            // Failed to regenerate key
        } finally {
            setSaving(null);
        }
    };

    const copyToClipboard = async (text: string, id: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const formatDate = (date: string | null) => {
        if (!date) return 'Never';
        return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getSuccessRate = (stats: ApiKey['stats']) => {
        if (stats.totalRequests === 0) return 100;
        return Math.round((stats.successCount / stats.totalRequests) * 100);
    };

    const isExpired = (expiresAt: string | null) => expiresAt && new Date(expiresAt) < new Date();

    // Stats summary
    const totalKeys = keys.length;
    const activeKeys = keys.filter(k => k.enabled && !isExpired(k.expiresAt)).length;
    const totalRequests = keys.reduce((sum, k) => sum + k.stats.totalRequests, 0);

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[60vh]">
                <RefreshCw className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6">
            <div className="max-w-5xl mx-auto space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2">
                            <Key className="w-5 h-5 text-[var(--accent-primary)]" />
                            API Keys
                        </h1>
                        <p className="text-[var(--text-muted)] text-xs">Manage programmatic access</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowDocs(!showDocs)}
                            className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm flex items-center gap-2 hover:bg-[var(--bg-card)]"
                        >
                            <Info className="w-4 h-4" />
                            <span className="hidden sm:inline">Docs</span>
                        </button>
                        <button
                            onClick={() => setNewKeyModal(true)}
                            className="btn-gradient flex items-center gap-2 text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            New Key
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="glass-card p-3 text-center">
                        <div className="text-2xl font-bold text-[var(--accent-primary)]">{totalKeys}</div>
                        <div className="text-xs text-[var(--text-muted)]">Total Keys</div>
                    </div>
                    <div className="glass-card p-3 text-center">
                        <div className="text-2xl font-bold text-green-400">{activeKeys}</div>
                        <div className="text-xs text-[var(--text-muted)]">Active</div>
                    </div>
                    <div className="glass-card p-3 text-center">
                        <div className="text-2xl font-bold text-blue-400">{totalRequests.toLocaleString()}</div>
                        <div className="text-xs text-[var(--text-muted)]">Requests</div>
                    </div>
                </div>

                {/* Guest Playground Section */}
                <PlaygroundSettings />

                {/* API Docs (Collapsible) */}
                <AnimatePresence>
                    {showDocs && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="glass-card p-4 overflow-hidden"
                        >
                            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-yellow-400" />
                                Quick Start
                            </h3>
                            <div className="grid gap-2 text-xs">
                                <div className="p-2 rounded bg-[var(--bg-secondary)] font-mono overflow-x-auto">
                                    <span className="text-purple-400">POST</span> /api/download <span className="text-[var(--text-muted)]">← auto-detect platform</span>
                                </div>
                                <div className="p-2 rounded bg-[var(--bg-secondary)] font-mono overflow-x-auto">
                                    <span className="text-blue-400">POST</span> /api/download/facebook <span className="text-[var(--text-muted)]">← explicit</span>
                                </div>
                                <div className="p-2 rounded bg-[var(--bg-secondary)] font-mono overflow-x-auto">
                                    <span className="text-[var(--text-muted)]">Header:</span> X-API-Key: YOUR_KEY
                                </div>
                            </div>
                            <p className="text-[var(--text-muted)] text-xs mt-3">
                                Platforms: facebook, instagram, twitter, tiktok, youtube, weibo
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Empty State */}
                {keys.length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-8 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
                            <Key className="w-8 h-8 text-[var(--text-muted)]" />
                        </div>
                        <h3 className="font-semibold mb-1">No API Keys</h3>
                        <p className="text-sm text-[var(--text-muted)] mb-4">Create your first key to start using the API</p>
                        <button onClick={() => setNewKeyModal(true)} className="btn-gradient">
                            <Plus className="w-4 h-4 mr-2" />
                            Create API Key
                        </button>
                    </motion.div>
                )}

                {/* Keys Table */}
                {keys.length > 0 && (
                    <div className="glass-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/50">
                                        <th className="text-left p-3 font-medium">Name</th>
                                        <th className="text-left p-3 font-medium hidden md:table-cell">Key</th>
                                        <th className="text-center p-3 font-medium">Status</th>
                                        <th className="text-center p-3 font-medium hidden sm:table-cell">Usage</th>
                                        <th className="text-center p-3 font-medium hidden lg:table-cell">Rate</th>
                                        <th className="text-right p-3 font-medium">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {keys.map((apiKey, idx) => (
                                        <motion.tr
                                            key={apiKey.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: idx * 0.03 }}
                                            className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--bg-secondary)]/30"
                                        >
                                            {/* Name */}
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${apiKey.enabled && !isExpired(apiKey.expiresAt) ? 'bg-green-400' : 'bg-red-400'}`} />
                                                    <div>
                                                        <div className="font-medium flex items-center gap-1">
                                                            {apiKey.name}
                                                            {apiKey.key.includes('test') && (
                                                                <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-400">TEST</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-[var(--text-muted)]">
                                                            {formatDate(apiKey.created)}
                                                            {apiKey.expiresAt && (
                                                                <span className={isExpired(apiKey.expiresAt) ? 'text-red-400 ml-1' : 'text-yellow-400 ml-1'}>
                                                                    • {isExpired(apiKey.expiresAt) ? 'Expired' : `Exp ${formatDate(apiKey.expiresAt)}`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Key Preview */}
                                            <td className="p-3 hidden md:table-cell">
                                                <div className="flex items-center gap-1">
                                                    <code className="text-xs bg-[var(--bg-secondary)] px-2 py-1 rounded font-mono">
                                                        {apiKey.key}
                                                    </code>
                                                    <button
                                                        onClick={() => copyToClipboard(apiKey.key, apiKey.id)}
                                                        className="p-1 rounded hover:bg-[var(--bg-secondary)]"
                                                    >
                                                        {copied === apiKey.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-[var(--text-muted)]" />}
                                                    </button>
                                                </div>
                                            </td>

                                            {/* Status */}
                                            <td className="p-3 text-center">
                                                {isExpired(apiKey.expiresAt) ? (
                                                    <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-400">Expired</span>
                                                ) : apiKey.enabled ? (
                                                    <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400">Active</span>
                                                ) : (
                                                    <span className="text-xs px-2 py-1 rounded-full bg-gray-500/10 text-gray-400">Disabled</span>
                                                )}
                                            </td>

                                            {/* Usage Stats */}
                                            <td className="p-3 text-center hidden sm:table-cell">
                                                <div className="text-xs">
                                                    <span className="font-medium">{apiKey.stats.totalRequests.toLocaleString()}</span>
                                                    <span className="text-[var(--text-muted)]"> req</span>
                                                </div>
                                                <div className="text-[10px] text-[var(--text-muted)]">
                                                    <span className="text-green-400">{getSuccessRate(apiKey.stats)}%</span> success
                                                </div>
                                            </td>

                                            {/* Rate Limit */}
                                            <td className="p-3 text-center hidden lg:table-cell">
                                                <span className="text-xs">{apiKey.rateLimit}/min</span>
                                            </td>

                                            {/* Actions */}
                                            <td className="p-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => toggleKey(apiKey.id, !apiKey.enabled)}
                                                        disabled={saving === apiKey.id}
                                                        className={`p-1.5 rounded-lg transition-colors ${apiKey.enabled ? 'hover:bg-yellow-500/10 hover:text-yellow-400' : 'hover:bg-green-500/10 hover:text-green-400'} text-[var(--text-muted)]`}
                                                        title={apiKey.enabled ? 'Disable' : 'Enable'}
                                                    >
                                                        <Power className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => regenerateKey(apiKey.id, apiKey.name)}
                                                        disabled={saving === apiKey.id}
                                                        className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                                                        title="Regenerate"
                                                    >
                                                        <RotateCcw className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteKey(apiKey.id, apiKey.name)}
                                                        disabled={saving === apiKey.id}
                                                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Create Key Modal */}
                <AnimatePresence>
                    {newKeyModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
                            onClick={() => setNewKeyModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="glass-card p-5 max-w-md w-full"
                                onClick={e => e.stopPropagation()}
                            >
                                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                    <Key className="w-5 h-5 text-[var(--accent-primary)]" />
                                    New API Key
                                </h3>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-[var(--text-muted)] mb-1">Name *</label>
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            placeholder="e.g. Production, Mobile App"
                                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                            autoFocus
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-[var(--text-muted)] mb-1">Rate Limit</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={newRateLimit}
                                                    onChange={e => setNewRateLimit(parseInt(e.target.value) || 60)}
                                                    min={1}
                                                    max={1000}
                                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm pr-12"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">/min</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-[var(--text-muted)] mb-1">Validity</label>
                                            <select
                                                value={newValidity ?? 'never'}
                                                onChange={e => setNewValidity(e.target.value === 'never' ? null : parseInt(e.target.value))}
                                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                            >
                                                <option value="never">Never expires</option>
                                                <option value={7}>7 days</option>
                                                <option value={30}>30 days</option>
                                                <option value={90}>90 days</option>
                                                <option value={365}>1 year</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-[var(--text-muted)] mb-1">Length</label>
                                            <select
                                                value={newKeyLength}
                                                onChange={e => setNewKeyLength(parseInt(e.target.value))}
                                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                            >
                                                <option value={16}>16 chars</option>
                                                <option value={24}>24 chars</option>
                                                <option value={32}>32 chars</option>
                                                <option value={48}>48 chars</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs text-[var(--text-muted)] mb-1">Format</label>
                                            <select
                                                value={newKeyFormat}
                                                onChange={e => setNewKeyFormat(e.target.value as 'alphanumeric' | 'hex' | 'base64')}
                                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                            >
                                                <option value="alphanumeric">Alphanumeric</option>
                                                <option value="hex">Hex</option>
                                                <option value="base64">Base64</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs text-[var(--text-muted)] mb-1">Prefix</label>
                                        <input
                                            type="text"
                                            value={newPrefix}
                                            onChange={e => setNewPrefix(e.target.value)}
                                            placeholder="xtf_live (default)"
                                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                        />
                                        <p className="text-[10px] text-[var(--text-muted)] mt-1">Custom prefix, e.g: myapp_prod, api_v2</p>
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-5">
                                    <button
                                        onClick={() => setNewKeyModal(false)}
                                        className="flex-1 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={createKey}
                                        disabled={!newName.trim() || saving === 'create'}
                                        className="flex-1 py-2 rounded-lg bg-[var(--accent-primary)] text-white font-medium text-sm disabled:opacity-50"
                                    >
                                        {saving === 'create' ? 'Creating...' : 'Create Key'}
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Key Created Modal */}
                <AnimatePresence>
                    {newKeyResult && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                className="glass-card p-5 max-w-lg w-full"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-full bg-green-500/10">
                                        <Check className="w-6 h-6 text-green-500" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold">Key Created!</h3>
                                        <p className="text-xs text-[var(--text-muted)]">{newKeyResult.key.name}</p>
                                    </div>
                                </div>

                                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 mb-4">
                                    <div className="flex items-center gap-2 text-yellow-400 text-sm mb-1">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span className="font-medium">Copy this key now!</span>
                                    </div>
                                    <p className="text-xs text-[var(--text-muted)]">
                                        You won't be able to see the full key again.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 p-3 rounded-lg bg-[var(--bg-secondary)] font-mono text-xs mb-4">
                                    <span className="flex-1 break-all select-all">{newKeyResult.plainKey}</span>
                                    <button
                                        onClick={() => copyToClipboard(newKeyResult.plainKey, 'new')}
                                        className="p-2 rounded hover:bg-[var(--bg-primary)] shrink-0"
                                    >
                                        {copied === 'new' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>

                                <button
                                    onClick={() => setNewKeyResult(null)}
                                    className="w-full py-2 rounded-lg bg-[var(--accent-primary)] text-white font-medium text-sm"
                                >
                                    Done
                                </button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

// Guest Playground Settings Component
function PlaygroundSettings() {
    const [enabled, setEnabled] = useState(true);
    const [rateLimit, setRateLimit] = useState(5);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Fetch current playground settings
        fetch('/api/admin/services')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data) {
                    setEnabled(data.data.playgroundEnabled ?? true);
                    setRateLimit(data.data.playgroundRateLimit ?? 5);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const saveSettings = async (newEnabled?: boolean, newRateLimit?: number) => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/services', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'updateGlobal',
                    playgroundEnabled: newEnabled ?? enabled,
                    playgroundRateLimit: newRateLimit ?? rateLimit
                })
            });
            const data = await res.json();
            if (data.success) {
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Saved', showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
            }
        } catch {
            Swal.fire({ toast: true, position: 'top-end', icon: 'error', title: 'Failed to save', showConfirmButton: false, timer: 1500, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = () => {
        const newEnabled = !enabled;
        setEnabled(newEnabled);
        saveSettings(newEnabled, undefined);
    };

    const handleRateLimitChange = (value: number) => {
        setRateLimit(value);
    };

    const handleRateLimitBlur = () => {
        saveSettings(undefined, rateLimit);
    };

    if (loading) {
        return (
            <div className="glass-card p-4">
                <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
                    <span className="text-sm text-[var(--text-muted)]">Loading playground settings...</span>
                </div>
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-purple-400" />
                    <div>
                        <h3 className="font-semibold text-sm">Guest Playground</h3>
                        <p className="text-[10px] text-[var(--text-muted)]">/api/playground - No API key required</p>
                    </div>
                </div>
                <button
                    onClick={handleToggle}
                    disabled={saving}
                    className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-green-500' : 'bg-gray-600'}`}
                >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'left-7' : 'left-1'}`} />
                </button>
            </div>

            <div className="flex items-center gap-4 p-3 rounded-lg bg-[var(--bg-secondary)]">
                <div className="flex-1">
                    <label className="text-xs text-[var(--text-muted)] block mb-1">Rate Limit</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={rateLimit}
                            onChange={e => handleRateLimitChange(Math.max(1, Math.min(100, parseInt(e.target.value) || 5)))}
                            onBlur={handleRateLimitBlur}
                            min={1}
                            max={100}
                            className="w-20 px-2 py-1 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-sm text-center"
                        />
                        <span className="text-xs text-[var(--text-muted)]">requests / 2 minutes</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className={`text-xs px-2 py-1 rounded-full ${enabled ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {enabled ? 'Enabled' : 'Disabled'}
                    </div>
                </div>
            </div>

            <p className="text-[10px] text-[var(--text-muted)] mt-2">
                Allows users to test API at /advanced without authentication. Uses admin cookies as fallback.
            </p>
        </motion.div>
    );
}
