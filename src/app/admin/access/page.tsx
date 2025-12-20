'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Key, Plus, Copy, Trash2, Check, RefreshCw,
    Power, RotateCcw, Zap, Info, Code, ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import Swal from 'sweetalert2';
import { StatCard, AdminCard, AdminModal, StatusBadge, EmptyState } from '@/components/admin';
import { useApiKeys, type CreateKeyOptions } from '@/hooks/admin';

export default function AccessPage() {
    const [showDocs, setShowDocs] = useState(false);
    const [newKeyModal, setNewKeyModal] = useState(false);
    const [newKeyResult, setNewKeyResult] = useState<{ plainKey: string; name: string } | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    const { keys, loading, saving, stats, createKey, toggleKey, deleteKey, regenerateKey, refetch } = useApiKeys();

    // Form state
    const [form, setForm] = useState({
        name: '',
        rateLimit: 60,
        isTest: false,
        keyLength: 32,
        keyFormat: 'alphanumeric' as 'alphanumeric' | 'hex' | 'base64',
        validityDays: null as number | null,
        prefix: '',
    });

    const handleCreate = async () => {
        if (!form.name.trim()) return;
        const options: CreateKeyOptions = {
            rateLimit: form.rateLimit,
            isTest: form.isTest,
            keyLength: form.keyLength,
            keyFormat: form.keyFormat,
            validityDays: form.validityDays,
            prefix: form.prefix || undefined,
        };
        const result = await createKey(form.name, options);
        if (result?.plainKey) {
            setNewKeyResult({ plainKey: result.plainKey, name: form.name });
            setNewKeyModal(false);
            resetForm();
        }
    };

    const handleRegenerate = async (id: string, name: string) => {
        const result = await regenerateKey(id, name);
        if (result?.plainKey) {
            setNewKeyResult({ plainKey: result.plainKey, name });
        }
    };

    const resetForm = () => {
        setForm({ name: '', rateLimit: 60, isTest: false, keyLength: 32, keyFormat: 'alphanumeric', validityDays: null, prefix: '' });
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

    const isExpired = (expiresAt: string | null) => expiresAt && new Date(expiresAt) < new Date();

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
                            Access Management
                        </h1>
                        <p className="text-[var(--text-muted)] text-xs">API keys and playground access</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowDocs(!showDocs)}
                            className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm flex items-center gap-2 hover:bg-[var(--bg-card)]"
                        >
                            <Info className="w-4 h-4" />
                            <span className="hidden sm:inline">Docs</span>
                        </button>
                        <Link
                            href="/admin/access/playground"
                            className="px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm flex items-center gap-2 hover:bg-[var(--bg-card)]"
                        >
                            <Code className="w-4 h-4" />
                            <span className="hidden sm:inline">Playground</span>
                            <ExternalLink className="w-3 h-3" />
                        </Link>
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
                    <StatCard icon={<Key className="w-5 h-5" />} label="Total Keys" value={stats.totalKeys.toString()} color="text-[var(--accent-primary)]" />
                    <StatCard icon={<Power className="w-5 h-5" />} label="Active" value={stats.activeKeys.toString()} color="text-green-400" />
                    <StatCard icon={<Zap className="w-5 h-5" />} label="Requests" value={stats.totalRequests.toLocaleString()} color="text-blue-400" />
                </div>

                {/* API Docs (Collapsible) */}
                <AnimatePresence>
                    {showDocs && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <AdminCard>
                                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-yellow-400" />
                                    Quick Start
                                </h3>
                                <div className="grid gap-2 text-xs">
                                    <div className="p-2 rounded bg-[var(--bg-secondary)] font-mono overflow-x-auto">
                                        <span className="text-purple-400">POST</span> /api <span className="text-[var(--text-muted)]">← auto-detect platform</span>
                                    </div>
                                    <div className="p-2 rounded bg-[var(--bg-secondary)] font-mono overflow-x-auto">
                                        <span className="text-[var(--text-muted)]">Header:</span> X-API-Key: YOUR_KEY
                                    </div>
                                    <div className="p-2 rounded bg-[var(--bg-secondary)] font-mono overflow-x-auto">
                                        <span className="text-[var(--text-muted)]">Body:</span> {`{ "url": "https://..." }`}
                                    </div>
                                </div>
                                <p className="text-[var(--text-muted)] text-xs mt-3">
                                    Platforms: facebook, instagram, twitter, tiktok, weibo
                                </p>
                            </AdminCard>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Empty State */}
                {keys.length === 0 && (
                    <EmptyState
                        icon={<Key className="w-8 h-8" />}
                        title="No API Keys"
                        description="Create your first key to start using the API"
                        action={{ label: 'Create API Key', onClick: () => setNewKeyModal(true) }}
                    />
                )}

                {/* Keys Table */}
                {keys.length > 0 && (
                    <AdminCard className="overflow-hidden p-0">
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
                                            <td className="p-3 text-center">
                                                <StatusBadge 
                                                    status={isExpired(apiKey.expiresAt) ? 'expired' : apiKey.enabled ? 'active' : 'inactive'} 
                                                />
                                            </td>
                                            <td className="p-3 text-center hidden sm:table-cell">
                                                <div className="text-xs">
                                                    <span className="font-medium">{apiKey.stats.totalRequests.toLocaleString()}</span>
                                                    <span className="text-[var(--text-muted)]"> req</span>
                                                </div>
                                            </td>
                                            <td className="p-3 text-center hidden lg:table-cell">
                                                <span className="text-xs">{apiKey.rateLimit}/min</span>
                                            </td>
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
                                                        onClick={() => handleRegenerate(apiKey.id, apiKey.name)}
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
                    </AdminCard>
                )}

                {/* Create Key Modal */}
                <AdminModal open={newKeyModal} onClose={() => setNewKeyModal(false)} title="New API Key">
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Name *</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
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
                                        value={form.rateLimit}
                                        onChange={e => setForm(f => ({ ...f, rateLimit: parseInt(e.target.value) || 60 }))}
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
                                    value={form.validityDays ?? 'never'}
                                    onChange={e => setForm(f => ({ ...f, validityDays: e.target.value === 'never' ? null : parseInt(e.target.value) }))}
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
                                    value={form.keyLength}
                                    onChange={e => setForm(f => ({ ...f, keyLength: parseInt(e.target.value) }))}
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
                                    value={form.keyFormat}
                                    onChange={e => setForm(f => ({ ...f, keyFormat: e.target.value as 'alphanumeric' | 'hex' | 'base64' }))}
                                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                >
                                    <option value="alphanumeric">Alphanumeric</option>
                                    <option value="hex">Hex</option>
                                    <option value="base64">Base64</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Prefix (optional)</label>
                            <input
                                type="text"
                                value={form.prefix}
                                onChange={e => setForm(f => ({ ...f, prefix: e.target.value }))}
                                placeholder="e.g. xtf_"
                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono"
                                maxLength={10}
                            />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={form.isTest}
                                onChange={e => setForm(f => ({ ...f, isTest: e.target.checked }))}
                                className="rounded"
                            />
                            Test key (marked with TEST badge)
                        </label>
                        <button
                            onClick={handleCreate}
                            disabled={!form.name.trim() || saving === 'create'}
                            className="w-full py-2 bg-[var(--accent-primary)] text-white rounded-lg text-sm disabled:opacity-50"
                        >
                            {saving === 'create' ? 'Creating...' : 'Create Key'}
                        </button>
                    </div>
                </AdminModal>

                {/* New Key Result Modal */}
                <AdminModal 
                    open={!!newKeyResult} 
                    onClose={() => setNewKeyResult(null)} 
                    title="API Key Created"
                >
                    <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                            <p className="text-sm text-green-400 mb-2">Key for "{newKeyResult?.name}"</p>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 p-2 rounded bg-[var(--bg-secondary)] font-mono text-sm break-all">
                                    {newKeyResult?.plainKey}
                                </code>
                                <button
                                    onClick={() => newKeyResult && copyToClipboard(newKeyResult.plainKey, 'new')}
                                    className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
                                >
                                    {copied === 'new' ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-sm text-yellow-400">
                            ⚠️ Copy this key now! It won't be shown again.
                        </div>
                        <button
                            onClick={() => setNewKeyResult(null)}
                            className="w-full py-2 bg-[var(--bg-secondary)] rounded-lg text-sm"
                        >
                            Done
                        </button>
                    </div>
                </AdminModal>
            </div>
        </div>
    );
}
