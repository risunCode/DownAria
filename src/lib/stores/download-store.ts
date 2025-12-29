/**
 * Download Store - Shared download state between DownloadPreview and MediaGallery
 * Uses a simple pub/sub pattern for lightweight state sync
 */

export interface DownloadProgress {
  status: 'idle' | 'downloading' | 'done' | 'error';
  percent: number;
  loaded: number;
  total: number;
  speed: number;
  message?: string;
}

type Listener = (progress: DownloadProgress) => void;

// Store: Map of contentUrl -> download progress
const downloadStates = new Map<string, DownloadProgress>();
const listeners = new Map<string, Set<Listener>>();

const DEFAULT_PROGRESS: DownloadProgress = {
  status: 'idle',
  percent: 0,
  loaded: 0,
  total: 0,
  speed: 0,
};

/**
 * Get current download progress for a content URL
 */
export function getDownloadProgress(contentUrl: string): DownloadProgress {
  return downloadStates.get(contentUrl) || DEFAULT_PROGRESS;
}

/**
 * Update download progress and notify all listeners
 */
export function setDownloadProgress(contentUrl: string, progress: DownloadProgress): void {
  downloadStates.set(contentUrl, progress);
  
  // Notify listeners
  const contentListeners = listeners.get(contentUrl);
  if (contentListeners) {
    contentListeners.forEach(listener => listener(progress));
  }
}

/**
 * Subscribe to download progress updates
 * Returns unsubscribe function
 */
export function subscribeDownloadProgress(contentUrl: string, listener: Listener): () => void {
  if (!listeners.has(contentUrl)) {
    listeners.set(contentUrl, new Set());
  }
  listeners.get(contentUrl)!.add(listener);
  
  // Immediately call with current state
  const current = downloadStates.get(contentUrl);
  if (current) {
    listener(current);
  }
  
  // Return unsubscribe function
  return () => {
    const contentListeners = listeners.get(contentUrl);
    if (contentListeners) {
      contentListeners.delete(listener);
      if (contentListeners.size === 0) {
        listeners.delete(contentUrl);
      }
    }
  };
}

/**
 * Clear download state (after completion or error timeout)
 */
export function clearDownloadProgress(contentUrl: string): void {
  downloadStates.delete(contentUrl);
  // Don't delete listeners - they might still be active
}

/**
 * Check if a download is currently in progress for a content URL
 */
export function isDownloading(contentUrl: string): boolean {
  const state = downloadStates.get(contentUrl);
  return state?.status === 'downloading';
}
