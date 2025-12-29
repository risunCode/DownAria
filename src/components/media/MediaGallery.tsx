'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ChevronDown, Download, Send, Link2, Play, User, Loader2, Check } from 'lucide-react';
import Image from 'next/image';
import { MediaData, MediaFormat, PlatformId } from '@/lib/types';
import { formatBytes } from '@/lib/utils/format';
import { getProxiedThumbnail } from '@/lib/api/proxy';
import { getProxyUrl } from '@/lib/api/proxy';
import { RichText } from '@/lib/utils/text-parser';
import { sendDiscordNotification, getUserDiscordSettings } from '@/lib/utils/discord-webhook';
import { addHistory, type HistoryEntry } from '@/lib/storage';
import Swal from 'sweetalert2';

// YouTube filesize limit for frontend (350MB warning, backend allows 450MB)
const YOUTUBE_MAX_FILESIZE_MB = 350;
const YOUTUBE_MAX_FILESIZE_BYTES = YOUTUBE_MAX_FILESIZE_MB * 1024 * 1024;

// Shared utilities and components
import { 
  extractPostId, 
  groupFormatsByItem, 
  getItemThumbnails,
  findPreferredFormat,
  canYouTubeAutoplay,
  getYouTubePreviewNotice,
  getQualityBadge,
} from '@/lib/utils/media';
// Shared download store
import { 
  setDownloadProgress as setGlobalDownloadProgress,
  subscribeDownloadProgress,
  getDownloadProgress,
} from '@/lib/stores/download-store';
import { EngagementDisplay } from '@/components/media/EngagementDisplay';
import { FormatSelector } from '@/components/media/FormatSelector';
import { DownloadProgress } from '@/components/media/DownloadProgress';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface MediaGalleryProps {
  data: MediaData;
  platform: PlatformId;
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
  initialFormat?: MediaFormat | null;
  onDownloadComplete?: (entry: HistoryEntry) => void;
}

interface DownloadState {
  status: 'idle' | 'downloading' | 'done' | 'error';
  progress: number;
  speed: number;
  loaded: number;
  total: number;
  eta: number; // seconds remaining
  message?: string; // Custom message for merge status
}

// ═══════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════

function useMediaGalleryMode(): 'modal' | 'fullscreen' {
  const [mode, setMode] = useState<'modal' | 'fullscreen'>('modal');

  useEffect(() => {
    const checkMode = () => {
      setMode(window.innerWidth < 768 ? 'fullscreen' : 'modal');
    };
    checkMode();
    window.addEventListener('resize', checkMode);
    return () => window.removeEventListener('resize', checkMode);
  }, []);

  return mode;
}

function useKeyboardNavigation(
  onClose: () => void,
  onPrev: () => void,
  onNext: () => void,
  isOpen: boolean
) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          onPrev();
          break;
        case 'ArrowRight':
          onNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onPrev, onNext]);
}

/**
 * Hook for swipe gesture navigation (left/right)
 */
function useSwipeNavigation(
  onPrev: () => void,
  onNext: () => void,
  isEnabled: boolean
) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isEnabled) return;
    
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    
    // Only consider horizontal swipe if deltaX > deltaY (not scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
      isSwiping.current = true;
    }
  }, [isEnabled]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isEnabled || !isSwiping.current) return;
    
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const threshold = 50; // minimum swipe distance
    
    if (deltaX > threshold) {
      onPrev(); // Swipe right = go to previous
    } else if (deltaX < -threshold) {
      onNext(); // Swipe left = go to next
    }
    
    isSwiping.current = false;
  }, [isEnabled, onPrev, onNext]);

  return { handleTouchStart, handleTouchMove, handleTouchEnd };
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function MediaGallery({ data, platform, isOpen, onClose, initialIndex = 0, initialFormat = null, onDownloadComplete }: MediaGalleryProps) {
  const mode = useMediaGalleryMode();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [selectedFormat, setSelectedFormat] = useState<MediaFormat | null>(initialFormat);
  const [downloadState, setDownloadState] = useState<DownloadState>({ status: 'idle', progress: 0, speed: 0, loaded: 0, total: 0, eta: 0 });
  const [fileSizes, setFileSizes] = useState<Record<string, string>>({});
  const [discordSent, setDiscordSent] = useState<Record<string, boolean>>({}); // Track per itemId
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const loopCountRef = useRef(0);
  const MAX_LOOPS = 8; // Auto-stop after 8 loops (user might be asleep 😴)
  const abortControllerRef = useRef<AbortController | null>(null); // For cancelling downloads

  // Check if format exceeds YouTube size limit
  const isOverYouTubeLimit = (format: MediaFormat | null): boolean => {
    if (platform !== 'youtube' || !format) return false;
    const size = format.filesize || 0;
    return size > YOUTUBE_MAX_FILESIZE_BYTES;
  };

  // Handle close - prevent during download, send cancel signal
  const handleClose = useCallback(() => {
    if (downloadState.status === 'downloading') {
      Swal.fire({
        icon: 'warning',
        title: 'Download sedang berjalan',
        text: 'Yakin mau batalkan download?',
        showCancelButton: true,
        confirmButtonText: 'Ya, batalkan',
        cancelButtonText: 'Lanjutkan download',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        confirmButtonColor: '#ef4444',
      }).then((result) => {
        if (result.isConfirmed) {
          // Cancel the download
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
          }
          setDownloadState({ status: 'idle', progress: 0, speed: 0, loaded: 0, total: 0, eta: 0 });
          onClose();
        }
      });
      return;
    }
    onClose();
  }, [downloadState.status, onClose]);

  // Memoize grouped formats - only recalculate when formats change
  const groupedItems = useMemo(() => groupFormatsByItem(data.formats || []), [data.formats]);
  const itemThumbnails = useMemo(() => getItemThumbnails(data.formats || []), [data.formats]);
  const itemIds = useMemo(() => Object.keys(groupedItems), [groupedItems]);
  const isCarousel = itemIds.length > 1;
  const currentItemId = itemIds[currentIndex] || 'main';
  const currentFormats = groupedItems[currentItemId] || [];
  // Use item-specific thumbnail, fallback to data.thumbnail
  const currentThumbnail = itemThumbnails[currentItemId] || currentFormats[0]?.thumbnail || data.thumbnail;

  // Sync initialFormat when modal opens or initialFormat changes
  useEffect(() => {
    if (isOpen && initialFormat) {
      setSelectedFormat(initialFormat);
      // Also sync currentIndex to match the initialFormat's item
      if (initialFormat.itemId) {
        const idx = itemIds.indexOf(initialFormat.itemId);
        if (idx >= 0) {
          setCurrentIndex(idx);
        }
      }
    }
  }, [isOpen, initialFormat, itemIds]);

  // Sync with global download store - subscribe to updates from DownloadPreview
  useEffect(() => {
    if (!isOpen) return;
    
    const unsubscribe = subscribeDownloadProgress(data.url, (progress) => {
      setDownloadState({
        status: progress.status,
        progress: progress.percent,
        speed: progress.speed,
        loaded: progress.loaded,
        total: progress.total,
        eta: 0,
        message: progress.message,
      });
    });
    
    // Check initial state from store (in case download started from DownloadPreview)
    const initial = getDownloadProgress(data.url);
    if (initial.status !== 'idle') {
      setDownloadState({
        status: initial.status,
        progress: initial.percent,
        speed: initial.speed,
        loaded: initial.loaded,
        total: initial.total,
        eta: 0,
        message: initial.message,
      });
    }
    
    return unsubscribe;
  }, [isOpen, data.url]);

  // Auto-select format when switching items (only if no initialFormat or user switched manually)
  useEffect(() => {
    if (currentFormats.length > 0 && !selectedFormat) {
      const preferred = findPreferredFormat(currentFormats);
      if (preferred) setSelectedFormat(preferred);
    }
  }, [currentFormats, selectedFormat]);

  // Track if this is initial open (to avoid resetting initialFormat)
  const hasInitialFormat = useRef(false);
  useEffect(() => {
    if (isOpen && initialFormat) {
      hasInitialFormat.current = true;
    }
    if (!isOpen) {
      hasInitialFormat.current = false;
    }
  }, [isOpen, initialFormat]);

  // Reset format on item change (user navigation)
  const prevIndex = useRef(currentIndex);
  useEffect(() => {
    // Only reset if index actually changed
    if (prevIndex.current !== currentIndex) {
      // Always select preferred format for new item when navigating
      const newItemId = itemIds[currentIndex] || 'main';
      const newFormats = groupedItems[newItemId] || [];
      const preferred = findPreferredFormat(newFormats);
      setSelectedFormat(preferred || null);
      setDownloadState({ status: 'idle', progress: 0, speed: 0, loaded: 0, total: 0, eta: 0 });
      loopCountRef.current = 0; // Reset loop counter on item change
      
      // Clear hasInitialFormat after first navigation
      if (hasInitialFormat.current) {
        hasInitialFormat.current = false;
      }
    }
    prevIndex.current = currentIndex;
  }, [currentIndex, itemIds, groupedItems]);

  // Reset loop counter when format changes
  useEffect(() => {
    loopCountRef.current = 0;
  }, [selectedFormat]);

  // Video loop handler - auto-stop after MAX_LOOPS
  const handleVideoEnded = useCallback(() => {
    loopCountRef.current += 1;
    
    if (loopCountRef.current >= MAX_LOOPS) {
      // Stop the video after max loops
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    } else {
      // Continue looping
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
    }
  }, []);

  // Fetch file sizes (batch + parallel) - use backend sizes if available, fallback to proxy fetch
  useEffect(() => {
    if (!isOpen) return;
    
    // First: populate from backend filesize (all platforms including YouTube)
    const backendSizes: Record<string, string> = {};
    Object.values(groupedItems).forEach(formats => {
      formats.forEach(f => {
        if (f.filesize && f.filesize > 0 && !fileSizes[f.url]) {
          backendSizes[f.url] = formatBytes(f.filesize);
        }
      });
    });
    
    if (Object.keys(backendSizes).length > 0) {
      setFileSizes(prev => ({ ...prev, ...backendSizes }));
    }
    
    // Skip proxy fetch for YouTube (backend already provides sizes)
    if (platform === 'youtube') return;
    
    const fetchSizes = async () => {
      // Collect formats that don't have size yet (not from backend, not already fetched)
      const allFormats: MediaFormat[] = [];
      Object.values(groupedItems).forEach(formats => {
        formats.forEach(f => {
          if (!fileSizes[f.url] && !backendSizes[f.url] && !f.filesize) {
            allFormats.push(f);
          }
        });
      });
      
      if (allFormats.length === 0) return;
      
      // Fetch all in parallel
      const results = await Promise.allSettled(
        allFormats.map(async (format) => {
          const res = await fetch(getProxyUrl(format.url, { platform, head: true }));
          const size = res.headers.get('x-file-size');
          return { url: format.url, size: size && parseInt(size) > 0 ? formatBytes(parseInt(size)) : null };
        })
      );
      
      // Batch update state once
      const newSizes: Record<string, string> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.size) {
          newSizes[result.value.url] = result.value.size;
        }
      });
      
      if (Object.keys(newSizes).length > 0) {
        setFileSizes(prev => ({ ...prev, ...newSizes }));
      }
    };
    
    fetchSizes();
  }, [platform, isOpen, groupedItems]); // Fetch all formats when modal opens

  // Navigation
  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : itemIds.length - 1));
  }, [itemIds.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev < itemIds.length - 1 ? prev + 1 : 0));
  }, [itemIds.length]);

  useKeyboardNavigation(handleClose, goToPrev, goToNext, isOpen);

  // Swipe navigation for carousel
  const { handleTouchStart, handleTouchMove, handleTouchEnd } = useSwipeNavigation(goToPrev, goToNext, isCarousel);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Warn user before leaving page during download
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (downloadState.status === 'downloading') {
        e.preventDefault();
        e.returnValue = 'Download sedang berjalan. Yakin mau meninggalkan halaman?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [downloadState.status]);

  // Download handler - uses unified helper
  const handleDownload = async () => {
    if (!selectedFormat) return;
    setDownloadState({ status: 'downloading', progress: 0, speed: 0, loaded: 0, total: 0, eta: 0 });
    // Update global store for sync with DownloadPreview
    setGlobalDownloadProgress(data.url, { status: 'downloading', percent: 0, loaded: 0, total: 0, speed: 0 });

    try {
      const { downloadMedia, triggerBlobDownload } = await import('@/lib/utils/media');
      const carouselIndex = isCarousel ? currentIndex + 1 : undefined;
      
      const result = await downloadMedia(selectedFormat, data, platform, carouselIndex, (progress) => {
        setDownloadState({
          status: progress.status === 'done' ? 'done' : progress.status === 'error' ? 'error' : 'downloading',
          progress: progress.percent,
          speed: progress.speed,
          loaded: progress.loaded,
          total: progress.total,
          eta: 0,
          message: progress.message,
        });
        // Update global store
        setGlobalDownloadProgress(data.url, {
          status: progress.status === 'done' ? 'done' : progress.status === 'error' ? 'error' : 'downloading',
          percent: progress.percent,
          loaded: progress.loaded,
          total: progress.total,
          speed: progress.speed,
          message: progress.message,
        });
      });

      if (!result.success) {
        throw new Error(result.error || 'Download failed');
      }

      // Trigger browser download if we have a blob
      if (result.blob && result.filename) {
        triggerBlobDownload(result.blob, result.filename);
      }

      setDownloadState({ status: 'done', progress: 100, speed: 0, loaded: result.blob?.size || 0, total: result.blob?.size || 0, eta: 0 });
      setGlobalDownloadProgress(data.url, { status: 'done', percent: 100, loaded: 0, total: 0, speed: 0 });

      // Add to history
      const historyId = await addHistory({
        platform,
        contentId: extractPostId(data.url),
        resolvedUrl: data.url,
        title: data.title || 'Untitled',
        thumbnail: currentThumbnail || '',
        author: data.author || 'Unknown',
        quality: selectedFormat.quality,
        type: selectedFormat.type,
      });

      if (onDownloadComplete) {
        onDownloadComplete({
          id: historyId,
          platform,
          contentId: extractPostId(data.url),
          resolvedUrl: data.url,
          title: data.title || 'Untitled',
          thumbnail: currentThumbnail || '',
          author: data.author || 'Unknown',
          downloadedAt: Date.now(),
          quality: selectedFormat.quality,
          type: selectedFormat.type,
        });
      }

      setTimeout(() => {
        setDownloadState(prev => ({ ...prev, status: 'idle' }));
        setGlobalDownloadProgress(data.url, { status: 'idle', percent: 0, loaded: 0, total: 0, speed: 0 });
      }, 3000);
    } catch (err) {
      console.error('Download error:', err);
      setDownloadState({ status: 'error', progress: 0, speed: 0, loaded: 0, total: 0, eta: 0 });
      setGlobalDownloadProgress(data.url, { status: 'error', percent: 0, loaded: 0, total: 0, speed: 0 });
      setTimeout(() => {
        setDownloadState(prev => ({ ...prev, status: 'idle' }));
        setGlobalDownloadProgress(data.url, { status: 'idle', percent: 0, loaded: 0, total: 0, speed: 0 });
      }, 3000);
    }
  };

  // Discord handler
  const handleDiscord = async () => {
    if (!selectedFormat) return;
    
    // Check if already sent for this item
    if (discordSent[currentItemId]) {
      Swal.fire({ icon: 'info', title: 'Already Sent', text: 'This item was already sent to Discord.', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
      return;
    }
    
    const settings = getUserDiscordSettings();
    if (!settings?.webhookUrl) {
      Swal.fire({
        icon: 'warning',
        title: 'Webhook Not Configured',
        text: 'Configure Discord webhook in Settings first.',
        confirmButtonText: 'Go to Settings',
        showCancelButton: true,
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
      }).then(result => {
        if (result.isConfirmed) window.location.href = '/settings';
      });
      return;
    }

    const result = await sendDiscordNotification({
      platform: platform.charAt(0).toUpperCase() + platform.slice(1),
      title: data.title || 'Untitled',
      quality: selectedFormat.quality,
      thumbnail: currentThumbnail,
      mediaUrl: selectedFormat.url,
      mediaType: selectedFormat.type,
      sourceUrl: data.url,
      author: data.author,
      engagement: data.engagement,
    }, true);

    if (result.sent) {
      setDiscordSent(prev => ({ ...prev, [currentItemId]: true }));
      Swal.fire({ icon: 'success', title: 'Sent!', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
    }
  };

  // Copy link handler
  const handleCopyLink = () => {
    navigator.clipboard.writeText(data.url);
    Swal.fire({ icon: 'success', title: 'Link Copied!', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
  };

  const content = (
    <>
      {/* Media Preview - max height to prevent overflow */}
      <div 
        className="relative w-full aspect-video max-h-[45vh] bg-black rounded-lg overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {selectedFormat?.type === 'video' ? (
          // YouTube video-only (needsMerge) - show thumbnail with warning, no video player
          platform === 'youtube' && selectedFormat.needsMerge ? (
            <div className="w-full h-full flex flex-col items-center justify-center relative">
              {currentThumbnail && (
                <Image
                  src={getProxiedThumbnail(currentThumbnail, platform)}
                  alt={data.title || 'Video'}
                  fill
                  className="object-cover"
                  unoptimized
                />
              )}
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                  <Play className="w-8 h-8 text-white ml-1" />
                </div>
                <span className="px-4 py-2 text-sm font-medium bg-black/70 text-amber-400 rounded-lg backdrop-blur-sm border border-amber-400/30">
                  🔇 Preview tidak tersedia - dapat diputar setelah download
                </span>
              </div>
            </div>
          ) : (
            // Non-YouTube or combined format - show video player
            <>
              <video
                ref={videoRef}
                src={getProxyUrl(selectedFormat.url, { platform, inline: true })}
                poster={currentThumbnail ? getProxiedThumbnail(currentThumbnail, platform) : undefined}
                className="w-full h-full object-contain"
                controls
                autoPlay={canYouTubeAutoplay(selectedFormat, platform)}
                playsInline
                onEnded={handleVideoEnded}
              />
            </>
          )
        ) : selectedFormat?.type === 'audio' ? (
          // Audio Player with thumbnail background
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-purple-900/50 to-black">
            {currentThumbnail && (
              <Image
                src={getProxiedThumbnail(currentThumbnail, platform)}
                alt={data.title || 'Audio'}
                fill
                className="object-cover opacity-30 blur-xl"
                unoptimized
              />
            )}
            <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-sm">
              {/* Album Art */}
              <div className="w-24 h-24 rounded-xl overflow-hidden shadow-2xl bg-[var(--bg-secondary)]">
                {currentThumbnail ? (
                  <Image
                    src={getProxiedThumbnail(currentThumbnail, platform)}
                    alt={data.title || 'Audio'}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-8 h-8 text-white/50" />
                  </div>
                )}
              </div>
              {/* Audio Element - All platforms proxied */}
              <audio
                src={getProxyUrl(selectedFormat.url, { platform, inline: true })}
                className="w-full"
                controls
                autoPlay
              />
              <p className="text-xs text-white/60 text-center">🎵 Audio Only</p>
            </div>
          </div>
        ) : selectedFormat?.type === 'image' ? (
          // Image - use full resolution from format URL, fallback to thumbnail
          <Image
            src={getProxyUrl(selectedFormat.url, { platform, inline: true })}
            alt={data.title || 'Image'}
            fill
            className="object-contain"
            unoptimized
          />
        ) : currentThumbnail ? (
          // Fallback to thumbnail if no format selected
          <Image
            src={getProxiedThumbnail(currentThumbnail, platform)}
            alt={data.title || 'Media'}
            fill
            className="object-contain"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-16 h-16 text-white/50" />
          </div>
        )}

        {/* Carousel Navigation */}
        {isCarousel && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); goToPrev(); }} 
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-20 touch-manipulation"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); goToNext(); }} 
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-20 touch-manipulation"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail Strip for Carousel */}
      {isCarousel && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide">
          {itemIds.map((itemId, idx) => {
            const itemFormats = groupedItems[itemId];
            // Use item-specific thumbnail from getItemThumbnails, fallback chain
            const thumb = itemThumbnails[itemId] || itemFormats[0]?.thumbnail || data.thumbnail;
            const isVideo = itemFormats[0]?.type === 'video';
            const qualityBadge = getQualityBadge(itemFormats);
            return (
              <button
                key={itemId}
                onClick={() => setCurrentIndex(idx)}
                className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all ${
                  idx === currentIndex 
                    ? 'ring-2 ring-[var(--accent-primary)] ring-offset-2 ring-offset-[var(--bg-card)]' 
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                {thumb ? (
                  <Image
                    src={getProxiedThumbnail(thumb, platform)}
                    alt={`Item ${idx + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full bg-[var(--bg-secondary)] flex items-center justify-center">
                    <span className="text-xs text-[var(--text-muted)]">{idx + 1}</span>
                  </div>
                )}
                {/* Index number badge - top left */}
                <div className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">
                  {idx + 1}
                </div>
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
                {/* Video play icon - only show if no quality badge */}
                {isVideo && !qualityBadge && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Info Section */}
      <div className="p-4 space-y-3">
        {/* Author & Platform + Badges */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
            <User className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[var(--text-primary)] truncate">{data.author || 'Unknown'}</p>
            <p className="text-xs text-[var(--text-muted)]">{platform.charAt(0).toUpperCase() + platform.slice(1)}</p>
          </div>
          {/* Response time badge */}
          {data.responseTime && (
            <span className="px-2 py-1 text-[10px] rounded-full bg-blue-500/20 text-blue-400">⚡ {data.responseTime}ms</span>
          )}
          {/* Public/Private badge */}
          <span className={`px-2 py-1 text-[10px] rounded-full ${
            data.usedCookie 
              ? 'bg-amber-500/20 text-amber-400' 
              : 'bg-green-500/20 text-green-400'
          }`}>
            {data.usedCookie ? '🔒 Private' : '🌐 Public'}
          </span>
        </div>

        {/* Engagement - right after author */}
        {data.engagement && <EngagementDisplay engagement={data.engagement} className="text-[var(--text-muted)]" />}

        {/* Caption/Description - with show more/less */}
        {data.description && (
          <div className="text-sm text-[var(--text-secondary)]">
            <span className={!captionExpanded ? 'line-clamp-2' : ''}>
              <RichText text={data.description} platform={platform} />
            </span>
            {data.description.length > 150 && (
              <button 
                onClick={() => setCaptionExpanded(!captionExpanded)}
                className="text-[var(--accent-primary)] hover:underline text-xs mt-1 block"
              >
                {captionExpanded ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Quality Selector - Pills with size */}
        <FormatSelector
          formats={currentFormats}
          selected={selectedFormat}
          onSelect={setSelectedFormat}
          getSize={(f) => fileSizes[f.url] || null}
        />

        {/* YouTube size estimation notice */}
        {platform === 'youtube' && (
          <p className="text-[10px] text-[var(--text-muted)] text-center mt-1">
            ⚠️ File sizes are estimated and may differ from actual download
          </p>
        )}

      </div>
    </>
  );

  // Action buttons - rendered in sticky footer
  const actionButtons = (
    <div className="p-4 space-y-3 border-t border-[var(--border-color)]/50 bg-[var(--bg-card)]">
      {/* YouTube Size Limit Warning */}
      {platform === 'youtube' && isOverYouTubeLimit(selectedFormat) && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <span>🚫</span>
          <span>File terlalu besar (max {YOUTUBE_MAX_FILESIZE_MB}MB). Pilih kualitas yang lebih rendah.</span>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          disabled={downloadState.status === 'downloading' || !selectedFormat || isOverYouTubeLimit(selectedFormat)}
          title={isOverYouTubeLimit(selectedFormat) ? `File terlalu besar (max ${YOUTUBE_MAX_FILESIZE_MB}MB)` : undefined}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--accent-primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isOverYouTubeLimit(selectedFormat) ? (
            <>
              <Download className="w-5 h-5" />
              Terlalu besar (max {YOUTUBE_MAX_FILESIZE_MB}MB)
            </>
          ) : downloadState.status === 'downloading' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {downloadState.message || `${downloadState.progress}%`}
            </>
          ) : downloadState.status === 'done' ? (
            <>
              <Check className="w-5 h-5" />
              Downloaded!
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              {(() => {
                const quality = selectedFormat?.quality || 'Download';
                // For generic "Image X" quality, just show "Download"
                const isGenericImage = quality.toLowerCase().startsWith('image');
                return isGenericImage ? 'Download' : quality;
              })()}
              {selectedFormat && fileSizes[selectedFormat.url] && ` (${fileSizes[selectedFormat.url]})`}
            </>
          )}
        </button>
        <button
          onClick={handleDiscord}
          disabled={discordSent[currentItemId]}
          className="p-3 rounded-xl bg-[#5865F2] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          title="Send to Discord"
        >
          {discordSent[currentItemId] ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5" />}
        </button>
        <button
          onClick={handleCopyLink}
          className="p-3 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
          title="Copy Link"
        >
          <Link2 className="w-5 h-5" />
        </button>
      </div>

      {/* Download Progress Bar - Real-time */}
      {downloadState.status === 'downloading' && (
        <DownloadProgress 
          progress={{
            percent: downloadState.progress,
            loaded: downloadState.loaded,
            total: downloadState.total,
            speed: downloadState.speed,
            eta: downloadState.eta,
            message: downloadState.message
          }}
        />
      )}
    </div>
  );

  // Render based on mode
  return mode === 'fullscreen' ? (
    <FullscreenWrapper isOpen={isOpen} onClose={handleClose} footer={actionButtons}>{content}</FullscreenWrapper>
  ) : (
    <ModalWrapper isOpen={isOpen} onClose={handleClose} footer={actionButtons}>{content}</ModalWrapper>
  );
}


// ═══════════════════════════════════════════════════════════════
// WRAPPER COMPONENTS
// ═══════════════════════════════════════════════════════════════

function ModalWrapper({ children, isOpen, onClose, footer }: { children: React.ReactNode; isOpen: boolean; onClose: () => void; footer?: React.ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            key="modal-content"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-[var(--border-color)]"
            onClick={e => e.stopPropagation()}
          >
            {/* Frosted Glass Title Bar with Traffic Lights */}
            <div className="flex-shrink-0 px-3 py-2.5 bg-[var(--bg-card)]/80 backdrop-blur-md border-b border-[var(--border-color)]/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="w-3 h-3 rounded-full bg-[#FF5F57] hover:brightness-90 transition-all flex items-center justify-center group"
                  title="Close"
                >
                  <X className="w-2 h-2 text-[#990000] opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <button
                  onClick={onClose}
                  className="w-3 h-3 rounded-full bg-[#FEBC2E] hover:brightness-90 transition-all flex items-center justify-center group"
                  title="Minimize"
                >
                  <span className="w-1.5 h-0.5 bg-[#995700] opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                </button>
                <button
                  onClick={onClose}
                  className="w-3 h-3 rounded-full bg-[#28C840] hover:brightness-90 transition-all flex items-center justify-center group"
                  title="Expand"
                >
                  <span className="w-1.5 h-1.5 border border-[#006500] opacity-0 group-hover:opacity-100 transition-opacity rounded-sm" />
                </button>
                <span className="ml-2 text-xs text-[var(--text-muted)] font-medium">Preview</span>
              </div>
            </div>
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {children}
            </div>
            {/* Sticky Footer */}
            {footer && (
              <div className="flex-shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FullscreenWrapper({ children, isOpen, onClose, footer }: { children: React.ReactNode; isOpen: boolean; onClose: () => void; footer?: React.ReactNode }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  
  // Use refs instead of state for performance (no re-renders during drag)
  const touchStartY = useRef(0);
  const currentDragY = useRef(0);
  const isDragging = useRef(false);
  const isAtTop = useRef(true);
  const wasPlaying = useRef(false);
  
  // Track swipe close state - use state to trigger re-render and hide immediately
  const [isClosingBySwipe, setIsClosingBySwipe] = useState(false);

  // Pause all media when dragging starts
  const pauseMedia = useCallback(() => {
    const videos = sheetRef.current?.querySelectorAll('video');
    const audios = sheetRef.current?.querySelectorAll('audio');
    videos?.forEach(v => {
      if (!v.paused) { wasPlaying.current = true; v.pause(); }
    });
    audios?.forEach(a => {
      if (!a.paused) { wasPlaying.current = true; a.pause(); }
    });
  }, []);

  // Resume media if it was playing
  const resumeMedia = useCallback(() => {
    if (wasPlaying.current) {
      const videos = sheetRef.current?.querySelectorAll('video');
      const audios = sheetRef.current?.querySelectorAll('audio');
      videos?.forEach(v => v.play().catch(() => {}));
      audios?.forEach(a => a.play().catch(() => {}));
      wasPlaying.current = false;
    }
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isAtTop.current = (contentRef.current?.scrollTop || 0) <= 5;
    currentDragY.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    const deltaY = e.touches[0].clientY - touchStartY.current;
    
    // Only drag when at top and pulling down
    if (isAtTop.current && deltaY > 10) {
      if (!isDragging.current) {
        isDragging.current = true;
        pauseMedia();
      }
      
      e.preventDefault();
      currentDragY.current = Math.min(deltaY * 0.5, 250);
      
      // Direct DOM manipulation - no React re-render = smooth 60fps
      if (sheetRef.current) {
        sheetRef.current.style.transform = `translateY(${currentDragY.current}px)`;
        sheetRef.current.style.opacity = `${1 - currentDragY.current / 400}`;
      }
      if (backdropRef.current) {
        backdropRef.current.style.opacity = `${0.5 - currentDragY.current / 600}`;
      }
    }
  }, [pauseMedia]);

  const handleTouchEnd = useCallback(() => {
    if (isDragging.current) {
      const shouldClose = currentDragY.current > 80;
      
      if (shouldClose) {
        // Animate out via DOM (smooth, no blink)
        if (sheetRef.current) {
          sheetRef.current.style.transition = 'transform 0.25s ease-out, opacity 0.25s ease-out';
          sheetRef.current.style.transform = 'translateY(100%)';
          sheetRef.current.style.opacity = '0';
        }
        if (backdropRef.current) {
          backdropRef.current.style.transition = 'opacity 0.25s ease-out';
          backdropRef.current.style.opacity = '0';
        }
        // Set closing state immediately to hide framer-motion wrapper
        setIsClosingBySwipe(true);
        // Call onClose after animation completes
        setTimeout(onClose, 250);
      } else {
        // Snap back - use requestAnimationFrame for smoother animation
        requestAnimationFrame(() => {
          if (sheetRef.current) {
            sheetRef.current.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease-out';
            sheetRef.current.style.transform = 'translateY(0)';
            sheetRef.current.style.opacity = '1';
          }
          if (backdropRef.current) {
            backdropRef.current.style.transition = 'opacity 0.3s ease-out';
            backdropRef.current.style.opacity = '0.5';
          }
        });
        resumeMedia();
      }
      
      // Clear transition after animation completes
      setTimeout(() => {
        if (sheetRef.current && !isDragging.current) {
          sheetRef.current.style.transition = '';
        }
        if (backdropRef.current) {
          backdropRef.current.style.transition = '';
        }
      }, 350);
      
      isDragging.current = false;
      currentDragY.current = 0;
    }
  }, [onClose, resumeMedia]);

  // Attach touch listeners with passive: false for preventDefault
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || !isOpen) return;

    sheet.addEventListener('touchstart', handleTouchStart, { passive: true });
    sheet.addEventListener('touchmove', handleTouchMove, { passive: false });
    sheet.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      sheet.removeEventListener('touchstart', handleTouchStart);
      sheet.removeEventListener('touchmove', handleTouchMove);
      sheet.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setIsClosingBySwipe(false);
      // Small delay to let framer-motion finish initial animation
      const timer = setTimeout(() => {
        if (sheetRef.current) {
          sheetRef.current.style.transform = '';
          sheetRef.current.style.opacity = '';
          sheetRef.current.style.transition = '';
        }
        if (backdropRef.current) {
          backdropRef.current.style.transition = '';
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // If closing by swipe, render nothing (skip framer-motion exit which causes blink)
  if (isClosingBySwipe) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            ref={backdropRef}
            key="fullscreen-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black"
            onClick={onClose}
          />
          
          {/* Sheet - use CSS animation for entry, manual DOM for drag */}
          <motion.div
            ref={sheetRef}
            key="fullscreen"
            initial={{ y: '100%', opacity: 1 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-[var(--bg-card)] rounded-t-3xl overflow-hidden max-h-[92vh] flex flex-col"
            style={{ 
              boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            {/* Header with traffic lights and hide panel */}
            <div className="sticky top-0 z-10 bg-[var(--bg-card)] border-b border-[var(--border-color)]/50">
              {/* Single row: Traffic Lights + Preview + Hide Panel */}
              <div className="flex items-center justify-between px-4 py-3">
                {/* Left: Traffic Lights + Preview */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="w-4 h-4 rounded-full bg-[#FF5F57] hover:bg-[#FF5F57]/80 transition-colors flex items-center justify-center group"
                    title="Close"
                  >
                    <X className="w-2.5 h-2.5 text-[#990000] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button
                    onClick={onClose}
                    className="w-4 h-4 rounded-full bg-[#FEBC2E] hover:bg-[#FEBC2E]/80 transition-colors flex items-center justify-center group"
                    title="Minimize"
                  >
                    <ChevronLeft className="w-2.5 h-2.5 text-[#995700] opacity-0 group-hover:opacity-100 transition-opacity -rotate-90" />
                  </button>
                  <button
                    onClick={onClose}
                    className="w-4 h-4 rounded-full bg-[#28C840] hover:bg-[#28C840]/80 transition-colors flex items-center justify-center group"
                    title="Expand"
                  >
                    <ChevronRight className="w-2.5 h-2.5 text-[#006500] opacity-0 group-hover:opacity-100 transition-opacity rotate-45" />
                  </button>
                  <span className="ml-3 text-sm font-medium text-[var(--text-secondary)]">Preview</span>
                </div>
                
                {/* Right: Hide Panel Button */}
                <button 
                  onClick={onClose}
                  className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <span className="text-xs font-medium">Sembunyikan</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Scrollable Content - hide scrollbar on mobile */}
            <div 
              ref={contentRef}
              className="overflow-y-auto flex-1 min-h-0 pb-safe overscroll-contain scrollbar-hide"
              style={{ maxHeight: footer ? 'calc(92vh - 70px - 120px)' : 'calc(92vh - 70px)' }}
            >
              {children}
            </div>
            
            {/* Sticky Footer */}
            {footer && (
              <div className="flex-shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default MediaGallery;
