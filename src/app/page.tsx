'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SidebarLayout } from '@/components/Sidebar';
import { DownloadForm } from '@/components/DownloadForm';
import { VideoPreview } from '@/components/VideoPreview';
import { HistoryList } from '@/components/HistoryList';
import { CardSkeleton } from '@/components/ui/Card';
import { Platform, MediaData, HistoryItem, detectPlatform, sanitizeUrl } from '@/lib/types';
import { MagicIcon, BoltIcon, LayersIcon, LockIcon } from '@/components/ui/Icons';
import { getWeiboCookie, clearWeiboCookie, getPlatformCookie, getCachedResponse, cacheResponse } from '@/lib/utils/storage';
import { checkRateLimit, consumeRateLimit } from '@/lib/utils/rate-limit';
import Swal from 'sweetalert2';
import Announcements from '@/components/Announcements';

// ============================================================================
// CONSTANTS
// ============================================================================

const TITLE_VARIANTS = ['Social Media', 'Facebook', 'Instagram', 'TikTok', 'Twitter', 'Weibo'];

const SWAL_CONFIG = {
  background: '#1a1a1a',
  color: '#fff',
  confirmButtonColor: '#6366f1',
};

// ============================================================================
// COMPONENTS
// ============================================================================

function AnimatedTitle() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % TITLE_VARIANTS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 h-8 sm:h-10">
      <span className="text-[var(--text-primary)]">Free </span>
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="gradient-text inline-block"
        >
          {TITLE_VARIANTS[index]}
        </motion.span>
      </AnimatePresence>
      <span className="text-[var(--text-primary)]"> Downloader</span>
    </h1>
  );
}

// ============================================================================
// ERROR HANDLERS
// ============================================================================

function showError(title: string, message: string, options?: { 
  showSettings?: boolean; 
  showAdvanced?: boolean;
  icon?: 'error' | 'warning' | 'info';
  buttonColor?: string;
}) {
  const { showSettings, showAdvanced, icon = 'error', buttonColor } = options || {};
  
  Swal.fire({
    icon,
    title,
    html: message,
    ...SWAL_CONFIG,
    confirmButtonColor: buttonColor || SWAL_CONFIG.confirmButtonColor,
    showCancelButton: showSettings || showAdvanced,
    confirmButtonText: showSettings ? '⚙️ Settings' : showAdvanced ? '🔧 Advanced' : 'OK',
    cancelButtonText: 'Close',
  }).then((result) => {
    if (result.isConfirmed) {
      if (showSettings) window.location.href = '/settings';
      if (showAdvanced) window.location.href = '/advanced';
    }
  });
}

function handleMetaError(errorMsg: string, platform: 'facebook' | 'instagram') {
  const hasCookie = !!getPlatformCookie(platform);
  const displayMsg = errorMsg.length > 100 ? errorMsg.substring(0, 100) + '...' : errorMsg;
  
  if (hasCookie) {
    showError('Extraction Failed', `
      <p style="margin-bottom: 12px;">${displayMsg}</p>
      <p style="font-size: 12px; color: #fbbf24; margin-bottom: 8px;">⚠️ Cookie is set but extraction still failed.</p>
      <p style="font-size: 11px; color: #a1a1aa;">Try: Refresh cookie, use HTML extractor in Advanced, or the post may be restricted.</p>
    `, { showAdvanced: true });
  } else {
    showError('Failed to Fetch', `
      <p style="margin-bottom: 12px;">${displayMsg}</p>
      <p style="font-size: 12px; color: #a1a1aa;">This content may be private. Add your cookie in Settings to access.</p>
    `, { showSettings: true, buttonColor: '#f59e0b' });
  }
}

export default function Home() {
  const [platform, setPlatform] = useState<Platform>('youtube');
  const [isLoading, setIsLoading] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [mediaData, setMediaData] = useState<MediaData | null>(null);

  // Fetch Weibo with cookie
  const fetchWeibo = async (url: string, cookie?: string): Promise<{ success: boolean; data?: MediaData; error?: string }> => {
    const response = await fetch('/api/weibo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, cookie }),
    });
    return response.json();
  };

  const handleSubmit = async (url: string) => {
    setIsLoading(true);
    setMediaData(null);

    const sanitizedUrl = sanitizeUrl(url);
    const detectedPlatform = detectPlatform(sanitizedUrl) || platform;

    if (detectedPlatform !== platform) {
      setPlatform(detectedPlatform);
    }

    // Check client-side cache first (1 day retention)
    const cached = getCachedResponse(sanitizedUrl);
    if (cached) {
      setMediaData({ ...cached.data, cached: true });
      setIsLoading(false);
      return;
    }

    // Rate limit check
    const rateCheck = checkRateLimit(detectedPlatform);
    if (!rateCheck.allowed) {
      setIsLoading(false);
      Swal.fire({
        icon: 'warning',
        title: 'Rate Limited',
        text: `Too many requests. Please wait ${rateCheck.resetIn}s before trying again.`,
        background: '#1a1a1a',
        color: '#fff',
        confirmButtonColor: '#6366f1',
      });
      return;
    }
    consumeRateLimit(detectedPlatform);

    try {
      // Special handling for Weibo - needs cookie
      if (detectedPlatform === 'weibo') {
        // Get user cookie from localStorage (if any)
        const userCookie = getWeiboCookie();
        
        // Try fetch - backend will use admin cookie as fallback if no user cookie
        const result = await fetchWeibo(sanitizedUrl, userCookie || undefined);
        
        if (result.success && result.data) {
          const mediaResult = { ...result.data, usedCookie: !!userCookie || result.data.usedCookie };
          setMediaData(mediaResult);
          cacheResponse(sanitizedUrl, detectedPlatform, mediaResult);
          return;
        }
        
        // Failed - check if cookie issue
        if (result.error === 'COOKIE_EXPIRED') {
          clearWeiboCookie();
        }
        
        // Cookie required but neither user nor admin has it
        if (result.error?.includes('cookie') || result.error?.includes('Cookie') || result.error === 'COOKIE_REQUIRED') {
          setIsLoading(false);
          
          const { isConfirmed } = await Swal.fire({
            icon: 'warning',
            title: 'Weibo Cookie Required',
            html: `
              <p style="margin-bottom: 8px;">Weibo requires a cookie to access videos.</p>
              <p style="font-size: 12px; color: #fbbf24; margin-bottom: 8px;">⚠️ Your previous cookie has expired or not set.</p>
              <p style="font-size: 13px; color: #a1a1aa;">Go to <b>Settings</b> → <b>Weibo</b> and paste a new guest cookie.</p>
            `,
            showCancelButton: true,
            confirmButtonText: '⚙️ Go to Settings',
            cancelButtonText: 'Cancel',
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#6366f1',
          });
          
          if (isConfirmed) {
            window.location.href = '/settings';
          }
          return;
        }
        
        throw new Error(result.error || 'Failed to fetch');
      }
      
      // Other platforms - normal flow
      const apiEndpoint = (detectedPlatform === 'facebook' || detectedPlatform === 'instagram') 
        ? 'meta' 
        : detectedPlatform;
      
      // Get platform cookie if available (for Facebook Stories, Instagram private posts)
      const platformCookie = ['facebook', 'instagram'].includes(detectedPlatform)
        ? getPlatformCookie(detectedPlatform as 'facebook' | 'instagram')
        : undefined;
      
      const response = await fetch(`/api/${apiEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sanitizedUrl, cookie: platformCookie }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch');
      }

      const mediaResult = { ...data.data, usedCookie: !!platformCookie };
      setMediaData(mediaResult);
      cacheResponse(sanitizedUrl, detectedPlatform, mediaResult);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An error occurred';
      const displayMsg = errorMsg.length > 100 ? errorMsg.substring(0, 100) + '...' : errorMsg;
      
      // Handle different error types
      if (errorMsg.includes('CHECKPOINT_REQUIRED')) {
        showError('🚫 Cookie Blocked', `
          <p style="margin-bottom: 12px;">Facebook detected unusual activity on the admin cookie.</p>
          <p style="font-size: 12px; color: #f87171; margin-bottom: 8px;">The account may be shadow banned or requires verification.</p>
          <p style="font-size: 11px; color: #a1a1aa;">Try adding your own cookie in Settings, or wait for admin to update.</p>
        `, { icon: 'warning', buttonColor: '#ef4444', showSettings: true });
      } else if (errorMsg.includes('maintenance')) {
        showError('🔧 Under Maintenance', `
          <p style="font-size: 14px; color: #fbbf24;">We're working on improvements. Check back soon!</p>
        `, { icon: 'warning', buttonColor: '#f59e0b' });
      } else if (errorMsg.includes('disabled') || errorMsg.includes('unavailable')) {
        showError('⏸️ Service Paused', `
          <p style="margin-bottom: 12px;">${displayMsg}</p>
          <p style="font-size: 12px; color: #60a5fa;">This platform is temporarily disabled by admin.</p>
        `, { icon: 'info', buttonColor: '#3b82f6' });
      } else if (detectedPlatform === 'facebook' || detectedPlatform === 'instagram') {
        handleMetaError(errorMsg, detectedPlatform);
      } else {
        showError('Failed', displayMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadComplete = (item: HistoryItem) => {
    setHistoryRefresh(prev => prev + 1);
  };

  // Batch queue handlers


  return (
    <SidebarLayout>
      <Announcements page="home" />
      <div className="py-4 px-3 sm:py-6 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          {/* Compact Hero */}
          <div className="text-center py-2 sm:py-4">
            <AnimatedTitle />
            <p className="text-xs sm:text-sm text-[var(--text-muted)] mb-3">
              Paste URL → Auto-detect → Download
            </p>
            {/* Feature badges */}
            <div className="flex flex-wrap justify-center gap-2 text-[10px] sm:text-xs">
              <span className="px-2 py-1 rounded-full bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] flex items-center gap-1">
                <MagicIcon className="w-3 h-3 text-purple-400" /> No Watermark
              </span>
              <span className="px-2 py-1 rounded-full bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] flex items-center gap-1">
                <BoltIcon className="w-3 h-3 text-yellow-400" /> Fast & Free
              </span>
              <span className="px-2 py-1 rounded-full bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] flex items-center gap-1">
                <LayersIcon className="w-3 h-3 text-blue-400" /> Multiple Qualities
              </span>
              <span className="px-2 py-1 rounded-full bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] flex items-center gap-1">
                <LockIcon className="w-3 h-3 text-green-400" /> No Login Required
              </span>
            </div>
          </div>

          {/* Download Form */}
          <DownloadForm
            platform={platform}
            onPlatformChange={setPlatform}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />

          {/* Loading */}
          <AnimatePresence>
            {isLoading && <CardSkeleton />}
          </AnimatePresence>

          {/* Preview */}
          <AnimatePresence mode="wait">
            {!isLoading && mediaData && (
              <VideoPreview
                data={mediaData}
                platform={platform}
                onDownloadComplete={handleDownloadComplete}
              />
            )}
          </AnimatePresence>

          {/* History - compact */}
          <HistoryList refreshTrigger={historyRefresh} compact />
        </div>
      </div>
    </SidebarLayout>
  );
}
