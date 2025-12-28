'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Key, Shield, Zap, Trash2, Copy, Check } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import { DocsNavbar } from '@/components/docs/DocsNavbar';

// Use environment variable - no hardcoded production URLs
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '[API_URL]';
const API_ENDPOINT = '/api/v1';

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] overflow-hidden my-4">
            <div className="flex items-center justify-between px-2 sm:px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
                <span className="text-[10px] sm:text-xs text-[var(--text-muted)]">{language}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] sm:text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-colors"
                >
                    {copied ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-400" /> : <Copy className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre className="p-2 sm:p-4 text-[10px] sm:text-xs overflow-x-auto">
                <code className="text-[var(--text-secondary)] whitespace-pre-wrap break-all sm:whitespace-pre sm:break-normal">{code}</code>
            </pre>
        </div>
    );
}

export function ApiKeysGuidePage() {
    return (
        <SidebarLayout>
            <div className="py-6 px-4 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <DocsNavbar />
                    <div className="space-y-6">
                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-400 text-xs font-medium mb-4">
                            <Key className="w-3.5 h-3.5" />
                            Guide
                        </div>
                        <h1 className="text-3xl font-bold mb-3">
                            <span className="gradient-text">API Keys</span> Guide
                        </h1>
                        <p className="text-[var(--text-muted)]">
                            Managing your API keys for higher limits and better access
                        </p>
                    </motion.div>

                    {/* Benefits */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4"
                    >
                        <div className="glass-card p-4">
                            <Zap className="w-5 h-5 text-yellow-500 mb-2" />
                            <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1">Higher Rate Limits</h3>
                            <p className="text-xs text-[var(--text-muted)]">100 req/min vs 15 for public</p>
                        </div>
                        <div className="glass-card p-4">
                            <Shield className="w-5 h-5 text-green-500 mb-2" />
                            <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1">Usage Tracking</h3>
                            <p className="text-xs text-[var(--text-muted)]">Monitor your API usage</p>
                        </div>
                        <div className="glass-card p-4">
                            <Key className="w-5 h-5 text-purple-500 mb-2" />
                            <h3 className="font-semibold text-[var(--text-primary)] text-sm mb-1">Priority Support</h3>
                            <p className="text-xs text-[var(--text-muted)]">Get help faster</p>
                        </div>
                    </motion.div>

                    {/* Creating API Key */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass-card p-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Creating an API Key</h2>
                        
                        <div className="space-y-3">
                            {[
                                { step: 1, title: 'Hubungi Admin', desc: 'Contact @suntaw via Telegram untuk mendapatkan API key.' },
                                { step: 2, title: 'Pilih Paket', desc: 'Pilih paket donasi sesuai kebutuhan kamu.' },
                                { step: 3, title: 'Terima API Key', desc: 'Admin akan mengirimkan API key kamu.' },
                                { step: 4, title: 'Copy & Store', desc: 'Simpan dengan aman. Jangan share ke orang lain!' },
                            ].map((item) => (
                                <div key={item.step} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-secondary)]">
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

                        <div className="mt-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                            <p className="text-xs text-[var(--text-secondary)]">
                                <strong className="text-yellow-400">⚠️ Important:</strong> Your API key is shown only once when created. If you lose it, create a new one.
                            </p>
                        </div>
                    </motion.div>

                    {/* Using API Key */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="glass-card p-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Using Your API Key</h2>
                        <p className="text-sm text-[var(--text-muted)] mb-4">
                            Pass your API key as a query parameter:
                        </p>

                        <CodeBlock 
                            language="bash"
                            code={`curl "${BASE_URL}${API_ENDPOINT}?key=dwa_live_xxxxx&url=https://www.instagram.com/reel/ABC123/"`}
                        />

                        <CodeBlock 
                            language="javascript"
                            code={`const API_KEY = process.env.DownAria_API_KEY; // Use env variable!
const videoUrl = 'https://www.instagram.com/reel/ABC123/';

const response = await fetch(
  \`${BASE_URL}${API_ENDPOINT}?key=\${API_KEY}&url=\${encodeURIComponent(videoUrl)}\`
);

const { success, data } = await response.json();
console.log(data.formats); // Array of download URLs`}
                        />

                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 mt-4">
                            <p className="text-xs text-[var(--text-secondary)]">
                                <strong className="text-blue-400">ℹ️ Note:</strong> Hubungi admin via Telegram <a href="https://t.me/suntaw" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">@suntaw</a> untuk mendapatkan API key.
                            </p>
                        </div>
                    </motion.div>

                    {/* Security */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="glass-card p-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                            <Shield className="w-5 h-5 text-green-500" />
                            Security Best Practices
                        </h2>
                        
                        <div className="space-y-3">
                            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                <p className="text-xs text-[var(--text-secondary)]">
                                    <strong className="text-red-400">🚫 Never expose your API key</strong><br />
                                    Don&apos;t put in client-side JS, public repos, or share with others.
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                <p className="text-xs text-[var(--text-secondary)]">
                                    <strong className="text-purple-400">💡 Use environment variables</strong><br />
                                    Store in .env file and access via process.env.
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <p className="text-xs text-[var(--text-secondary)]">
                                    <strong className="text-blue-400">🔄 Rotate keys regularly</strong><br />
                                    If compromised, delete and create a new one immediately.
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Managing Keys */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="glass-card p-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                            <Trash2 className="w-5 h-5 text-red-500" />
                            Managing API Keys
                        </h2>
                        
                        <p className="text-sm text-[var(--text-muted)] mb-4">
                            Kelola API key kamu dengan menghubungi admin:
                        </p>
                        
                        <ul className="space-y-2 text-xs text-[var(--text-muted)]">
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--accent-primary)]">•</span>
                                <span><strong className="text-[var(--text-primary)]">Cek status</strong> - Tanyakan status API key kamu ke admin</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--accent-primary)]">•</span>
                                <span><strong className="text-[var(--text-primary)]">Disable key</strong> - Minta admin untuk menonaktifkan sementara</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--accent-primary)]">•</span>
                                <span><strong className="text-[var(--text-primary)]">Ganti key</strong> - Jika key bocor, minta key baru ke admin</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--accent-primary)]">•</span>
                                <span><strong className="text-[var(--text-primary)]">Perpanjang</strong> - Hubungi admin untuk perpanjang masa aktif</span>
                            </li>
                        </ul>
                    </motion.div>
                    </div>
                </div>
            </div>
        </SidebarLayout>
    );
}
