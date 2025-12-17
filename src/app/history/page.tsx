'use client';

import { SidebarLayout } from '@/components/Sidebar';
import { HistoryList } from '@/components/HistoryList';
import Announcements from '@/components/Announcements';
import { motion } from 'framer-motion';
import { Shield, HardDrive } from 'lucide-react';

export default function HistoryPage() {
    return (
        <SidebarLayout>
            <Announcements page="history" />
            <div className="py-8 px-6 lg:px-12">
                <div className="max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6"
                    >
                        <div className="text-center py-4">
                            <h1 className="text-2xl lg:text-3xl font-bold gradient-text mb-2">
                                Download History
                            </h1>
                            <p className="text-[var(--text-muted)]">
                                View and manage your past downloads
                            </p>
                        </div>

                        {/* Privacy Info Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="flex items-start gap-3 p-4 rounded-xl bg-[var(--accent-primary)]/5 border border-[var(--accent-primary)]/20"
                        >
                            <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10 shrink-0">
                                <Shield className="w-4 h-4 text-[var(--accent-primary)]" />
                            </div>
                            <div className="text-sm">
                                <p className="text-[var(--text-secondary)]">
                                    <span className="font-medium text-[var(--text-primary)]">Your privacy matters.</span>{' '}
                                    Download history is stored locally on your device only. 
                                    We never collect, track, or send your data anywhere.
                                </p>
                                <p className="text-[var(--text-muted)] text-xs mt-1 flex items-center gap-1">
                                    <HardDrive className="w-3 h-3" /> Saved in browser localStorage
                                </p>
                            </div>
                        </motion.div>

                        <HistoryList />
                    </motion.div>
                </div>
            </div>
        </SidebarLayout>
    );
}
