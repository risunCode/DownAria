'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { SidebarLayout } from '@/components/Sidebar';
import { DocsNavbar } from '@/components/docs/DocsNavbar';

const issues = [
    {
        problem: 'Download fails with "Failed to fetch"',
        causes: ['No internet connection', 'Server temporarily unavailable', 'Request timeout'],
        solutions: ['Check your internet connection', 'Wait a few minutes and try again', 'Check status page'],
    },
    {
        problem: 'Content is private or requires login',
        causes: ['Private account', 'Stories require authentication', 'Age-restricted content'],
        solutions: ['Add your cookie in Settings', 'Make sure you\'re logged in', 'See Cookie Setup Guide'],
    },
    {
        problem: 'Rate limit exceeded (429 error)',
        causes: ['Too many requests', 'IP-based rate limiting'],
        solutions: ['Wait 60 seconds', 'Reduce request frequency'],
    },
    {
        problem: 'Cookie not working',
        causes: ['Cookie expired', 'Wrong format', 'Account logged out'],
        solutions: ['Get a fresh cookie', 'Check cookie format', 'Log in again'],
    },
    {
        problem: 'URL not recognized',
        causes: ['Unsupported format', 'Shortened URL', 'Wrong platform'],
        solutions: ['Use direct URL', 'Expand shortened links', 'Check supported platforms'],
    },
];

export function TroubleshootingPage() {
    return (
        <SidebarLayout>
            <div className="py-6 px-4 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <DocsNavbar />
                    <div className="space-y-6">
                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-medium mb-4">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Troubleshooting
                        </div>
                        <h1 className="text-3xl font-bold mb-3">
                            <span className="gradient-text">Troubleshooting</span>
                        </h1>
                        <p className="text-[var(--text-muted)]">
                            Common issues and how to fix them.
                        </p>
                    </motion.div>

                    {/* Quick Fixes */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass-card p-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                            <RefreshCw className="w-5 h-5 text-blue-500" />
                            Quick Fixes
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[
                                { title: 'Clear Cache', desc: 'Settings → Enable "Skip Cache"' },
                                { title: 'Refresh Cookie', desc: 'Get new cookie from platform' },
                                { title: 'Try Different URL', desc: 'Use direct post/video URL' },
                                { title: 'Wait & Retry', desc: 'Wait 60 seconds if rate limited' },
                            ].map((fix, idx) => (
                                <div key={idx} className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                                    <h3 className="font-medium text-[var(--text-primary)] text-sm mb-1">{fix.title}</h3>
                                    <p className="text-xs text-[var(--text-muted)]">{fix.desc}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Common Issues */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Common Issues</h2>
                        
                        <div className="space-y-4">
                            {issues.map((issue, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 + idx * 0.05 }}
                                    className="glass-card p-4"
                                >
                                    <h3 className="font-medium text-[var(--text-primary)] text-sm mb-3 flex items-center gap-2">
                                        <XCircle className="w-4 h-4 text-red-400" />
                                        {issue.problem}
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Possible Causes</p>
                                            <ul className="space-y-1">
                                                {issue.causes.map((cause, i) => (
                                                    <li key={i} className="text-xs text-[var(--text-muted)] flex items-start gap-2">
                                                        <span className="text-yellow-400">•</span>
                                                        {cause}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Solutions</p>
                                            <ul className="space-y-1">
                                                {issue.solutions.map((solution, i) => (
                                                    <li key={i} className="text-xs text-[var(--text-muted)] flex items-start gap-2">
                                                        <CheckCircle className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                                                        {solution}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Still having issues */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="glass-card p-4 border-l-4 border-l-blue-500"
                    >
                        <p className="text-sm text-[var(--text-secondary)]">
                            <strong className="text-blue-400">ℹ️ Still having issues?</strong><br />
                            Check the <Link href="/docs/faq" className="text-[var(--accent-primary)] hover:underline">FAQ</Link> or{' '}
                            <Link href="/about" className="text-[var(--accent-primary)] hover:underline">contact us</Link> for help.
                        </p>
                    </motion.div>
                    </div>
                </div>
            </div>
        </SidebarLayout>
    );
}
