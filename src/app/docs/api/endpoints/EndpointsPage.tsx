'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Copy, Check, Code } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import { DocsNavbar } from '@/components/docs/DocsNavbar';

const BASE_URL = 'https://xt-fetch.vercel.app';
const PLAYGROUND_ENDPOINT = '/api/playground';

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
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

function EndpointCard({ method, path, description, auth }: { method: string; path: string; description: string; auth?: string }) {
    const methodColors: Record<string, string> = {
        GET: 'bg-green-500/20 text-green-400',
        POST: 'bg-blue-500/20 text-blue-400',
        PUT: 'bg-yellow-500/20 text-yellow-400',
        DELETE: 'bg-red-500/20 text-red-400',
    };

    return (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] mb-4">
            <span className={`px-2 py-1 text-xs font-bold rounded ${methodColors[method]}`}>{method}</span>
            <code className="text-sm font-mono text-[var(--text-primary)]">{path}</code>
            {auth && (
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded ${
                    auth === 'required' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                    Auth {auth}
                </span>
            )}
        </div>
    );
}

export function EndpointsPage() {
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
                            API <span className="gradient-text">Endpoints</span>
                        </h1>
                        <p className="text-[var(--text-muted)]">
                            Complete reference for all available API endpoints.
                        </p>
                    </motion.div>

                    {/* POST /api/playground - PUBLIC */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass-card p-5"
                    >
                        <EndpointCard method="POST" path="/api/playground" description="Public API (Rate Limited)" />
                        <p className="text-sm text-[var(--text-muted)] mb-4">
                            Public API for downloading videos. No authentication required. Rate limited to 5 requests per 2 minutes.
                        </p>

                        {/* Browser Test URL */}
                        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 mb-4">
                            <p className="text-xs text-[var(--text-secondary)] mb-2">
                                <strong className="text-green-400">🌐 Test in Browser:</strong>
                            </p>
                            <code className="text-xs text-[var(--text-primary)] break-all">
                                {BASE_URL}/api/playground?url=https://www.facebook.com/share/p/1G8yBgJaPa/
                            </code>
                        </div>

                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Request</h3>
                        <div className="overflow-x-auto mb-4">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-[var(--border-color)]">
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Method</th>
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Param</th>
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    <tr>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">GET</td>
                                        <td className="py-2 px-3 font-mono text-[var(--accent-primary)]">?url=...</td>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">URL as query parameter</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">POST</td>
                                        <td className="py-2 px-3 font-mono text-[var(--accent-primary)]">{`{"url": "..."}`}</td>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">URL in JSON body</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Example (POST)</h3>
                        <CodeBlock 
                            language="javascript"
                            code={`const response = await fetch('${BASE_URL}${PLAYGROUND_ENDPOINT}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    url: 'https://www.facebook.com/share/p/1G8yBgJaPa/'
  })
});

const { success, data, rateLimit } = await response.json();

if (success) {
  console.log('Remaining requests:', rateLimit.remaining);
  console.log('Download URLs:', data.formats);
}`}
                        />

                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 mt-4">Response</h3>
                        <CodeBlock 
                            language="json"
                            code={`{
  "success": true,
  "platform": "facebook",
  "data": {
    "title": "Video title",
    "author": "Author name",
    "thumbnail": "https://...",
    "formats": [
      { "url": "https://...", "quality": "HD", "type": "video" },
      { "url": "https://...", "quality": "SD", "type": "video" }
    ],
    "responseTime": 1234
  },
  "rateLimit": { "remaining": 4, "limit": 5 }
}`}
                        />
                    </motion.div>

                    {/* POST /api - API Key Required */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass-card p-5"
                    >
                        <EndpointCard method="POST" path="/api" description="Main API (Higher Limits)" auth="required" />
                        <p className="text-sm text-[var(--text-muted)] mb-4">
                            Main download endpoint with higher rate limits. Requires API key in header.
                        </p>

                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Headers</h3>
                        <div className="overflow-x-auto mb-4">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-[var(--border-color)]">
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Header</th>
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Required</th>
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    <tr>
                                        <td className="py-2 px-3 font-mono text-[var(--accent-primary)]">X-API-Key</td>
                                        <td className="py-2 px-3"><span className="text-red-400">Yes</span></td>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">Your API key (format: beta_xxxxx)</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3 font-mono text-[var(--accent-primary)]">Content-Type</td>
                                        <td className="py-2 px-3"><span className="text-red-400">Yes</span></td>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">application/json</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Request Body</h3>
                        <div className="overflow-x-auto mb-4">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-[var(--border-color)]">
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Field</th>
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Type</th>
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Required</th>
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    <tr>
                                        <td className="py-2 px-3 font-mono text-[var(--accent-primary)]">url</td>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">string</td>
                                        <td className="py-2 px-3"><span className="text-red-400">Yes</span></td>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">Social media URL</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3 font-mono text-[var(--accent-primary)]">cookie</td>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">string</td>
                                        <td className="py-2 px-3"><span className="text-[var(--text-muted)]">No</span></td>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">Platform cookie for private content</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3 font-mono text-[var(--accent-primary)]">skipCache</td>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">boolean</td>
                                        <td className="py-2 px-3"><span className="text-[var(--text-muted)]">No</span></td>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">Skip cached results</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Example</h3>
                        <CodeBlock 
                            language="javascript"
                            code={`const response = await fetch('${BASE_URL}/api', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-API-Key': 'demo_caf079daf479ceb1'
  },
  body: JSON.stringify({ 
    url: 'https://www.facebook.com/share/p/1G8yBgJaPa/'
  })
});

const { success, data } = await response.json();

if (success) {
  console.log('Download URLs:', data.formats);
}`}
                        />

                        <div className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                            <p className="text-xs text-[var(--text-secondary)]">
                                <strong className="text-blue-400">🧪 Demo Key:</strong> Use <code className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)]">demo_caf079daf479ceb1</code> for testing (limited to 3 requests/minute).
                            </p>
                        </div>

                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 mt-4">Response</h3>
                        <CodeBlock 
                            language="json"
                            code={`{
  "success": true,
  "platform": "facebook",
  "data": {
    "title": "Video title",
    "author": "Author name", 
    "thumbnail": "https://...",
    "formats": [
      { "url": "https://...", "quality": "HD", "type": "video" },
      { "url": "https://...", "quality": "SD", "type": "video" }
    ],
    "responseTime": 856
  }
}`}
                        />

                        <div className="mt-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                            <p className="text-xs text-[var(--text-secondary)]">
                                <strong className="text-purple-400">💡 Get Your Own Key:</strong> Create an account and generate your API key from Settings → API Keys for higher limits.
                            </p>
                        </div>
                    </motion.div>

                    {/* GET /api/status */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="glass-card p-5"
                    >
                        <EndpointCard method="GET" path="/api/status" description="Service status" />
                        <p className="text-sm text-[var(--text-muted)] mb-4">
                            Get current service status and platform availability.
                        </p>

                        <CodeBlock 
                            language="json"
                            code={`{
  "success": true,
  "maintenance": false,
  "platforms": {
    "facebook": { "enabled": true, "status": "active" },
    "instagram": { "enabled": true, "status": "active" },
    "twitter": { "enabled": true, "status": "active" },
    "tiktok": { "enabled": true, "status": "active" },
    "weibo": { "enabled": true, "status": "active" }
  }
}`}
                        />
                    </motion.div>

                    {/* GET /api/proxy */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="glass-card p-5"
                    >
                        <EndpointCard method="GET" path="/api/proxy" description="Media proxy" />
                        <p className="text-sm text-[var(--text-muted)] mb-4">
                            Proxy media URLs to bypass CORS restrictions.
                        </p>

                        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Query Parameters</h3>
                        <div className="overflow-x-auto mb-4">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-[var(--border-color)]">
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Param</th>
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Type</th>
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    <tr>
                                        <td className="py-2 px-3 font-mono text-[var(--accent-primary)]">url</td>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">string</td>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">URL-encoded media URL</td>
                                    </tr>
                                    <tr>
                                        <td className="py-2 px-3 font-mono text-[var(--accent-primary)]">inline</td>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">1 | 0</td>
                                        <td className="py-2 px-3 text-[var(--text-muted)]">Display inline (1) or download (0)</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                            <p className="text-xs text-[var(--text-secondary)]">
                                <strong className="text-yellow-400">⚠️ Note:</strong> Proxy only works with whitelisted CDN domains for security.
                            </p>
                        </div>
                    </motion.div>
                    </div>
                </div>
            </div>
        </SidebarLayout>
    );
}
