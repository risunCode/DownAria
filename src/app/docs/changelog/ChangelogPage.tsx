'use client';

import { motion } from 'framer-motion';
import { FileText, Sparkles, Wrench, Bug } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import { DocsNavbar } from '@/components/docs/DocsNavbar';

const changelog = [
    {
        version: '1.6.0',
        date: 'December 25, 2025',
        changes: [
            { type: 'new', items: ['🎵 Rebranding - XTFetch is now DownAria (Down + Aria = "Melodious Downloads")', 'Cookie Pool Tiers - Public tier for free users, Private tier for premium API', 'Smart Fallback - Private tier falls back to public if all cookies exhausted', 'Tier Management UI - Filter and manage cookies by tier in admin panel'] },
            { type: 'improved', items: ['Security Hardening - Strict CORS origin whitelist (no more wildcard)', 'Admin Panel Stability - Fixed various 500 errors in admin endpoints', 'Error Handling - Better handling of empty/invalid API responses'] },
            { type: 'fixed', items: ['Admin panel connection issues resolved', 'AI keys API permission errors fixed', 'Update prompt settings now accessible', 'Removed Direct Proxy feature (discontinued)'] },
        ],
    },
    {
        version: '1.5.0',
        date: 'December 25, 2025',
        changes: [
            { type: 'new', items: ['Direct Backend Connection - Frontend connects directly to Railway backend', 'Origin Whitelist - Block unauthorized API access', 'YouTube Merge Queue - Concurrency control for HD merging', 'YouTube Preview Notice - "Preview tanpa suara, suara digabung saat download"'] },
            { type: 'improved', items: ['Error Handling - Proper error codes instead of generic messages', 'YouTube Filesize - Accurate size from yt-dlp (not estimation)', 'Stories/Groups URL - Cookie used from first try for auth-required URLs', 'CORS Configuration - Proper headers for cross-origin requests'] },
            { type: 'fixed', items: ['Thumbnail proxy returning "URL required" error', 'Facebook Stories redirect to login even with cookie', 'Error messages concatenating multiple errors'] },
        ],
    },
    {
        version: '1.4.0',
        date: 'December 23, 2025',
        changes: [
            { type: 'new', items: ['AI Chat Multi-Model - GPT-5 & Copilot Smart via Magma API', 'Dynamic UI - Header changes based on selected model', 'Feature Gating - Image/Web search disabled for non-Gemini', 'Session Warning - Banner for models without session support', 'AI Disclaimer - Footer warning about AI accuracy'] },
            { type: 'improved', items: ['Dropdown Auto-Position - Adjusts based on viewport space', 'Dropdown Single-Open - Opening one closes the other', 'Responsive AI Chat - Fixed container width on mobile'] },
        ],
    },
    {
        version: '1.3.0',
        date: 'December 23, 2025',
        changes: [
            { type: 'new', items: ['Hashtag Search - Click #hashtag to search across platforms', 'Ad Banner System - Advertising cards with auto-rotate', 'File Size Detection - Size shown on quality buttons (HD/SD)', 'Video Auto-Stop - Auto-pause after 8 loops (battery saver)', 'Smart Discord Send - Per-item tracking for carousels'] },
            { type: 'improved', items: ['MediaGallery - Image carousel now renders full resolution', 'Playground API - Rate limit syncs with Admin Console', 'Proxy API - CORS headers for file size detection'] },
            { type: 'fixed', items: ['Playground rate limit not syncing with Admin settings', 'File size not showing on quality buttons', 'Image carousel always showing index 1'] },
        ],
    },
    {
        version: '1.2.0',
        date: 'December 21, 2025',
        changes: [
            { type: 'new', items: ['MediaGallery Component - Global media preview with carousel', 'YouTube Support - Added to sidebar platforms', 'Redis Cache Strategy - URL hash-based cache keys'] },
            { type: 'improved', items: ['Admin Playground - Uses global MediaGallery', 'IndexedDB Optimization - Removed media_cache store'] },
        ],
    },
    {
        version: '1.0.5',
        date: 'December 21, 2025',
        changes: [
            { type: 'new', items: ['Smarter Cookie Management - Auto health tracking per usage', 'Improved Backup - Better export/import for cross-browser compatibility'] },
            { type: 'improved', items: ['Mobile performance - smoother animations & reduced lag', 'AI Chat now fully responsive on mobile', 'Documentation pages responsive fixes', 'Admin dashboard layout improvements', 'Cleaner admin panel navigation'] },
        ],
    },
    {
        version: '1.0.4',
        date: 'December 20, 2025',
        changes: [
            { type: 'new', items: ['Multi-language support (English + Bahasa Indonesia)', 'Language selector in Settings → Basic', 'Full Backup - Export/Import history + settings as ZIP', 'Faster Downloads - Improved caching system'] },
            { type: 'improved', items: ['Better error messages with localization', 'Friendlier UI text and labels', 'Performance optimizations'] },
        ],
    },
    {
        version: '1.0.3',
        date: 'December 20, 2025',
        changes: [
            { type: 'new', items: ['Settings page redesign - Tab-based navigation', 'Discord Webhook with tagging support', 'Result caching for faster responses', 'SEO metadata for all pages'] },
            { type: 'fixed', items: ['Fixed Facebook 403 errors', 'Fixed cache key case sensitivity'] },
        ],
    },
    {
        version: '1.0.0',
        date: 'November 25, 2025',
        changes: [
            { type: 'new', items: ['Initial release', 'Facebook, Instagram, Twitter/X support', 'TikTok, Weibo support', 'Auto-detect platform from URL', 'Multiple quality options (HD, SD)', 'Dark/Light/Solarized themes', 'PWA with offline support'] },
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
                            Version history and updates for DownAria.
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
