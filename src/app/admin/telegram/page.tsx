'use client';

import { motion } from 'framer-motion';
import { Bot, ChevronRight, MessageSquare, Send, Settings } from 'lucide-react';

const COMMANDS = [
    { cmd: '/download', desc: 'Download media from URL' },
    { cmd: '/info', desc: 'Get media info without downloading' },
    { cmd: '/formats', desc: 'List available formats' },
    { cmd: '/help', desc: 'Show help message' },
];

export default function TelegramPage() {
    return (
        <div className="p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl font-bold">Telegram Bot</h1>
                    <p className="text-[var(--text-muted)] text-sm">Configure Telegram bot integration</p>
                </div>

                {/* Coming Soon */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30"
                >
                    <p className="text-sm text-yellow-400">
                        ⚠️ Telegram Bot integration is coming soon. Configuration below is for preview only.
                    </p>
                </motion.div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Bot Config */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-5"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <Bot className="w-5 h-5 text-[#0088cc]" />
                            <h2 className="font-semibold">Bot Configuration</h2>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-[var(--text-muted)] mb-1">Bot Token</label>
                                <input
                                    type="password"
                                    placeholder="Enter Telegram Bot Token"
                                    className="input-url text-sm"
                                    disabled
                                />
                                <p className="text-xs text-[var(--text-muted)] mt-1">Get from @BotFather</p>
                            </div>

                            <div>
                                <label className="block text-xs text-[var(--text-muted)] mb-1">Admin Chat ID</label>
                                <input
                                    type="text"
                                    placeholder="Your Telegram user ID"
                                    className="input-url text-sm"
                                    disabled
                                />
                            </div>

                            <button className="btn-gradient flex items-center gap-2 opacity-50 cursor-not-allowed" disabled>
                                <Settings className="w-4 h-4" />
                                Save Configuration
                            </button>
                        </div>
                    </motion.div>

                    {/* Commands */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass-card p-5"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <MessageSquare className="w-5 h-5 text-[#0088cc]" />
                            <h2 className="font-semibold">Bot Commands</h2>
                        </div>

                        <div className="space-y-2">
                            {COMMANDS.map((cmd) => (
                                <div
                                    key={cmd.cmd}
                                    className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]"
                                >
                                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                                    <code className="text-sm text-[#0088cc] font-medium">{cmd.cmd}</code>
                                    <span className="text-sm text-[var(--text-secondary)]">— {cmd.desc}</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>

                {/* Test Message */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-card p-5"
                >
                    <div className="flex items-center gap-2 mb-4">
                        <Send className="w-5 h-5 text-[#0088cc]" />
                        <h2 className="font-semibold">Test Message</h2>
                    </div>

                    <div className="flex gap-3">
                        <input
                            type="text"
                            placeholder="Enter test message..."
                            className="input-url text-sm flex-1"
                            disabled
                        />
                        <button className="btn-gradient opacity-50 cursor-not-allowed" disabled>
                            Send Test
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
