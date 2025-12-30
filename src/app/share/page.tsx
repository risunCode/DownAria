'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import { useTranslations } from 'next-intl';
import { SidebarLayout } from '@/components/Sidebar';
import { DownloadForm } from '@/components/DownloadForm';
import { DownloadPreview } from '@/components/DownloadPreview';
import { CardSkeleton } from '@/components/ui/Card';
import { PlatformId, MediaData } from '@/lib/types';
import type { HistoryEntry } from '@/lib/storage';
import { getPlatformCookie, getSkipCache } from '@/lib/storage';
import { platformDetect, sanitizeUrl } from '@/lib/utils/format';
import { fetchMediaWithCache } from '@/hooks/useScraperCache';
import { useStatus } from '@/hooks/useStatus';

function ShareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('share');
  const tErrors = useTranslations('errors');

  const [platform, setPlatform] = useState<PlatformId>('facebook');
  const [isLoading, setIsLoading] = useState(false);
  const [mediaData, setMediaData] = useState<MediaData | null>(null);
  const [sharedUrl, setSharedUrl] = useState<string>('');
  const [autoFetched, setAutoFetched] = useState(false);
  
  // Get platform status
  const { platforms: platformStatus } = useStatus();

  // Extract URL from share params
  useEffect(() => {
    // Priority: url > text (might contain URL) > title
    const url = searchParams.get('url');
    const text = searchParams.get('text');
    const title = searchParams.get('title');

    // Try to extract URL from params
    let extractedUrl = '';

    if (url) {
      extractedUrl = url;
    } else if (text) {
      // Text might contain URL - extract it
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        extractedUrl = urlMatch[0];
      }
    } else if (title) {
      // Sometimes URL is in title
      const urlMatch = title.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        extractedUrl = urlMatch[0];
      }
    }

    if (extractedUrl) {
      setSharedUrl(extractedUrl);
      const detected = platformDetect(extractedUrl);
      if (detected) {
        setPlatform(detected);
      }
    }
  }, [searchParams]);

  // Auto-fetch when URL is detected
  useEffect(() => {
    if (sharedUrl && !autoFetched && !isLoading && !mediaData) {
      setAutoFetched(true);
      handleSubmit(sharedUrl);
    }
  }, [sharedUrl, autoFetched, isLoading, mediaData]);

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
      Swal.fire({
        icon: 'warning',
        title: '🔧 Platform Offline',
        text: `${platformInfo.name} is temporarily unavailable. Please try again later.`,
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        confirmButtonColor: 'var(--accent-primary)',
      });
      return;
    }

    try {
      // Get platform cookie if available
      let platformCookie: string | undefined;
      if (detectedPlatform === 'weibo') {
        platformCookie = getPlatformCookie('weibo') || undefined;
      } else if (['facebook', 'instagram'].includes(detectedPlatform)) {
        platformCookie = getPlatformCookie(detectedPlatform as 'facebook' | 'instagram') || undefined;
      }

      // Use cached scraper
      const skipCache = getSkipCache();
      const result = await fetchMediaWithCache(sanitizedUrl, platformCookie, skipCache);

      if (!result.success) {
        // Handle Weibo cookie error
        if (detectedPlatform === 'weibo' && (result.error?.includes('cookie') || result.error?.includes('Cookie'))) {
          setIsLoading(false);
          Swal.fire({
            icon: 'warning',
            title: tErrors('weiboCookie.title'),
            text: tErrors('weiboCookie.hint'),
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            confirmButtonColor: 'var(--accent-primary)',
          });
          return;
        }
        throw new Error(result.error || tErrors('fetchFailed'));
      }

      setMediaData(result.data || null);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : t('error');
      Swal.fire({
        icon: 'error',
        title: t('failed'),
        text: errorMsg.length > 100 ? errorMsg.substring(0, 100) + '...' : errorMsg,
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        confirmButtonColor: 'var(--accent-primary)',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadComplete = (_entry: HistoryEntry) => {
    // Optional: redirect to home after download
  };

  return (
    <SidebarLayout>
      <div className="py-4 px-3 sm:py-6 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="text-center py-2 sm:py-4">
            <h1 className="text-xl sm:text-2xl font-bold gradient-text mb-1">
              {t('title')}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              {sharedUrl ? t('processing') : t('noUrl')}
            </p>
          </div>

          {/* Download Form - pre-filled with shared URL */}
          <DownloadForm
            platform={platform}
            onPlatformChange={setPlatform}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            initialUrl={sharedUrl}
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

          {/* Back to Home */}
          <div className="text-center">
            <button
              onClick={() => router.push('/')}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              {t('backToHome')}
            </button>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={
      <SidebarLayout>
        <div className="py-4 px-3 sm:py-6 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <CardSkeleton />
          </div>
        </div>
      </SidebarLayout>
    }>
      <ShareContent />
    </Suspense>
  );
}
