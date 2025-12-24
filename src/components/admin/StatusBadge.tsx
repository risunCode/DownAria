'use client';

type Status = 'active' | 'inactive' | 'on' | 'off' | 'healthy' | 'cooldown' | 'expired' | 'disabled' | 'warning' | 'error' | 'success' | 'info' | 'banned' | 'frozen';

interface StatusBadgeProps {
    status: Status;
    label?: string;
    size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<Status, { bg: string; text: string; dot: string; defaultLabel: string }> = {
    active: { bg: 'bg-green-500/15', text: 'text-green-400', dot: 'bg-green-400', defaultLabel: 'Active' },
    on: { bg: 'bg-green-500/15', text: 'text-green-400', dot: 'bg-green-400', defaultLabel: 'ON' },
    healthy: { bg: 'bg-green-500/15', text: 'text-green-400', dot: 'bg-green-400', defaultLabel: 'Healthy' },
    success: { bg: 'bg-green-500/15', text: 'text-green-400', dot: 'bg-green-400', defaultLabel: 'Success' },
    inactive: { bg: 'bg-gray-500/15', text: 'text-gray-400', dot: 'bg-gray-400', defaultLabel: 'Inactive' },
    off: { bg: 'bg-gray-500/15', text: 'text-gray-400', dot: 'bg-gray-400', defaultLabel: 'OFF' },
    disabled: { bg: 'bg-gray-500/15', text: 'text-gray-400', dot: 'bg-gray-400', defaultLabel: 'Disabled' },
    warning: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', dot: 'bg-yellow-400', defaultLabel: 'Warning' },
    cooldown: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', dot: 'bg-yellow-400', defaultLabel: 'Cooldown' },
    error: { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-400', defaultLabel: 'Error' },
    expired: { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-400', defaultLabel: 'Expired' },
    banned: { bg: 'bg-red-600/15', text: 'text-red-500', dot: 'bg-red-500', defaultLabel: 'Banned' },
    info: { bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-400', defaultLabel: 'Info' },
    frozen: { bg: 'bg-blue-500/15', text: 'text-blue-400', dot: 'bg-blue-400', defaultLabel: 'Frozen' },
};

export function StatusBadge({ status, label, size = 'sm' }: StatusBadgeProps) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.inactive;
    const displayLabel = label || config.defaultLabel;
    
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${config.bg} ${config.text} ${size === 'sm' ? 'text-xs' : 'text-sm'} font-medium`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {displayLabel}
        </span>
    );
}
