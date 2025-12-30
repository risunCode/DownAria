'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { useTranslations } from 'next-intl';
import { MediaGallery } from '@/components/media';
import Swal from 'sweetalert2';
// Shared utilities
import { 
    extractPostId, 
    groupFormatsByItem,
    getItemThumbnails,
    findPreferredFormat,
    getQualityBadge,
} from '@/lib/utils/media';
// Shared download store
import { 
    setDownloadProgress as setGlobalDownloadProgress,
    subscribeDownloadProgress,
    getDownloadProgress,
} from '@/lib/stores/download-store';

// Global filesize limit for all platforms (400MB)
const MAX_FILESIZE_MB = 400;
const MAX_FILESIZE_BYTES = MAX_FILESIZE_MB * 1024 * 1024;
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
    
    // AbortController for cancelling downloads
    const abortControllersRef = useRef<Record<string, AbortController>>({});
    
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

    // Experimental audio conversion state
    const [audioConvertEnabled, setAudioConvertEnabled] = useState(false);
    const [audioConvertStatus, setAudioConvertStatus] = useState<Record<string, 'idle' | 'converting' | 'success' | 'error'>>({});

    // Check if experimental audio conversion is enabled
    useEffect(() => {
        const stored = localStorage.getItem('experimentalAudioConvert');
        setAudioConvertEnabled(stored === 'true');
    }, []);

    // Check if content has audio formats available
    // If yes, audio will show in FormatSelector - no need for convert buttons
    const hasAudioFormats = formats.some(f => f.type === 'audio');

    // Estimate audio filesize: duration_seconds * 128kbps / 8, or fallback to video_filesize * 0.1
    const estimateAudioSize = (format: MediaFormat | undefined): number => {
        if (!format) return 0;
        // If we have duration string (e.g., "3:45" or "1:23:45"), parse to seconds
        if (data.duration) {
            const parts = data.duration.split(':').map(Number);
            let seconds = 0;
            if (parts.length === 3) {
                // HH:MM:SS
                seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else if (parts.length === 2) {
                // MM:SS
                seconds = parts[0] * 60 + parts[1];
            } else if (parts.length === 1) {
                seconds = parts[0];
            }
            if (seconds > 0) {
                // Estimate based on 128kbps bitrate
                return Math.round(seconds * 128 * 1000 / 8);
            }
        }
        // Fallback: estimate as 10% of video filesize
        if (format.filesize) {
            return Math.round(format.filesize * 0.1);
        }
        return 0;
    };

    // Handle audio conversion - extract audio from video (only when no native audio available)
    const handleAudioConvert = async (format: MediaFormat, itemId: string, audioFormat: 'mp3' | 'm4a') => {
        const key = `${itemId}-${audioFormat}`;
        setAudioConvertStatus(prev => ({ ...prev, [key]: 'converting' }));

        try {
            const allFormats = groupedItems[itemId] || formats;
            
            // Find best quality video for audio extraction
            const videoFormats = allFormats.filter(f => f.type === 'video');
            
            let bestVideoForAudio: MediaFormat | undefined;
            
            // Sort by quality preference for audio (medium-high is best)
            const qualityOrder = ['1080p', '720p', 'HD', 'FHD', '480p', '1440p', '4K', '2160p', '360p', 'SD'];
            
            for (const q of qualityOrder) {
                bestVideoForAudio = videoFormats.find(f => 
                    f.quality.toLowerCase().includes(q.toLowerCase())
                );
                if (bestVideoForAudio) break;
            }
            
            // Fallback to first video if no quality match
            if (!bestVideoForAudio) {
                bestVideoForAudio = videoFormats[0] || format;
            }
            
            console.log(`[AudioConvert] Extracting from ${bestVideoForAudio.quality} video`);

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const response = await fetch(`${apiUrl}/api/v1/merge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: bestVideoForAudio.url,
                    format: audioFormat,
                    filename: data.title || 'audio',
                    platform: platform
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Conversion failed');
            }

            // Get the blob and trigger download
            const blob = await response.blob();
            const filename = `${data.title || 'audio'}.${audioFormat}`;
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setAudioConvertStatus(prev => ({ ...prev, [key]: 'success' }));
            
            Swal.fire({
                icon: 'success',
                title: 'Audio Extracted!',
                text: `${audioFormat.toUpperCase()} file downloaded`,
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });

            setTimeout(() => {
                setAudioConvertStatus(prev => ({ ...prev, [key]: 'idle' }));
            }, 5000);
        } catch (error) {
            console.error('Audio conversion error:', error);
            setAudioConvertStatus(prev => ({ ...prev, [key]: 'error' }));
            
            Swal.fire({
                icon: 'error',
                title: 'Conversion Failed',
                text: error instanceof Error ? error.message : 'Failed to convert to audio',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 5000,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });

            setTimeout(() => {
                setAudioConvertStatus(prev => ({ ...prev, [key]: 'idle' }));
            }, 5000);
        }
    };

    // Reset sizesFetched when data changes
    useEffect(() => {
        setSizesFetched(false);
        setFileSizes({});
        setFileSizeNumerics({});
    }, [data.url]); // Reset when URL changes (new content)

    // Sync with global download store - subscribe to updates from MediaGallery
    useEffect(() => {
        const unsubscribe = subscribeDownloadProgress(data.url, (progress) => {
            // Map global progress to local state format
            const status: DownloadStatus = 
                progress.status === 'downloading' ? 'downloading' :
                progress.status === 'done' ? 'success' :
                progress.status === 'error' ? 'error' : 'idle';
            
            // Update for 'main' item (single item) or current selected item
            const itemId = 'main';
            setDownloadStatus(prev => ({ ...prev, [itemId]: status }));
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
        
        // Check initial state from store
        const initial = getDownloadProgress(data.url);
        if (initial.status !== 'idle') {
            const status: DownloadStatus = 
                initial.status === 'downloading' ? 'downloading' :
                initial.status === 'done' ? 'success' :
                initial.status === 'error' ? 'error' : 'idle';
            setDownloadStatus(prev => ({ ...prev, main: status }));
            setDownloadProgress(prev => ({
                ...prev,
                main: {
                    loaded: initial.loaded,
                    total: initial.total,
                    percent: initial.percent,
                    speed: initial.speed,
                    message: initial.message,
                }
            }));
        }
        
        return unsubscribe;
    }, [data.url]);

    // Check if any download OR conversion is in progress
    const isAnyConverting = Object.values(audioConvertStatus).some(s => s === 'converting');
    const isAnyDownloading = Object.values(downloadStatus).some(s => s === 'downloading') || globalStatus === 'downloading' || isAnyConverting;

    // Cancel specific download by itemId
    const cancelDownload = useCallback((itemId: string) => {
        const controller = abortControllersRef.current[itemId];
        if (controller) {
            controller.abort();
            delete abortControllersRef.current[itemId];
        }
        
        // Reset status for this item only
        setDownloadStatus(prev => ({ ...prev, [itemId]: 'idle' }));
        setDownloadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[itemId];
            return newProgress;
        });
        
        console.log(`[DownloadPreview] Download cancelled for item: ${itemId}`);
    }, []);

    // Cancel all ongoing downloads/conversions (for navigation blocking)
    const cancelAllProcesses = useCallback(() => {
        // Abort all ongoing fetch requests
        Object.keys(abortControllersRef.current).forEach(itemId => {
            cancelDownload(itemId);
        });
        
        // Reset global status
        setGlobalStatus('idle');
        setAudioConvertStatus({});
        
        console.log('[DownloadPreview] All processes cancelled by user');
    }, [cancelDownload]);

    // Block navigation helper with SweetAlert + countdown
    const blockNavigation = useCallback(async (): Promise<boolean> => {
        if (!isAnyDownloading) return true; // Allow navigation
        
        let countdown = 4;
        
        const result = await Swal.fire({
            icon: 'warning',
            title: isAnyConverting ? 'Konversi Sedang Berjalan!' : 'Download Sedang Berjalan!',
            text: 'Jika kamu meninggalkan halaman, proses akan dibatalkan. Yakin mau keluar?',
            showCancelButton: true,
            confirmButtonText: `Ya, Keluar (${countdown})`,
            cancelButtonText: 'Tetap di Sini',
            confirmButtonColor: '#ef4444',
            cancelButtonColor: 'var(--accent-primary)',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            allowOutsideClick: false,
            allowEscapeKey: true,
            didOpen: () => {
                const confirmBtn = Swal.getConfirmButton();
                if (confirmBtn) {
                    confirmBtn.disabled = true;
                    confirmBtn.style.opacity = '0.5';
                    confirmBtn.style.cursor = 'not-allowed';
                    
                    const interval = setInterval(() => {
                        countdown--;
                        if (countdown > 0) {
                            confirmBtn.textContent = `Ya, Keluar (${countdown})`;
                        } else {
                            confirmBtn.textContent = 'Ya, Keluar';
                            confirmBtn.disabled = false;
                            confirmBtn.style.opacity = '1';
                            confirmBtn.style.cursor = 'pointer';
                            clearInterval(interval);
                        }
                    }, 1000);
                }
            }
        });
        
        if (result.isConfirmed) {
            // Cancel all ongoing processes before navigating
            cancelAllProcesses();
        }
        
        return result.isConfirmed;
    }, [isAnyDownloading, isAnyConverting, cancelAllProcesses]);

    // Block browser back/forward navigation during download
    useEffect(() => {
        if (!isAnyDownloading) return;

        // Push a dummy state to detect back button
        window.history.pushState({ downloadInProgress: true }, '');

        const handlePopState = async () => {
            if (isAnyDownloading) {
                // Re-push state to stay on page
                window.history.pushState({ downloadInProgress: true }, '');
                
                // Show warning
                Swal.fire({
                    icon: 'warning',
                    title: isAnyConverting ? 'Konversi Sedang Berjalan!' : 'Download Sedang Berjalan!',
                    text: 'Tunggu proses selesai sebelum meninggalkan halaman.',
                    toast: true,
                    position: 'top',
                    timer: 3000,
                    showConfirmButton: false,
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                });
            }
        };

        window.addEventListener('popstate', handlePopState);
        
        return () => {
            window.removeEventListener('popstate', handlePopState);
            // Cleanup: go back to remove the dummy state we pushed
            if (window.history.state?.downloadInProgress) {
                window.history.back();
            }
        };
    }, [isAnyDownloading, isAnyConverting]);

    // Intercept link clicks during download
    useEffect(() => {
        if (!isAnyDownloading) return;

        const handleClick = async (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const link = target.closest('a');
            
            if (link && link.href && !link.href.startsWith('blob:') && !link.download) {
                const isSameOrigin = link.href.startsWith(window.location.origin);
                
                if (isSameOrigin) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const shouldNavigate = await blockNavigation();
                    if (shouldNavigate) {
                        // User confirmed, allow navigation
                        window.location.href = link.href;
                    }
                }
            }
        };

        document.addEventListener('click', handleClick, true);
        return () => document.removeEventListener('click', handleClick, true);
    }, [isAnyDownloading, blockNavigation]);

    // Prevent paste during download (to avoid accidental new URL submission)
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (isAnyDownloading) {
                e.preventDefault();
                Swal.fire({
                    icon: 'warning',
                    title: 'Download Sedang Berjalan',
                    text: 'Tunggu download selesai sebelum paste URL baru.',
                    toast: true,
                    position: 'top-end',
                    timer: 3000,
                    showConfirmButton: false,
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                });
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [isAnyDownloading]);

    // Fetch file sizes for ALL formats - use backend sizes if available, fallback to proxy fetch
    useEffect(() => {
        // Check if formats already have filesize from backend (YouTube + other platforms now)
        const hasBackendSizes = data.formats?.some(f => f.filesize && f.filesize > 0);
        if (hasBackendSizes) {
            // Use backend sizes - populate fileSizes state from format.filesize
            const newSizes: Record<string, string> = {};
            const newNumerics: Record<string, number> = {};
            for (const format of data.formats || []) {
                if (format.filesize && format.filesize > 0) {
                    const itemId = format.itemId || 'main';
                    const key = `${itemId}-${format.url}`;
                    newSizes[key] = formatBytes(format.filesize);
                    newNumerics[key] = format.filesize;
                }
            }
            if (Object.keys(newSizes).length > 0) {
                setFileSizes(newSizes);
                setFileSizeNumerics(newNumerics);
                setSizesFetched(true);
            }
            return;
        }
        
        // Fallback: fetch sizes via proxy (legacy behavior for platforms without backend sizes)
        if (sizesFetched) return;
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
    }, [platform, data.formats, sizesFetched]);

    const getFileSize = (itemId: string, format: MediaFormat | undefined): string | null => {
        if (!format?.url) return null;
        let size: string | null = null;
        // Use filesize from response if available (all platforms including YouTube)
        if (format.filesize) {
            size = formatBytes(format.filesize);
        } else {
            const key = `${itemId}-${format.url}`;
            size = fileSizes[key] || null;
        }
        // Add ~ prefix for estimated sizes (YouTube merge formats)
        return size && format.needsMerge ? `~${size}` : size;
    };

    // Helper to get size for any format (not just selected)
    const getFormatSize = (itemId: string, format: MediaFormat): string | null => {
        if (!format?.url) return null;
        let size: string | null = null;
        // Use filesize from response if available (all platforms including YouTube)
        if (format.filesize) {
            size = formatBytes(format.filesize);
        } else {
            const key = `${itemId}-${format.url}`;
            size = fileSizes[key] || null;
        }
        // Add ~ prefix for estimated sizes (YouTube merge formats)
        return size && format.needsMerge ? `~${size}` : size;
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

    // Check if format exceeds global size limit (400MB for all platforms)
    const isOverSizeLimit = (format: MediaFormat | undefined): boolean => {
        if (!format) return false;
        const size = format.filesize || 0;
        return size > MAX_FILESIZE_BYTES;
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

        // Get file size - prefer format.filesize (from backend), fallback to fetched size
        const sizeKey = `${itemId}-${format.url}`;
        const sizeBytes = format.filesize || fileSizeNumerics[sizeKey] || 0;

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
        // Create AbortController for this download
        const abortController = new AbortController();
        abortControllersRef.current[itemId] = abortController;
        
        setDownloadStatus(prev => ({ ...prev, [itemId]: 'downloading' }));
        setDownloadProgress(prev => ({ ...prev, [itemId]: { loaded: 0, total: 0, percent: 0, speed: 0 } }));
        // Update global store for sync with MediaGallery
        setGlobalDownloadProgress(data.url, { status: 'downloading', percent: 0, loaded: 0, total: 0, speed: 0 });

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
                // Update global store
                setGlobalDownloadProgress(data.url, {
                    status: progress.status === 'done' ? 'done' : progress.status === 'error' ? 'error' : 'downloading',
                    percent: progress.percent,
                    loaded: progress.loaded,
                    total: progress.total,
                    speed: progress.speed,
                    message: progress.message,
                });
            }, abortController.signal);

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
                    fileSize: format.filesize || 0,
                });
                setSentToWebhook(prev => ({ ...prev, [itemId]: true }));
            }

            setDownloadStatus(prev => ({ ...prev, [itemId]: 'success' }));
            setGlobalDownloadProgress(data.url, { status: 'done', percent: 100, loaded: 0, total: 0, speed: 0 });
            
            // Cleanup abort controller
            delete abortControllersRef.current[itemId];
            
            setTimeout(() => {
                setDownloadStatus(prev => ({ ...prev, [itemId]: 'idle' }));
                setGlobalDownloadProgress(data.url, { status: 'idle', percent: 0, loaded: 0, total: 0, speed: 0 });
            }, 5000);
        } catch (e) {
            console.error('Download error:', e);
            setDownloadStatus(prev => ({ ...prev, [itemId]: 'error' }));
            setGlobalDownloadProgress(data.url, { status: 'error', percent: 0, loaded: 0, total: 0, speed: 0 });
            
            // Cleanup abort controller
            delete abortControllersRef.current[itemId];
            
            setTimeout(() => {
                setDownloadStatus(prev => ({ ...prev, [itemId]: 'idle' }));
                setGlobalDownloadProgress(data.url, { status: 'idle', percent: 0, loaded: 0, total: 0, speed: 0 });
            }, 5000);
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
        <div className="flex flex-col gap-2">
            <FormatSelector
                formats={formats}
                selected={selectedFormats[itemId] || null}
                onSelect={(format) => setSelectedFormats(prev => ({ ...prev, [itemId]: format }))}
                getSize={(f) => getFormatSize(itemId, f)}
            />
            {/* Audio Conversion - Only show if NO native audio format available */}
            {audioConvertEnabled && !hasAudioFormats && selectedFormats[itemId]?.type === 'video' && (
                <div className="flex flex-wrap items-center gap-1.5">
                    <Button 
                        size="xs" 
                        variant="secondary"
                        onClick={() => handleAudioConvert(selectedFormats[itemId], itemId, 'mp3')}
                        disabled={audioConvertStatus[`${itemId}-mp3`] === 'converting'}
                        leftIcon={audioConvertStatus[`${itemId}-mp3`] === 'converting' ? <Loader2 className="animate-spin w-3 h-3" /> : <span className="text-[10px]">⚡</span>}
                        title="Convert to MP3"
                        className="text-[10px] px-2 py-1"
                    >
                        {audioConvertStatus[`${itemId}-mp3`] === 'converting' ? '...' : 
                         audioConvertStatus[`${itemId}-mp3`] === 'success' ? '✓' : 
                         `MP3${estimateAudioSize(selectedFormats[itemId]) ? ` ~${formatBytes(estimateAudioSize(selectedFormats[itemId]))}` : ''}`}
                    </Button>
                    <Button 
                        size="xs" 
                        variant="secondary"
                        onClick={() => handleAudioConvert(selectedFormats[itemId], itemId, 'm4a')}
                        disabled={audioConvertStatus[`${itemId}-m4a`] === 'converting'}
                        leftIcon={audioConvertStatus[`${itemId}-m4a`] === 'converting' ? <Loader2 className="animate-spin w-3 h-3" /> : <span className="text-[10px]">⚡</span>}
                        title="Convert to M4A"
                        className="text-[10px] px-2 py-1"
                    >
                        {audioConvertStatus[`${itemId}-m4a`] === 'converting' ? '...' : 
                         audioConvertStatus[`${itemId}-m4a`] === 'success' ? '✓' : 
                         `M4A${estimateAudioSize(selectedFormats[itemId]) ? ` ~${formatBytes(estimateAudioSize(selectedFormats[itemId]))}` : ''}`}
                    </Button>
                </div>
            )}
        </div>
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
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 overflow-hidden">
                        {itemIds.map((itemId, index) => {
                            const thumbnail = itemThumbnails[itemId] || data.thumbnail;
                            const isSelected = selectedItemId === itemId;
                            const itemFormats = groupedItems[itemId] || [];
                            const qualityBadge = getQualityBadge(itemFormats);
                            const isVideo = itemFormats.some(f => f.type === 'video');
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
                                    {/* Index badge - top left */}
                                    <div className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">{index + 1}</div>
                                    {/* Quality badge - top right (only for video) */}
                                    {qualityBadge && (
                                        <div className={`absolute top-0.5 right-0.5 px-1 py-0.5 rounded text-[8px] font-bold ${
                                            qualityBadge === '4K' || qualityBadge === 'FHD' 
                                                ? 'bg-purple-500/90 text-white' 
                                                : qualityBadge === 'HD' 
                                                    ? 'bg-blue-500/90 text-white' 
                                                    : 'bg-gray-500/90 text-white'
                                        }`}>
                                            {qualityBadge}
                                        </div>
                                    )}
                                    {/* Video play icon overlay */}
                                    {isVideo && !qualityBadge && (
                                        <div className="absolute bottom-0.5 right-0.5">
                                            <Play className="w-3 h-3 text-white drop-shadow-md" fill="white" />
                                        </div>
                                    )}
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
                    <div className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg bg-[var(--bg-secondary)] min-w-0 overflow-hidden">
                        {/* Thumbnail + Audio Convert column */}
                        <div className="flex flex-col gap-2 w-full sm:w-32 md:w-40 flex-shrink-0">
                            <div 
                                className="relative w-full aspect-video rounded-lg overflow-hidden bg-[var(--bg-primary)] cursor-pointer group"
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
                            {/* Audio Conversion removed - now in renderFormatButtons */}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                            {renderFormatButtons(groupedItems[selectedItemId], selectedItemId)}
                            <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
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
                                {downloadStatus[selectedItemId] === 'downloading' ? (
                                    <Button size="xs" variant="secondary" onClick={() => cancelDownload(selectedItemId)}
                                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30"
                                        leftIcon={<Loader2 className="animate-spin w-3.5 h-3.5" />}>
                                        {getProgressText(selectedItemId)} • Batal
                                    </Button>
                                ) : (
                                    <Button size="xs" onClick={() => {
                                        const format = selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0];
                                        if (format) triggerDownload(format, selectedItemId);
                                    }}
                                        disabled={isOverSizeLimit(selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0])}
                                        title={isOverSizeLimit(selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0]) ? `File terlalu besar (max ${MAX_FILESIZE_MB}MB)` : undefined}
                                        leftIcon={<Download className="w-3.5 h-3.5" />}>
                                        {isOverSizeLimit(selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0])
                                            ? `Terlalu besar`
                                            : downloadStatus[selectedItemId] === 'success'
                                                ? t('done')
                                                : `${t('download')}${getFileSize(selectedItemId, selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0]) ? ` (${getFileSize(selectedItemId, selectedFormats[selectedItemId] || groupedItems[selectedItemId]?.[0])})` : ''}`}
                                    </Button>
                                )}
                            </div>
                            {/* Progress Bar for carousel item */}
                            {downloadStatus[selectedItemId] === 'downloading' && downloadProgress[selectedItemId] && (
                                <DownloadProgress 
                                    progress={{
                                        percent: downloadProgress[selectedItemId]?.percent || 0,
                                        loaded: downloadProgress[selectedItemId]?.loaded || 0,
                                        total: downloadProgress[selectedItemId]?.total || 0,
                                        speed: downloadProgress[selectedItemId]?.speed || 0,
                                        message: downloadProgress[selectedItemId]?.message
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
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 min-w-0 overflow-hidden">
                    {/* Thumbnail + Audio Convert column */}
                    <div className="flex flex-col gap-2 w-full sm:w-40 md:w-48 lg:w-64 flex-shrink-0">
                        <div 
                            className="relative w-full aspect-video rounded-xl overflow-hidden bg-[var(--bg-secondary)] cursor-pointer group"
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
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
                        {renderFormatButtons(groupedItems[itemIds[0]], itemIds[0])}
                        <div className="mt-4 flex flex-wrap gap-1.5 sm:gap-2">
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
                            {downloadStatus[itemIds[0]] === 'downloading' ? (
                                <Button size="xs" variant="secondary" onClick={() => cancelDownload(itemIds[0])}
                                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30"
                                    leftIcon={<Loader2 className="animate-spin w-3.5 h-3.5" />}>
                                    {getProgressText(itemIds[0])} • Batal
                                </Button>
                            ) : (
                                <Button size="xs" onClick={() => triggerDownload(selectedFormats[itemIds[0]], itemIds[0])}
                                    disabled={isOverSizeLimit(selectedFormats[itemIds[0]])}
                                    title={isOverSizeLimit(selectedFormats[itemIds[0]]) ? `File terlalu besar (max ${MAX_FILESIZE_MB}MB)` : undefined}
                                    leftIcon={<Download className="w-3.5 h-3.5" />}>
                                    {isOverSizeLimit(selectedFormats[itemIds[0]]) 
                                        ? `Terlalu besar (max ${MAX_FILESIZE_MB}MB)`
                                        : downloadStatus[itemIds[0]] === 'success' ? t('downloaded') : t('download')}
                                    {!isOverSizeLimit(selectedFormats[itemIds[0]]) && getFileSize(itemIds[0], selectedFormats[itemIds[0]]) && (
                                        <span className="ml-1 opacity-70">({getFileSize(itemIds[0], selectedFormats[itemIds[0]])})</span>
                                    )}
                                </Button>
                            )}
                        </div>
                        {/* Progress Bar */}
                        {downloadStatus[itemIds[0]] === 'downloading' && downloadProgress[itemIds[0]] && (
                            <DownloadProgress 
                                progress={{
                                    percent: downloadProgress[itemIds[0]]?.percent || 0,
                                    loaded: downloadProgress[itemIds[0]]?.loaded || 0,
                                    total: downloadProgress[itemIds[0]]?.total || 0,
                                    speed: downloadProgress[itemIds[0]]?.speed || 0,
                                    message: downloadProgress[itemIds[0]]?.message
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

            {/* Global Size Limit Warning */}
            <div className="mt-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center gap-2">
                <span>⚠️</span>
                <span>Download Limit: max {MAX_FILESIZE_MB}MB per file. Pilih kualitas yang lebih rendah jika file terlalu besar.</span>
            </div>
        </motion.div>
    );
}
