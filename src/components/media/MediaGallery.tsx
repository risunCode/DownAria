'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ChevronDown, Download, Send, Link2, Play, Heart, MessageCircle, Share2, User, Loader2, Check } from 'lucide-react';
import Image from 'next/image';
import { MediaData, MediaFormat, Platform } from '@/lib/types';
import { formatBytes } from '@/lib/utils/format-utils';
import { getProxiedThumbnail } from '@/lib/utils/thumbnail-utils';
import { getProxyUrl } from '@/lib/api/proxy';
import { RichText } from '@/lib/utils/text-parser';
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

export function MediaGallery({ data, platform, isOpen, onClose, initialIndex = 0, initialFormat = null, onDownloadComplete }: MediaGalleryProps) {
  const mode = useMediaGalleryMode();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [selectedFormat, setSelectedFormat] = useState<MediaFormat | null>(initialFormat);
  const [downloadState, setDownloadState] = useState<DownloadState>({ status: 'idle', progress: 0, speed: 0, loaded: 0, total: 0, eta: 0 });
  const [fileSizes, setFileSizes] = useState<Record<string, string>>({});
  const [discordSent, setDiscordSent] = useState<Record<string, boolean>>({}); // Track per itemId
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const loopCountRef = useRef(0);
  const MAX_LOOPS = 8; // Auto-stop after 8 loops (user might be asleep 😴)

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
    // Check isHLS flag from backend, or URL/format patterns
    return format.isHLS === true ||
           format.url.includes('.m3u8') || 
           format.url.includes('hls_playlist') ||
           format.format === 'm3u8' || 
           format.format === 'hls';
  };

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

  // Auto-select format when switching items (only if no initialFormat or user switched manually)
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
    // Only reset if index actually changed by user (not initial sync)
    if (prevIndex.current !== currentIndex && !hasInitialFormat.current) {
      setSelectedFormat(null);
      setDownloadState({ status: 'idle', progress: 0, speed: 0, loaded: 0, total: 0, eta: 0 });
      loopCountRef.current = 0; // Reset loop counter on item change
    }
    prevIndex.current = currentIndex;
    // Clear hasInitialFormat after first navigation
    if (hasInitialFormat.current) {
      hasInitialFormat.current = false;
    }
  }, [currentIndex]);

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
    
    // Check if HLS.js is supported (requires MSE - not available on iOS Safari)
    const hlsJsSupported = Hls.isSupported();
    
    // Check if native HLS is supported (Safari, iOS)
    const nativeHlsSupported = video.canPlayType('application/vnd.apple.mpegurl') !== '';

    // Use proxy for HLS playback
    const proxyUrl = getProxyUrl(selectedFormat.url, { platform, inline: true, hls: true });

    // iOS with no HLS.js support - use native HLS with rewritten playlist
    if (!hlsJsSupported && nativeHlsSupported) {
      video.src = proxyUrl;
      video.play().catch(() => {});
      return;
    }

    // Use native HLS for Safari/iOS
    if (nativeHlsSupported) {
      video.src = proxyUrl;
      video.play().catch(() => {});
      return;
    }

    // Use HLS.js for browsers that support it (Chrome, Firefox, Edge, etc.)
    if (hlsJsSupported) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        // Custom loader to proxy all segment requests
        xhrSetup: (xhr: XMLHttpRequest, url: string) => {
          // If URL is already our proxy, use as-is
          if (url.includes('/api/v1/proxy')) {
            return;
          }
          // Otherwise, proxy the URL
          const proxiedUrl = getProxyUrl(url, { platform, inline: true });
          xhr.open('GET', proxiedUrl, true);
        },
      });
      hlsRef.current = hls;
      hls.loadSource(proxyUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error('[HLS] Error:', data.type, data.details, data);
      });
    } else {
      console.error('[HLS] No HLS playback method available!');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [selectedFormat, platform]);

  // Fetch file sizes (batch + parallel) - skip for YouTube (unknown size anyway)
  useEffect(() => {
    if (!isOpen || platform === 'youtube') return;
    
    const fetchSizes = async () => {
      // Collect ALL formats from ALL items (not just current)
      const allFormats: MediaFormat[] = [];
      Object.values(groupedItems).forEach(formats => {
        formats.forEach(f => {
          if (!fileSizes[f.url]) {
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
    const proxyM3u8 = getProxyUrl(m3u8Url, { platform, inline: true, hls: true });
    const m3u8Res = await fetch(proxyM3u8);
    if (!m3u8Res.ok) {
      const errorText = await m3u8Res.text().catch(() => 'Unknown error');
      console.error('[HLS] Error response:', errorText);
      throw new Error('Failed to fetch HLS playlist');
    }
    
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
      const proxySegUrl = getProxyUrl(segUrl, { platform, inline: true });
      
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
    
    // Merge all segments into single blob (MPEG-TS segments concatenated, playable as MP4)
    return new Blob(segments as BlobPart[], { type: 'video/mp4' });
  };

  // Download handler with real-time progress (IDM-proof using Blob)
  const handleDownload = async () => {
    if (!selectedFormat) return;
    setDownloadState({ status: 'downloading', progress: 0, speed: 0, loaded: 0, total: 0, eta: 0 });

    try {
      // Generate filename
      const isHls = isHlsFormat(selectedFormat);
      let filename = generateFilename(data, platform, selectedFormat, isCarousel ? currentIndex + 1 : undefined);
      
      // For HLS, change extension to .mp4 (we merge segments into playable MP4)
      if (isHls) {
        filename = filename.replace(/\.m3u8$/i, '.mp4');
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
        const proxyUrl = getProxyUrl(selectedFormat.url, { filename, platform });
        
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

          // Update every chunk for realtime progress (throttle to 50ms for performance)
          if (now - lastUpdateTime >= 50) {
            lastUpdateTime = now;
            setDownloadState({ status: 'downloading', progress, speed, loaded, total, eta: remaining });
          }
        }
        
        // Final update to ensure 100%
        setDownloadState({ status: 'downloading', progress: 100, speed: 0, loaded, total, eta: 0 });

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
      <div className="relative w-full aspect-video max-h-[45vh] bg-black rounded-lg overflow-hidden">
        {selectedFormat?.type === 'video' ? (
          isHlsFormat(selectedFormat) ? (
            <video
              ref={videoRef}
              poster={currentThumbnail ? getProxiedThumbnail(currentThumbnail, platform) : undefined}
              className="w-full h-full object-contain"
              controls
              autoPlay
              playsInline
              onEnded={handleVideoEnded}
            />
          ) : (
            <video
              ref={videoRef}
              src={getProxyUrl(selectedFormat.url, { platform, inline: true })}
              poster={currentThumbnail ? getProxiedThumbnail(currentThumbnail, platform) : undefined}
              className="w-full h-full object-contain"
              controls
              autoPlay
              playsInline
              onEnded={handleVideoEnded}
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
              {/* Audio Element - YouTube direct, others proxied */}
              <audio
                src={platform === 'youtube' ? selectedFormat.url : getProxyUrl(selectedFormat.url, { platform, inline: true })}
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
                {/* Index number badge */}
                <div className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">
                  {idx + 1}
                </div>
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
        {data.engagement && (
          <div className="flex flex-wrap gap-3 text-xs text-[var(--text-muted)]">
            {data.engagement.likes !== undefined && <span className="flex items-center gap-1 text-red-400"><Heart className="w-3 h-3" />{formatNumber(data.engagement.likes)}</span>}
            {data.engagement.comments !== undefined && <span className="flex items-center gap-1 text-blue-400"><MessageCircle className="w-3 h-3" />{formatNumber(data.engagement.comments)}</span>}
            {data.engagement.shares !== undefined && <span className="flex items-center gap-1 text-green-400"><Share2 className="w-3 h-3" />{formatNumber(data.engagement.shares)}</span>}
          </div>
        )}

        {/* Caption - truncated with expand */}
        {data.title && (
          <span className="block text-sm text-[var(--text-secondary)] line-clamp-2" title={data.title}>
            <RichText text={data.title} platform={platform} />
          </span>
        )}

        {/* Quality Selector - Pills with size (hide if only one format with generic name) */}
        {!(currentFormats.length === 1 && currentFormats[0].quality.toLowerCase().startsWith('image')) && (
          <div className="flex flex-wrap gap-2">
            {currentFormats.map((format, idx) => {
              // For carousel images, show cleaner label
              const isGenericImage = format.quality.toLowerCase().startsWith('image');
              const displayQuality = isGenericImage ? (format.type === 'video' ? 'Video' : 'Original') : format.quality;
              
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedFormat(format)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedFormat === format
                      ? 'bg-[var(--accent-primary)] text-white'
                      : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-[var(--bg-card)]'
                  }`}
                >
                  {displayQuality}
                  {fileSizes[format.url] && <span className="ml-1 opacity-70">({fileSizes[format.url]})</span>}
                </button>
              );
            })}
          </div>
        )}

      </div>
    </>
  );

  // Action buttons - rendered in sticky footer
  const actionButtons = (
    <div className="p-4 space-y-3 border-t border-[var(--border-color)]/50 bg-[var(--bg-card)]">
      {/* Actions */}
      <div className="flex gap-2">
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
  );

  // Render based on mode
  return mode === 'fullscreen' ? (
    <FullscreenWrapper isOpen={isOpen} onClose={onClose} footer={actionButtons}>{content}</FullscreenWrapper>
  ) : (
    <ModalWrapper isOpen={isOpen} onClose={onClose} footer={actionButtons}>{content}</ModalWrapper>
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
            
            {/* Scrollable Content */}
            <div 
              ref={contentRef}
              className="overflow-y-auto flex-1 min-h-0 pb-safe overscroll-contain"
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
