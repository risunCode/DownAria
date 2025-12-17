'use client';

import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const sizes = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center"
        >
            <Loader2 className={`${sizes[size]} animate-spin text-[var(--accent-primary)]`} />
        </motion.div>
    );
}

export function FullPageLoader() {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-[var(--bg-primary)]">
            <div className="text-center">
                <LoadingSpinner size="lg" />
                <p className="mt-4 text-[var(--text-secondary)]">Loading...</p>
            </div>
        </div>
    );
}
