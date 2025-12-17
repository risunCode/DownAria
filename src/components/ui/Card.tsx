'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    hover?: boolean;
    onClick?: () => void;
}

export function Card({ children, className = '', hover = true, onClick }: CardProps) {
    return (
        <motion.div
            whileHover={hover ? { y: -2 } : undefined}
            transition={{ duration: 0.2 }}
            onClick={onClick}
            className={`
        glass-card p-6
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
        >
            {children}
        </motion.div>
    );
}

// Skeleton loading card
export function CardSkeleton({ className = '' }: { className?: string }) {
    return (
        <div className={`glass-card p-6 ${className}`}>
            <div className="flex gap-4">
                <div className="skeleton w-32 h-24 rounded-lg" />
                <div className="flex-1 space-y-3">
                    <div className="skeleton h-5 w-3/4 rounded" />
                    <div className="skeleton h-4 w-1/2 rounded" />
                    <div className="skeleton h-4 w-1/3 rounded" />
                </div>
            </div>
        </div>
    );
}
