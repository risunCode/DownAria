'use client';

import { motion } from 'framer-motion';
import { Download, Heart, Github, FileText, Clock } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import CompactAdDisplay from '@/components/CompactAdDisplay';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
    FacebookIcon,
    InstagramIcon,
    XTwitterIcon,
    TiktokIcon,
    WeiboIcon,
    YoutubeIcon,
    LockIcon,
} from '@/components/ui/Icons';
import { faPinterest, faThreads } from '@fortawesome/free-brands-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function AboutPage() {
    const t = useTranslations('about');

    // All supported platforms with status
    const allPlatforms = [
        { name: 'YouTube', icon: YoutubeIcon, color: '#FF0000', status: 'active' as const },
        { name: 'Facebook', icon: FacebookIcon, color: '#1877F2', status: 'active' as const },
        { name: 'Instagram', icon: InstagramIcon, color: '#E4405F', status: 'active' as const },
        { name: 'TikTok', icon: TiktokIcon, color: '#00F2EA', status: 'active' as const },
        { name: 'Twitter/X', icon: XTwitterIcon, color: '#9CA3AF', status: 'active' as const },
        { name: 'Weibo', icon: WeiboIcon, color: '#E6162D', status: 'cookie' as const, note: 'Cookie required' },
        { name: 'Pinterest', icon: () => <FontAwesomeIcon icon={faPinterest} className="w-5 h-5" />, color: '#E60023', status: 'coming' as const },
        { name: 'Threads', icon: () => <FontAwesomeIcon icon={faThreads} className="w-5 h-5" />, color: '#000000', status: 'coming' as const },
    ];

    return (
        <SidebarLayout>
            <div className="py-6 px-4 lg:px-8">
                <div className="max-w-4xl mx-auto space-y-8">
                    {/* Hero */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center"
                    >
                        <h1 className="text-3xl font-bold mb-2">
                            {t('title')} <span className="gradient-text">DownAria</span>
                        </h1>
                        <p className="text-sm text-[var(--text-muted)]">{t('subtitle')}</p>
                    </motion.div>

                    {/* Compact Ads */}
                    <CompactAdDisplay placement="about" maxAds={3} />

                    {/* The Story - Full Width, Centered */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass-card p-6 border-l-4 border-l-[var(--accent-primary)]"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Heart className="w-5 h-5 text-red-500" />
                            <h2 className="font-bold text-lg text-[var(--text-primary)]">{t('story.title')}</h2>
                        </div>
                        <div className="space-y-3 text-sm text-[var(--text-secondary)] max-w-3xl">
                            <p>{t('story.p1')}</p>
                            <p>{t('story.p2')}</p>
                            <p><em>{t('story.p3')}</em></p>
                            <p className="text-[var(--accent-primary)] font-medium">{t('story.p4')}</p>
                        </div>
                    </motion.div>

                    {/* Changelog - Full Width */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="glass-card p-6"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Clock className="w-5 h-5 text-[var(--accent-primary)]" />
                            <h3 className="font-semibold text-lg text-[var(--text-primary)]">Changelog</h3>
                            <span className="text-xs font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 px-2 py-0.5 rounded">v2.0.0</span>
                        </div>
                        <ul className="text-sm text-[var(--text-muted)] space-y-2 mb-4">
                            <li>📦 Download ZIP - Album &gt;10 items auto-ZIP</li>
                            <li>🔞 New Platforms - Erome, Rule34Video, Eporner, PornHub</li>
                            <li>⚡ Lazy Thumbnails - Faster loading, retry on fail</li>
                            <li>🚫 400MB Limit - Global download limit protection</li>
                            <li>❌ Per-item Cancel - Cancel individual downloads</li>
                        </ul>
                        <Link
                            href="/docs/changelog"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-all text-sm font-medium"
                        >
                            <Clock className="w-4 h-4" />
                            View Full Changelog
                        </Link>
                    </motion.div>

                    {/* Documentation & Privacy - 2 Columns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Documentation Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="glass-card p-5 flex flex-col"
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <FileText className="w-5 h-5 text-[var(--accent-primary)]" />
                                <h3 className="font-semibold text-[var(--text-primary)]">Documentation</h3>
                            </div>
                            <p className="text-sm text-[var(--text-muted)] mb-4 flex-1">
                                Learn how to use DownAria, API reference, cookie guides, and frequently asked questions.
                            </p>
                            <Link
                                href="/docs"
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-all text-sm font-medium"
                            >
                                <FileText className="w-4 h-4" />
                                View Documentation
                            </Link>
                        </motion.div>

                        {/* Privacy Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                            className="glass-card p-5 flex flex-col"
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <LockIcon className="w-5 h-5 text-green-400" />
                                <h3 className="font-semibold text-[var(--text-primary)]">Privacy Policy</h3>
                            </div>
                            <p className="text-sm text-[var(--text-muted)] mb-4 flex-1">
                                We respect your user data. Learn how we handle your information and cookies.
                            </p>
                            <Link
                                href="/privacy"
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-green-400 transition-all text-sm font-medium"
                            >
                                <LockIcon className="w-4 h-4" />
                                View Policy
                            </Link>
                        </motion.div>
                    </div>

                    {/* Credits - Full Width */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.28 }}
                        className="glass-card p-5 flex flex-col"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Heart className="w-5 h-5 text-pink-400" />
                            <h3 className="font-semibold text-[var(--text-primary)]">Credits</h3>
                        </div>
                        <p className="text-sm text-[var(--text-muted)] mb-4 flex-1">
                            Meet the creator and the open-source technologies that power DownAria.
                        </p>
                        <Link
                            href="/credits"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-pink-400 transition-all text-sm font-medium"
                        >
                            <Heart className="w-4 h-4" />
                            View Credits
                        </Link>
                    </motion.div>

                    {/* Supported Platforms Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        id="platforms"
                        className="glass-card p-6"
                    >
                        <h3 className="font-bold text-lg text-[var(--text-primary)] mb-4">Supported Platforms</h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {allPlatforms.map((platform, i) => (
                                <div
                                    key={i}
                                    className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] ${platform.status === 'coming' ? 'opacity-50' : ''
                                        }`}
                                >
                                    <div style={{ color: platform.color }}>
                                        <platform.icon className="w-6 h-6" />
                                    </div>
                                    <span className="text-sm font-medium text-[var(--text-primary)]">
                                        {platform.name}
                                    </span>
                                    {platform.status === 'active' && (
                                        <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                                            Active
                                        </span>
                                    )}
                                    {platform.status === 'cookie' && (
                                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                                            {platform.note}
                                        </span>
                                    )}
                                    {platform.status === 'coming' && (
                                        <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-primary)] px-2 py-0.5 rounded">
                                            Coming Soon
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Other Projects */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 }}
                        className="glass-card p-5"
                    >
                        <h3 className="font-semibold text-[var(--text-primary)] mb-4">🔗 Other Projects by risunCode</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <a
                                href="https://github.com/risunCode/SurfManager"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-primary)] transition-colors group"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <Github className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)]" />
                                    <span className="font-medium text-[var(--text-primary)]">SurfManager</span>
                                </div>
                                <p className="text-xs text-[var(--text-muted)]">
                                    Reset IDE data, backup & restore, multi-account management.
                                </p>
                            </a>
                            <a
                                href="https://github.com/risunCode/SesWi-Session-Manager"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-primary)] transition-colors group"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <Github className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)]" />
                                    <span className="font-medium text-[var(--text-primary)]">SesWi Session</span>
                                </div>
                                <p className="text-xs text-[var(--text-muted)]">
                                    Chrome extension for cookie & session management.
                                </p>
                            </a>
                        </div>
                    </motion.div>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="flex flex-col sm:flex-row gap-3 justify-center"
                    >
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center gap-2 bg-[var(--accent-primary)] text-white font-semibold py-3 px-6 rounded-xl text-sm hover:opacity-90 transition-opacity"
                        >
                            <Download className="w-4 h-4" />
                            {t('startDownloading')}
                        </Link>
                        <a
                            href="https://github.com/risunCode"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-medium py-3 px-6 rounded-xl text-sm border border-[var(--border-color)] hover:border-[var(--accent-primary)] hover:text-[var(--text-primary)] transition-all"
                        >
                            <Github className="w-4 h-4" />
                            GitHub
                        </a>
                    </motion.div>

                    {/* Footer */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.45 }}
                        className="text-center text-xs text-[var(--text-muted)] space-y-1 pt-4"
                    >
                        <p>⚠️ For personal use only. Respect copyright laws.</p>
                        <p>
                            Made with ❤️ by{' '}
                            <a href="https://github.com/risunCode" className="text-[var(--accent-primary)] hover:underline">
                                risunCode
                            </a>
                            {' • '}
                            Icon by{' '}
                            <a
                                href="https://icons8.com/icons/set/download"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--accent-primary)] hover:underline"
                            >
                                Icons8
                            </a>
                        </p>
                    </motion.div>
                </div>
            </div>
        </SidebarLayout>
    );
}
