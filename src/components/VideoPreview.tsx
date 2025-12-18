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
    ChevronLeft,
    ChevronRight,
    X,
    ZoomIn,
    FileText,
    Heart,
    MessageCircle,
    Repeat2,
    Share2,
    Bookmark,
    Send
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { MediaData, MediaFormat, Platform, HistoryItem } from '@/lib/types';
import { addToHistory } from '@/lib/utils/storage';
import { VideoIcon, ImageIcon, MusicIcon, LayersIcon, CheckCircleIcon } from '@/components/ui/Icons';
import { sendDiscordNotification, getUserDiscordSettings } from '@/lib/utils/discord-webhook';
import Swal from 'sweetalert2';

interface VideoPreviewProps {
    data: MediaData;
    platform: Platform;
    onDownloadComplete?: (item: HistoryItem) => void;
}

type DownloadStatus = 'idle' | 'downloading' | 'success' | 'error';

// Format bytes to human readable
function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Proxy thumbnail for platforms that block direct access (Instagram CDN)
function getProxiedThumbnail(url: string | undefined, platform: Platform): string {
    if (!url) return '';
    // Instagram CDN blocks direct browser access, need to proxy
    if (platform === 'instagram' && (url.includes('instagram') || url.includes('cdninstagram') || url.includes('fbcdn'))) {
        return `/api/proxy?url=${encodeURIComponent(url)}&platform=instagram&inline=1`;
    }
    return url;
}

export function VideoPreview({ data, platform, onDownloadComplete }: VideoPreviewProps) {
    const [downloadStatus, setDownloadStatus] = useState<Record<string, DownloadStatus>>({});
    const [downloadProgress, setDownloadProgress] = useState<Record<string, { loaded: number; total: number; percent: number }>>({});
    const [fileSizes, setFileSizes] = useState<Record<string, string>>({});
    const [globalStatus, setGlobalStatus] = useState<DownloadStatus>('idle');

    // Group formats by itemId
    const groupedItems: Record<string, MediaFormat[]> = {};
    const itemThumbnails: Record<string, string> = {};

    data.formats.forEach(format => {
        const id = format.itemId || 'main';
        if (!groupedItems[id]) {
            groupedItems[id] = [];
            // For images, use URL as thumbnail if no explicit thumbnail set
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

    // State for selected item in gallery
    const [selectedItemId, setSelectedItemId] = useState<string>(itemIds[0] || 'main');

    // State for fullscreen gallery preview
    const [showGallery, setShowGallery] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showAllFormats, setShowAllFormats] = useState(false);
    
    // State for caption modal
    const [showCaptionModal, setShowCaptionModal] = useState(false);
    
    // State for webhook sent tracking (prevent duplicates)
    const [sentToWebhook, setSentToWebhook] = useState<Record<string, boolean>>({});

    // Get current gallery item info
    const getCurrentGalleryItem = () => {
        const itemId = itemIds[galleryIndex];
        const formats = groupedItems[itemId] || [];
        const selectedFormat = selectedFormats[itemId];
        const isVideo = formats.some(f => f.type === 'video');
        const videoUrl = isVideo ? selectedFormat?.url : null;
        const thumbnail = itemThumbnails[itemId];
        return { itemId, isVideo, videoUrl, thumbnail, selectedFormat };
    };

    // Gallery navigation
    const goToPrev = () => {
        setIsPlaying(false);
        setGalleryIndex(prev => (prev - 1 + itemIds.length) % itemIds.length);
    };
    const goToNext = () => {
        setIsPlaying(false);
        setGalleryIndex(prev => (prev + 1) % itemIds.length);
    };

    // Open gallery at specific index
    const openGallery = (index: number) => {
        setGalleryIndex(index);
        setIsPlaying(false);
        setShowGallery(true);
    };

    // Close gallery
    const closeGallery = () => {
        setShowGallery(false);
        setIsPlaying(false);
    };

    // Keyboard navigation for gallery
    useEffect(() => {
        if (!showGallery) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') goToPrev();
            else if (e.key === 'ArrowRight') goToNext();
            else if (e.key === 'Escape') setShowGallery(false);
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [showGallery, itemIds.length]);

    // Fetch file sizes for selected formats
    useEffect(() => {
        const fetchSizes = async () => {
            for (const [itemId, format] of Object.entries(selectedFormats)) {
                if (!format?.url) continue; // Skip if no URL
                const key = `${itemId}-${format.url}`;
                if (fileSizes[key]) continue; // Already fetched

                try {
                    const res = await fetch(`/api/proxy?url=${encodeURIComponent(format.url)}&platform=${platform}&head=1`);
                    const size = res.headers.get('x-file-size');
                    if (size && parseInt(size) > 0) {
                        setFileSizes(prev => ({ ...prev, [key]: formatBytes(parseInt(size)) }));
                    }
                } catch {
                    // Ignore errors
                }
            }
        };
        fetchSizes();
    }, [selectedFormats, platform, fileSizes]);

    // Get file size for a format
    const getFileSize = (itemId: string, format: MediaFormat | undefined): string | null => {
        if (!format?.url) return null;
        const key = `${itemId}-${format.url}`;
        return fileSizes[key] || null;
    };

    // Get download progress text
    const getProgressText = (itemId: string): string => {
        const progress = downloadProgress[itemId];
        if (!progress) return 'Downloading...';
        if (progress.total > 0) {
            return `${formatBytes(progress.loaded)} / ${formatBytes(progress.total)} (${progress.percent}%)`;
        }
        return `${formatBytes(progress.loaded)} downloaded`;
    };

    // Send to webhook with SweetAlert confirmation
    const handleSendToWebhook = async (format: MediaFormat, itemId: string) => {
        const settings = getUserDiscordSettings();
        if (!settings?.webhookUrl) {
            Swal.fire({
                icon: 'warning',
                title: 'Webhook Not Configured',
                text: 'Please configure Discord webhook in Settings first.',
                confirmButtonText: 'Go to Settings',
                showCancelButton: true,
                customClass: { popup: 'glass-card' }
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

        // Check if file is large for warning
        const isLargeFile = format.fileSize && parseFloat(format.fileSize) > 10;
        const sendMethodNote = isLargeFile 
            ? `<div class="mt-2 p-2 rounded bg-amber-500/10 text-amber-400 text-xs">⚠️ Large file (${format.fileSize}) - will send as 2 messages</div>`
            : '';

        const result = await Swal.fire({
            title: 'Send to Discord?',
            html: `
                <div class="text-left space-y-2 text-sm">
                    <div class="flex items-center gap-2">
                        <span class="text-[var(--text-muted)]">Platform:</span>
                        <span class="font-medium">${platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[var(--text-muted)]">Type:</span>
                        <span class="font-medium">${isVideo ? '🎬 Video' : '🖼️ Image'} ${isMultiItem ? `#${itemIndex}` : ''}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[var(--text-muted)]">Quality:</span>
                        <span class="font-medium">${format.quality}${format.fileSize ? ` (${format.fileSize})` : ''}</span>
                    </div>
                    ${data.author ? `<div class="flex items-center gap-2"><span class="text-[var(--text-muted)]">Author:</span><span class="font-medium">${data.author}</span></div>` : ''}
                </div>
                ${sendMethodNote}
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '📤 Send',
            cancelButtonText: 'Cancel',
            customClass: { popup: 'glass-card' }
        });

        if (!result.isConfirmed) return;

        // Show loading
        Swal.fire({
            title: 'Sending...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
            customClass: { popup: 'glass-card' }
        });

        // Parse file size from format (e.g. "24.3 MB" -> bytes)
        let fileSizeBytes: number | undefined;
        if (format.fileSize) {
            const match = format.fileSize.match(/([\d.]+)\s*(KB|MB|GB)/i);
            if (match) {
                const num = parseFloat(match[1]);
                const unit = match[2].toUpperCase();
                fileSizeBytes = unit === 'GB' ? num * 1024 * 1024 * 1024 
                              : unit === 'MB' ? num * 1024 * 1024 
                              : num * 1024;
            }
        }

        const sendResult = await sendDiscordNotification({
            platform: platform.charAt(0).toUpperCase() + platform.slice(1),
            title: data.title || 'Untitled',
            quality: format.quality,
            thumbnail,
            mediaUrl: format.url,
            mediaType: format.type,
            sourceUrl: data.url,
            author: data.author,
            engagement: data.engagement ? {
                views: data.engagement.views,
                likes: data.engagement.likes,
                comments: data.engagement.comments,
                shares: data.engagement.shares,
            } : undefined,
            fileSize: fileSizeBytes, // Pass file size for smart send method
        }, true); // manual=true to bypass autoSend check

        if (sendResult.sent) {
            setSentToWebhook(prev => ({ ...prev, [itemId]: true }));
            Swal.fire({
                icon: 'success',
                title: 'Sent!',
                text: 'Content sent to Discord successfully.',
                timer: 2000,
                showConfirmButton: false,
                customClass: { popup: 'glass-card' }
            });
        } else {
            // Better error messages
            let errorMsg = 'Failed to send';
            if (sendResult.details) {
                errorMsg = sendResult.details;
            } else if (sendResult.reason === 'duplicate') {
                errorMsg = 'Already sent in the last minute!';
            } else if (sendResult.reason === 'rate_limited') {
                errorMsg = 'Discord rate limited. Please wait a moment.';
            } else if (sendResult.reason?.startsWith('error_')) {
                errorMsg = `Discord error: ${sendResult.reason.replace('error_', '')}`;
            }
            
            Swal.fire({
                icon: 'error',
                title: 'Failed',
                text: errorMsg,
                customClass: { popup: 'glass-card' }
            });
        }
    };

    const triggerDownload = async (format: MediaFormat, itemId: string) => {
        setDownloadStatus(prev => ({ ...prev, [itemId]: 'downloading' }));
        setDownloadProgress(prev => ({ ...prev, [itemId]: { loaded: 0, total: 0, percent: 0 } }));

        try {
            // Generate filename: XT-Fetch_Platform_UserName_PostID_Carousel.ext
            // Platform short names
            const platformShort: Record<string, string> = {
                facebook: 'FB', instagram: 'IG', twitter: 'X', tiktok: 'TT',
                youtube: 'YT', weibo: 'WB', douyin: 'DY'
            };
            const platName = platformShort[platform] || platform.toUpperCase();
            
            // Clean author name
            const author = (data.author || 'unknown')
                .replace(/^@/, '').replace(/\s+/g, '-')
                .replace(/[^a-zA-Z0-9\-_\u4e00-\u9fff]/g, '').substring(0, 25) || 'unknown';

            // Extract post ID from URL
            const extractPostId = (url: string): string => {
                // Facebook patterns
                const fbShare = url.match(/\/share\/[rvp]\/([^/?]+)/);
                if (fbShare) return fbShare[1];
                const fbReel = url.match(/\/reel\/(\d+)/);
                if (fbReel) return fbReel[1];
                const fbVideo = url.match(/\/videos?\/(\d+)/);
                if (fbVideo) return fbVideo[1];
                const fbStory = url.match(/\/stories\/(\d+)/);
                if (fbStory) return fbStory[1];
                const fbPost = url.match(/\/posts\/([^/?]+)/);
                if (fbPost) return fbPost[1];
                const pfbid = url.match(/pfbid([^&/?]+)/);
                if (pfbid) return 'pfbid' + pfbid[1].substring(0, 10);
                // Instagram
                const igPost = url.match(/\/(p|reel|reels|tv)\/([^/?]+)/);
                if (igPost) return igPost[2];
                // TikTok
                const ttVideo = url.match(/\/video\/(\d+)/);
                if (ttVideo) return ttVideo[1];
                // Twitter
                const twStatus = url.match(/\/status\/(\d+)/);
                if (twStatus) return twStatus[1];
                // YouTube
                const ytVideo = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
                if (ytVideo) return ytVideo[1];
                // Fallback: use timestamp
                return Date.now().toString(36);
            };
            const postId = extractPostId(data.url);

            let filename = format.filename;
            if (!filename) {
                // Get file extension
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

                // Carousel suffix (for multi-item: _1, _2, etc)
                const carouselSuffix = isMultiItem && itemId !== 'main' ? `_${itemIds.indexOf(itemId) + 1}` : '';

                // Format: XT-Fetch_Platform_UserName_PostID_Carousel.ext
                filename = `XT-Fetch_${platName}_${author}_${postId}${carouselSuffix}.${fileExt}`;
            }
            if (!filename.includes('.')) filename += `.${format.format || 'mp4'}`;

            // Helper: trigger download via anchor element
            const downloadViaAnchor = (url: string, fname: string) => {
                const link = document.createElement('a');
                link.href = url;
                link.download = fname;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            // TikTok/Douyin: Use proxy to force download (direct CDN opens new tab)
            if (platform === 'tiktok' || platform === 'douyin') {
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(format.url)}&filename=${encodeURIComponent(filename)}&platform=${platform}`;
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error(`Download failed: ${response.status}`);
                
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                downloadViaAnchor(blobUrl, filename);
                URL.revokeObjectURL(blobUrl);
            } else {
                // Other platforms: Use proxy with fetch + streaming for progress tracking
                const proxyUrl = `/api/proxy?url=${encodeURIComponent(format.url)}&filename=${encodeURIComponent(filename)}&platform=${platform}`;
                const response = await fetch(proxyUrl);
                if (!response.ok) throw new Error(`Download failed: ${response.status}`);

                // Get content length for progress
                const contentLength = response.headers.get('content-length');
                const total = contentLength ? parseInt(contentLength) : 0;

                // Stream the response with progress tracking
                const reader = response.body?.getReader();
                if (!reader) throw new Error('No response body');

                const chunks: Uint8Array[] = [];
                let loaded = 0;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    chunks.push(value);
                    loaded += value.length;

                    // Update progress
                    const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
                    setDownloadProgress(prev => ({
                        ...prev,
                        [itemId]: { loaded, total, percent }
                    }));
                }

                // Combine chunks and create blob
                const blob = new Blob(chunks as BlobPart[]);
                const blobUrl = URL.createObjectURL(blob);
                downloadViaAnchor(blobUrl, filename);
                URL.revokeObjectURL(blobUrl);

                // Update final size in fileSizes
                const key = `${itemId}-${format.url}`;
                setFileSizes(prev => ({ ...prev, [key]: formatBytes(loaded) }));
            }

            const historyItem = addToHistory({
                url: data.url, platform, title: data.title,
                thumbnail: itemThumbnails[itemId] || data.thumbnail || '',
                quality: format.quality, type: format.type,
            });
            if (onDownloadComplete) onDownloadComplete(historyItem);

            // Send Discord notification only if not already sent via webhook button
            if (!sentToWebhook[itemId]) {
                // Get file size from download progress or format info
                const progress = downloadProgress[itemId];
                let fileSizeBytes: number | undefined = progress?.loaded || progress?.total;
                
                // Fallback: parse from format.fileSize string (e.g. "24.3 MB")
                if (!fileSizeBytes && format.fileSize) {
                    const match = format.fileSize.match(/([\d.]+)\s*(KB|MB|GB)/i);
                    if (match) {
                        const num = parseFloat(match[1]);
                        const unit = match[2].toUpperCase();
                        fileSizeBytes = unit === 'GB' ? num * 1024 * 1024 * 1024 
                                      : unit === 'MB' ? num * 1024 * 1024 
                                      : num * 1024;
                    }
                }
                
                sendDiscordNotification({
                    platform: platform.charAt(0).toUpperCase() + platform.slice(1),
                    title: data.title || filename,
                    quality: format.quality,
                    thumbnail: data.thumbnail,
                    mediaUrl: format.url,
                    mediaType: format.type,
                    sourceUrl: data.url,
                    author: data.author,
                    engagement: data.engagement ? {
                        views: data.engagement.views,
                        likes: data.engagement.likes,
                        comments: data.engagement.comments,
                        shares: data.engagement.shares,
                    } : undefined,
                    fileSize: fileSizeBytes, // Pass file size for smart send method
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
                    await new Promise(r => setTimeout(r, 1000)); // 1s delay between downloads
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
                        <span className="text-xs text-[var(--text-muted)] mr-2 flex items-center"><MusicIcon className="w-3 h-3 mr-1" /> Audio</span>
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
            {/* Compact Header */}
            <div className="mb-3 sm:mb-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] line-clamp-1">{data.title}</h3>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                        {data.responseTime && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                ⚡ {data.responseTime}ms
                            </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            data.usedCookie 
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                : 'bg-green-500/20 text-green-400 border border-green-500/30'
                        }`}>
                            {data.usedCookie ? '🔒 Private' : '🌐 Public'}
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3 text-xs text-[var(--text-secondary)]">
                    {data.author && (<span className="flex items-center gap-1"><User className="w-3 h-3" />{data.author}</span>)}
                    {data.views && (<span className="flex items-center gap-1"><Eye className="w-3 h-3" />{data.views}</span>)}
                    {isMultiItem && (<span className="flex items-center gap-1 text-[var(--accent-primary)]"><LayersIcon className="w-3 h-3" />{itemIds.length} items</span>)}
                    {data.engagement && (() => {
                        const e = data.engagement as { views?: number; likes?: number; comments?: number; reposts?: number; shares?: number; bookmarks?: number };
                        return (
                            <>
                                {e.views !== undefined && e.views > 0 && <span className="flex items-center gap-1 text-purple-400"><Eye className="w-3 h-3" />{e.views.toLocaleString()}</span>}
                                {e.likes !== undefined && e.likes > 0 && <span className="flex items-center gap-1 text-red-400"><Heart className="w-3 h-3" />{e.likes.toLocaleString()}</span>}
                                {e.comments !== undefined && e.comments > 0 && <span className="flex items-center gap-1 text-blue-400"><MessageCircle className="w-3 h-3" />{e.comments.toLocaleString()}</span>}
                                {e.reposts !== undefined && e.reposts > 0 && <span className="flex items-center gap-1 text-green-400"><Repeat2 className="w-3 h-3" />{e.reposts.toLocaleString()}</span>}
                                {e.shares !== undefined && e.shares > 0 && <span className="flex items-center gap-1 text-orange-400"><Share2 className="w-3 h-3" />{e.shares.toLocaleString()}</span>}
                                {e.bookmarks !== undefined && e.bookmarks > 0 && <span className="flex items-center gap-1 text-yellow-400"><Bookmark className="w-3 h-3" />{e.bookmarks.toLocaleString()}</span>}
                            </>
                        );
                    })()}
                </div>
                {/* Caption/Description - truncated to 2 lines */}
                {data.description && (
                    <div className="mt-2">
                        <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                            {data.description.replace(/\n+/g, ' ')}
                        </p>
                        {data.description.length > 100 && (
                            <button
                                onClick={() => setShowCaptionModal(true)}
                                className="mt-1 text-xs text-[var(--accent-primary)] hover:underline flex items-center gap-1"
                            >
                                <FileText className="w-3 h-3" />
                                Show all
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Content */}
            {isMultiItem ? (
                <div className="space-y-4">
                    {/* Thumbnail grid - more columns on mobile */}
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
                        <button
                            onClick={() => openGallery(itemIds.indexOf(selectedItemId))}
                            className="relative w-full sm:w-32 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-primary)] group cursor-pointer"
                        >
                            {itemThumbnails[selectedItemId] ? (
                                <Image src={getProxiedThumbnail(itemThumbnails[selectedItemId], platform)} alt="Preview" fill className="object-cover" unoptimized />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center"><Play className="w-8 h-8 text-[var(--text-muted)]" /></div>
                            )}
                            {/* Preview overlay */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ZoomIn className="w-6 h-6 text-white" />
                            </div>
                        </button>
                        <div className="flex-1 min-w-0 flex flex-col">
                            <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">
                                <span className="inline-flex items-center gap-1.5">
                                    {groupedItems[selectedItemId][0].type === 'video' ? <VideoIcon className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                                    {groupedItems[selectedItemId][0].type === 'video' ? 'Video' : 'Image'} #{itemIds.indexOf(selectedItemId) + 1}
                                </span>
                            </h4>
                            {/* Only show format buttons if multiple formats available */}
                            {groupedItems[selectedItemId].length > 1 && renderFormatButtons(groupedItems[selectedItemId], selectedItemId)}
                            <div className="mt-3 flex flex-wrap gap-2">
                                <Button size="sm" variant="secondary" onClick={() => openGallery(itemIds.indexOf(selectedItemId))}
                                    leftIcon={<ZoomIn className="w-4 h-4" />}>
                                    Preview
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => {
                                    const format = selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0];
                                    if (format) handleSendToWebhook(format, selectedItemId);
                                }}
                                    disabled={sentToWebhook[selectedItemId]}
                                    leftIcon={sentToWebhook[selectedItemId] ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <Send className="w-4 h-4" />}>
                                    {sentToWebhook[selectedItemId] ? 'Sent' : 'Webhook'}
                                </Button>
                                <Button size="sm" onClick={() => {
                                    const format = selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0];
                                    if (format) triggerDownload(format, selectedItemId);
                                }}
                                    disabled={downloadStatus[selectedItemId] === 'downloading'}
                                    leftIcon={downloadStatus[selectedItemId] === 'downloading' ? <Loader2 className="animate-spin w-4 h-4" /> : <Download className="w-4 h-4" />}>
                                    {downloadStatus[selectedItemId] === 'downloading'
                                        ? 'Downloading...'
                                        : downloadStatus[selectedItemId] === 'success' 
                                        ? '✓ Done' 
                                        : `Download${getFileSize(selectedItemId, selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0]) ? ` (${getFileSize(selectedItemId, selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0])})` : ''}`}
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-[var(--border-color)] flex justify-end">
                        <Button variant="primary" size="lg" onClick={handleDownloadAll} disabled={globalStatus === 'downloading'}
                            leftIcon={globalStatus === 'downloading' ? <Loader2 className="animate-spin w-5 h-5" /> : <Download className="w-5 h-5" />}>
                            {globalStatus === 'downloading' ? 'Downloading All...' : `Download All (${itemIds.length})`}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                    <button
                        onClick={() => openGallery(0)}
                        className="relative w-full sm:w-48 md:w-64 aspect-video rounded-xl overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)] group cursor-pointer"
                    >
                        {data.thumbnail ? (
                            <Image src={getProxiedThumbnail(data.thumbnail, platform)} alt={data.title} fill className="object-cover" unoptimized />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center"><Play className="w-12 h-12 text-[var(--text-muted)]" /></div>
                        )}
                        {/* Preview overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn className="w-8 h-8 text-white" />
                        </div>
                    </button>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        {renderFormatButtons(groupedItems[itemIds[0]], itemIds[0])}
                        <div className="mt-4 flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => openGallery(0)}
                                leftIcon={<ZoomIn className="w-4 h-4" />}>
                                Preview
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => handleSendToWebhook(selectedFormats[itemIds[0]], itemIds[0])}
                                disabled={sentToWebhook[itemIds[0]]}
                                leftIcon={sentToWebhook[itemIds[0]] ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <Send className="w-4 h-4" />}>
                                {sentToWebhook[itemIds[0]] ? 'Sent' : 'Webhook'}
                            </Button>
                            <Button size="sm" onClick={() => triggerDownload(selectedFormats[itemIds[0]], itemIds[0])}
                                disabled={downloadStatus[itemIds[0]] === 'downloading'}
                                leftIcon={downloadStatus[itemIds[0]] === 'downloading' ? <Loader2 className="animate-spin w-4 h-4" /> : <Download className="w-4 h-4" />}>
                                {downloadStatus[itemIds[0]] === 'downloading'
                                    ? getProgressText(itemIds[0])
                                    : downloadStatus[itemIds[0]] === 'success' ? 'Downloaded' : 'Download'}
                                {downloadStatus[itemIds[0]] !== 'downloading' && getFileSize(itemIds[0], selectedFormats[itemIds[0]]) && (
                                    <span className="ml-1 opacity-70">({getFileSize(itemIds[0], selectedFormats[itemIds[0]])})</span>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Gallery Modal - Fullscreen on mobile, centered modal on desktop */}
            {showGallery && (() => {
                const { isVideo, videoUrl, thumbnail, itemId } = getCurrentGalleryItem();
                return (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-0 md:p-8"
                        onClick={closeGallery}
                    >
                        {/* Modal container - fullscreen mobile, centered modal desktop */}
                        <motion.div
                            animate={{ scale: 1, opacity: 1 }}
                            className="w-full h-full md:w-full md:max-w-4xl md:h-[80vh] bg-neutral-900 md:rounded-2xl md:shadow-2xl flex flex-col overflow-hidden border border-white/10"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex-shrink-0 flex items-center justify-between p-3 md:p-4 text-white md:border-b md:border-[var(--border-color)]">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm font-medium whitespace-nowrap">{galleryIndex + 1} / {itemIds.length}</span>
                                    {isVideo && <span className="px-2 py-0.5 bg-red-500/80 rounded text-xs whitespace-nowrap">VIDEO</span>}
                                </div>

                                <div className="flex-1 mx-4 text-center min-w-0">
                                    <h3 className="text-sm md:text-base font-medium truncate px-2">{data.title}</h3>
                                    {data.views && <p className="text-xs text-white/50 truncate hidden md:block">{data.views}</p>}
                                </div>

                                <button onClick={closeGallery} className="p-2 hover:bg-white/10 md:hover:bg-[var(--bg-secondary)] rounded-full transition-colors flex-shrink-0">
                                    <X className="w-5 h-5 md:w-6 md:h-6" />
                                </button>
                            </div>

                            {/* Main content area - horizontal layout with arrows */}
                            <div className="flex-1 flex items-center justify-center gap-2 md:gap-4 px-2 md:px-4 min-h-0 overflow-hidden">
                                {/* Left arrow - only show if multiple items */}
                                {itemIds.length > 1 && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                                        onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); goToPrev(); }}
                                        className="flex-shrink-0 p-2 md:p-3 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full transition-colors touch-manipulation z-10"
                                    >
                                        <ChevronLeft className="w-5 h-5 md:w-6 md:h-6 text-white" />
                                    </button>
                                )}

                                {/* Video or Image */}
                                <div
                                    className="relative flex-1 h-full max-w-[800px] flex items-center justify-center"
                                >
                                    {isVideo && isPlaying && videoUrl ? (
                                        // Video player - autoplay, loop, muted for better browser support
                                        <video
                                            src={`/api/proxy?url=${encodeURIComponent(videoUrl)}&platform=${platform}`}
                                            controls
                                            autoPlay
                                            loop
                                            muted={false}
                                            playsInline
                                            className="w-full h-full object-contain rounded-lg touch-manipulation"
                                            style={{ touchAction: 'manipulation' }}
                                            onClick={e => e.stopPropagation()}
                                        />
                                    ) : (
                                        // Thumbnail with play button for video
                                        <div className="relative w-full h-full">
                                            {thumbnail ? (
                                                <Image
                                                    src={getProxiedThumbnail(thumbnail, platform)}
                                                    alt={`${isVideo ? 'Video' : 'Image'} ${galleryIndex + 1}`}
                                                    fill
                                                    className="object-contain"
                                                    unoptimized
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-white/5 rounded-lg">
                                                    <Play className="w-16 h-16 text-white/50" />
                                                </div>
                                            )}
                                            {/* Play button overlay for videos */}
                                            {isVideo && videoUrl && (
                                                <button
                                                    onClick={() => setIsPlaying(true)}
                                                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors group"
                                                >
                                                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 group-hover:scale-110 transition-all">
                                                        <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white ml-1" />
                                                    </div>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Right arrow */}
                                {itemIds.length > 1 && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); goToNext(); }}
                                        onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); goToNext(); }}
                                        className="flex-shrink-0 p-2 md:p-3 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-full transition-colors touch-manipulation z-10"
                                    >
                                        <ChevronRight className="w-5 h-5 md:w-6 md:h-6 text-white" />
                                    </button>
                                )}
                            </div>

                            {/* Bottom bar with quality selector + download */}
                            <div className="p-3 md:p-4 space-y-3 md:border-t md:border-[var(--border-color)]">
                                {/* Quality selector in gallery - prioritize formats with audio */}
                                {groupedItems[itemId]?.length > 1 && (() => {
                                    const allFormats = groupedItems[itemId].filter(f => f.type !== 'audio');
                                    const withAudio = allFormats.filter(f => f.hasAudio !== false);
                                    const noAudio = allFormats.filter(f => f.hasAudio === false);
                                    const displayFormats = showAllFormats ? allFormats : withAudio;

                                    return (
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap justify-center gap-2 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                                                {displayFormats.map((format, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => {
                                                            setSelectedFormats(prev => ({ ...prev, [itemId]: format }));
                                                            setIsPlaying(false);
                                                        }}
                                                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all shrink-0 ${selectedFormats[itemId] === format
                                                            ? 'bg-[var(--accent-primary)] text-white shadow-md transform scale-105'
                                                            : 'bg-white/20 text-white/90 hover:bg-white/30 hover:text-white'
                                                            }`}
                                                    >
                                                        {format.quality}
                                                    </button>
                                                ))}
                                            </div>
                                            {noAudio.length > 0 && (
                                                <button
                                                    onClick={() => setShowAllFormats(!showAllFormats)}
                                                    className="w-full text-xs text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] transition-colors py-1 font-medium flex items-center justify-center gap-1"
                                                >
                                                    {showAllFormats ? <span>▲ Hide no-audio formats</span> : <span>▼ Show {noAudio.length} more (no audio)</span>}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}
                                {/* Action buttons */}
                                <div className="flex justify-center gap-3">
                                    {isVideo && videoUrl && !isPlaying && (
                                        <Button
                                            variant="secondary"
                                            onClick={() => setIsPlaying(true)}
                                            leftIcon={<Play className="w-4 h-4" />}
                                        >
                                            Play Video
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() => triggerDownload(selectedFormats[itemId], itemId)}
                                        disabled={downloadStatus[itemId] === 'downloading'}
                                        leftIcon={downloadStatus[itemId] === 'downloading'
                                            ? <Loader2 className="animate-spin w-4 h-4" />
                                            : <Download className="w-4 h-4" />}
                                    >
                                        {downloadStatus[itemId] === 'downloading'
                                            ? getProgressText(itemId)
                                            : downloadStatus[itemId] === 'success'
                                                ? '✓ Downloaded'
                                                : `Download ${selectedFormats[itemId]?.quality || (isVideo ? 'Video' : 'Image')}`}
                                    </Button>
                                </div>
                            </div>

                            {/* Thumbnail strip - only show if multiple items */}
                            {itemIds.length > 1 && (
                                <div className="p-2 md:p-3 overflow-x-auto md:border-t md:border-[var(--border-color)]">
                                    <div className="flex gap-1 md:gap-2 justify-center min-w-max">
                                        {itemIds.map((id, idx) => {
                                            const isItemVideo = groupedItems[id]?.some(f => f.type === 'video');
                                            return (
                                                <button
                                                    key={id}
                                                    onClick={() => {
                                                        setIsPlaying(false);
                                                        setGalleryIndex(idx);
                                                    }}
                                                    className={`relative w-10 h-10 md:w-14 md:h-14 rounded-lg overflow-hidden flex-shrink-0 transition-all ${idx === galleryIndex
                                                        ? 'ring-2 ring-[var(--accent-primary)] opacity-100'
                                                        : 'opacity-50 hover:opacity-80'
                                                        }`}
                                                >
                                                    {itemThumbnails[id] ? (
                                                        <Image src={getProxiedThumbnail(itemThumbnails[id], platform)} alt={`#${idx + 1}`} fill className="object-cover" unoptimized />
                                                    ) : (
                                                        <div className="w-full h-full bg-white/10 flex items-center justify-center">
                                                            <span className="text-white text-xs">{idx + 1}</span>
                                                        </div>
                                                    )}
                                                    {/* Video indicator */}
                                                    {isItemVideo && (
                                                        <div className="absolute bottom-0.5 right-0.5 p-0.5 bg-black/70 rounded">
                                                            <Play className="w-2.5 h-2.5 text-white fill-white" />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                );
            })()}

            {/* Caption Modal */}
            {showCaptionModal && data.description && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setShowCaptionModal(false)}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-full max-w-lg max-h-[80vh] bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-[var(--border-color)] flex flex-col overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-[var(--accent-primary)]" />
                                <h3 className="font-semibold text-[var(--text-primary)]">Caption</h3>
                            </div>
                            <button
                                onClick={() => setShowCaptionModal(false)}
                                className="p-2 hover:bg-[var(--bg-secondary)] rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-[var(--text-secondary)]" />
                            </button>
                        </div>
                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line leading-relaxed">
                                {data.description}
                            </p>
                        </div>
                        {/* Footer */}
                        <div className="p-4 border-t border-[var(--border-color)]">
                            <Button
                                variant="secondary"
                                size="sm"
                                className="w-full"
                                onClick={async () => {
                                    await navigator.clipboard.writeText(data.description || '');
                                    setShowCaptionModal(false);
                                    // Show small toast
                                    const toast = document.createElement('div');
                                    toast.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg shadow-lg z-[100] animate-fade-in';
                                    toast.textContent = '✓ Copied to clipboard';
                                    document.body.appendChild(toast);
                                    setTimeout(() => toast.remove(), 1500);
                                }}
                            >
                                Copy Caption
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </motion.div>
    );
}
