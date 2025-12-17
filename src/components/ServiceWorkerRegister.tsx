'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => {
          // SW registered successfully
        })
        .catch(() => {
          // SW registration failed
        });
    }
  }, []);

  return null;
}
