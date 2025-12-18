'use client';

import { useEffect, useState } from 'react';

export function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Track online/offline status
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered');
          
          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available
                  setUpdateAvailable(true);
                  console.log('[PWA] New version available');
                }
              });
            }
          });

          // Check for updates periodically (every 30 min)
          setInterval(() => {
            registration.update();
          }, 30 * 60 * 1000);
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
    };
  }, []);

  // Update prompt
  const handleUpdate = () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('skipWaiting');
    }
  };

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
      {updateAvailable && (
        <div className="fixed bottom-4 right-4 z-50 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--accent-primary)] shadow-xl animate-fade-in max-w-xs">
          <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
            🎉 New version available!
          </p>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Refresh to get the latest features.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleUpdate}
              className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Update Now
            </button>
            <button
              onClick={() => setUpdateAvailable(false)}
              className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-sm hover:bg-[var(--bg-card-hover)] transition-colors"
            >
              Later
            </button>
          </div>
        </div>
      )}
    </>
  );
}
