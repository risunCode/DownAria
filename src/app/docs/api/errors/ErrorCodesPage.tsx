'use client';

import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import { DocsNavbar } from '@/components/docs/DocsNavbar';

const errorCodes = [
    { code: 'INVALID_URL', status: 400, description: 'URL not valid or unsupported platform', solution: 'Check URL format' },
    { code: 'PLATFORM_DISABLED', status: 503, description: 'Platform temporarily disabled', solution: 'Check status page' },
    { code: 'MAINTENANCE_MODE', status: 503, description: 'DownAria under maintenance', solution: 'Wait and retry' },
    { code: 'RATE_LIMIT_EXCEEDED', status: 429, description: 'Too many requests', solution: 'Wait 60 seconds' },
    { code: 'PRIVATE_CONTENT', status: 403, description: 'Content is private', solution: 'Add cookie in Settings' },
    { code: 'COOKIE_REQUIRED', status: 401, description: 'Platform requires cookie', solution: 'Add platform cookie' },
    { code: 'COOKIE_EXPIRED', status: 401, description: 'Cookie has expired', solution: 'Get fresh cookie' },
    { code: 'CONTENT_NOT_FOUND', status: 404, description: 'Content not found or deleted', solution: 'Verify URL exists' },
    { code: 'NO_MEDIA_FOUND', status: 404, description: 'No downloadable media', solution: 'Check if post has video' },
    { code: 'NETWORK_ERROR', status: 500, description: 'Failed to connect', solution: 'Check internet' },
    { code: 'API_ERROR', status: 500, description: 'Platform API error', solution: 'Try again later' },
    { code: 'TIMEOUT', status: 504, description: 'Request timeout', solution: 'Retry request' },
];

export function ErrorCodesPage() {
    return (
        <SidebarLayout>
            <div className="py-6 px-4 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <DocsNavbar />
                    <div className="space-y-6">
                    {/* Header */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 text-xs font-medium mb-4">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            API Reference
                        </div>
                        <h1 className="text-3xl font-bold mb-3">
                            <span className="gradient-text">Error</span> Codes
                        </h1>
                        <p className="text-[var(--text-muted)]">
                            API error codes and how to handle them
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
                            All error responses follow the format: <code className="px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] text-xs">{`{ "success": false, "error": "ERROR_CODE: Description" }`}</code>
                        </p>
                    </motion.div>

                    {/* Error Table */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="glass-card p-5"
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Quick Reference</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="border-b border-[var(--border-color)]">
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Code</th>
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Status</th>
                                        <th className="text-left py-2 px-3 text-[var(--text-muted)] font-medium">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--border-color)]">
                                    {errorCodes.map((error) => (
                                        <tr key={error.code} className="hover:bg-[var(--bg-secondary)] transition-colors">
                                            <td className="py-2 px-3">
                                                <code className="text-red-400">{error.code}</code>
                                            </td>
                                            <td className="py-2 px-3">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                    error.status >= 500 ? 'bg-red-500/20 text-red-400' :
                                                    error.status >= 400 ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-green-500/20 text-green-400'
                                                }`}>
                                                    {error.status}
                                                </span>
                                            </td>
                                            <td className="py-2 px-3 text-[var(--text-muted)]">{error.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>

                    {/* Error Details */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Error Details & Solutions</h2>
                        <div className="space-y-3">
                            {errorCodes.map((error, idx) => (
                                <motion.div
                                    key={error.code}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 + idx * 0.03 }}
                                    className="glass-card p-4"
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <code className="text-sm font-mono text-red-400">{error.code}</code>
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                            error.status >= 500 ? 'bg-red-500/20 text-red-400' :
                                            error.status >= 400 ? 'bg-yellow-500/20 text-yellow-400' :
                                            'bg-green-500/20 text-green-400'
                                        }`}>
                                            HTTP {error.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-[var(--text-muted)] mb-2">{error.description}</p>
                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]">
                                        <span className="text-[var(--accent-primary)] text-xs">💡</span>
                                        <span className="text-xs text-[var(--text-secondary)]">{error.solution}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                    </div>
                </div>
            </div>
        </SidebarLayout>
    );
}
