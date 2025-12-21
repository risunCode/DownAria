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
    FileText,
    Heart,
    MessageCircle,
    Repeat2,
    Share2,
    Bookmark,
    Send,
    Maximize2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MediaData, MediaFormat, Platform } from '@/lib/types';
import { addHistory, type HistoryEntry } from '@/lib/storage';
import { VideoIcon, ImageIcon, MusicIcon, LayersIcon, CheckCircleIcon } from '@/components/ui/Icons';
import { sendDiscordNotification, getUserDiscordSettings } from '@/lib/utils/discord-webhook';
import { formatBytes } from '@/lib/utils/format-utils';
import { getProxiedThumbnail } from '@/lib/utils/thumbnail-utils';
import { getProxyUrl } from '@/lib/api/proxy';
import { useTranslations } from 'next-intl';
import { MediaGallery } from '@/components/media';
import Swal from 'sweetalert2';

interface DownloadPreviewProps {
    data: MediaData;
    platform: Platform;
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

    // Group formats by itemId
    const groupedItems: Record<string, MediaFormat[]> = {};
    const itemThumbnails: Record<string, string> = {};

    // Safety check for formats
    const formats = data.formats || [];
    
    formats.forEach(format => {
        const id = format.itemId || 'main';
        if (!groupedItems[id]) {
            groupedItems[id] = [];
            if (format.thumbnail) {
                itemThumbnails[id] = format.thumbnail;
            } else if (format.type === 'image' && format.url) {
                itemThumbnails[id] = format.url;
            }
        }
        groupedItems[id].push(format);
    });

    const itemIds = Object.keys(groupedItems);
    const isMultiItem = itemIds.length > 1;

    // State for selected format per item
    const [selectedFormats, setSelectedFormats] = useState<Record<string, MediaFormat>>(() => {
        const initial: Record<string, MediaFormat> = {};
        itemIds.forEach(id => {
            if (groupedItems[id].length > 0) {
                const preferred = groupedItems[id].find(f =>
                    f.quality.toLowerCase().includes('hd') ||
                    f.quality.toLowerCase().includes('original') ||
                    f.quality.toLowerCase().includes('1080')
                ) || groupedItems[id][0];
                initial[id] = preferred;
            }
        });
        return initial;
    });

    // State for selected item
    const [selectedItemId, setSelectedItemId] = useState<string>(itemIds[0] || 'main');

    // State for webhook sent tracking
    const [sentToWebhook, setSentToWebhook] = useState<Record<string, boolean>>({});

    // Fetch file sizes
    useEffect(() => {
        const fetchSizes = async () => {
            for (const [itemId, format] of Object.entries(selectedFormats)) {
                if (!format?.url) continue;
                const key = `${itemId}-${format.url}`;
                if (fileSizes[key]) continue;

                try {
                    const res = await fetch(getProxyUrl(format.url, { platform, head: true }));
                    const size = res.headers.get('x-file-size');
                    if (size && parseInt(size) > 0) {
                        const bytes = parseInt(size);
                        setFileSizes(prev => ({ ...prev, [key]: formatBytes(bytes) }));
                        setFileSizeNumerics(prev => ({ ...prev, [key]: bytes }));
                    }
                } catch {
                    // Ignore errors
                }
            }
        };
        fetchSizes();
    }, [selectedFormats, platform, fileSizes]);

    const getFileSize = (itemId: string, format: MediaFormat | undefined): string | null => {
        if (!format?.url) return null;
        const key = `${itemId}-${format.url}`;
        return fileSizes[key] || null;
    };

    const getProgressText = (itemId: string): string => {
        const progress = downloadProgress[itemId];
        if (!progress) return tCommon('loading');
        
        const parts: string[] = [];
        
        // Show percentage
        if (progress.percent > 0) {
            parts.push(`${progress.percent}%`);
        }
        
        // Show speed if available
        if (progress.speed > 0) {
            const speedMB = (progress.speed / (1024 * 1024)).toFixed(1);
            parts.push(`${speedMB} MB/s`);
        }
        
        // Show message for HLS
        if (progress.message) {
            return progress.message;
        }
        
        return parts.length > 0 ? parts.join(' • ') : tCommon('loading');
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

    // Download function
    const triggerDownload = async (format: MediaFormat, itemId: string) => {
        setDownloadStatus(prev => ({ ...prev, [itemId]: 'downloading' }));
        setDownloadProgress(prev => ({ ...prev, [itemId]: { loaded: 0, total: 0, percent: 0, speed: 0 } }));

        try {
            // Generate filename
            const platformShort: Record<string, string> = {
                facebook: 'FB', instagram: 'IG', twitter: 'X', tiktok: 'TT', weibo: 'WB', youtube: 'YT'
            };
            const platName = platformShort[platform] || platform.toUpperCase();
            const author = (data.author || 'unknown').replace(/^@/, '').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-_\u4e00-\u9fff]/g, '').substring(0, 25) || 'unknown';

            const extractPostId = (url: string): string => {
                const fbShare = url.match(/\/share\/[rvp]\/([^/?]+)/);
                if (fbShare) return fbShare[1];
                const fbReel = url.match(/\/reel\/(\d+)/);
                if (fbReel) return fbReel[1];
                const fbVideo = url.match(/\/videos?\/(\d+)/);
                if (fbVideo) return fbVideo[1];
                const igPost = url.match(/\/(p|reel|reels|tv)\/([^/?]+)/);
                if (igPost) return igPost[2];
                const ttVideo = url.match(/\/video\/(\d+)/);
                if (ttVideo) return ttVideo[1];
                const twStatus = url.match(/\/status\/(\d+)/);
                if (twStatus) return twStatus[1];
                // YouTube video ID
                const ytWatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
                if (ytWatch) return ytWatch[1];
                const ytShort = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
                if (ytShort) return ytShort[1];
                const ytShorts = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
                if (ytShorts) return ytShorts[1];
                return Date.now().toString(36);
            };
            const postId = extractPostId(data.url);

            let filename = format.filename;
            if (!filename) {
                let fileExt = format.format;
                if (!fileExt) {
                    try {
                        const urlObj = new URL(format.url);
                        const formatParam = urlObj.searchParams.get('format');
                        if (formatParam) fileExt = formatParam;
                        else {
                            const match = urlObj.pathname.match(/\.(\w+)$/);
                            if (match) fileExt = match[1];
                        }
                    } catch { }
                    if (!fileExt) fileExt = format.type === 'video' ? 'mp4' : format.type === 'audio' ? 'mp3' : 'jpg';
                }
                const carouselSuffix = isMultiItem && itemId !== 'main' ? `_${itemIds.indexOf(itemId) + 1}` : '';
                filename = `${platName}_${author}_${postId}${carouselSuffix}_[XTFetch].${fileExt}`;
            }
            // Only add extension if filename doesn't already have one
            if (!filename.match(/\.\w+$/)) filename += `.${format.format || 'mp4'}`;

            // Check if this is HLS format (m3u8) - need special handling
            const isHLS = (format as { isHLS?: boolean }).isHLS || format.format === 'm3u8' || format.url.includes('.m3u8');
            
            if (isHLS) {
                // Use HLS downloader for m3u8 streams
                const { downloadHLSAsMP4 } = await import('@/lib/utils/hls-downloader');
                
                // Change extension from m3u8 to mp4
                const mp4Filename = filename.replace(/\.m3u8$/i, '.mp4');
                
                const result = await downloadHLSAsMP4(format.url, mp4Filename, (progress) => {
                    setDownloadProgress(prev => ({
                        ...prev,
                        [itemId]: {
                            loaded: progress.bytesLoaded || 0,
                            total: 0,
                            percent: progress.percent,
                            speed: 0,
                            message: progress.message,
                        }
                    }));
                });
                
                if (!result.success) {
                    throw new Error(result.error || 'HLS download failed');
                }
                
                // Add to history
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

                setDownloadStatus(prev => ({ ...prev, [itemId]: 'success' }));
                return;
            }

            const downloadViaAnchor = (url: string, fname: string) => {
                const link = document.createElement('a');
                link.href = url;
                link.download = fname;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            const proxyUrl = getProxyUrl(format.url, { filename, platform });
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`Download failed: ${response.status}`);

            const contentLength = response.headers.get('content-length');
            const total = contentLength ? parseInt(contentLength) : 0;
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const chunks: Uint8Array[] = [];
            let loaded = 0;
            let lastTime = Date.now();
            let lastLoaded = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                loaded += value.length;
                
                // Calculate speed every 500ms
                const now = Date.now();
                const timeDiff = now - lastTime;
                let speed = 0;
                
                if (timeDiff >= 500) {
                    speed = ((loaded - lastLoaded) / timeDiff) * 1000; // bytes per second
                    lastTime = now;
                    lastLoaded = loaded;
                }
                
                const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
                setDownloadProgress(prev => ({ 
                    ...prev, 
                    [itemId]: { 
                        loaded, 
                        total, 
                        percent,
                        speed: speed || prev[itemId]?.speed || 0
                    } 
                }));
            }

            const blob = new Blob(chunks as BlobPart[]);
            const blobUrl = URL.createObjectURL(blob);
            downloadViaAnchor(blobUrl, filename);
            URL.revokeObjectURL(blobUrl);

            // Add to history
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
                    title: data.title || filename,
                    quality: format.quality,
                    thumbnail: data.thumbnail,
                    mediaUrl: format.url,
                    mediaType: format.type,
                    sourceUrl: data.url,
                    author: data.author,
                });
                setSentToWebhook(prev => ({ ...prev, [itemId]: true }));
            }

            setDownloadStatus(prev => ({ ...prev, [itemId]: 'success' }));
            setTimeout(() => setDownloadStatus(prev => ({ ...prev, [itemId]: 'idle' })), 5000);
        } catch {
            setDownloadStatus(prev => ({ ...prev, [itemId]: 'error' }));
            setTimeout(() => setDownloadStatus(prev => ({ ...prev, [itemId]: 'idle' })), 5000);
        }
    };

    const handleDownloadAll = async () => {
        setGlobalStatus('downloading');
        for (const id of itemIds) {
            const format = selectedFormats[id] || groupedItems[id]?.[0];
            if (format) {
                try {
                    await triggerDownload(format, id);
                    await new Promise(r => setTimeout(r, 1000));
                } catch { /* skip failed */ }
            }
        }
        setGlobalStatus('idle');
    };

    const renderFormatButtons = (formats: MediaFormat[], itemId: string) => {
        const videoFormats = formats.filter(f => f.type === 'video');
        const audioFormats = formats.filter(f => f.type === 'audio');
        const imageFormats = formats.filter(f => f.type === 'image');
        const currentSelected = selectedFormats[itemId];

        return (
            <div className="space-y-2">
                {videoFormats.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {videoFormats.map((format, idx) => (
                            <button key={`v-${idx}`} onClick={() => setSelectedFormats(prev => ({ ...prev, [itemId]: format }))}
                                className={`quality-badge ${currentSelected === format ? 'selected' : ''}`}>
                                {format.quality}
                                {format.size && <span className="text-xs ml-1 opacity-70">({format.size})</span>}
                            </button>
                        ))}
                    </div>
                )}
                {imageFormats.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {imageFormats.map((format, idx) => (
                            <button key={`i-${idx}`} onClick={() => setSelectedFormats(prev => ({ ...prev, [itemId]: format }))}
                                className={`quality-badge ${currentSelected === format ? 'selected' : ''}`}>
                                {format.quality}
                            </button>
                        ))}
                    </div>
                )}
                {audioFormats.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        <span className="text-xs text-[var(--text-muted)] mr-2 flex items-center"><MusicIcon className="w-3 h-3 mr-1" /> {t('audio')}</span>
                        {audioFormats.map((format, idx) => (
                            <button key={`a-${idx}`} onClick={() => setSelectedFormats(prev => ({ ...prev, [itemId]: format }))}
                                className={`quality-badge ${currentSelected === format ? 'selected' : ''}`}>
                                {format.quality}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

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
                    {data.engagement && (() => {
                        const e = data.engagement as { views?: number; likes?: number; comments?: number; shares?: number; bookmarks?: number };
                        return (
                            <>
                                {e.views !== undefined && e.views > 0 && <span className="flex items-center gap-1 text-purple-400"><Eye className="w-3 h-3" />{e.views.toLocaleString()}</span>}
                                {e.likes !== undefined && e.likes > 0 && <span className="flex items-center gap-1 text-red-400"><Heart className="w-3 h-3" />{e.likes.toLocaleString()}</span>}
                                {e.comments !== undefined && e.comments > 0 && <span className="flex items-center gap-1 text-blue-400"><MessageCircle className="w-3 h-3" />{e.comments.toLocaleString()}</span>}
                                {e.shares !== undefined && e.shares > 0 && <span className="flex items-center gap-1 text-orange-400"><Share2 className="w-3 h-3" />{e.shares.toLocaleString()}</span>}
                                {e.bookmarks !== undefined && e.bookmarks > 0 && <span className="flex items-center gap-1 text-yellow-400"><Bookmark className="w-3 h-3" />{e.bookmarks.toLocaleString()}</span>}
                            </>
                        );
                    })()}
                </div>
                {/* Description */}
                {data.description && (
                    <div className="mt-2">
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                            {data.description.replace(/\n+/g, ' ')}
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
                            <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">
                                <span className="inline-flex items-center gap-1.5">
                                    {groupedItems[selectedItemId][0].type === 'video' ? <VideoIcon className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                                    {groupedItems[selectedItemId][0].type === 'video' ? t('video') : t('image')} #{itemIds.indexOf(selectedItemId) + 1}
                                </span>
                            </h4>
                            {groupedItems[selectedItemId].length > 1 && renderFormatButtons(groupedItems[selectedItemId], selectedItemId)}
                            <div className="mt-3 flex flex-wrap gap-2">
                                <Button size="sm" variant="secondary" onClick={() => {
                                    const format = selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0];
                                    if (format) handleSendToWebhook(format, selectedItemId);
                                }}
                                    disabled={sentToWebhook[selectedItemId]}
                                    leftIcon={sentToWebhook[selectedItemId] ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <Send className="w-4 h-4" />}>
                                    {sentToWebhook[selectedItemId] ? t('sent') : t('discord')}
                                </Button>
                                <Button size="sm" onClick={() => {
                                    const format = selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0];
                                    if (format) triggerDownload(format, selectedItemId);
                                }}
                                    disabled={downloadStatus[selectedItemId] === 'downloading'}
                                    leftIcon={downloadStatus[selectedItemId] === 'downloading' ? <Loader2 className="animate-spin w-4 h-4" /> : <Download className="w-4 h-4" />}>
                                    {downloadStatus[selectedItemId] === 'downloading'
                                        ? getProgressText(selectedItemId)
                                        : downloadStatus[selectedItemId] === 'success'
                                            ? t('done')
                                            : `${t('download')}${getFileSize(selectedItemId, selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0]) ? ` (${getFileSize(selectedItemId, selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0])})` : ''}`}
                                </Button>
                            </div>
                            {/* Progress Bar for carousel item */}
                            {downloadStatus[selectedItemId] === 'downloading' && downloadProgress[selectedItemId] && (
                                <div className="mt-3 space-y-1">
                                    <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-purple-500 transition-all duration-300 ease-out"
                                            style={{ width: `${downloadProgress[selectedItemId]?.percent || 0}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                                        <span>{formatBytes(downloadProgress[selectedItemId]?.loaded || 0)} / {downloadProgress[selectedItemId]?.total ? formatBytes(downloadProgress[selectedItemId].total) : '?'}</span>
                                        {downloadProgress[selectedItemId]?.speed > 0 && (
                                            <span className="text-[var(--accent-primary)] font-mono">
                                                {(downloadProgress[selectedItemId].speed / (1024 * 1024)).toFixed(1)} MB/s
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Download All */}
                    <div className="pt-4 border-t border-[var(--border-color)] flex justify-end">
                        <Button variant="primary" size="lg" onClick={handleDownloadAll} disabled={globalStatus === 'downloading'}
                            leftIcon={globalStatus === 'downloading' ? <Loader2 className="animate-spin w-5 h-5" /> : <Download className="w-5 h-5" />}>
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
                        {data.thumbnail ? (
                            <Image src={getProxiedThumbnail(data.thumbnail, platform)} alt={data.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized />
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
                        <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => handleSendToWebhook(selectedFormats[itemIds[0]], itemIds[0])}
                                disabled={sentToWebhook[itemIds[0]]}
                                leftIcon={sentToWebhook[itemIds[0]] ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <Send className="w-4 h-4" />}>
                                {sentToWebhook[itemIds[0]] ? t('sent') : t('discord')}
                            </Button>
                            <Button size="sm" onClick={() => triggerDownload(selectedFormats[itemIds[0]], itemIds[0])}
                                disabled={downloadStatus[itemIds[0]] === 'downloading'}
                                leftIcon={downloadStatus[itemIds[0]] === 'downloading' ? <Loader2 className="animate-spin w-4 h-4" /> : <Download className="w-4 h-4" />}>
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
                            <div className="mt-3 space-y-1">
                                <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-purple-500 transition-all duration-300 ease-out"
                                        style={{ width: `${downloadProgress[itemIds[0]]?.percent || 0}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                                    <span>{formatBytes(downloadProgress[itemIds[0]]?.loaded || 0)} / {downloadProgress[itemIds[0]]?.total ? formatBytes(downloadProgress[itemIds[0]].total) : '?'}</span>
                                    {downloadProgress[itemIds[0]]?.speed > 0 && (
                                        <span className="text-[var(--accent-primary)] font-mono">
                                            {(downloadProgress[itemIds[0]].speed / (1024 * 1024)).toFixed(1)} MB/s
                                        </span>
                                    )}
                                </div>
                            </div>
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
                onDownloadComplete={onDownloadComplete}
            />
        </motion.div>
    );
}
