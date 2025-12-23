'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { SidebarLayout } from '@/components/Sidebar';
import { DownloadForm } from '@/components/DownloadForm';
import { DownloadPreview } from '@/components/DownloadPreview';
import { HistoryList } from '@/components/HistoryList';
import { CardSkeleton } from '@/components/ui/Card';
import { MagicIcon, BoltIcon, LayersIcon, LockIcon } from '@/components/ui/Icons';
import { PlatformId, MediaData } from '@/lib/types';
import type { HistoryEntry } from '@/lib/storage';
import { getWeiboCookie, clearWeiboCookie, getPlatformCookie } from '@/lib/storage';
import { detectPlatform, sanitizeUrl } from '@/lib/utils/format';
import Swal from 'sweetalert2';
import Announcements from '@/components/Announcements';
import { AdBannerCard } from '@/components/AdBannerCard';
import { analyzeNetworkError, isOnline } from '@/lib/utils/network';

// ============================================================================
// CONSTANTS
// ============================================================================

const TITLE_VARIANTS = ['Social Media', 'Facebook', 'Instagram', 'TikTok', 'Twitter', 'Weibo'];

const SWAL_CONFIG = {
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  confirmButtonColor: 'var(--accent-primary)',
};

// ============================================================================
// COMPONENTS
// ============================================================================

function AnimatedTitle() {
  const [index, setIndex] = useState(0);
  const t = useTranslations('home');

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % TITLE_VARIANTS.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 h-8 sm:h-10">
      <span className="text-[var(--text-primary)]">{t('titlePrefix')} </span>
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
      <span className="text-[var(--text-primary)]"> {t('titleSuffix')}</span>
    </h1>
  );
}

// ============================================================================
// ERROR HANDLERS
// ============================================================================

function showError(title: string, message: string, options?: {
  showSettings?: boolean;
  showAdvanced?: boolean;
  showRetry?: boolean;
  onRetry?: () => void;
  icon?: 'error' | 'warning' | 'info';
  buttonColor?: string;
}) {
  const { showSettings, showAdvanced, showRetry, onRetry, icon = 'error', buttonColor } = options || {};

  Swal.fire({
    icon,
    title,
    html: message,
    ...SWAL_CONFIG,
    confirmButtonColor: buttonColor || SWAL_CONFIG.confirmButtonColor,
    showCancelButton: showSettings || showAdvanced || showRetry,
    confirmButtonText: showSettings ? '⚙️ Settings' : showAdvanced ? '🔧 Advanced' : showRetry ? '🔄 Retry' : 'OK',
    cancelButtonText: 'Close',
  }).then((result) => {
    if (result.isConfirmed) {
      if (showSettings) window.location.href = '/settings';
      if (showAdvanced) window.location.href = '/advanced';
      if (showRetry && onRetry) onRetry();
    }
  });
}

function showNetworkError(error: unknown, onRetry?: () => void) {
  const status = analyzeNetworkError(error);
  
  const iconMap = {
    'offline': '📡',
    'timeout': '⏱️',
    'server-error': '🔧',
    'cors': '🚫',
    'unknown': '❌',
  };

  showError(`${iconMap[status.type]} ${status.message}`, `
    <p style="margin-bottom: 12px; font-size: 14px;">${status.suggestion}</p>
    ${!status.online ? '<p style="font-size: 12px; color: #f87171;">Check your WiFi or mobile data connection.</p>' : ''}
  `, { 
    icon: status.type === 'server-error' ? 'warning' : 'error',
    buttonColor: '#6366f1',
    showRetry: true,
    onRetry,
  });
}

function handleMetaError(errorMsg: string, platform: 'facebook' | 'instagram') {
  const hasCookie = !!getPlatformCookie(platform);
  const displayMsg = errorMsg.length > 100 ? errorMsg.substring(0, 100) + '...' : errorMsg;

  if (hasCookie) {
    showError('Extraction Failed', `
      <p style="margin-bottom: 12px;">${displayMsg}</p>
      <p style="font-size: 12px; color: #facc15; margin-bottom: 8px;">⚠️ Cookie is set but extraction still failed.</p>
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
  const [platform, setPlatform] = useState<PlatformId>('facebook');
  const [isLoading, setIsLoading] = useState(false);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [mediaData, setMediaData] = useState<MediaData | null>(null);
  const t = useTranslations('home');
  const tErrors = useTranslations('errors');

  // API URL from environment
  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

  // Unified fetch for all platforms
  const fetchMedia = async (url: string, cookie?: string): Promise<{ success: boolean; data?: MediaData; error?: string; platform?: string }> => {
    // Check if skip cache is enabled in settings
    const { getSkipCache } = await import('@/lib/storage');
    const skipCache = getSkipCache();
    
    // Use AbortController with 120s timeout (backend yt-dlp has 90s timeout)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    
    try {
      const response = await fetch(`${API_URL}/api/v1/publicservices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, cookie, skipCache }),
        signal: controller.signal,
      });
      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleSubmit = async (url: string) => {
    setIsLoading(true);
    setMediaData(null);

    const sanitizedUrl = sanitizeUrl(url);
    const detectedPlatform = detectPlatform(sanitizedUrl) || platform;

    if (detectedPlatform !== platform) {
      setPlatform(detectedPlatform);
    }

    // Rate limiting handled by server API
    // Client-side caching moved to IndexedDB (handled by HistoryList)

    try {
      // Get platform cookie if available
      let platformCookie: string | undefined;
      if (detectedPlatform === 'weibo') {
        platformCookie = getWeiboCookie() || undefined;
      } else if (['facebook', 'instagram'].includes(detectedPlatform)) {
        platformCookie = getPlatformCookie(detectedPlatform as 'facebook' | 'instagram') || undefined;
      }

      // Unified API call for all platforms
      const result = await fetchMedia(sanitizedUrl, platformCookie);

      if (result.success && result.data) {
        // Use usedCookie from API response - scraper knows if cookie was actually used
        const mediaResult = { ...result.data, usedCookie: result.data.usedCookie === true };
        setMediaData(mediaResult);
        // Caching handled by IndexedDB when download completes
        return;
      }

      // Handle Weibo cookie errors
      if (detectedPlatform === 'weibo') {
        if (result.error === 'COOKIE_EXPIRED') {
          clearWeiboCookie();
        }

        if (result.error?.includes('cookie') || result.error?.includes('Cookie') || result.error === 'COOKIE_REQUIRED') {
          setIsLoading(false);

          const { isConfirmed } = await Swal.fire({
            icon: 'warning',
            title: tErrors('weiboCookie.title'),
            html: `
              <p style="margin-bottom: 8px;">${tErrors('weiboCookie.message')}</p>
              <p style="font-size: 12px; color: #facc15; margin-bottom: 8px;">${tErrors('weiboCookie.expired')}</p>
              <p style="font-size: 13px; color: #a1a1aa;">${tErrors('weiboCookie.hint')}</p>
            `,
            showCancelButton: true,
            confirmButtonText: tErrors('weiboCookie.goToSettings'),
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
      }

      throw new Error(result.error || 'Failed to fetch');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An error occurred';
      const displayMsg = errorMsg.length > 100 ? errorMsg.substring(0, 100) + '...' : errorMsg;

      // Check for AbortError (our timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        showError('⏱️ Request Timeout', `
          <p style="margin-bottom: 12px; font-size: 14px;">The server is taking too long to respond.</p>
          <p style="font-size: 13px; color: #facc15; margin-bottom: 8px;">${detectedPlatform === 'youtube' ? 'YouTube extraction can be slow for some videos.' : 'This might be a temporary issue.'}</p>
          <p style="font-size: 11px; color: #a1a1aa;">Try again - the result may be cached now.</p>
        `, { icon: 'warning', buttonColor: '#6366f1', showRetry: true, onRetry: () => handleSubmit(url) });
        return;
      }

      // Check for network errors FIRST (offline, timeout, server unreachable)
      const networkStatus = analyzeNetworkError(error);
      if (networkStatus.type === 'offline' || networkStatus.type === 'timeout' || 
          errorMsg.toLowerCase().includes('failed to fetch') || !isOnline()) {
        showNetworkError(error, () => handleSubmit(url));
        return;
      }

      // Handle YouTube extraction timeout from backend
      if (errorMsg.includes('timed out') || errorMsg.includes('timeout')) {
        showError('⏱️ Extraction Timeout', `
          <p style="margin-bottom: 12px; font-size: 14px;">${detectedPlatform === 'youtube' ? 'YouTube video extraction timed out.' : 'The extraction process timed out.'}</p>
          <p style="font-size: 13px; color: #facc15; margin-bottom: 8px;">Some videos take longer to process.</p>
          <p style="font-size: 11px; color: #a1a1aa;">Try again - the result may be cached now.</p>
        `, { icon: 'warning', buttonColor: '#6366f1', showRetry: true, onRetry: () => handleSubmit(url) });
        return;
      }

      // Handle rate limit errors
      if (errorMsg.includes('Rate limit') || errorMsg.includes('rate limit') || errorMsg.includes('429')) {
        const resetMatch = errorMsg.match(/(\d+)s/);
        const resetIn = resetMatch ? parseInt(resetMatch[1]) : 60;
        
        showError('⏳ Slow Down!', `
          <p style="margin-bottom: 12px; font-size: 14px;">Whoops, calm down bro!</p>
          <p style="font-size: 13px; color: #facc15; margin-bottom: 8px;">You've made too many requests.</p>
          <p style="font-size: 16px; font-weight: bold; color: #f87171;">Please wait ${resetIn} seconds</p>
          <p style="font-size: 11px; color: #a1a1aa; margin-top: 8px;">Rate limiting helps keep the service fast for everyone.</p>
        `, { icon: 'warning', buttonColor: '#f59e0b' });
        return;
      }

      // Handle different error types
      if (errorMsg.includes('CHECKPOINT_REQUIRED')) {
        showError('🚫 Cookie Blocked', `
          <p style="margin-bottom: 12px;">Facebook detected unusual activity on the admin cookie.</p>
          <p style="font-size: 12px; color: #f87171; margin-bottom: 8px;">The account may be shadow banned or requires verification.</p>
          <p style="font-size: 11px; color: #a1a1aa;">Try adding your own cookie in Settings, or wait for admin to update.</p>
        `, { icon: 'warning', buttonColor: '#ef4444', showSettings: true });
      } else if (errorMsg.includes('maintenance')) {
        showError('🔧 Under Maintenance', `
          <p style="font-size: 14px; color: #facc15;">We're working on improvements. Check back soon!</p>
        `, { icon: 'warning', buttonColor: '#f59e0b' });
      } else if (errorMsg.includes('disabled') || errorMsg.includes('unavailable')) {
        showError('⏸️ Service Paused', `
          <p style="margin-bottom: 12px;">${displayMsg}</p>
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

  const handleDownloadComplete = (_entry: HistoryEntry) => {
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
              {t('subtitle')}
            </p>
            {/* Feature badges */}
            <div className="flex flex-wrap justify-center gap-2 text-[10px] sm:text-xs">
              <span className="px-2 py-1 rounded-full bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] flex items-center gap-1">
                <MagicIcon className="w-3 h-3 text-purple-400" /> {t('badges.noWatermark')}
              </span>
              <span className="px-2 py-1 rounded-full bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] flex items-center gap-1">
                <BoltIcon className="w-3 h-3 text-yellow-400" /> {t('badges.fastFree')}
              </span>
              <span className="px-2 py-1 rounded-full bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] flex items-center gap-1">
                <LayersIcon className="w-3 h-3 text-blue-400" /> {t('badges.multiQuality')}
              </span>
              <span className="px-2 py-1 rounded-full bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-color)] flex items-center gap-1">
                <LockIcon className="w-3 h-3 text-green-400" /> {t('badges.noLogin')}
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
              <DownloadPreview
                data={mediaData}
                platform={platform}
                onDownloadComplete={handleDownloadComplete}
              />
            )}
          </AnimatePresence>

          {/* Ad Banner */}
          <AdBannerCard />

          {/* History - compact */}
          <HistoryList refreshTrigger={historyRefresh} compact />
        </div>
      </div>
    </SidebarLayout>
  );
}
