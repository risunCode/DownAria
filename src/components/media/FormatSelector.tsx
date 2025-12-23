/**
 * FormatSelector - Reusable format/quality selection buttons
 * Used in DownloadPreview and MediaGallery
 */

'use client';

import { MediaFormat } from '@/lib/types';
import { MusicIcon } from '@/components/ui/Icons';

interface FormatSelectorProps {
    formats: MediaFormat[];
    selected: MediaFormat | null;
    onSelect: (format: MediaFormat) => void;
    getSize?: (format: MediaFormat) => string | null;
    showAudioLabel?: boolean;
    className?: string;
}

/**
 * Display format selection buttons grouped by type
 * Shows file sizes when available
 */
export function FormatSelector({
    formats,
    selected,
    onSelect,
    getSize,
    showAudioLabel = true,
    className = ''
}: FormatSelectorProps) {
    // Group formats by type
    const videoFormats = formats.filter(f => f.type === 'video');
    const audioFormats = formats.filter(f => f.type === 'audio');
    const imageFormats = formats.filter(f => f.type === 'image');

    // Helper to get display quality (clean up generic names)
    const getDisplayQuality = (format: MediaFormat): string => {
        const quality = format.quality.toLowerCase();
        if (quality.startsWith('image')) {
            return format.type === 'video' ? 'Video' : 'Original';
        }
        return format.quality;
    };

    // Render format button
    const renderButton = (format: MediaFormat, idx: number, prefix: string) => {
        const isSelected = selected === format;
        const size = getSize?.(format);
        const displayQuality = getDisplayQuality(format);
        const needsMerge = format.needsMerge;

        return (
            <button
                key={`${prefix}-${idx}`}
                onClick={() => onSelect(format)}
                title={needsMerge ? 'HD quality - will merge video + audio' : undefined}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isSelected
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-card)]'
                }`}
            >
                {displayQuality}
                {needsMerge && <span className="ml-1 text-yellow-500">⚡</span>}
                {size && <span className="ml-1 opacity-70">({size})</span>}
            </button>
        );
    };

    // Hide if only one format with generic name
    if (formats.length === 1 && formats[0].quality.toLowerCase().startsWith('image')) {
        return null;
    }

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Video formats */}
            {videoFormats.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {videoFormats.map((format, idx) => renderButton(format, idx, 'v'))}
                </div>
            )}

            {/* Image formats */}
            {imageFormats.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {imageFormats.map((format, idx) => renderButton(format, idx, 'i'))}
                </div>
            )}

            {/* Audio formats */}
            {audioFormats.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {showAudioLabel && (
                        <span className="text-xs text-[var(--text-muted)] mr-2 flex items-center">
                            <MusicIcon className="w-3 h-3 mr-1" /> Audio
                        </span>
                    )}
                    {audioFormats.map((format, idx) => renderButton(format, idx, 'a'))}
                </div>
            )}
        </div>
    );
}

export default FormatSelector;
