'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Code, Zap, Shield, Globe, ArrowRight, Copy, Check } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import { DocsNavbar } from '@/components/docs/DocsNavbar';
import { useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] overflow-hidden my-4">
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
                <span className="text-[10px] sm:text-xs text-[var(--text-muted)]">{language}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-colors"
                >
                    {copied ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-400" /> : <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                    <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
            </div>
            <pre className="p-3 sm:p-4 text-[10px] sm:text-sm overflow-x-auto">
                <code className="text-[var(--text-secondary)] break-all whitespace-pre-wrap">{code}</code>
            </pre>
        </div>
    );
}

export function ApiOverviewPage() {
    return (
        <SidebarLayout>
            <div className="py-6 px-4 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <DocsNavbar />
                    <div className="space-y-6">
                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium mb-4">
                            <Code className="w-3.5 h-3.5" />
                            API Reference
                        </div>
                        <h1 className="text-3xl font-bold mb-3">
                            <span className="gradient-text">API</span> Overview
                        </h1>
                        <p className="text-[var(--text-muted)]">
                            Integrate video downloading into your applications with our simple REST API
                        </p>
                    </motion.div>

                    {/* Features */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4"
                    >
                        <div className="glass-card p-4">
                            <Zap className="w-5 h-5 text-yellow-500 mb-2" />
                            <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1">Simple & Fast</h3>
                            <p className="text-xs text-[var(--text-muted)]">Single endpoint, auto-detect platform</p>
                        </div>
                        <div className="glass-card p-4">
                            <Shield className="w-5 h-5 text-green-500 mb-2" />
                            <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1">Rate Limited</h3>
                            <p className="text-xs text-[var(--text-muted)]">Fair usage with API key support</p>
                        </div>
                        <div className="glass-card p-4">
                            <Globe className="w-5 h-5 text-blue-500 mb-2" />
                            <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1">6 Platforms</h3>
                            <p className="text-xs text-[var(--text-muted)]">FB, IG, Twitter, TikTok, YT, Weibo</p>
                        </div>
                    </motion.div>

                    {/* API Base URL */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass-card p-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">API Endpoint</h2>
                        <div className="px-4 py-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] font-mono text-sm text-[var(--accent-primary)]">
                            GET {API_URL}/api/v1?key=YOUR_API_KEY&url=MEDIA_URL
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-3">
                            Direct connection to the backend API. Visit <a href={API_URL} target="_blank" rel="noopener noreferrer" className="text-[var(--accent-primary)] hover:underline">{API_URL}</a> to check backend status.
                        </p>
                    </motion.div>

                    {/* Important Notice */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.25 }}
                        className="glass-card p-4 border-l-4 border-l-blue-500"
                    >
                        <p className="text-sm text-[var(--text-secondary)]">
                            <strong className="text-blue-400">ℹ️ Note:</strong> API memerlukan API key yang valid untuk semua request. 
                            Hubungi admin via Telegram <a href="https://t.me/suntaw" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">@suntaw</a> untuk mendapatkan API key.
                        </p>
                    </motion.div>

                    {/* Quick Example */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="glass-card p-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Quick Example</h2>
                        
                        <CodeBlock 
                            language="bash"
                            code={`curl "${API_URL}/api/v1?key=dwa_live_xxxxx&url=https://www.tiktok.com/@user/video/123"`}
                        />

                        <CodeBlock 
                            language="javascript"
                            code={`const API_KEY = 'dwa_live_xxxxx';
const videoUrl = 'https://www.tiktok.com/@user/video/123';

const response = await fetch(
  \`${API_URL}/api/v1?key=\${API_KEY}&url=\${encodeURIComponent(videoUrl)}\`
);

const data = await response.json();
console.log(data.data.formats); // Array of download URLs`}
                        />
                    </motion.div>

                    {/* Authentication */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="glass-card p-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Authentication</h2>
                        <p className="text-sm text-[var(--text-muted)] mb-4">
                            API key is required for all requests. Pass it as a query parameter:
                        </p>
                        
                        <CodeBlock 
                            language="bash"
                            code={`curl "${API_URL}/api/v1?key=dwa_live_xxxxx&url=https://instagram.com/p/xxxxx"`}
                        />

                        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 mt-4">
                            <p className="text-sm text-[var(--text-secondary)]">
                                <strong className="text-purple-400">💡 Tip:</strong> Hubungi admin via Telegram <a href="https://t.me/suntaw" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">@suntaw</a> untuk mendapatkan API key. 
                                Lihat <Link href="/docs/guides/api-keys" className="text-[var(--accent-primary)] hover:underline">API Keys Guide</Link> untuk info lebih lanjut.
                            </p>
                        </div>
                    </motion.div>

                    {/* Rate Limits */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="glass-card p-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Rate Limits</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-[var(--border-color)]">
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium text-xs">Type</th>
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium text-xs">Limit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    <tr>
                                        <td className="py-3 px-3 text-[var(--text-secondary)] text-xs">Standard API Key</td>
                                        <td className="py-3 px-3 text-[var(--text-muted)] text-xs">100 requests/minute</td>
                                    </tr>
                                    <tr>
                                        <td className="py-3 px-3 text-[var(--text-secondary)] text-xs">VIP API Key</td>
                                        <td className="py-3 px-3 text-[var(--text-muted)] text-xs">Unlimited</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </motion.div>

                    {/* Next Steps */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Next Steps</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Link href="/docs/api/endpoints" className="group glass-card p-4 hover:border-[var(--accent-primary)] transition-all">
                                <h3 className="font-medium text-[var(--text-primary)] text-sm mb-1 flex items-center gap-1">
                                    API Endpoints
                                    <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                </h3>
                                <p className="text-xs text-[var(--text-muted)]">Complete endpoint reference</p>
                            </Link>
                            <Link href="/docs/api/errors" className="group glass-card p-4 hover:border-[var(--accent-primary)] transition-all">
                                <h3 className="font-medium text-[var(--text-primary)] text-sm mb-1 flex items-center gap-1">
                                    Error Codes
                                    <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                </h3>
                                <p className="text-xs text-[var(--text-muted)]">Handle errors properly</p>
                            </Link>
                        </div>
                    </motion.div>
                    </div>
                </div>
            </div>
        </SidebarLayout>
    );
}
