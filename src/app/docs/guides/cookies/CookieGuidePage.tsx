'use client';

import { motion } from 'framer-motion';
import { Cookie, Chrome } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import { DocsNavbar } from '@/components/docs/DocsNavbar';
import { FacebookIcon, InstagramIcon, WeiboIcon } from '@/components/ui/Icons';

export function CookieGuidePage() {
    return (
        <SidebarLayout>
            <div className="py-6 px-4 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <DocsNavbar />
                    <div className="space-y-6">
                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 text-yellow-400 text-xs font-medium mb-4">
                            <Cookie className="w-3.5 h-3.5" />
                            Guide
                        </div>
                        <h1 className="text-3xl font-bold mb-3">
                            <span className="gradient-text">Cookie</span> Setup
                        </h1>
                        <p className="text-[var(--text-muted)]">
                            How to get cookies for private content.
                        </p>
                    </motion.div>

                    {/* Info */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass-card p-4 border-l-4 border-l-blue-500"
                    >
                        <p className="text-sm text-[var(--text-secondary)]">
                            <strong className="text-blue-400">ℹ️ When do you need cookies?</strong><br />
                            Only for private content like stories, private accounts, or age-restricted videos. Public content works without cookies.
                        </p>
                    </motion.div>

                    {/* Steps - Easy Method */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass-card p-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                            <Chrome className="w-5 h-5" />
                            Getting Cookies (Easy Method)
                        </h2>

                        <p className="text-sm text-[var(--text-muted)] mb-4">
                            Use a browser extension to export cookies as JSON - much easier than manual copy!
                        </p>

                        {/* Recommended Extensions */}
                        <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] mb-4">
                            <h3 className="font-medium text-[var(--text-primary)] text-sm mb-2">Recommended Extensions:</h3>
                            <ul className="space-y-1 text-xs text-[var(--text-muted)]">
                                <li className="flex items-center gap-2">
                                    <span className="text-green-400">•</span>
                                    <strong>Cookie Editor</strong> - Chrome / Firefox / Edge
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-green-400">•</span>
                                    <strong>Cookie-Editor</strong> - Available on all browsers
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-green-400">•</span>
                                    <strong>EditThisCookie</strong> - Chrome classic
                                </li>
                            </ul>
                        </div>
                        
                        <div className="space-y-3">
                            {[
                                { step: 1, title: 'Install Cookie Editor', desc: 'Install from Chrome Web Store or Firefox Add-ons' },
                                { step: 2, title: 'Log in to the platform', desc: 'Open Facebook/Instagram/Weibo and log in to your account' },
                                { step: 3, title: 'Open Cookie Editor', desc: 'Click the extension icon in your browser toolbar' },
                                { step: 4, title: 'Export as JSON', desc: 'Click "Export" or "Export All" button to copy cookies' },
                                { step: 5, title: 'Paste in XTFetch', desc: 'Go to Settings → Cookies → Paste the JSON' },
                            ].map((item) => (
                                <div key={item.step} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)] transition-colors">
                                    <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                        {item.step}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-[var(--text-primary)] text-sm">{item.title}</h3>
                                        <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* JSON Format Example */}
                        <div className="mt-4 p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)]">
                            <h3 className="font-medium text-[var(--text-primary)] text-sm mb-2">JSON Format Example:</h3>
                            <pre className="text-xs text-[var(--text-muted)] overflow-x-auto">
{`[
  { "name": "sessionid", "value": "123456...", "domain": ".instagram.com" },
  { "name": "ds_user_id", "value": "789...", "domain": ".instagram.com" }
]`}
                            </pre>
                        </div>

                        <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                            <p className="text-xs text-[var(--text-secondary)]">
                                <strong className="text-green-400">✨ Tip:</strong> XTFetch automatically parses JSON format and extracts the required cookies!
                            </p>
                        </div>
                    </motion.div>

                    {/* Platform Specific */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="glass-card p-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Platform-Specific Cookies</h2>
                        
                        <div className="space-y-4">
                            {/* Facebook */}
                            <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                                <div className="flex items-center gap-2 mb-2">
                                    <FacebookIcon className="w-4 h-4 text-blue-500" />
                                    <h3 className="font-medium text-[var(--text-primary)] text-sm">Facebook</h3>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Optional</span>
                                </div>
                                <p className="text-xs text-[var(--text-muted)] mb-2">
                                    Required: <code className="px-1 py-0.5 rounded bg-[var(--bg-primary)] text-xs">c_user</code> and <code className="px-1 py-0.5 rounded bg-[var(--bg-primary)] text-xs">xs</code>
                                </p>
                                <div className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] font-mono text-xs text-[var(--text-muted)]">
                                    c_user=123456789; xs=abc123...
                                </div>
                            </div>

                            {/* Instagram */}
                            <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                                <div className="flex items-center gap-2 mb-2">
                                    <InstagramIcon className="w-4 h-4 text-pink-500" />
                                    <h3 className="font-medium text-[var(--text-primary)] text-sm">Instagram</h3>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Optional</span>
                                </div>
                                <p className="text-xs text-[var(--text-muted)] mb-2">
                                    Required: <code className="px-1 py-0.5 rounded bg-[var(--bg-primary)] text-xs">sessionid</code>
                                </p>
                                <div className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] font-mono text-xs text-[var(--text-muted)]">
                                    sessionid=123456789%3Aabc123...
                                </div>
                            </div>

                            {/* Weibo */}
                            <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
                                <div className="flex items-center gap-2 mb-2">
                                    <WeiboIcon className="w-4 h-4 text-orange-500" />
                                    <h3 className="font-medium text-[var(--text-primary)] text-sm">Weibo</h3>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Required</span>
                                </div>
                                <p className="text-xs text-[var(--text-muted)] mb-2">
                                    Required: <code className="px-1 py-0.5 rounded bg-[var(--bg-primary)] text-xs">SUB</code>
                                </p>
                                <div className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] font-mono text-xs text-[var(--text-muted)]">
                                    SUB=_2A25abc123...
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Warnings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="glass-card p-4 border-l-4 border-l-yellow-500"
                        >
                            <p className="text-sm text-[var(--text-secondary)]">
                                <strong className="text-yellow-400">⚠️ Keep your cookies private</strong><br />
                                <span className="text-xs">Never share your cookies. They can be used to access your account.</span>
                            </p>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.45 }}
                            className="glass-card p-4 border-l-4 border-l-green-500"
                        >
                            <p className="text-sm text-[var(--text-secondary)]">
                                <strong className="text-green-400">🔒 Encrypted storage</strong><br />
                                <span className="text-xs">XTFetch encrypts your cookies with AES-256 before storing them locally.</span>
                            </p>
                        </motion.div>
                    </div>
                    </div>
                </div>
            </div>
        </SidebarLayout>
    );
}
