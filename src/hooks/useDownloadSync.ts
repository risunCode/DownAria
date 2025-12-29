/**
 * useDownloadSync - Hook for synced download state between components
 */

import { useState, useEffect, useCallback } from 'react';
import {
  DownloadProgress,
  getDownloadProgress,
  setDownloadProgress,
  subscribeDownloadProgress,
  clearDownloadProgress,
} from '@/lib/stores/download-store';

interface UseDownloadSyncReturn {
  progress: DownloadProgress;
  isDownloading: boolean;
  isDone: boolean;
  isError: boolean;
  updateProgress: (progress: DownloadProgress) => void;
  resetProgress: () => void;
}

/**
 * Hook to sync download progress across components
 * @param contentUrl - Unique identifier for the content (usually data.url)
 */
export function useDownloadSync(contentUrl: string): UseDownloadSyncReturn {
  const [progress, setProgress] = useState<DownloadProgress>(() => 
    getDownloadProgress(contentUrl)
  );

  // Subscribe to progress updates
  useEffect(() => {
    const unsubscribe = subscribeDownloadProgress(contentUrl, (newProgress) => {
      setProgress(newProgress);
    });
    
    return unsubscribe;
  }, [contentUrl]);

  // Update progress (broadcasts to all subscribers)
  const updateProgress = useCallback((newProgress: DownloadProgress) => {
    setDownloadProgress(contentUrl, newProgress);
  }, [contentUrl]);

  // Reset progress
  const resetProgress = useCallback(() => {
    clearDownloadProgress(contentUrl);
    setProgress({
      status: 'idle',
      percent: 0,
      loaded: 0,
      total: 0,
      speed: 0,
    });
  }, [contentUrl]);

  return {
    progress,
    isDownloading: progress.status === 'downloading',
    isDone: progress.status === 'done',
    isError: progress.status === 'error',
    updateProgress,
    resetProgress,
  };
}

export default useDownloadSync;
