'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center max-w-md"
            >
                {/* 404 Number */}
                <motion.div
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 10 }}
                    className="text-[120px] sm:text-[150px] font-bold leading-none gradient-text"
                >
                    404
                </motion.div>
                
                {/* Message */}
                <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-4 mb-2">
                    Page Not Found
                </h1>
                <p className="text-[var(--text-muted)] mb-8">
                    Oops! The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>
                
                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] text-white font-medium rounded-xl transition-colors"
                    >
                        <Home className="w-5 h-5" />
                        Go Home
                    </Link>
                    <button
                        onClick={() => window.history.back()}
                        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] text-[var(--text-primary)] font-medium rounded-xl border border-[var(--border-color)] transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Go Back
                    </button>
                </div>
                
                {/* Suggestion */}
                <div className="mt-8 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)]">
                    <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                        <Search className="w-4 h-4" />
                        <span>Try downloading a video from the homepage</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
