'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Download, Send, Link2, Play, Heart, MessageCircle, Share2, User, Loader2, Check } from 'lucide-react';
import Image from 'next/image';
import { MediaData, MediaFormat, Platform } from '@/lib/types';
import { formatBytes } from '@/lib/utils/format-utils';
import { getProxiedThumbnail } from '@/lib/utils/thumbnail-utils';
import { sendDiscordNotification, getUserDiscordSettings } from '@/lib/utils/discord-webhook';
import { addHistory, type HistoryEntry } from '@/lib/storage';
import Swal from 'sweetalert2';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

interface MediaGalleryProps {
  data: MediaData;
  platform: Platform;
  isOpen: boolean;
  onClose: () => void;
  initialIndex?: number;
  onDownloadComplete?: (entry: HistoryEntry) => void;
}

interface DownloadState {
  status: 'idle' | 'downloading' | 'done' | 'error';
  progress: number;
  speed: number;
  loaded: number;
  total: number;
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

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function MediaGallery({ data, platform, isOpen, onClose, initialIndex = 0, onDownloadComplete }: MediaGalleryProps) {
  const mode = useMediaGalleryMode();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [selectedFormat, setSelectedFormat] = useState<MediaFormat | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState>({ status: 'idle', progress: 0, speed: 0, loaded: 0, total: 0 });
  const [fileSizes, setFileSizes] = useState<Record<string, string>>({});
  const [discordSent, setDiscordSent] = useState(false);

  // Group formats by itemId for carousel
  const groupedItems = groupFormatsByItem(data.formats || []);
  const itemIds = Object.keys(groupedItems);
  const isCarousel = itemIds.length > 1;
  const currentItemId = itemIds[currentIndex] || 'main';
  const currentFormats = groupedItems[currentItemId] || [];
  const currentThumbnail = currentFormats[0]?.thumbnail || data.thumbnail;

  // Set default selected format
  useEffect(() => {
    if (currentFormats.length > 0 && !selectedFormat) {
      const preferred = currentFormats.find(f => 
        f.quality.toLowerCase().includes('hd') || 
        f.quality.toLowerCase().includes('1080')
      ) || currentFormats[0];
      setSelectedFormat(preferred);
    }
  }, [currentFormats, selectedFormat]);

  // Reset on item change
  useEffect(() => {
    setSelectedFormat(null);
    setDownloadState({ status: 'idle', progress: 0, speed: 0, loaded: 0, total: 0 });
  }, [currentIndex]);

  // Fetch file sizes
  useEffect(() => {
    const fetchSizes = async () => {
      for (const format of currentFormats) {
        const key = format.url;
        if (fileSizes[key]) continue;
        try {
          const res = await fetch(`/api/proxy?url=${encodeURIComponent(format.url)}&platform=${platform}&head=1`);
          const size = res.headers.get('x-file-size');
          if (size && parseInt(size) > 0) {
            setFileSizes(prev => ({ ...prev, [key]: formatBytes(parseInt(size)) }));
          }
        } catch { /* ignore */ }
      }
    };
    if (isOpen) fetchSizes();
  }, [currentFormats, platform, isOpen, fileSizes]);

  // Navigation
  const goToPrev = useCallback(() => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : itemIds.length - 1));
  }, [itemIds.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => (prev < itemIds.length - 1 ? prev + 1 : 0));
  }, [itemIds.length]);

  useKeyboardNavigation(onClose, goToPrev, goToNext, isOpen);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Download handler
  const handleDownload = async () => {
    if (!selectedFormat) return;
    setDownloadState({ status: 'downloading', progress: 0, speed: 0, loaded: 0, total: 0 });

    try {
      const filename = generateFilename(data, platform, selectedFormat, isCarousel ? currentIndex + 1 : undefined);
      const proxyUrl = `/api/proxy?url=${encodeURIComponent(selectedFormat.url)}&filename=${encodeURIComponent(filename)}&platform=${platform}`;
      
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

        const now = Date.now();
        const timeDiff = now - lastTime;
        let speed = downloadState.speed;

        if (timeDiff >= 500) {
          speed = ((loaded - lastLoaded) / timeDiff) * 1000;
          lastTime = now;
          lastLoaded = loaded;
        }

        const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;
        setDownloadState({ status: 'downloading', progress, speed, loaded, total });
      }

      const blob = new Blob(chunks as BlobPart[]);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(blobUrl);

      setDownloadState({ status: 'done', progress: 100, speed: 0, loaded, total });

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

      setTimeout(() => setDownloadState(prev => ({ ...prev, status: 'idle' })), 3000);
    } catch (err) {
      console.error('Download error:', err);
      setDownloadState({ status: 'error', progress: 0, speed: 0, loaded: 0, total: 0 });
      setTimeout(() => setDownloadState(prev => ({ ...prev, status: 'idle' })), 3000);
    }
  };

  // Discord handler
  const handleDiscord = async () => {
    if (!selectedFormat) return;
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
      setDiscordSent(true);
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
      {/* Media Preview */}
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
        {selectedFormat?.type === 'video' ? (
          <video
            src={`/api/proxy?url=${encodeURIComponent(selectedFormat.url)}&platform=${platform}&inline=1`}
            poster={currentThumbnail ? getProxiedThumbnail(currentThumbnail, platform) : undefined}
            className="w-full h-full object-contain"
            controls
            autoPlay
            loop
            playsInline
          />
        ) : currentThumbnail ? (
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
            <button onClick={goToPrev} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button onClick={goToNext} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
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
            const thumb = itemFormats[0]?.thumbnail || data.thumbnail;
            const isVideo = itemFormats[0]?.type === 'video';
            return (
              <button
                key={idx}
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
                {isVideo && (
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
        {/* Author & Platform */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center">
            <User className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[var(--text-primary)] truncate">{data.author || 'Unknown'}</p>
            <p className="text-xs text-[var(--text-muted)]">{platform.charAt(0).toUpperCase() + platform.slice(1)}</p>
          </div>
          {data.responseTime && (
            <span className="px-2 py-1 text-[10px] rounded-full bg-blue-500/20 text-blue-400">⚡ {data.responseTime}ms</span>
          )}
        </div>

        {/* Caption - truncated with expand */}
        {data.title && (
          <p className="text-sm text-[var(--text-secondary)] line-clamp-2" title={data.title}>
            {data.title}
          </p>
        )}

        {/* Engagement - compact inline */}
        {data.engagement && (
          <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
            {data.engagement.likes !== undefined && <span className="flex items-center gap-1 text-red-400"><Heart className="w-3 h-3" />{formatNumber(data.engagement.likes)}</span>}
            {data.engagement.comments !== undefined && <span className="flex items-center gap-1 text-blue-400"><MessageCircle className="w-3 h-3" />{formatNumber(data.engagement.comments)}</span>}
            {data.engagement.shares !== undefined && <span className="flex items-center gap-1 text-green-400"><Share2 className="w-3 h-3" />{formatNumber(data.engagement.shares)}</span>}
          </div>
        )}

        {/* Quality Selector */}
        <div className="flex flex-wrap gap-2">
          {currentFormats.map((format, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedFormat(format)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedFormat === format
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-card)]'
              }`}
            >
              {format.quality}
              {fileSizes[format.url] && <span className="ml-1 opacity-70">({fileSizes[format.url]})</span>}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleDownload}
            disabled={downloadState.status === 'downloading' || !selectedFormat}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--accent-primary)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {downloadState.status === 'downloading' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {downloadState.progress}% · {(downloadState.speed / 1024 / 1024).toFixed(1)} MB/s
              </>
            ) : downloadState.status === 'done' ? (
              <>
                <Check className="w-5 h-5" />
                Downloaded!
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download {selectedFormat && fileSizes[selectedFormat.url] ? `(${fileSizes[selectedFormat.url]})` : ''}
              </>
            )}
          </button>
          <button
            onClick={handleDiscord}
            disabled={discordSent}
            className="p-3 rounded-xl bg-[#5865F2] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            title="Send to Discord"
          >
            {discordSent ? <Check className="w-5 h-5" /> : <Send className="w-5 h-5" />}
          </button>
          <button
            onClick={handleCopyLink}
            className="p-3 rounded-xl bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
            title="Copy Link"
          >
            <Link2 className="w-5 h-5" />
          </button>
        </div>

        {/* Download Progress Bar */}
        {downloadState.status === 'downloading' && (
          <div className="space-y-1">
            <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-purple-500 transition-all duration-300"
                style={{ width: `${downloadState.progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
              <span>{formatBytes(downloadState.loaded)} / {downloadState.total ? formatBytes(downloadState.total) : '?'}</span>
              <span className="text-[var(--accent-primary)]">{(downloadState.speed / 1024 / 1024).toFixed(1)} MB/s</span>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // Render based on mode
  return mode === 'fullscreen' ? (
    <FullscreenWrapper isOpen={isOpen} onClose={onClose}>{content}</FullscreenWrapper>
  ) : (
    <ModalWrapper isOpen={isOpen} onClose={onClose}>{content}</ModalWrapper>
  );
}


// ═══════════════════════════════════════════════════════════════
// WRAPPER COMPONENTS
// ═══════════════════════════════════════════════════════════════

function ModalWrapper({ children, isOpen, onClose }: { children: React.ReactNode; isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            key="modal-content"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--bg-card)] rounded-2xl shadow-2xl border border-[var(--border-color)]"
            onClick={e => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function FullscreenWrapper({ children, isOpen, onClose }: { children: React.ReactNode; isOpen: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="fullscreen"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.y > 100) onClose();
          }}
          className="fixed inset-0 z-50 bg-[var(--bg-primary)] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[var(--bg-primary)]/90 backdrop-blur-sm border-b border-[var(--border-color)]">
            <button onClick={onClose} className="flex items-center gap-2 text-[var(--text-primary)]">
              <ChevronLeft className="w-5 h-5" />
              <span className="font-medium">Back</span>
            </button>
            <div className="w-12 h-1 rounded-full bg-[var(--border-color)] absolute left-1/2 -translate-x-1/2 top-1.5" />
          </div>
          {/* Content */}
          <div className="pb-safe">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function groupFormatsByItem(formats: MediaFormat[]): Record<string, MediaFormat[]> {
  const grouped: Record<string, MediaFormat[]> = {};
  formats.forEach(format => {
    const id = format.itemId || 'main';
    if (!grouped[id]) grouped[id] = [];
    grouped[id].push(format);
  });
  return grouped;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return num.toString();
}

function extractPostId(url: string): string {
  const patterns = [
    /\/share\/[rvp]\/([^/?]+)/,
    /\/reel\/(\d+)/,
    /\/videos?\/(\d+)/,
    /\/(p|reel|reels|tv)\/([^/?]+)/,
    /\/video\/(\d+)/,
    /\/status\/(\d+)/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[match.length - 1];
  }
  return Date.now().toString(36);
}

function generateFilename(data: MediaData, platform: Platform, format: MediaFormat, carouselIndex?: number): string {
  const platformShort: Record<string, string> = {
    facebook: 'FB', instagram: 'IG', twitter: 'X', tiktok: 'TT', weibo: 'WB', youtube: 'YT'
  };
  const platName = platformShort[platform] || platform.toUpperCase();
  const author = (data.author || 'unknown').replace(/^@/, '').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-_\u4e00-\u9fff]/g, '').substring(0, 25) || 'unknown';
  const postId = extractPostId(data.url);
  const ext = format.format || (format.type === 'video' ? 'mp4' : format.type === 'audio' ? 'mp3' : 'jpg');
  const carouselSuffix = carouselIndex ? `_${carouselIndex}` : '';
  
  return `${platName}_${author}_${postId}${carouselSuffix}_[XTFetch].${ext}`;
}

export default MediaGallery;
