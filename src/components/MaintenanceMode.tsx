'use client';

import { motion } from 'framer-motion';
import { Wrench, Clock, RefreshCw } from 'lucide-react';

interface MaintenanceModeProps {
    message?: string;
    estimatedTime?: string;
}

export function MaintenanceMode({ message, estimatedTime }: MaintenanceModeProps) {
    const handleRefresh = () => {
        window.location.reload();
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full text-center"
            >
                {/* Icon */}
                <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[var(--accent-primary)]/10 mb-6"
                >
                    <Wrench className="w-12 h-12 text-[var(--accent-primary)]" />
                </motion.div>

                {/* Title */}
                <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
                    Under Maintenance
                </h1>

                {/* Message */}
                <p className="text-[var(--text-secondary)] mb-6">
                    {message || "We're currently performing scheduled maintenance. Please check back soon!"}
                </p>

                {/* Estimated Time */}
                {estimatedTime && (
                    <div className="flex items-center justify-center gap-2 text-sm text-[var(--text-muted)] mb-6">
                        <Clock className="w-4 h-4" />
                        <span>Estimated: {estimatedTime}</span>
                    </div>
                )}

                {/* Refresh Button */}
                <button
                    onClick={handleRefresh}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Check Again
                </button>

                {/* Status indicator */}
                <div className="mt-8 flex items-center justify-center gap-2">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">Maintenance in progress</span>
                </div>
            </motion.div>
        </div>
    );
}
