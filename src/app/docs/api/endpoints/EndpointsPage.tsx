'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Copy, Check, Code } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import { DocsNavbar } from '@/components/docs/DocsNavbar';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!API_URL) {
    console.warn('NEXT_PUBLIC_API_URL is not set - API examples will use placeholder');
}
const API_BASE = API_URL || '[API_URL]';

// Legacy CodeBlock for simple JSON responses
function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative rounded-xl bg-[var(--bg-primary)] border border-[var(--border-color)] overflow-hidden my-4">
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
                <span className="text-xs text-[var(--text-muted)]">{language}</span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-colors"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
                </button>
            </div>
            <pre className="p-3 sm:p-4 text-[10px] sm:text-xs overflow-x-auto">
                <code className="text-[var(--text-secondary)] whitespace-pre-wrap break-words sm:whitespace-pre sm:break-normal">{code}</code>
            </pre>
        </div>
    );
}

type CodeTab = {
    label: string;
    language: string;
    code: string;
};

function MacCodeBlock({ tabs }: { tabs: CodeTab[] }) {
    const [activeTab, setActiveTab] = useState(0);
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(tabs[activeTab].code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="rounded-xl overflow-hidden bg-[#1e1e1e] border border-[var(--border-color)] shadow-2xl my-6">
            {/* Mac Window Header */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-3 bg-[#252526] border-b border-[#333]">
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ff5f56]" />
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ffbd2e]" />
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#27c93f]" />
                </div>
                {/* Tabs */}
                <div className="flex items-center gap-1 bg-[#1e1e1e] p-1 rounded-lg overflow-x-auto mx-2 max-w-[200px] sm:max-w-none no-scrollbar">
                    {tabs.map((tab, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveTab(idx)}
                            className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded-md transition-all whitespace-nowrap flex-shrink-0 ${activeTab === idx
                                    ? 'bg-[#37373d] text-white shadow-sm'
                                    : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                {/* Copy Button */}
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                    title="Copy code"
                >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </button>
            </div>

            {/* Code Content */}
            <div className="p-3 sm:p-5 overflow-x-auto relative group">
                <pre className="font-mono text-[10px] sm:text-xs leading-relaxed">
                    <code className="block text-gray-300 whitespace-pre">
                        {tabs[activeTab].code}
                    </code>
                </pre>
            </div>
        </div>
    );
}

function EndpointCard({ method, path, auth }: { method: string; path: string; description?: string; auth?: string }) {
    const methodColors: Record<string, string> = {
        GET: 'bg-green-500/20 text-green-400',
        POST: 'bg-blue-500/20 text-blue-400',
        PUT: 'bg-yellow-500/20 text-yellow-400',
        DELETE: 'bg-red-500/20 text-red-400',
    };

    return (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)] mb-4">
            <span className={`px-2 py-1 text-xs font-bold rounded flex-shrink-0 ${methodColors[method]}`}>{method}</span>
            <code className="text-xs sm:text-sm font-mono text-[var(--text-primary)] break-all">{path}</code>
            {auth && (
                <span className={`text-[10px] px-2 py-0.5 rounded flex-shrink-0 sm:ml-auto ${auth === 'required' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
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

                        {/* GET /api/v1 - Main API */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="glass-card p-5"
                        >
                            <EndpointCard method="GET" path="/api/v1" auth="required" />
                            <p className="text-sm text-[var(--text-muted)] mb-4">
                                Main download endpoint. Requires API key as query parameter.
                            </p>

                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Query Parameters</h3>
                            <div className="overflow-x-auto -mx-3 sm:mx-0 mb-4">
                                <table className="w-full text-[10px] sm:text-xs min-w-[400px]">
                                    <thead>
                                        <tr className="border-b border-[var(--border-color)]">
                                            <th className="text-left py-2 px-2 sm:px-3 text-[var(--text-muted)] font-medium">Param</th>
                                            <th className="text-left py-2 px-2 sm:px-3 text-[var(--text-muted)] font-medium">Required</th>
                                            <th className="text-left py-2 px-2 sm:px-3 text-[var(--text-muted)] font-medium">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-color)]">
                                        <tr>
                                            <td className="py-2 px-2 sm:px-3 font-mono text-[var(--accent-primary)]">key</td>
                                            <td className="py-2 px-2 sm:px-3"><span className="text-red-400">Yes</span></td>
                                            <td className="py-2 px-2 sm:px-3 text-[var(--text-muted)]">Your API key (format: dwa_live_xxxxx)</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-2 sm:px-3 font-mono text-[var(--accent-primary)]">url</td>
                                            <td className="py-2 px-2 sm:px-3"><span className="text-red-400">Yes</span></td>
                                            <td className="py-2 px-2 sm:px-3 text-[var(--text-muted)]">Social media URL to download</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Example</h3>
                            <MacCodeBlock
                                tabs={[
                                    {
                                        label: 'cURL',
                                        language: 'bash',
                                        code: `curl -X GET "${API_BASE}/api/v1?key=dwa_live_xxxxx&url=https://www.facebook.com/share/p/1G8yBgJaPa/"`
                                    },
                                    {
                                        label: 'JavaScript (Fetch)',
                                        language: 'javascript',
                                        code: `const API_KEY = 'dwa_live_xxxxx';\nconst videoUrl = 'https://www.facebook.com/share/p/1G8yBgJaPa/';\n\nconst response = await fetch(\n  \`${API_BASE}/api/v1?key=\${API_KEY}&url=\${encodeURIComponent(videoUrl)}\`\n);\n\nconst { success, data } = await response.json();\nif (success) {\n  console.log('Download URLs:', data.formats);\n}`
                                    },
                                    {
                                        label: 'Axios',
                                        language: 'javascript',
                                        code: `import axios from 'axios';\n\nconst response = await axios.get('${API_BASE}/api/v1', {\n  params: {\n    key: 'dwa_live_xxxxx',\n    url: 'https://www.facebook.com/share/p/1G8yBgJaPa/'\n  }\n});\n\nconsole.log(response.data.data.formats);`
                                    },
                                    {
                                        label: 'Python',
                                        language: 'python',
                                        code: `import requests\n\nparams = {\n    'key': 'dwa_live_xxxxx',\n    'url': 'https://www.facebook.com/share/p/1G8yBgJaPa/'\n}\n\nresponse = requests.get('${API_BASE}/api/v1', params=params)\nprint(response.json())`
                                    }
                                ]}
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
  }
}`}
                            />

                            <div className="mt-4 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                <p className="text-xs text-[var(--text-secondary)]">
                                    <strong className="text-purple-400">💡 Get Your API Key:</strong> Contact admin via Telegram <a href="https://t.me/suntaw" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">@suntaw</a> to get your API key.
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
                            <EndpointCard method="GET" path="/api/v1/status" description="Service status" />
                            <p className="text-sm text-[var(--text-muted)] mb-4">
                                Get current service status and platform availability.
                            </p>

                            <MacCodeBlock
                                tabs={[
                                    {
                                        label: 'cURL',
                                        language: 'bash',
                                        code: `curl -X GET "${API_BASE}/api/v1/status"`
                                    },
                                    {
                                        label: 'JavaScript',
                                        language: 'javascript',
                                        code: `fetch('${API_BASE}/api/v1/status')\n  .then(res => res.json())\n  .then(data => console.log(data));`
                                    }
                                ]}
                            />

                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 mt-4">Response</h3>
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
                            <EndpointCard method="GET" path="/api/v1/proxy" description="Media proxy" />
                            <p className="text-sm text-[var(--text-muted)] mb-4">
                                Proxy media URLs to bypass CORS restrictions.
                            </p>

                            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Query Parameters</h3>
                            <div className="overflow-x-auto -mx-3 sm:mx-0 mb-4">
                                <table className="w-full text-[10px] sm:text-xs min-w-[400px]">
                                    <thead>
                                        <tr className="border-b border-[var(--border-color)]">
                                            <th className="text-left py-2 px-2 sm:px-3 text-[var(--text-muted)] font-medium">Param</th>
                                            <th className="text-left py-2 px-2 sm:px-3 text-[var(--text-muted)] font-medium">Type</th>
                                            <th className="text-left py-2 px-2 sm:px-3 text-[var(--text-muted)] font-medium">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--border-color)]">
                                        <tr>
                                            <td className="py-2 px-2 sm:px-3 font-mono text-[var(--accent-primary)]">url</td>
                                            <td className="py-2 px-2 sm:px-3 text-[var(--text-muted)]">string</td>
                                            <td className="py-2 px-2 sm:px-3 text-[var(--text-muted)]">URL-encoded media URL</td>
                                        </tr>
                                        <tr>
                                            <td className="py-2 px-2 sm:px-3 font-mono text-[var(--accent-primary)]">inline</td>
                                            <td className="py-2 px-2 sm:px-3 text-[var(--text-muted)]">1 | 0</td>
                                            <td className="py-2 px-2 sm:px-3 text-[var(--text-muted)]">Display inline (1) or download (0)</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <MacCodeBlock
                                tabs={[
                                    { label: 'Example', language: 'html', code: `<img src="${API_BASE}/api/v1/proxy?url=https%3A%2F%2Fexample.com%2Fimage.jpg" />` }
                                ]}
                            />

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
