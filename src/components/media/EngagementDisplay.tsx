/**
 * EngagementDisplay - Reusable engagement stats display
 * Used in DownloadPreview and MediaGallery
 */

'use client';

import { Eye, Heart, MessageCircle, Share2, Bookmark, Repeat2 } from 'lucide-react';
import { EngagementStats } from '@/lib/types';
import { formatNumber } from '@/lib/utils/format';

interface EngagementDisplayProps {
    engagement: EngagementStats;
    size?: 'sm' | 'md';
    className?: string;
}

/**
 * Display engagement statistics with icons
 * Automatically hides stats that are undefined or zero
 */
export function EngagementDisplay({ 
    engagement, 
    size = 'sm',
    className = '' 
}: EngagementDisplayProps) {
    const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
    const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
    
    const stats = [
        { 
            key: 'views', 
            value: engagement.views, 
            icon: Eye, 
            color: 'text-purple-400',
            label: 'views'
        },
        { 
            key: 'likes', 
            value: engagement.likes, 
            icon: Heart, 
            color: 'text-red-400',
            label: 'likes'
        },
        { 
            key: 'comments', 
            value: engagement.comments, 
            icon: MessageCircle, 
            color: 'text-blue-400',
            label: 'comments'
        },
        { 
            key: 'shares', 
            value: engagement.shares, 
            icon: Share2, 
            color: 'text-green-400',
            label: 'shares'
        },
        { 
            key: 'bookmarks', 
            value: engagement.bookmarks, 
            icon: Bookmark, 
            color: 'text-yellow-400',
            label: 'bookmarks'
        },
        { 
            key: 'replies', 
            value: engagement.replies, 
            icon: Repeat2, 
            color: 'text-orange-400',
            label: 'replies'
        },
    ];

    // Filter out undefined or zero values
    const visibleStats = stats.filter(s => s.value !== undefined && s.value > 0);

    if (visibleStats.length === 0) return null;

    return (
        <div className={`flex flex-wrap gap-2 ${textSize} ${className}`}>
            {visibleStats.map(({ key, value, icon: Icon, color }) => (
                <span 
                    key={key} 
                    className={`flex items-center gap-1 ${color}`}
                    title={`${value?.toLocaleString()} ${key}`}
                >
                    <Icon className={iconSize} />
                    {formatNumber(value!)}
                </span>
            ))}
        </div>
    );
}

export default EngagementDisplay;
