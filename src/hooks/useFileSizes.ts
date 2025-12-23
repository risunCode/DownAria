/**
 * useFileSizes Hook - Fetch file sizes for media formats
 * Shared between DownloadPreview and MediaGallery
 */

import { useState, useEffect, useRef } from 'react';
import { MediaFormat, PlatformId } from '@/lib/types';
import { formatBytes } from '@/lib/utils/format';
import { getProxyUrl } from '@/lib/api/proxy';

interface FileSizeData {
    formatted: string;  // Human readable (e.g., "32.5 MB")
    bytes: number;      // Raw bytes
}

interface UseFileSizesResult {
    sizes: Record<string, FileSizeData>;
    getSize: (url: string) => string | null;
    getSizeBytes: (url: string) => number;
    isLoading: boolean;
}

/**
 * Hook to fetch and cache file sizes for media formats
 * @param formats - Array of media formats to fetch sizes for
 * @param platform - Platform ID (skips YouTube as sizes are unknown)
 * @param enabled - Whether to fetch sizes (default: true)
 */
export function useFileSizes(
    formats: MediaFormat[],
    platform: PlatformId,
    enabled: boolean = true
): UseFileSizesResult {
    const [sizes, setSizes] = useState<Record<string, FileSizeData>>({});
    const [isLoading, setIsLoading] = useState(false);
    const fetchedRef = useRef(false);
    const formatsKeyRef = useRef('');

    // Create a stable key from formats to detect changes
    const formatsKey = formats.map(f => f.url).sort().join('|');

    // Reset when formats change
    useEffect(() => {
        if (formatsKeyRef.current !== formatsKey) {
            formatsKeyRef.current = formatsKey;
            fetchedRef.current = false;
            setSizes({});
        }
    }, [formatsKey]);

    // Fetch sizes
    useEffect(() => {
        // Skip if disabled, already fetched, YouTube, or no formats
        if (!enabled || fetchedRef.current || platform === 'youtube' || formats.length === 0) {
            return;
        }

        const fetchSizes = async () => {
            setIsLoading(true);
            fetchedRef.current = true;

            // Filter formats that need size fetching
            const toFetch = formats.filter(f => f.url && !sizes[f.url]);
            
            if (toFetch.length === 0) {
                setIsLoading(false);
                return;
            }

            // Fetch all in parallel
            const results = await Promise.allSettled(
                toFetch.map(async (format) => {
                    try {
                        const proxyUrl = getProxyUrl(format.url, { platform, head: true });
                        const res = await fetch(proxyUrl);
                        const size = res.headers.get('x-file-size');
                        
                        if (size && parseInt(size) > 0) {
                            const bytes = parseInt(size);
                            return { 
                                url: format.url, 
                                data: { formatted: formatBytes(bytes), bytes } 
                            };
                        }
                        return { url: format.url, data: null };
                    } catch {
                        return { url: format.url, data: null };
                    }
                })
            );

            // Batch update state
            const newSizes: Record<string, FileSizeData> = {};
            results.forEach((result) => {
                if (result.status === 'fulfilled' && result.value.data) {
                    newSizes[result.value.url] = result.value.data;
                }
            });

            if (Object.keys(newSizes).length > 0) {
                setSizes(prev => ({ ...prev, ...newSizes }));
            }
            
            setIsLoading(false);
        };

        fetchSizes();
    }, [formats, platform, enabled, sizes]);

    // Helper to get formatted size
    const getSize = (url: string): string | null => {
        return sizes[url]?.formatted || null;
    };

    // Helper to get size in bytes
    const getSizeBytes = (url: string): number => {
        return sizes[url]?.bytes || 0;
    };

    return { sizes, getSize, getSizeBytes, isLoading };
}

export default useFileSizes;
