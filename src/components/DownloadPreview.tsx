'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
    Download,
    Play,
    User,
    Eye,
    Loader2,
    Maximize2,
    Send
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MediaData, MediaFormat, PlatformId } from '@/lib/types';
import { addHistory, type HistoryEntry } from '@/lib/storage';
import { LayersIcon, CheckCircleIcon } from '@/components/ui/Icons';
import { sendDiscordNotification, getUserDiscordSettings } from '@/lib/utils/discord-webhook';
import { formatBytes } from '@/lib/utils/format';
import { getProxiedThumbnail } from '@/lib/api/proxy';
import { getProxyUrl } from '@/lib/api/proxy';
import { RichText } from '@/lib/utils/text-parser';
import { useTranslations } from 'next-intl';
import { MediaGallery } from '@/components/media';
import Swal from 'sweetalert2';
// Shared utilities
import { 
    extractPostId, 
    groupFormatsByItem,
    getItemThumbnails,
    findPreferredFormat 
} from '@/lib/utils/media';
import { EngagementDisplay } from '@/components/media/EngagementDisplay';
import { FormatSelector } from '@/components/media/FormatSelector';
import { DownloadProgress, getProgressText as getProgressTextUtil } from '@/components/media/DownloadProgress';

interface DownloadPreviewProps {
    data: MediaData;
    platform: PlatformId;
    onDownloadComplete?: (entry: HistoryEntry) => void;
}

type DownloadStatus = 'idle' | 'downloading' | 'success' | 'error';

export function DownloadPreview({ data, platform, onDownloadComplete }: DownloadPreviewProps) {
    const [downloadStatus, setDownloadStatus] = useState<Record<string, DownloadStatus>>({});
    const [downloadProgress, setDownloadProgress] = useState<Record<string, { loaded: number; total: number; percent: number; speed: number; message?: string }>>({});
    const [fileSizes, setFileSizes] = useState<Record<string, string>>({});
    const [fileSizeNumerics, setFileSizeNumerics] = useState<Record<string, number>>({});
    const [globalStatus, setGlobalStatus] = useState<DownloadStatus>('idle');
    const [showGallery, setShowGallery] = useState(false);
    const [galleryInitialIndex, setGalleryInitialIndex] = useState(0);
    
    const t = useTranslations('download.preview');
    const tCommon = useTranslations('common');

    // Safety check - if no data or no formats, show nothing
    if (!data || !data.formats || data.formats.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6 text-center"
            >
                <p className="text-[var(--text-muted)]">No media formats available</p>
            </motion.div>
        );
    }

    // Group formats by itemId using shared utilities
    const formats = data.formats || [];
    const groupedItems = groupFormatsByItem(formats);
    const itemThumbnails = getItemThumbnails(formats);

    const itemIds = Object.keys(groupedItems);
    const isMultiItem = itemIds.length > 1;

    // State for selected format per item using shared utility
    const [selectedFormats, setSelectedFormats] = useState<Record<string, MediaFormat>>(() => {
        const initial: Record<string, MediaFormat> = {};
        itemIds.forEach(id => {
            const preferred = findPreferredFormat(groupedItems[id] || []);
            if (preferred) initial[id] = preferred;
        });
        return initial;
    });

    // State for selected item
    const [selectedItemId, setSelectedItemId] = useState<string>(itemIds[0] || 'main');

    // State for webhook sent tracking
    const [sentToWebhook, setSentToWebhook] = useState<Record<string, boolean>>({});
    
    // Track if sizes have been fetched for current data
    const [sizesFetched, setSizesFetched] = useState(false);

    // Reset sizesFetched when data changes
    useEffect(() => {
        setSizesFetched(false);
        setFileSizes({});
        setFileSizeNumerics({});
    }, [data.url]); // Reset when URL changes (new content)

    // Fetch file sizes for ALL formats (not just selected) - skip YouTube
    useEffect(() => {
        if (platform === 'youtube') return; // YouTube sizes are unknown (streaming)
        if (sizesFetched) return; // Already fetched
        if (!data.formats || data.formats.length === 0) return;
        
        const fetchSizes = async () => {
            // Collect all unique format URLs from data.formats directly
            const allFormats: { itemId: string; format: MediaFormat }[] = [];
            for (const format of data.formats || []) {
                const itemId = format.itemId || 'main';
                if (format?.url) {
                    allFormats.push({ itemId, format });
                }
            }
            
            if (allFormats.length === 0) return;
            
            setSizesFetched(true); // Mark as fetched to prevent re-runs
            
            // Fetch all in parallel (batch)
            const results = await Promise.allSettled(
                allFormats.map(async ({ itemId, format }) => {
                    try {
                        const proxyUrl = getProxyUrl(format.url, { platform, head: true });
                        const res = await fetch(proxyUrl);
                        const size = res.headers.get('x-file-size');
                        const key = `${itemId}-${format.url}`;
                        if (size && parseInt(size) > 0) {
                            const bytes = parseInt(size);
                            return { key, size: formatBytes(bytes), bytes };
                        }
                        return { key, size: null, bytes: 0 };
                    } catch {
                        return { key: `${itemId}-${format.url}`, size: null, bytes: 0 };
                    }
                })
            );
            
            // Batch update state
            const newSizes: Record<string, string> = {};
            const newNumerics: Record<string, number> = {};
            results.forEach((result) => {
                if (result.status === 'fulfilled' && result.value.size) {
                    newSizes[result.value.key] = result.value.size;
                    newNumerics[result.value.key] = result.value.bytes;
                }
            });
            
            if (Object.keys(newSizes).length > 0) {
                setFileSizes(newSizes);
                setFileSizeNumerics(newNumerics);
            }
        };
        
        fetchSizes();
    }, [platform, data.formats, sizesFetched]); // Re-run when platform or formats change

    const getFileSize = (itemId: string, format: MediaFormat | undefined): string | null => {
        if (!format?.url) return null;
        const key = `${itemId}-${format.url}`;
        return fileSizes[key] || null;
    };

    // Helper to get size for any format (not just selected)
    const getFormatSize = (itemId: string, format: MediaFormat): string | null => {
        if (!format?.url) return null;
        const key = `${itemId}-${format.url}`;
        return fileSizes[key] || null;
    };

    // Use shared progress text utility
    const getProgressText = (itemId: string): string => {
        const progress = downloadProgress[itemId];
        if (!progress) return tCommon('loading');
        return getProgressTextUtil({
            percent: progress.percent,
            loaded: progress.loaded,
            total: progress.total,
            speed: progress.speed,
            message: progress.message
        });
    };

    // Send to webhook
    const handleSendToWebhook = async (format: MediaFormat, itemId: string) => {
        const settings = getUserDiscordSettings();
        if (!settings?.webhookUrl) {
            Swal.fire({
                icon: 'warning',
                title: 'Webhook Not Configured',
                text: 'Please configure Discord webhook in Settings first.',
                confirmButtonText: 'Go to Settings',
                showCancelButton: true,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                confirmButtonColor: 'var(--accent-primary)',
            }).then((result) => {
                if (result.isConfirmed) {
                    window.location.href = '/settings';
                }
            });
            return;
        }

        const thumbnail = itemThumbnails[itemId] || data.thumbnail;
        const itemIndex = itemIds.indexOf(itemId) + 1;
        const isVideo = format.type === 'video';

        // Get file size
        const sizeKey = `${itemId}-${format.url}`;
        const sizeBytes = fileSizeNumerics[sizeKey] || 0;

        // Delegate confirmation to sendDiscordNotification (which now has smart dialogs)
        const sendResult = await sendDiscordNotification({
            platform: platform.charAt(0).toUpperCase() + platform.slice(1),
            title: data.title || 'Untitled',
            quality: format.quality,
            thumbnail,
            mediaUrl: format.url,
            mediaType: format.type,
            sourceUrl: data.url,
            author: data.author,
            engagement: data.engagement,
            fileSize: sizeBytes,
        }, true);

        if (sendResult.sent) {
            setSentToWebhook(prev => ({ ...prev, [itemId]: true }));
            Swal.fire({
                icon: 'success',
                title: 'Sent to Discord',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
        } else if (sendResult.reason !== 'cancelled') {
            Swal.fire({
                icon: 'error',
                title: 'Failed to Send',
                text: sendResult.details,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 5000,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
        }
    };

    // Download function - uses unified helper
    const triggerDownload = async (format: MediaFormat, itemId: string) => {
        setDownloadStatus(prev => ({ ...prev, [itemId]: 'downloading' }));
        setDownloadProgress(prev => ({ ...prev, [itemId]: { loaded: 0, total: 0, percent: 0, speed: 0 } }));

        try {
            const { downloadMedia, triggerBlobDownload } = await import('@/lib/utils/media');
            const carouselIndex = isMultiItem && itemId !== 'main' ? itemIds.indexOf(itemId) + 1 : undefined;
            
            const result = await downloadMedia(format, data, platform, carouselIndex, (progress) => {
                setDownloadProgress(prev => ({
                    ...prev,
                    [itemId]: {
                        loaded: progress.loaded,
                        total: progress.total,
                        percent: progress.percent,
                        speed: progress.speed,
                        message: progress.message,
                    }
                }));
            });

            if (!result.success) {
                throw new Error(result.error || 'Download failed');
            }

            // Trigger browser download if we have a blob
            if (result.blob && result.filename) {
                triggerBlobDownload(result.blob, result.filename);
            }

            // Add to history
            const postId = extractPostId(data.url);
            const historyId = await addHistory({
                platform,
                contentId: postId,
                resolvedUrl: data.url,
                title: data.title || 'Untitled',
                thumbnail: itemThumbnails[itemId] || data.thumbnail || '',
                author: data.author || 'Unknown',
                quality: format.quality,
                type: format.type,
            });

            if (onDownloadComplete) {
                onDownloadComplete({
                    id: historyId,
                    platform,
                    contentId: postId,
                    resolvedUrl: data.url,
                    title: data.title || 'Untitled',
                    thumbnail: itemThumbnails[itemId] || data.thumbnail || '',
                    author: data.author || 'Unknown',
                    downloadedAt: Date.now(),
                    quality: format.quality,
                    type: format.type,
                });
            }

            // Send Discord notification
            if (!sentToWebhook[itemId]) {
                sendDiscordNotification({
                    platform: platform.charAt(0).toUpperCase() + platform.slice(1),
                    title: data.title || result.filename || 'Download',
                    quality: format.quality,
                    thumbnail: itemThumbnails[itemId] || data.thumbnail,
                    mediaUrl: format.url,
                    mediaType: format.type,
                    sourceUrl: data.url,
                    author: data.author,
                });
                setSentToWebhook(prev => ({ ...prev, [itemId]: true }));
            }

            setDownloadStatus(prev => ({ ...prev, [itemId]: 'success' }));
            setTimeout(() => setDownloadStatus(prev => ({ ...prev, [itemId]: 'idle' })), 5000);
        } catch (e) {
            console.error('Download error:', e);
            setDownloadStatus(prev => ({ ...prev, [itemId]: 'error' }));
            setTimeout(() => setDownloadStatus(prev => ({ ...prev, [itemId]: 'idle' })), 5000);
        }
    };

    const handleDownloadAll = async () => {
        setGlobalStatus('downloading');
        let isFirstItem = true;
        for (const id of itemIds) {
            const format = selectedFormats[id] || groupedItems[id]?.[0];
            if (format) {
                try {
                    // For Download All, only send Discord for first item (representative)
                    // Mark others as "sent" to prevent duplicate sends
                    if (!isFirstItem && !sentToWebhook[id]) {
                        setSentToWebhook(prev => ({ ...prev, [id]: true }));
                    }
                    await triggerDownload(format, id);
                    isFirstItem = false;
                    await new Promise(r => setTimeout(r, 1000));
                } catch { /* skip failed */ }
            }
        }
        setGlobalStatus('idle');
    };

    const renderFormatButtons = (formats: MediaFormat[], itemId: string) => (
        <FormatSelector
            formats={formats}
            selected={selectedFormats[itemId] || null}
            onSelect={(format) => setSelectedFormats(prev => ({ ...prev, [itemId]: format }))}
            getSize={(f) => getFormatSize(itemId, f)}
        />
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card p-3 sm:p-4 overflow-hidden shiny-border"
        >
            {/* Header */}
            <div className="mb-3 sm:mb-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] line-clamp-1">{data.title}</h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Response time FIRST, then public/private badge */}
                        {data.responseTime && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                ⚡ {data.responseTime}ms
                            </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${data.usedCookie
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-green-500/20 text-green-400 border border-green-500/30'
                            }`}>
                            {data.usedCookie ? t('withCookie') : t('guest')}
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3 text-xs text-[var(--text-secondary)]">
                    {data.author && (<span className="flex items-center gap-1"><User className="w-3 h-3" />{data.author}</span>)}
                    {data.views && (<span className="flex items-center gap-1"><Eye className="w-3 h-3" />{data.views}</span>)}
                    {isMultiItem && (<span className="flex items-center gap-1 text-[var(--accent-primary)]"><LayersIcon className="w-3 h-3" />{itemIds.length} {t('items')}</span>)}
                    {data.engagement && <EngagementDisplay engagement={data.engagement} />}
                </div>
                {/* Description - truncated to ~150 chars */}
                {data.description && (
                    <div className="mt-2">
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                            {data.description.length > 150 
                                ? data.description.replace(/\n+/g, ' ').substring(0, 150) + '...'
                                : data.description.replace(/\n+/g, ' ')
                            }
                        </p>
                    </div>
                )}
            </div>

            {/* Content */}
            {isMultiItem ? (
                <div className="space-y-4">
                    {/* Thumbnail grid */}
                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-1">
                        {itemIds.map((itemId, index) => {
                            const thumbnail = itemThumbnails[itemId] || data.thumbnail;
                            const isSelected = selectedItemId === itemId;
                            return (
                                <button key={itemId} onClick={() => setSelectedItemId(itemId)}
                                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${isSelected
                                        ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)] ring-opacity-30'
                                        : 'border-[var(--border-color)] hover:border-[var(--accent-primary)] opacity-60 hover:opacity-100'}`}>
                                    {thumbnail ? (
                                        <Image src={getProxiedThumbnail(thumbnail, platform)} alt={`#${index + 1}`} fill className="object-cover" unoptimized />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-[var(--bg-secondary)]">
                                            <Play className="w-4 h-4 text-[var(--text-muted)]" />
                                        </div>
                                    )}
                                    <div className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">{index + 1}</div>
                                    {isSelected && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="absolute inset-0 bg-black/30" />
                                            <CheckCircleIcon className="w-6 h-6 text-[var(--accent-primary)] drop-shadow-lg relative z-10" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Selected item preview */}
                    <div className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <div 
                            className="relative w-full sm:w-32 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-primary)] cursor-pointer group"
                            onClick={() => {
                                setGalleryInitialIndex(itemIds.indexOf(selectedItemId));
                                setShowGallery(true);
                            }}
                        >
                            {itemThumbnails[selectedItemId] ? (
                                <Image src={getProxiedThumbnail(itemThumbnails[selectedItemId], platform)} alt="Preview" fill className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center"><Play className="w-8 h-8 text-[var(--text-muted)]" /></div>
                            )}
                            {/* Preview overlay */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col">
                            {groupedItems[selectedItemId].length > 1 && renderFormatButtons(groupedItems[selectedItemId], selectedItemId)}
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {/* Preview button */}
                                <Button size="xs" variant="secondary" onClick={() => {
                                    setGalleryInitialIndex(itemIds.indexOf(selectedItemId));
                                    setShowGallery(true);
                                }}
                                    leftIcon={<Maximize2 className="w-3.5 h-3.5" />}>
                                    Preview
                                </Button>
                                {/* Discord button */}
                                <Button size="xs" variant="secondary" onClick={() => {
                                    const format = selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0];
                                    if (format) handleSendToWebhook(format, selectedItemId);
                                }}
                                    disabled={sentToWebhook[selectedItemId]}
                                    leftIcon={sentToWebhook[selectedItemId] ? <CheckCircleIcon className="w-3.5 h-3.5 text-green-400" /> : <Send className="w-3.5 h-3.5" />}>
                                    {sentToWebhook[selectedItemId] ? t('sent') : t('discord')}
                                </Button>
                                <Button size="xs" onClick={() => {
                                    const format = selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0];
                                    if (format) triggerDownload(format, selectedItemId);
                                }}
                                    disabled={downloadStatus[selectedItemId] === 'downloading'}
                                    leftIcon={downloadStatus[selectedItemId] === 'downloading' ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}>
                                    {downloadStatus[selectedItemId] === 'downloading'
                                        ? getProgressText(selectedItemId)
                                        : downloadStatus[selectedItemId] === 'success'
                                            ? t('done')
                                            : `${t('download')}${getFileSize(selectedItemId, selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0]) ? ` (${getFileSize(selectedItemId, selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0])})` : ''}`}
                                </Button>
                            </div>
                            {/* Progress Bar for carousel item */}
                            {downloadStatus[selectedItemId] === 'downloading' && downloadProgress[selectedItemId] && (
                                <DownloadProgress 
                                    progress={{
                                        percent: downloadProgress[selectedItemId]?.percent || 0,
                                        loaded: downloadProgress[selectedItemId]?.loaded || 0,
                                        total: downloadProgress[selectedItemId]?.total || 0,
                                        speed: downloadProgress[selectedItemId]?.speed || 0
                                    }}
                                    animated={false}
                                    className="mt-3"
                                />
                            )}
                        </div>
                    </div>

                    {/* Download All */}
                    <div className="pt-4 border-t border-[var(--border-color)] flex justify-end">
                        <Button variant="primary" size="sm" onClick={handleDownloadAll} disabled={globalStatus === 'downloading'}
                            leftIcon={globalStatus === 'downloading' ? <Loader2 className="animate-spin w-4 h-4" /> : <Download className="w-4 h-4" />}>
                            {globalStatus === 'downloading' ? t('downloadingAll') : `${t('downloadAll')} (${itemIds.length})`}
                        </Button>
                    </div>
                </div>
            ) : (
                /* Single item */
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                    <div 
                        className="relative w-full sm:w-48 md:w-64 aspect-video rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)] cursor-pointer group"
                        onClick={() => setShowGallery(true)}
                    >
                        {(itemThumbnails[itemIds[0]] || data.thumbnail) ? (
                            <Image src={getProxiedThumbnail(itemThumbnails[itemIds[0]] || data.thumbnail, platform)} alt={data.title || 'Preview'} fill className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center"><Play className="w-12 h-12 text-[var(--text-muted)]" /></div>
                        )}
                        {/* Preview overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-sm font-medium">
                                <Maximize2 className="w-4 h-4" />
                                Preview
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        {renderFormatButtons(groupedItems[itemIds[0]], itemIds[0])}
                        <div className="mt-4 flex flex-wrap gap-1.5">
                            {/* Preview button */}
                            <Button size="xs" variant="secondary" onClick={() => {
                                setGalleryInitialIndex(0);
                                setShowGallery(true);
                            }}
                                leftIcon={<Maximize2 className="w-3.5 h-3.5" />}>
                                Preview
                            </Button>
                            {/* Discord button */}
                            <Button size="xs" variant="secondary" onClick={() => handleSendToWebhook(selectedFormats[itemIds[0]], itemIds[0])}
                                disabled={sentToWebhook[itemIds[0]]}
                                leftIcon={sentToWebhook[itemIds[0]] ? <CheckCircleIcon className="w-3.5 h-3.5 text-green-400" /> : <Send className="w-3.5 h-3.5" />}>
                                {sentToWebhook[itemIds[0]] ? t('sent') : t('discord')}
                            </Button>
                            {/* Download button */}
                            <Button size="xs" onClick={() => triggerDownload(selectedFormats[itemIds[0]], itemIds[0])}
                                disabled={downloadStatus[itemIds[0]] === 'downloading'}
                                leftIcon={downloadStatus[itemIds[0]] === 'downloading' ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}>
                                {downloadStatus[itemIds[0]] === 'downloading'
                                    ? getProgressText(itemIds[0])
                                    : downloadStatus[itemIds[0]] === 'success' ? t('downloaded') : t('download')}
                                {downloadStatus[itemIds[0]] !== 'downloading' && getFileSize(itemIds[0], selectedFormats[itemIds[0]]) && (
                                    <span className="ml-1 opacity-70">({getFileSize(itemIds[0], selectedFormats[itemIds[0]])})</span>
                                )}
                            </Button>
                        </div>
                        {/* Progress Bar */}
                        {downloadStatus[itemIds[0]] === 'downloading' && downloadProgress[itemIds[0]] && (
                            <DownloadProgress 
                                progress={{
                                    percent: downloadProgress[itemIds[0]]?.percent || 0,
                                    loaded: downloadProgress[itemIds[0]]?.loaded || 0,
                                    total: downloadProgress[itemIds[0]]?.total || 0,
                                    speed: downloadProgress[itemIds[0]]?.speed || 0
                                }}
                                animated={false}
                                className="mt-3"
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Media Gallery Modal */}
            <MediaGallery
                data={data}
                platform={platform}
                isOpen={showGallery}
                onClose={() => setShowGallery(false)}
                initialIndex={galleryInitialIndex}
                initialFormat={selectedFormats[selectedItemId] || null}
                onDownloadComplete={onDownloadComplete}
            />
        </motion.div>
    );
}
