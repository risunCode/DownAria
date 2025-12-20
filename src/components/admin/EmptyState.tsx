'use client';

import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

interface EmptyStateAction {
    label: string;
    onClick: () => void;
}

interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description?: string;
    action?: EmptyStateAction | React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    const isActionObject = action && typeof action === 'object' && 'label' in action && 'onClick' in action;
    
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
        >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-muted)]">
                {icon}
            </div>
            <h3 className="font-semibold mb-1">{title}</h3>
            {description && <p className="text-sm text-[var(--text-muted)] mb-4">{description}</p>}
            {action && (
                isActionObject ? (
                    <button
                        onClick={(action as EmptyStateAction).onClick}
                        className="btn-gradient inline-flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        {(action as EmptyStateAction).label}
                    </button>
                ) : (
                    <div>{action}</div>
                )
            )}
        </motion.div>
    );
}
