'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Rocket, Code, BookOpen, HelpCircle, ArrowRight, Zap, Shield, Globe, CheckCircle, FileText } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import { DocsNavbar } from '@/components/docs/DocsNavbar';
import AnnouncementBanner from '@/components/AnnouncementBanner';

const features = [
    { icon: Zap, title: 'Fast & Free', desc: 'No registration, no limits, instant downloads' },
    { icon: Shield, title: 'No Watermark', desc: 'Clean videos without any branding' },
    { icon: Globe, title: '6 Platforms', desc: 'Facebook, Instagram, Twitter, TikTok, YouTube, Weibo' },
];

const quickLinks = [
    { href: '/docs/api', icon: Code, title: 'API Reference', desc: 'Complete API documentation with examples' },
    { href: '/docs/guides/cookies', icon: BookOpen, title: 'Cookie Setup', desc: 'How to get cookies for private content' },
    { href: '/docs/faq', icon: HelpCircle, title: 'FAQ', desc: 'Frequently asked questions' },
    { href: '/docs/changelog', icon: FileText, title: 'Changelog', desc: 'Version history and updates' },
];

const platforms = [
    { name: 'Facebook', types: 'Videos, Reels, Stories', cookie: 'Optional' },
    { name: 'Instagram', types: 'Posts, Reels, Stories', cookie: 'Optional' },
    { name: 'Twitter/X', types: 'Tweets with video', cookie: 'Not needed' },
    { name: 'TikTok', types: 'Videos (no watermark)', cookie: 'Not needed' },
    { name: 'YouTube', types: 'Videos, Shorts', cookie: 'Not needed' },
    { name: 'Weibo', types: 'Videos', cookie: 'Required' },
];

export function DocsHomePage() {
    return (
        <SidebarLayout>
            <div className="py-6 px-4 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <DocsNavbar />
                    {/* Announcements */}
                    <AnnouncementBanner page="docs" />
                    <div className="space-y-6">
                    {/* Hero */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] text-xs font-medium mb-4">
                            <Rocket className="w-3.5 h-3.5" />
                            Documentation
                        </div>
                        <h1 className="text-3xl font-bold mb-3">
                            <span className="gradient-text">DownAria</span> Documentation
                        </h1>
                        <p className="text-[var(--text-muted)] max-w-xl mx-auto">
                            Learn how to use DownAria to download videos from social media platforms. 
                            No watermark, no registration, completely free.
                        </p>
                    </motion.div>

                    {/* Features */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4"
                    >
                        {features.map((feature, idx) => (
                            <div key={idx} className="glass-card p-4">
                                <feature.icon className="w-6 h-6 text-[var(--accent-primary)] mb-2" />
                                <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1">{feature.title}</h3>
                                <p className="text-xs text-[var(--text-muted)]">{feature.desc}</p>
                            </div>
                        ))}
                    </motion.div>

                    {/* Quick Start */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass-card p-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-500" />
                            Quick Start
                        </h2>
                        
                        <div className="space-y-3">
                            {[
                                { step: 1, title: 'Copy URL', desc: 'Copy the video URL from Facebook, Instagram, Twitter, TikTok, YouTube, or Weibo' },
                                { step: 2, title: 'Paste & Download', desc: 'Paste the URL in DownAria. Platform is auto-detected. Choose quality and download!' },
                                { step: 3, title: 'Enjoy!', desc: 'Video is saved to your device without watermark. Check your Downloads folder.' },
                            ].map((item) => (
                                <div key={item.step} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)] transition-colors">
                                    <div className="w-7 h-7 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                                        {item.step}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-[var(--text-primary)] text-sm">{item.title}</h3>
                                        <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Tip Box */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="glass-card p-4 border-l-4 border-l-[var(--accent-primary)]"
                    >
                        <p className="text-sm text-[var(--text-secondary)]">
                            <strong className="text-[var(--text-primary)]">💡 Pro Tip:</strong> For private content (stories, private accounts), you may need to add your cookie in Settings. 
                            Check the <Link href="/docs/guides/cookies" className="text-[var(--accent-primary)] hover:underline">Cookie Setup Guide</Link> for instructions.
                        </p>
                    </motion.div>

                    {/* Quick Links */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                            Explore Documentation
                        </h2>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {quickLinks.map((link, idx) => (
                                <Link
                                    key={idx}
                                    href={link.href}
                                    className="group glass-card p-4 hover:border-[var(--accent-primary)] transition-all"
                                >
                                    <link.icon className="w-6 h-6 text-[var(--accent-primary)] mb-2" />
                                    <h3 className="font-medium text-[var(--text-primary)] text-sm mb-1 flex items-center gap-1">
                                        {link.title}
                                        <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                    </h3>
                                    <p className="text-xs text-[var(--text-muted)]">{link.desc}</p>
                                </Link>
                            ))}
                        </div>
                    </motion.div>

                    {/* Supported Platforms */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="glass-card p-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                            <Globe className="w-5 h-5 text-blue-500" />
                            Supported Platforms
                        </h2>
                        
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--border-color)]">
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium text-xs">Platform</th>
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium text-xs">Content Types</th>
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium text-xs">Cookie</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    {platforms.map((p) => (
                                        <tr key={p.name} className="hover:bg-[var(--bg-secondary)] transition-colors">
                                            <td className="py-2.5 px-3 text-[var(--text-primary)] font-medium text-xs">{p.name}</td>
                                            <td className="py-2.5 px-3 text-[var(--text-muted)] text-xs">{p.types}</td>
                                            <td className="py-2.5 px-3">
                                                <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
                                                    p.cookie === 'Not needed' 
                                                        ? 'bg-green-500/20 text-green-400' 
                                                        : p.cookie === 'Required'
                                                            ? 'bg-red-500/20 text-red-400'
                                                            : 'bg-yellow-500/20 text-yellow-400'
                                                }`}>
                                                    {p.cookie === 'Not needed' && <CheckCircle className="w-3 h-3" />}
                                                    {p.cookie}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                </div>
                </div>
            </div>
        </SidebarLayout>
    );
}
