'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebook, faInstagram, faTwitter, faWeibo, faYoutube } from '@fortawesome/free-brands-svg-icons';
import { faMusic } from '@fortawesome/free-solid-svg-icons';

export type PlatformId = 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'weibo' | 'youtube';

interface PlatformIconProps {
    platform: PlatformId;
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    showBg?: boolean;
}

const PLATFORM_CONFIG: Record<PlatformId, { icon: typeof faFacebook; color: string; bg: string; label: string }> = {
    facebook: { icon: faFacebook, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Facebook' },
    instagram: { icon: faInstagram, color: 'text-pink-500', bg: 'bg-pink-500/10', label: 'Instagram' },
    twitter: { icon: faTwitter, color: 'text-sky-400', bg: 'bg-sky-400/10', label: 'Twitter/X' },
    tiktok: { icon: faMusic, color: 'text-pink-400', bg: 'bg-pink-400/10', label: 'TikTok' },
    weibo: { icon: faWeibo, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'Weibo' },
    youtube: { icon: faYoutube, color: 'text-red-500', bg: 'bg-red-500/10', label: 'YouTube' },
};

const SIZE_MAP = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' };
const CONTAINER_SIZE_MAP = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };

export function PlatformIcon({ platform, size = 'md', showLabel = false, showBg = false }: PlatformIconProps) {
    const config = PLATFORM_CONFIG[platform];
    if (!config) return null;

    const icon = (
        <FontAwesomeIcon icon={config.icon} className={`${SIZE_MAP[size]} ${config.color}`} />
    );

    if (showBg) {
        return (
            <div className={`${CONTAINER_SIZE_MAP[size]} rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
                {icon}
                {showLabel && <span className={`ml-2 font-medium ${config.color}`}>{config.label}</span>}
            </div>
        );
    }

    if (showLabel) {
        return (
            <div className="flex items-center gap-2">
                {icon}
                <span className="font-medium">{config.label}</span>
            </div>
        );
    }

    return icon;
}

export function getPlatformLabel(platform: PlatformId): string {
    return PLATFORM_CONFIG[platform]?.label || platform;
}

export function getPlatformColor(platform: PlatformId): string {
    return PLATFORM_CONFIG[platform]?.color || 'text-gray-400';
}
