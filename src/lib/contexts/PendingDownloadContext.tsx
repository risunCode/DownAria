'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { MediaData, Platform } from '@/lib/types';

export interface QueuedMedia {
  id: string;
  mediaData: MediaData;
  platform: Platform;
  addedAt: number;
}

interface PendingDownloadContextType {
  mediaData: MediaData | null;
  setMediaData: (data: MediaData | null) => void;
  clearMediaData: () => void;
  // Queue management
  queue: QueuedMedia[];
  addToQueue: (media: MediaData, platform: Platform) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;
  isQueueMinimized: boolean;
  setQueueMinimized: (v: boolean) => void;
}

const PendingDownloadContext = createContext<PendingDownloadContextType | null>(null);

const QUEUE_STORAGE_KEY = 'xtfetch_media_queue';

export function PendingDownloadProvider({ children }: { children: ReactNode }) {
  const [mediaData, setMediaDataState] = useState<MediaData | null>(null);
  const [queue, setQueue] = useState<QueuedMedia[]>([]);
  const [isQueueMinimized, setQueueMinimized] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as QueuedMedia[];
        setQueue(parsed);
      }
    } catch {
      // Ignore parse errors
    }
    setIsHydrated(true);
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    if (!isHydrated) return;
    try {
      if (queue.length > 0) {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
      } else {
        localStorage.removeItem(QUEUE_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [queue, isHydrated]);

  const setMediaData = useCallback((data: MediaData | null) => {
    setMediaDataState(data);
  }, []);

  const clearMediaData = useCallback(() => {
    setMediaDataState(null);
  }, []);

  const addToQueue = useCallback((media: MediaData, platform: Platform) => {
    const id = `mq-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    setQueue(prev => {
      const updated = [...prev, { id, mediaData: media, platform, addedAt: Date.now() }];
      // Save immediately
      try {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
    setQueueMinimized(false);
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => {
      const updated = prev.filter(item => item.id !== id);
      // Save immediately
      try {
        if (updated.length > 0) {
          localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(updated));
        } else {
          localStorage.removeItem(QUEUE_STORAGE_KEY);
        }
      } catch {
        // Ignore
      }
      return updated;
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
    try {
      localStorage.removeItem(QUEUE_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);



  return (
    <PendingDownloadContext.Provider value={{ 
      mediaData, setMediaData, clearMediaData,
      queue, addToQueue, removeFromQueue, clearQueue,
      isQueueMinimized, setQueueMinimized
    }}>
      {children}
    </PendingDownloadContext.Provider>
  );
}

export function usePendingDownload() {
  const context = useContext(PendingDownloadContext);
  if (!context) {
    throw new Error('usePendingDownload must be used within PendingDownloadProvider');
  }
  return context;
}
