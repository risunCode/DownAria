'use client';

import { motion } from 'framer-motion';
import { FileText, Sparkles, Wrench, Bug } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import { DocsNavbar } from '@/components/docs/DocsNavbar';

const changelog = [
    {
        version: '1.0.8',
        date: 'December 21, 2025',
        changes: [
            { type: 'new', items: ['LocalStorage encryption (XOR + HMAC integrity)', 'Auto-migration for existing unencrypted data'] },
            { type: 'improved', items: ['Platform cookies now encrypted at rest', 'Discord webhook settings encrypted', 'Admin key storage encrypted', 'Browser fingerprint-based key derivation'] },
        ],
    },
    {
        version: '1.0.7',
        date: 'December 21, 2025',
        changes: [
            { type: 'new', items: ['Clear IndexedDB button in Storage settings', 'Install PWA section with manual instructions', 'Auto-update SW cache version on build'] },
            { type: 'improved', items: ['Settings Basic tab reorganized (App & Features section)', 'Hide Documentation toggle auto-refreshes page', 'Language selector made compact', 'Service Worker update check every 5 minutes', 'Cache headers optimized for sw.js', 'SSRF protection (IPv6, DNS rebinding, cloud metadata)', 'Cookie CRLF injection prevention', 'Encryption key validation in production', 'IP format validation in middleware', 'Error message sanitization'] },
            { type: 'fixed', items: ['Cache invalidation on deploy'] },
        ],
    },
    {
        version: '1.0.6',
        date: 'December 21, 2025',
        changes: [
            { type: 'new', items: ['API Origin Protection (domain whitelist)', 'Demo API Key for testing (demo_caf079daf479ceb1)', 'DocsNavbar for easy navigation', 'Legacy API rate limiting (5 req/5 min)'] },
            { type: 'improved', items: ['Documentation redesign with app styling', 'Cookie guide with JSON export method', 'LocalStorage keys renamed to xtf_* format', 'Dev server now runs on port 3001'] },
        ],
    },
    {
        version: '1.0.5',
        date: 'December 20, 2025',
        changes: [
            { type: 'new', items: ['Documentation Page (/docs)', 'i18n Support (English + Bahasa Indonesia)', 'Skip Cache toggle'] },
            { type: 'improved', items: ['Fixed filename format', 'Memory optimization', 'Better error messages'] },
        ],
    },
    {
        version: '1.0.4',
        date: 'December 15, 2025',
        changes: [
            { type: 'new', items: ['Cookie Pool System with health tracking', 'Admin Alerts & Announcements', 'Push Notifications (VAPID)'] },
            { type: 'improved', items: ['Redis cache migration (Upstash)', 'Improved rate limiting per-IP and per-API-key'] },
        ],
    },
    {
        version: '1.0.3',
        date: 'December 10, 2025',
        changes: [
            { type: 'new', items: ['IndexedDB History (unlimited local storage)', 'Playground API for testing', 'Full Backup export/import (ZIP)'] },
            { type: 'fixed', items: ['Instagram embed fallback', 'Twitter GraphQL auth'] },
        ],
    },
    {
        version: '1.0.0',
        date: 'November 25, 2025',
        changes: [
            { type: 'new', items: ['Initial release', 'Facebook, Instagram, Twitter/X support', 'TikTok (TikWM API), Weibo support', 'Auto-detect platform from URL', 'Multiple quality options (HD, SD)', 'Dark/Light/Solarized themes', 'PWA with offline support'] },
        ],
    },
];

const typeConfig = {
    new: { icon: Sparkles, label: 'New', color: 'bg-green-500/20 text-green-400' },
    improved: { icon: Wrench, label: 'Improved', color: 'bg-blue-500/20 text-blue-400' },
    fixed: { icon: Bug, label: 'Fixed', color: 'bg-yellow-500/20 text-yellow-400' },
};

export function ChangelogPage() {
    return (
        <SidebarLayout>
            <div className="py-6 px-4 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <DocsNavbar />
                    <div className="space-y-6">
                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)] text-xs font-medium mb-4">
                            <FileText className="w-3.5 h-3.5" />
                            Changelog
                        </div>
                        <h1 className="text-3xl font-bold mb-3">
                            <span className="gradient-text">Changelog</span>
                        </h1>
                        <p className="text-[var(--text-muted)]">
                            Version history and updates for XTFetch.
                        </p>
                    </motion.div>

                    {/* Timeline */}
                    <div className="space-y-6">
                        {changelog.map((entry, idx) => (
                            <motion.div
                                key={entry.version}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="glass-card p-5 border-l-4 border-l-[var(--accent-primary)]"
                            >
                                {/* Header */}
                                <div className="flex items-center gap-3 mb-4">
                                    <h2 className="text-xl font-bold text-[var(--text-primary)]">v{entry.version}</h2>
                                    {idx === 0 && (
                                        <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-green-500/20 text-green-400 animate-pulse">
                                            Latest
                                        </span>
                                    )}
                                    <span className="text-xs text-[var(--text-muted)]">{entry.date}</span>
                                </div>

                                {/* Changes */}
                                <div className="space-y-4">
                                    {entry.changes.map((change, i) => {
                                        const config = typeConfig[change.type as keyof typeof typeConfig];
                                        return (
                                            <div key={i}>
                                                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium mb-2 ${config.color}`}>
                                                    <config.icon className="w-3 h-3" />
                                                    {config.label}
                                                </div>
                                                <ul className="space-y-1 ml-4">
                                                    {change.items.map((item, j) => (
                                                        <li key={j} className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
                                                            <span className="text-[var(--border-color)] mt-1">•</span>
                                                            <span>{item}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                    </div>
                </div>
            </div>
        </SidebarLayout>
    );
}
