'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Download, Send, Link2, Play, Heart, MessageCircle, Share2, User, Loader2, Check } from 'lucide-react';
import Image from 'next/image';
import { MediaData, MediaFormat, Platform } from '@/lib/types';
import { formatBytes } from '@/lib/utils/format-utils';
import { getProxiedThumbnail } from '@/lib/utils/thumbnail-utils';
import { sendDiscordNotification, getUserDiscordSettings } from '@/lib/utils/discord-webhook';
import { addHistory, type HistoryEntry } from '@/lib/storage';
import Swal from 'sweetalert2';
import Hls from 'hls.js';

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
  eta: number; // seconds remaining
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
  const [downloadState, setDownloadState] = useState<DownloadState>({ status: 'idle', progress: 0, speed: 0, loaded: 0, total: 0, eta: 0 });
  const [fileSizes, setFileSizes] = useState<Record<string, string>>({});
  const [discordSent, setDiscordSent] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Memoize grouped formats - only recalculate when formats change
  const groupedItems = useMemo(() => groupFormatsByItem(data.formats || []), [data.formats]);
  const itemIds = useMemo(() => Object.keys(groupedItems), [groupedItems]);
  const isCarousel = itemIds.length > 1;
  const currentItemId = itemIds[currentIndex] || 'main';
  const currentFormats = groupedItems[currentItemId] || [];
  const currentThumbnail = currentFormats[0]?.thumbnail || data.thumbnail;

  // Check if format is m3u8/HLS
  const isHlsFormat = (format: MediaFormat | null) => {
    if (!format) return false;
    return format.url.includes('.m3u8') || format.format === 'm3u8' || format.format === 'hls';
  };

  // Set default selected format - prefer video, then HD
  useEffect(() => {
    if (currentFormats.length > 0 && !selectedFormat) {
      // First try to find HD video (by type or quality string)
      let preferred = currentFormats.find(f => 
        (f.type === 'video' || f.quality.toLowerCase().includes('video')) && (
          f.quality.toLowerCase().includes('hd') || 
          f.quality.toLowerCase().includes('1080') ||
          f.quality.toLowerCase().includes('720')
        )
      );
      // If no HD video, find any video
      if (!preferred) {
        preferred = currentFormats.find(f => 
          f.type === 'video' || f.quality.toLowerCase().includes('video')
        );
      }
      // If no video at all, find HD anything (but not audio)
      if (!preferred) {
        preferred = currentFormats.find(f => 
          f.type !== 'audio' && !f.quality.toLowerCase().includes('audio') && (
            f.quality.toLowerCase().includes('hd') || 
            f.quality.toLowerCase().includes('1080')
          )
        );
      }
      // Fallback to first non-audio format, then first format
      if (!preferred) {
        preferred = currentFormats.find(f => 
          f.type !== 'audio' && !f.quality.toLowerCase().includes('audio')
        ) || currentFormats[0];
      }
      setSelectedFormat(preferred);
    }
  }, [currentFormats, selectedFormat]);

  // Reset on item change
  useEffect(() => {
    setSelectedFormat(null);
    setDownloadState({ status: 'idle', progress: 0, speed: 0, loaded: 0, total: 0, eta: 0 });
  }, [currentIndex]);

  // HLS.js setup for m3u8 streams
  useEffect(() => {
    if (!videoRef.current || !selectedFormat || !isHlsFormat(selectedFormat)) {
      // Cleanup HLS if not needed
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(selectedFormat.url)}&platform=${platform}&inline=1&hls=1`;

    // Check if native HLS is supported (Safari, iOS)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = proxyUrl;
      return;
    }

    // Use HLS.js for other browsers with custom XHR loader to proxy all requests
    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        // Custom loader to proxy all segment requests
        xhrSetup: (xhr: XMLHttpRequest, url: string) => {
          // If URL is already our proxy, use as-is
          if (url.startsWith('/api/proxy')) {
            return;
          }
          // Otherwise, proxy the URL
          const proxiedUrl = `/api/proxy?url=${encodeURIComponent(url)}&platform=${platform}&inline=1`;
          xhr.open('GET', proxiedUrl, true);
        },
      });
      hlsRef.current = hls;
      hls.loadSource(proxyUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedFormat, platform]);

  // Fetch file sizes (batch + parallel)
  useEffect(() => {
    if (!isOpen || currentFormats.length === 0) return;
    
    const fetchSizes = async () => {
      // Filter formats that don't have sizes yet
      const formatsToFetch = currentFormats.filter(f => !fileSizes[f.url]);
      if (formatsToFetch.length === 0) return;
      
      // Fetch all in parallel
      const results = await Promise.allSettled(
        formatsToFetch.map(async (format) => {
          const res = await fetch(`/api/proxy?url=${encodeURIComponent(format.url)}&platform=${platform}&head=1`);
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
  }, [currentFormats, platform, isOpen]); // Removed fileSizes from deps to prevent loop

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

  // HLS segment downloader - downloads all segments and merges into single blob
  const downloadHlsAsBlob = async (
    m3u8Url: string,
    onProgress: (loaded: number, total: number, segment: number, totalSegments: number) => void
  ): Promise<Blob> => {
    // Fetch m3u8 playlist via proxy
    const proxyM3u8 = `/api/proxy?url=${encodeURIComponent(m3u8Url)}&platform=${platform}&inline=1&hls=1`;
    const m3u8Res = await fetch(proxyM3u8);
    if (!m3u8Res.ok) throw new Error('Failed to fetch HLS playlist');
    
    const m3u8Text = await m3u8Res.text();
    
    // Parse segment URLs from m3u8
    const lines = m3u8Text.split('\n');
    const segmentUrls: string[] = [];
    const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        // Could be relative or absolute URL
        if (trimmed.startsWith('http')) {
          segmentUrls.push(trimmed);
        } else {
          segmentUrls.push(baseUrl + trimmed);
        }
      }
    }
    
    if (segmentUrls.length === 0) {
      throw new Error('No segments found in HLS playlist');
    }
    
    // Download all segments
    const segments: Uint8Array[] = [];
    let totalLoaded = 0;
    const estimatedTotal = segmentUrls.length * 500000; // Estimate ~500KB per segment
    
    for (let i = 0; i < segmentUrls.length; i++) {
      const segUrl = segmentUrls[i];
      const proxySegUrl = `/api/proxy?url=${encodeURIComponent(segUrl)}&platform=${platform}&inline=1`;
      
      const segRes = await fetch(proxySegUrl, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
      
      if (!segRes.ok) {
        console.warn(`Segment ${i + 1} failed, skipping...`);
        continue;
      }
      
      const segData = await segRes.arrayBuffer();
      segments.push(new Uint8Array(segData));
      totalLoaded += segData.byteLength;
      
      onProgress(totalLoaded, estimatedTotal, i + 1, segmentUrls.length);
    }
    
    // Merge all segments into single blob (MPEG-TS segments can be concatenated directly)
    return new Blob(segments as BlobPart[], { type: 'video/mp2t' });
  };

  // Download handler with real-time progress (IDM-proof using Blob)
  const handleDownload = async () => {
    if (!selectedFormat) return;
    setDownloadState({ status: 'downloading', progress: 0, speed: 0, loaded: 0, total: 0, eta: 0 });

    try {
      // Generate filename - use .ts for HLS (MPEG-TS container), .mp4 for others
      const isHls = isHlsFormat(selectedFormat);
      let filename = generateFilename(data, platform, selectedFormat, isCarousel ? currentIndex + 1 : undefined);
      
      // For HLS, change extension to .ts (MPEG-TS) since we're concatenating segments
      if (isHls) {
        filename = filename.replace(/\.m3u8$/i, '.ts');
      }
      
      let blob: Blob;
      const startTime = Date.now();
      
      if (isHls) {
        // HLS download - fetch all segments and merge
        blob = await downloadHlsAsBlob(
          selectedFormat.url,
          (loaded, total, segment, totalSegments) => {
            const now = Date.now();
            const elapsed = (now - startTime) / 1000;
            const speed = loaded / elapsed;
            const progress = Math.round((segment / totalSegments) * 100);
            const remaining = ((totalSegments - segment) / segment) * elapsed;
            
            setDownloadState({
              status: 'downloading',
              progress,
              speed,
              loaded,
              total,
              eta: remaining,
            });
          }
        );
      } else {
        // Regular download
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(selectedFormat.url)}&filename=${encodeURIComponent(filename)}&platform=${platform}`;
        
        const response = await fetch(proxyUrl, {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });
        if (!response.ok) throw new Error(`Download failed: ${response.status}`);

        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength) : 0;
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const chunks: Uint8Array[] = [];
        let loaded = 0;
        let lastUpdateTime = startTime;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loaded += value.length;

          const now = Date.now();
          const elapsed = (now - startTime) / 1000;
          const speed = loaded / elapsed;
          const remaining = total > 0 ? (total - loaded) / speed : 0;
          const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;

          if (now - lastUpdateTime >= 100) {
            lastUpdateTime = now;
            setDownloadState({ status: 'downloading', progress, speed, loaded, total, eta: remaining });
          }
        }

        const contentType = response.headers.get('content-type') || 'video/mp4';
        blob = new Blob(chunks as BlobPart[], { type: contentType });
      }
      
      // Create blob URL and trigger download (IDM cannot intercept blob URLs)
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.style.display = 'none';
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      setDownloadState({ status: 'done', progress: 100, speed: 0, loaded: blob.size, total: blob.size, eta: 0 });

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
      setDownloadState({ status: 'error', progress: 0, speed: 0, loaded: 0, total: 0, eta: 0 });
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
      {/* Media Preview */}
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
        {selectedFormat?.type === 'video' ? (
          isHlsFormat(selectedFormat) ? (
            <video
              ref={videoRef}
              poster={currentThumbnail ? getProxiedThumbnail(currentThumbnail, platform) : undefined}
              className="w-full h-full object-contain"
              controls
              autoPlay
              playsInline
            />
          ) : (
            <video
              src={`/api/proxy?url=${encodeURIComponent(selectedFormat.url)}&platform=${platform}&inline=1`}
              poster={currentThumbnail ? getProxiedThumbnail(currentThumbnail, platform) : undefined}
              className="w-full h-full object-contain"
              controls
              autoPlay
              loop
              playsInline
            />
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
              {/* Audio Element */}
              <audio
                src={`/api/proxy?url=${encodeURIComponent(selectedFormat.url)}&platform=${platform}&inline=1`}
                className="w-full"
                controls
                autoPlay
              />
              <p className="text-xs text-white/60 text-center">🎵 Audio Only</p>
            </div>
          </div>
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

        {/* Quality Selector - Pills with size */}
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
                {downloadState.progress}%
              </>
            ) : downloadState.status === 'done' ? (
              <>
                <Check className="w-5 h-5" />
                Downloaded!
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                {selectedFormat?.quality || 'Download'}
                {selectedFormat && fileSizes[selectedFormat.url] && ` (${fileSizes[selectedFormat.url]})`}
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

        {/* Download Progress Bar - Real-time */}
        {downloadState.status === 'downloading' && (
          <div className="space-y-1">
            <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${downloadState.progress}%` }}
                transition={{ duration: 0.1, ease: 'linear' }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
              <span>{formatBytes(downloadState.loaded)} / {downloadState.total ? formatBytes(downloadState.total) : '?'}</span>
              <span className="text-[var(--accent-primary)]">
                {(downloadState.speed / 1024 / 1024).toFixed(1)} MB/s
                {downloadState.eta > 0 && ` · ${Math.ceil(downloadState.eta)}s left`}
              </span>
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
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
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  
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
        // Add dragging class for visual feedback
        handleRef.current?.classList.add('bg-[var(--accent-primary)]');
        handleRef.current?.classList.remove('bg-[var(--text-muted)]/40');
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
        // Reset handle color
        handleRef.current?.classList.remove('bg-[var(--accent-primary)]');
        handleRef.current?.classList.add('bg-[var(--text-muted)]/40');
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
            className="fixed inset-x-0 bottom-0 z-50 bg-[var(--bg-card)] rounded-t-3xl overflow-hidden max-h-[92vh]"
            style={{ 
              boxShadow: '0 -8px 40px rgba(0,0,0,0.4)',
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            {/* Header with macOS-style buttons */}
            <div className="sticky top-0 z-10 bg-[var(--bg-card)] border-b border-[var(--border-color)]/50">
              {/* Drag Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div ref={handleRef} className="w-12 h-1.5 rounded-full bg-[var(--text-muted)]/40 transition-colors duration-150" />
              </div>
              
              {/* macOS Traffic Light Buttons */}
              <div className="flex items-center gap-2 px-4 pb-3">
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
            </div>
            
            {/* Scrollable Content */}
            <div 
              ref={contentRef}
              className="overflow-y-auto max-h-[calc(92vh-70px)] pb-safe overscroll-contain"
            >
              {children}
            </div>
          </motion.div>
        </>
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
