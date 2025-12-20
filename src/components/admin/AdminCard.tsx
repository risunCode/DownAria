'use client';

import { motion } from 'framer-motion';

interface AdminCardProps {
    title?: string;
    subtitle?: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    noPadding?: boolean;
}

export function AdminCard({ title, subtitle, icon, action, children, className = '', noPadding = false }: AdminCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-card ${noPadding ? '' : 'p-5'} ${className}`}
        >
            {(title || action) && (
                <div className={`flex items-center justify-between ${noPadding ? 'px-5 pt-5' : ''} ${title ? 'mb-4' : ''}`}>
                    {title && (
                        <div className="flex items-center gap-2">
                            {icon && <span className="text-[var(--accent-primary)]">{icon}</span>}
                            <div>
                                <h2 className="font-semibold">{title}</h2>
                                {subtitle && <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>}
                            </div>
                        </div>
                    )}
                    {action && <div>{action}</div>}
                </div>
            )}
            {children}
        </motion.div>
    );
}

// Stat card variant
interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    subtitle?: string;
    color?: string;
    onClick?: () => void;
}

export function StatCard({ icon, label, value, subtitle, color = 'text-[var(--accent-primary)]', onClick }: StatCardProps) {
    const Component = onClick ? 'button' : 'div';
    return (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <Component
                onClick={onClick}
                className={`glass-card p-4 w-full text-left ${onClick ? 'cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors' : ''}`}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-[var(--bg-secondary)] ${color}`}>{icon}</div>
                    <div className="min-w-0">
                        <p className="text-xs text-[var(--text-muted)] truncate">{label}</p>
                        <p className="text-xl font-bold">{value}</p>
                        {subtitle && <p className="text-[10px] text-[var(--text-muted)]">{subtitle}</p>}
                    </div>
                </div>
            </Component>
        </motion.div>
    );
}
