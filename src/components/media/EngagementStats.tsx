'use client';

import { Eye, Heart, MessageCircle, Repeat2, Share2, Bookmark } from 'lucide-react';
import { UnifiedEngagement } from '@/lib/types';

interface EngagementStatsProps {
    engagement: UnifiedEngagement;
    compact?: boolean;
}

function formatCount(num: number): string {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString();
}

export function EngagementStats({ engagement, compact = false }: EngagementStatsProps) {
    const stats = [
        { key: 'views', value: engagement.views, icon: Eye, color: 'text-purple-400', label: 'Views' },
        { key: 'likes', value: engagement.likes, icon: Heart, color: 'text-red-400', label: 'Likes' },
        { key: 'comments', value: engagement.comments, icon: MessageCircle, color: 'text-blue-400', label: 'Comments' },
        { key: 'shares', value: engagement.shares, icon: Share2, color: 'text-green-400', label: 'Shares' },
        { key: 'bookmarks', value: engagement.bookmarks, icon: Bookmark, color: 'text-yellow-400', label: 'Bookmarks' },
    ].filter(s => s.value !== undefined && s.value > 0);

    if (stats.length === 0) return null;

    if (compact) {
        return (
            <div className="flex flex-wrap gap-2 text-xs">
                {stats.map(({ key, value, icon: Icon, color }) => (
                    <span key={key} className={`flex items-center gap-1 ${color}`}>
                        <Icon className="w-3 h-3" />
                        {formatCount(value!)}
                    </span>
                ))}
            </div>
        );
    }

    return (
        <div className="flex flex-wrap gap-3 text-sm">
            {stats.map(({ key, value, icon: Icon, color, label }) => (
                <div key={key} className="flex items-center gap-1.5" title={label}>
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className="text-[var(--text-secondary)]">{formatCount(value!)}</span>
                </div>
            ))}
        </div>
    );
}

export default EngagementStats;
