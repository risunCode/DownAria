'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { SidebarLayout } from '@/components/Sidebar';
import { DownloadForm } from '@/components/DownloadForm';
import { DownloadPreview } from '@/components/DownloadPreview';
import { HistoryList } from '@/components/HistoryList';

import { CardSkeleton } from '@/components/ui/Card';
import { MagicIcon, BoltIcon, LayersIcon, LockIcon } from '@/components/ui/Icons';
import { MaintenanceMode } from '@/components/MaintenanceMode';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import CompactAdDisplay from '@/components/CompactAdDisplay';
import { useMaintenanceStatus } from '@/hooks/useMaintenanceStatus';
import { useStatus } from '@/hooks/useStatus';
import { PlatformId, MediaData } from '@/lib/types';

import { getPlatformCookie, clearPlatformCookie, getSkipCache } from '@/lib/storage';
import { platformDetect, sanitizeUrl } from '@/lib/utils/format';
import Swal from 'sweetalert2';
import { analyzeNetworkError, isOnline } from '@/lib/utils/network';
import { fetchMediaWithCache } from '@/hooks/useScraperCache';

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
    text: message,
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

  const message = !status.online
    ? `${status.suggestion} Check your WiFi or mobile data connection.`
    : status.suggestion;

  showError(`${iconMap[status.type]} ${status.message}`, message, {
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
    showError('Extraction Failed', `${displayMsg} ⚠️ Cookie is set but extraction still failed. Try: Refresh cookie, use HTML extractor in Advanced, or the post may be restricted.`, { showAdvanced: true });
  } else {
    showError('Failed to Fetch', `${displayMsg} This content may be private. Add your cookie in Settings to access.`, { showSettings: true, buttonColor: '#f59e0b' });
  }
}

export default function Home() {
  const [platform, setPlatform] = useState<PlatformId>('facebook');
  const [isLoading, setIsLoading] = useState(false);

  const [mediaData, setMediaData] = useState<MediaData | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const t = useTranslations('home');
  const tErrors = useTranslations('errors');

  // Check maintenance status
  const { isFullMaintenance, message: maintenanceMessage } = useMaintenanceStatus();
  
  // Get platform status
  const { platforms: platformStatus } = useStatus();

  // Show maintenance page if full maintenance is active
  if (isFullMaintenance) {
    return <MaintenanceMode message={maintenanceMessage} />;
  }

  // Unified fetch for all platforms using client-side cache
  const fetchMedia = async (url: string, cookie?: string): Promise<{ success: boolean; data?: MediaData; error?: string; errorCode?: string; fromCache?: boolean }> => {
    const skipCache = getSkipCache();
    return fetchMediaWithCache(url, cookie, skipCache);
  };

  const handleDownloadComplete = () => {
    setHistoryRefresh(prev => prev + 1);
  };


  const handleSubmit = async (url: string) => {
    setIsLoading(true);
    setMediaData(null);

    const sanitizedUrl = sanitizeUrl(url);
    const detectedPlatform = platformDetect(sanitizedUrl) || platform;

    if (detectedPlatform !== platform) {
      setPlatform(detectedPlatform);
    }

    // Check if platform is enabled
    const platformInfo = platformStatus.find(p => p.id === detectedPlatform);
    if (platformInfo && !platformInfo.enabled) {
      setIsLoading(false);
      showError('🔧 Platform Offline', `${platformInfo.name} is temporarily unavailable. Please try again later.`, { icon: 'warning' });
      return;
    }

    // Rate limiting handled by server API
    // Client-side caching moved to IndexedDB (handled by HistoryList)

    try {
      // Get platform cookie if available
      let platformCookie: string | undefined;
      if (detectedPlatform === 'weibo') {
        platformCookie = getPlatformCookie('weibo') || undefined;
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
          clearPlatformCookie('weibo');
        }

        if (result.error?.includes('cookie') || result.error?.includes('Cookie') || result.error === 'COOKIE_REQUIRED') {
          setIsLoading(false);

          const { isConfirmed } = await Swal.fire({
            icon: 'warning',
            title: tErrors('weiboCookie.title'),
            text: `${tErrors('weiboCookie.message')} ${tErrors('weiboCookie.expired')} ${tErrors('weiboCookie.hint')}`,
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

      // Handle specific error codes from backend
      const errorCode = result.errorCode;
      const errorMessage = result.error || 'Failed to fetch';

      // Map error codes to user-friendly messages
      if (errorCode) {
        switch (errorCode) {
          case 'MAINTENANCE':
            showError('🔧 Under Maintenance', errorMessage || 'Service is under maintenance. Please try again later.', { icon: 'warning' });
            return;
          case 'PLATFORM_DISABLED':
            showError('🔧 Platform Offline', errorMessage || 'This platform is temporarily unavailable. Please try again later.', { icon: 'warning' });
            return;
          case 'PRIVATE_CONTENT':
          case 'COOKIE_REQUIRED':
          case 'AGE_RESTRICTED':
            showError('🔒 Login Required', 'This content is private or requires login. Add your cookie in Settings to access.', { showSettings: true, buttonColor: '#f59e0b' });
            return;
          case 'COOKIE_EXPIRED':
            showError('⏰ Admin Cookie Issue', 'Admin cookie sedang bermasalah (perlu verifikasi). Coba gunakan cookie pribadimu di Settings.', { showSettings: true, buttonColor: '#f59e0b' });
            return;
          case 'COOKIE_BANNED':
          case 'CHECKPOINT_REQUIRED':
            showError('🚫 Account Issue', 'The account requires verification or has been restricted. Try using a different cookie.', { showSettings: true, buttonColor: '#ef4444' });
            return;
          case 'NOT_FOUND':
          case 'DELETED':
          case 'CONTENT_REMOVED':
            showError('❌ Content Not Found', 'This content may have been deleted or removed.', { icon: 'error' });
            return;
          case 'NO_MEDIA':
            showError('📭 No Media', 'No downloadable media found in this post.', { icon: 'info' });
            return;
          case 'GEO_BLOCKED':
            showError('🌍 Region Blocked', 'This content is not available in your region.', { icon: 'warning' });
            return;
          case 'RATE_LIMITED':
            showError('⏳ Slow Down!', 'Too many requests. Please wait a moment and try again.', { icon: 'warning', buttonColor: '#f59e0b' });
            return;
          case 'BLOCKED':
            showError('🚫 Blocked', 'Request was blocked by the platform. Try again later.', { icon: 'error' });
            return;
        }
      }

      throw new Error(errorMessage);
    } catch (error) {
      // Get error details - check if it's from API response
      const errorMsg = error instanceof Error ? error.message : 'An error occurred';
      const displayMsg = errorMsg.length > 100 ? errorMsg.substring(0, 100) + '...' : errorMsg;

      // Check for AbortError (our timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutMsg = detectedPlatform === 'youtube'
          ? 'The server is taking too long to respond. YouTube extraction can be slow for some videos. Try again - the result may be cached now.'
          : 'The server is taking too long to respond. This might be a temporary issue. Try again - the result may be cached now.';
        showError('⏱️ Request Timeout', timeoutMsg, { icon: 'warning', buttonColor: '#6366f1', showRetry: true, onRetry: () => handleSubmit(url) });
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
        const extractionMsg = detectedPlatform === 'youtube'
          ? 'YouTube video extraction timed out. Some videos take longer to process. Try again - the result may be cached now.'
          : 'The extraction process timed out. Some videos take longer to process. Try again - the result may be cached now.';
        showError('⏱️ Extraction Timeout', extractionMsg, { icon: 'warning', buttonColor: '#6366f1', showRetry: true, onRetry: () => handleSubmit(url) });
        return;
      }

      // Handle rate limit errors
      if (errorMsg.includes('Rate limit') || errorMsg.includes('rate limit') || errorMsg.includes('429')) {
        const resetMatch = errorMsg.match(/(\d+)s/);
        const resetIn = resetMatch ? parseInt(resetMatch[1]) : 60;

        showError('⏳ Slow Down!', `Whoops, calm down bro! You've made too many requests. Please wait ${resetIn} seconds. Rate limiting helps keep the service fast for everyone.`, { icon: 'warning', buttonColor: '#f59e0b' });
        return;
      }

      // Handle different error types
      if (errorMsg.includes('CHECKPOINT_REQUIRED')) {
        showError('🚫 Cookie Blocked', 'Facebook detected unusual activity on the admin cookie. The account may be shadow banned or requires verification. Try adding your own cookie in Settings, or wait for admin to update.', { icon: 'warning', buttonColor: '#ef4444', showSettings: true });
      } else if (errorMsg.includes('maintenance')) {
        showError('🔧 Under Maintenance', 'We\'re working on improvements. Check back soon!', { icon: 'warning', buttonColor: '#f59e0b' });
      } else if (errorMsg.includes('disabled') || errorMsg.includes('unavailable')) {
        showError('⏸️ Service Paused', displayMsg, { icon: 'info', buttonColor: '#3b82f6' });
      } else if (errorMsg.includes('Unauthorized origin')) {
        showError('🚫 Unauthorized', 'Request blocked. Please try again or contact support.', { icon: 'error' });
      } else {
        showError('❌ Failed', displayMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };



  // Batch queue handlers


  return (
    <SidebarLayout>
      <div className="py-4 px-3 sm:py-6 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          {/* Announcements */}
          <AnnouncementBanner page="home" />

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

          {/* Compact Ad - Below Input (always visible) */}
          <CompactAdDisplay placement="home-input" maxAds={1} />

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

          {/* Download History */}
          <div className="mt-8">
            <HistoryList refreshTrigger={historyRefresh} compact />
          </div>


          {/* Compact Ads - Bottom of page */}
          <CompactAdDisplay placement="home-bottom" maxAds={3} className="mt-6" />
        </div>
      </div>
    </SidebarLayout>
  );
}
