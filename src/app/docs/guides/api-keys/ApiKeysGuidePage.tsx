'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Key, Shield, Zap, Trash2, Copy, Check } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import { DocsNavbar } from '@/components/docs/DocsNavbar';

const BASE_URL = 'https://xt-fetch.vercel.app';
const MAIN_API = '/api'; // Requires API key for external access

function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] overflow-hidden my-4">
            <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
                <span className="text-xs text-[var(--text-muted)]">{language}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-colors"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <pre className="p-4 text-xs overflow-x-auto">
                <code className="text-[var(--text-secondary)]">{code}</code>
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
                                { step: 1, title: 'Create an Account', desc: 'Sign up at XTFetch. Email or social login.' },
                                { step: 2, title: 'Go to Settings', desc: 'Navigate to Settings → API Keys section.' },
                                { step: 3, title: 'Create New Key', desc: 'Click "Create API Key", give it a name.' },
                                { step: 4, title: 'Copy & Store', desc: 'Copy immediately. Won\'t be shown again!' },
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
                            Pass your API key in the <code className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-xs">X-API-Key</code> header:
                        </p>

                        <CodeBlock 
                            language="bash"
                            code={`curl -X POST ${BASE_URL}${MAIN_API} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: xtf_sk_your_api_key_here" \\
  -d '{"url": "https://www.instagram.com/reel/ABC123/"}'`}
                        />

                        <CodeBlock 
                            language="javascript"
                            code={`const API_KEY = process.env.XTFETCH_API_KEY; // Use env variable!

const response = await fetch('${BASE_URL}${MAIN_API}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY // Required for /api endpoint
  },
  body: JSON.stringify({ url: 'https://...' })
});`}
                        />

                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 mt-4">
                            <p className="text-xs text-[var(--text-secondary)]">
                                <strong className="text-blue-400">ℹ️ Note:</strong> The <code className="px-1 py-0.5 rounded bg-[var(--bg-secondary)]">/api</code> endpoint requires an API key for external access. 
                                For testing without API key, use <code className="px-1 py-0.5 rounded bg-[var(--bg-secondary)]">/api/playground</code> instead.
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
                            Manage your API keys from Settings → API Keys:
                        </p>
                        
                        <ul className="space-y-2 text-xs text-[var(--text-muted)]">
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--accent-primary)]">•</span>
                                <span><strong className="text-[var(--text-primary)]">View usage</strong> - See total requests, success rate, last used</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--accent-primary)]">•</span>
                                <span><strong className="text-[var(--text-primary)]">Disable key</strong> - Temporarily disable without deleting</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--accent-primary)]">•</span>
                                <span><strong className="text-[var(--text-primary)]">Delete key</strong> - Permanently remove (cannot undo)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-[var(--accent-primary)]">•</span>
                                <span><strong className="text-[var(--text-primary)]">Create new key</strong> - Generate additional keys for different apps</span>
                            </li>
                        </ul>
                    </motion.div>
                    </div>
                </div>
            </div>
        </SidebarLayout>
    );
}
