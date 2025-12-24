'use client';

import { motion } from 'framer-motion';
import {
    Download,
    Zap,
    Shield,
    Globe,
    Heart,
    Github,
    Ban,
    Clock,
    Users,
    MessageCircle,
    Code,
    Server,
    AlertTriangle,
} from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import CompactAdDisplay from '@/components/CompactAdDisplay';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
    FacebookIcon,
    InstagramIcon,
    XTwitterIcon,
    TiktokIcon,
    WeiboIcon
} from '@/components/ui/Icons';

// ============================================================================
// CHANGELOG SECTION COMPONENT
// ============================================================================

function ChangelogSection() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass-card p-5"
        >
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <span className="text-lg">📋</span>
                Latest Changes
            </h3>

            <div className="space-y-4">
                {/* Latest Version - v1.4.0 */}
                <div className="border-l-2 border-l-green-500 pl-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded">v1.4.0</span>
                        <span className="text-xs text-[var(--text-muted)]">December 23, 2025</span>
                        <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded animate-pulse">Latest</span>
                    </div>

                    {/* What's New */}
                    <div className="mb-3">
                        <h4 className="text-xs font-semibold text-green-400 mb-1.5 flex items-center gap-1">
                            <span>✨</span> What&apos;s New
                        </h4>
                        <ul className="text-xs text-[var(--text-muted)] space-y-1 ml-4">
                            <li>• <strong>AI Chat Multi-Model</strong> - GPT-5 & Copilot Smart via Magma API</li>
                            <li>• <strong>Dynamic UI</strong> - Header changes based on selected model</li>
                            <li>• <strong>Feature Gating</strong> - Image/Web search disabled for non-Gemini</li>
                            <li>• <strong>Session Warning</strong> - Banner for models without session support</li>
                            <li>• <strong>AI Disclaimer</strong> - Footer warning about AI accuracy</li>
                        </ul>
                    </div>

                    {/* What's Improved */}
                    <div className="mb-3">
                        <h4 className="text-xs font-semibold text-blue-400 mb-1.5 flex items-center gap-1">
                            <span>🔧</span> What&apos;s Improved
                        </h4>
                        <ul className="text-xs text-[var(--text-muted)] space-y-1 ml-4">
                            <li>• Dropdown Auto-Position - Adjusts based on viewport space</li>
                            <li>• Dropdown Single-Open - Opening one closes the other</li>
                            <li>• Responsive AI Chat - Fixed container width on mobile</li>
                        </ul>
                    </div>
                </div>

                {/* Known Issues */}
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-amber-400 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Known Limitations
                    </h4>
                    <ul className="text-xs text-[var(--text-muted)] space-y-1.5 ml-4">
                        <li>• <strong>Facebook carousels 6+ images</strong> - Only first 5 images extracted (Facebook lazy-loads)</li>
                        <li>• <strong>GPT-5 & Copilot Smart</strong> - No session support, each message is a new chat</li>
                    </ul>
                </div>

                {/* Button to full changelog */}
                <Link
                    href="/docs/changelog"
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-primary)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                    <span>📜</span>
                    View Full Changelog
                </Link>
            </div>
        </motion.div>
    );
}

export default function AboutPage() {
    const t = useTranslations('about');
    
    const platforms = [
        { name: 'Facebook', icon: FacebookIcon, color: '#1877F2', status: 'active' },
        { name: 'Instagram', icon: InstagramIcon, color: '#E4405F', status: 'active' },
        { name: 'X/Twitter', icon: XTwitterIcon, color: '#9CA3AF', status: 'active' },
        { name: 'TikTok', icon: TiktokIcon, color: '#00F2EA', status: 'active' },
        { name: 'Weibo', icon: WeiboIcon, color: '#E6162D', status: 'active' },
    ];

    return (
        <SidebarLayout>
            <div className="py-6 px-4 lg:px-8">
                <div className="max-w-5xl mx-auto space-y-6">
                    {/* Hero */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                        <h1 className="text-3xl font-bold mb-2">
                            {t('title')} <span className="gradient-text">XTFetch</span>
                        </h1>
                        <p className="text-sm text-[var(--text-muted)]">{t('subtitle')}</p>
                    </motion.div>

                    {/* Compact Ads - Below hero */}
                    <CompactAdDisplay placement="about" maxAds={3} />

                    {/* Main Grid - Story + Pain Points */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* The Story - Takes 2 columns */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="lg:col-span-2 glass-card p-5 border-l-4 border-l-[var(--accent-primary)]"
                        >
                            <div className="flex items-center gap-2 mb-3">
                                <Heart className="w-5 h-5 text-red-500" />
                                <h2 className="font-bold text-[var(--text-primary)]">{t('story.title')}</h2>
                            </div>
                            <div className="space-y-3 text-sm text-[var(--text-secondary)]">
                                <p>{t('story.p1')}</p>
                                <p>{t('story.p2')}</p>
                                <p><em>{t('story.p3')}</em></p>
                                <p className="text-[var(--accent-primary)] font-medium">{t('story.p4')}</p>
                            </div>
                        </motion.div>

                        {/* Pain Points */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 }}
                            className="glass-card p-5"
                        >
                            <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3">{t('painPoints.title')}</h3>
                            <div className="space-y-2">
                                {[
                                    { icon: Ban, text: t('painPoints.limit') },
                                    { icon: Clock, text: t('painPoints.queue') },
                                    { icon: MessageCircle, text: t('painPoints.busy') },
                                    { icon: Users, text: t('painPoints.premium') },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                                        <item.icon className="w-4 h-4 text-red-400" />
                                        <span>{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {/* Features + Platforms + Privacy + Tech - 4 columns grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Features */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="glass-card p-4"
                        >
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-yellow-500" />
                                {t('features.title')}
                            </h3>
                            <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
                                <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> {t('features.noLimits')}</li>
                                <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> {t('features.noWatermark')}</li>
                                <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> {t('features.autoDetect')}</li>
                                <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> {t('features.multiQuality')}</li>
                                <li className="flex items-center gap-1.5"><span className="text-green-400">✓</span> {t('features.noLogin')}</li>
                            </ul>
                        </motion.div>

                        {/* Platforms */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                            className="glass-card p-4"
                        >
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                <Globe className="w-4 h-4 text-blue-500" />
                                {t('platforms.title')}
                            </h3>
                            <div className="space-y-1.5">
                                {platforms.map((p, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                        <div style={{ color: p.color }}><p.icon className="w-4 h-4" /></div>
                                        <span className="text-[var(--text-secondary)]">{p.name}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Privacy */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="glass-card p-4 border-l-2 border-l-blue-500"
                        >
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-blue-500" />
                                {t('privacy.title')}
                            </h3>
                            <ul className="text-xs text-[var(--text-muted)] space-y-1.5">
                                <li>• {t('privacy.local')}</li>
                                <li>• {t('privacy.noTracking')}</li>
                                <li>• {t('privacy.noLogs')}</li>
                                <li>• {t('privacy.openSource')}</li>
                            </ul>
                        </motion.div>

                        {/* Tech */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 }}
                            className="glass-card p-4 border-l-2 border-l-purple-500"
                        >
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                <Code className="w-4 h-4 text-purple-500" />
                                {t('tech.title')}
                            </h3>
                            <ul className="text-xs text-[var(--text-muted)] space-y-1.5">
                                <li>• Next.js 16 + React 19</li>
                                <li>• TypeScript 5</li>
                                <li>• Tailwind CSS 4</li>
                                <li>• Direct scraping</li>
                            </ul>
                        </motion.div>
                    </div>

                    {/* Thanks To - Libraries & Dev Environment side by side */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Libraries */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="glass-card p-4"
                        >
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                <Heart className="w-4 h-4 text-pink-500" />
                                Libraries & Frameworks
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    { name: 'Next.js 16', color: 'bg-white/10' },
                                    { name: 'React 19', color: 'bg-cyan-500/20' },
                                    { name: 'TypeScript', color: 'bg-blue-500/20' },
                                    { name: 'Tailwind CSS 4', color: 'bg-teal-500/20' },
                                    { name: 'Framer Motion', color: 'bg-purple-500/20' },
                                    { name: 'Cheerio', color: 'bg-orange-500/20' },
                                    { name: 'SweetAlert2', color: 'bg-pink-500/20' },
                                    { name: 'Lucide Icons', color: 'bg-amber-500/20' },
                                ].map((lib) => (
                                    <span key={lib.name} className={`px-2 py-0.5 rounded text-[10px] ${lib.color} text-[var(--text-secondary)]`}>
                                        {lib.name}
                                    </span>
                                ))}
                            </div>
                        </motion.div>

                        {/* Dev Environment */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.45 }}
                            className="glass-card p-4"
                        >
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                                <Server className="w-4 h-4 text-emerald-500" />
                                Development
                            </h3>
                            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)]">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                    <span>Windows 11</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                    <span>Antigravity IDE</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span>Kiro AI</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                    <span>Vercel</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Changelog */}
                    <ChangelogSection />

                    {/* Other Projects + CTA */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Other Projects */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.55 }}
                            className="lg:col-span-2 glass-card p-4"
                        >
                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">🔗 Other Projects</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <a
                                    href="https://github.com/risunCode/SurfManager"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-primary)] transition-colors group"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Github className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)]" />
                                        <span className="font-medium text-sm text-[var(--text-primary)]">SurfManager</span>
                                    </div>
                                    <p className="text-xs text-[var(--text-muted)]">Reset IDE data, backup & restore, multi-account.</p>
                                </a>
                                <a
                                    href="https://github.com/risunCode/SesWi-Session-Manager"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-[var(--accent-primary)] transition-colors group"
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <Github className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--accent-primary)]" />
                                        <span className="font-medium text-sm text-[var(--text-primary)]">SesWi Session</span>
                                    </div>
                                    <p className="text-xs text-[var(--text-muted)]">Chrome extension for cookie & session management.</p>
                                </a>
                            </div>
                        </motion.div>

                        {/* CTA */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="glass-card p-4 flex flex-col justify-center items-center gap-2"
                        >
                            <Link
                                href="/"
                                className="w-full inline-flex items-center justify-center gap-2 btn-gradient text-white font-semibold py-2.5 px-4 rounded-xl text-sm"
                            >
                                <Download className="w-4 h-4" />
                                {t('startDownloading')}
                            </Link>

                            <a
                                href="https://github.com/risunCode/XTFetchs"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full inline-flex items-center justify-center gap-2 bg-[var(--bg-secondary)] text-[var(--text-secondary)] font-medium py-2.5 px-4 rounded-xl text-sm border border-[var(--border-color)] hover:border-[var(--text-muted)] transition-colors"
                            >
                                <Github className="w-4 h-4" />
                                GitHub
                            </a>
                        </motion.div>
                    </div>

                    {/* Footer */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="text-center text-xs text-[var(--text-muted)] space-y-1"
                    >
                        <p>⚠️ For personal use only. Respect copyright laws.</p>
                        <p>
                            Made with ❤️ by <a href="https://github.com/risunCode" className="text-[var(--accent-primary)] hover:underline">risunCode</a>
                            {' • '}
                            Icon by <a href="https://icons8.com/icons/set/download" target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">Icons8</a>
                        </p>
                    </motion.div>
                </div>
            </div>
        </SidebarLayout>
    );
}
