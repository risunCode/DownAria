'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUpdatePrompt } from '@/hooks';

interface UpdatePromptSettings {
  enabled: boolean;
  mode: 'always' | 'once' | 'session';
  delay_seconds: number;
  dismissable: boolean;
  custom_message: string;
}

const DEFAULT_SETTINGS: UpdatePromptSettings = {
  enabled: true,
  mode: 'always',
  delay_seconds: 0,
  dismissable: true,
  custom_message: '',
};

const STORAGE_KEY = 'xtf_update_dismissed';

/**
 * Force clear all caches and reload
 * Can be called from console: window.forceRefresh()
 */
export async function forceRefresh(): Promise<void> {
  if (process.env.NODE_ENV === 'development') console.log('[PWA] Force refreshing...');

  // 1. Clear all caches
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    if (process.env.NODE_ENV === 'development') console.log('[PWA] Cleared caches:', cacheNames);
  }

  // 2. Unregister service worker
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(reg => reg.unregister()));
    if (process.env.NODE_ENV === 'development') console.log('[PWA] Unregistered service workers');
  }

  // 3. Clear localStorage cache keys (keep user settings)
  const keysToRemove = Object.keys(localStorage).filter(k =>
    k.startsWith('cache_') || k.startsWith('xtf_cache_')
  );
  keysToRemove.forEach(k => localStorage.removeItem(k));

  // 4. Hard reload
  window.location.reload();
}

// Expose to window for debugging
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).forceRefresh = forceRefresh;
}

export function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [settings, setSettings] = useState<UpdatePromptSettings>(DEFAULT_SETTINGS);

  // Use SWR for settings (cached, deduplicated)
  const { behavior } = useUpdatePrompt();

  // Check if prompt should be shown based on mode
  const shouldShowPrompt = useCallback((mode: UpdatePromptSettings['mode']): boolean => {
    if (mode === 'always') return true;

    if (mode === 'once') {
      // Check localStorage - if dismissed, never show again
      const dismissed = localStorage.getItem(STORAGE_KEY);
      return dismissed !== 'forever';
    }

    if (mode === 'session') {
      // Check sessionStorage - if dismissed this session, don't show
      const dismissed = sessionStorage.getItem(STORAGE_KEY);
      return dismissed !== 'session';
    }

    return true;
  }, []);

  // Sync SWR data to local settings
  useEffect(() => {
    if (behavior) {
      setSettings(prev => ({
        ...prev,
        mode: behavior === 'auto' ? 'always' : behavior === 'silent' ? 'session' : 'always',
        enabled: behavior !== 'silent',
      }));
    }
  }, [behavior]);

  // Show prompt when update available (with delay and mode check)
  useEffect(() => {
    if (!updateAvailable || !settings.enabled) return;

    if (!shouldShowPrompt(settings.mode)) {
      if (process.env.NODE_ENV === 'development') console.log('[PWA] Update prompt dismissed by user preference');
      return;
    }

    const delay = (settings.delay_seconds || 0) * 1000;
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [updateAvailable, settings, shouldShowPrompt]);

  useEffect(() => {
    // Track online/offline status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);

    // Register service worker
    let updateInterval: NodeJS.Timeout | null = null;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' }) // Always check for SW updates
        .then((registration) => {
          if (process.env.NODE_ENV === 'development') console.log('[PWA] Service Worker registered');

          // Force check for updates immediately on page load
          registration.update();

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available
                  setUpdateAvailable(true);
                  if (process.env.NODE_ENV === 'development') console.log('[PWA] New version available');
                }
              });
            }
          });

          // Check for updates periodically (every 5 min instead of 30)
          updateInterval = setInterval(() => {
            registration.update();
          }, 5 * 60 * 1000);
        })
        .catch((error) => {
          console.error('[PWA] SW registration failed:', error);
        });

      // Handle controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // Reload to get new version
        window.location.reload();
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (updateInterval) clearInterval(updateInterval);
    };
  }, []);

  // Update prompt
  const handleUpdate = () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('skipWaiting');
    }
  };

  // Dismiss handler based on mode
  const handleDismiss = () => {
    if (settings.mode === 'once') {
      localStorage.setItem(STORAGE_KEY, 'forever');
    } else if (settings.mode === 'session') {
      sessionStorage.setItem(STORAGE_KEY, 'session');
    }
    setShowPrompt(false);
  };

  const promptMessage = settings.custom_message || 'Refresh to get the latest features.';

  return (
    <>
      {/* Offline indicator */}
      {isOffline && (
        <div className="fixed bottom-4 left-4 z-50 px-4 py-2 rounded-lg bg-yellow-500/90 text-black text-sm font-medium shadow-lg flex items-center gap-2 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-yellow-800 animate-pulse" />
          Offline Mode
        </div>
      )}

      {/* Update available prompt */}
      {showPrompt && (
        <div className="fixed bottom-4 right-4 z-50 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--accent-primary)] shadow-xl animate-fade-in max-w-xs">
          <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
            🎉 New version available!
          </p>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            {promptMessage}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleUpdate}
              className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Update Now
            </button>
            {settings.dismissable && (
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-sm hover:bg-[var(--bg-card-hover)] transition-colors"
              >
                Later
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
