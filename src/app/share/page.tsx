'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { SidebarLayout } from '@/components/Sidebar';
import { DownloadForm } from '@/components/DownloadForm';
import { VideoPreview } from '@/components/VideoPreview';
import { CardSkeleton } from '@/components/ui/Card';
import { Platform, MediaData, HistoryItem, detectPlatform, sanitizeUrl } from '@/lib/types';
import { getPlatformCookie, getWeiboCookie } from '@/lib/utils/storage';
import { AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';

function ShareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [platform, setPlatform] = useState<Platform>('youtube');
  const [isLoading, setIsLoading] = useState(false);
  const [mediaData, setMediaData] = useState<MediaData | null>(null);
  const [sharedUrl, setSharedUrl] = useState<string>('');
  const [autoFetched, setAutoFetched] = useState(false);

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
      const detected = detectPlatform(extractedUrl);
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
    const detectedPlatform = detectPlatform(sanitizedUrl) || platform;

    if (detectedPlatform !== platform) {
      setPlatform(detectedPlatform);
    }

    try {
      // Special handling for Weibo
      if (detectedPlatform === 'weibo') {
        const cookie = getWeiboCookie();
        if (!cookie) {
          setIsLoading(false);
          Swal.fire({
            icon: 'warning',
            title: 'Weibo Cookie Required',
            text: 'Go to Settings to add Weibo cookie first.',
            background: '#1a1a1a',
            color: '#fff',
            confirmButtonColor: '#6366f1',
          });
          return;
        }
        
        const response = await fetch('/api/weibo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: sanitizedUrl, cookie }),
        });
        const data = await response.json();
        
        if (data.success && data.data) {
          setMediaData(data.data);
          return;
        }
        throw new Error(data.error || 'Failed to fetch');
      }
      
      // Other platforms
      const apiEndpoint = (detectedPlatform === 'facebook' || detectedPlatform === 'instagram') 
        ? 'meta' 
        : detectedPlatform;
      
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

      setMediaData(data.data);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An error occurred';
      Swal.fire({
        icon: 'error',
        title: 'Failed',
        text: errorMsg.length > 100 ? errorMsg.substring(0, 100) + '...' : errorMsg,
        background: '#1a1a1a',
        color: '#fff',
        confirmButtonColor: '#6366f1',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadComplete = (item: HistoryItem) => {
    // Optional: redirect to home after download
  };

  return (
    <SidebarLayout>
      <div className="py-4 px-3 sm:py-6 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="text-center py-2 sm:py-4">
            <h1 className="text-xl sm:text-2xl font-bold gradient-text mb-1">
              Shared Content
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-muted)]">
              {sharedUrl ? 'Processing shared URL...' : 'No URL detected from share'}
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
              <VideoPreview
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
              ← Back to Home
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
