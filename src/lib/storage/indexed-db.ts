/**
 * IndexedDB Storage Implementation
 * =================================
 * Unlimited local history storage with export/import support.
 * 
 * Features:
 * - Unlimited history items (IndexedDB has no practical limit)
 * - Export to JSON or ZIP (with thumbnails)
 * - Import from backup
 * - Search and filter
 * - Platform-based filtering
 */

import { Platform, MediaFormat } from '@/lib/types';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface HistoryEntry {
    id: string;
    platform: Platform;
    contentId: string;
    resolvedUrl: string;
    title: string;
    thumbnail: string;
    author: string;
    downloadedAt: number;
    quality?: string;
    type?: 'video' | 'image' | 'audio';
}

export interface MediaCacheEntry {
    cacheKey: string;
    platform: Platform;
    contentId: string;
    resolvedUrl: string;
    title: string;
    description?: string;
    thumbnail: string;
    author: string;
    authorName?: string;
    duration?: string;
    engagement?: {
        views?: number;
        likes?: number;
        comments?: number;
        shares?: number;
        reposts?: number;
    };
    formats: MediaFormat[];
    cachedAt: number;
    expiresAt: number;
    usedCookie?: boolean;
}

export interface ExportData {
    version: number;
    exportedAt: number;
    history: HistoryEntry[];
    stats: {
        total: number;
        platforms: Record<string, number>;
    };
}

// ═══════════════════════════════════════════════════════════════
// DATABASE SETUP
// ═══════════════════════════════════════════════════════════════

const DB_NAME = 'xtfetch_db';
const DB_VERSION = 1;
const HISTORY_STORE = 'history';
const CACHE_STORE = 'media_cache';

let db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;

            // History store
            if (!database.objectStoreNames.contains(HISTORY_STORE)) {
                const historyStore = database.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
                historyStore.createIndex('platform', 'platform', { unique: false });
                historyStore.createIndex('downloadedAt', 'downloadedAt', { unique: false });
                historyStore.createIndex('contentId', 'contentId', { unique: false });
            }

            // Cache store
            if (!database.objectStoreNames.contains(CACHE_STORE)) {
                const cacheStore = database.createObjectStore(CACHE_STORE, { keyPath: 'cacheKey' });
                cacheStore.createIndex('platform', 'platform', { unique: false });
                cacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
            }
        };
    });
}

export async function initStorage(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
        await openDB();
        await clearExpiredCache();
    } catch (err) {
        console.error('[IndexedDB] Init failed:', err);
    }
}

export function closeDB(): void {
    if (db) {
        db.close();
        db = null;
    }
}

// ═══════════════════════════════════════════════════════════════
// HISTORY OPERATIONS
// ═══════════════════════════════════════════════════════════════

export async function addHistory(entry: Omit<HistoryEntry, 'id' | 'downloadedAt'>): Promise<string> {
    const database = await openDB();
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
    
    const fullEntry: HistoryEntry = {
        ...entry,
        id,
        downloadedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
        const tx = database.transaction(HISTORY_STORE, 'readwrite');
        const store = tx.objectStore(HISTORY_STORE);
        const request = store.add(fullEntry);
        
        request.onsuccess = () => resolve(id);
        request.onerror = () => reject(request.error);
    });
}

export async function getHistory(limit = 100, offset = 0): Promise<HistoryEntry[]> {
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
        const tx = database.transaction(HISTORY_STORE, 'readonly');
        const store = tx.objectStore(HISTORY_STORE);
        const index = store.index('downloadedAt');
        const results: HistoryEntry[] = [];
        let skipped = 0;

        // Iterate in reverse (newest first)
        const request = index.openCursor(null, 'prev');
        
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            
            if (cursor && results.length < limit) {
                if (skipped < offset) {
                    skipped++;
                    cursor.continue();
                } else {
                    results.push(cursor.value);
                    cursor.continue();
                }
            } else {
                resolve(results);
            }
        };
        
        request.onerror = () => reject(request.error);
    });
}

export async function getHistoryCount(): Promise<number> {
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
        const tx = database.transaction(HISTORY_STORE, 'readonly');
        const store = tx.objectStore(HISTORY_STORE);
        const request = store.count();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function getHistoryByPlatform(platform: Platform, limit = 100): Promise<HistoryEntry[]> {
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
        const tx = database.transaction(HISTORY_STORE, 'readonly');
        const store = tx.objectStore(HISTORY_STORE);
        const index = store.index('platform');
        const results: HistoryEntry[] = [];

        const request = index.openCursor(IDBKeyRange.only(platform), 'prev');
        
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            
            if (cursor && results.length < limit) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        
        request.onerror = () => reject(request.error);
    });
}

export async function searchHistory(query: string, limit = 50): Promise<HistoryEntry[]> {
    const database = await openDB();
    const q = query.toLowerCase();
    
    return new Promise((resolve, reject) => {
        const tx = database.transaction(HISTORY_STORE, 'readonly');
        const store = tx.objectStore(HISTORY_STORE);
        const results: HistoryEntry[] = [];

        const request = store.openCursor();
        
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            
            if (cursor && results.length < limit) {
                const entry = cursor.value as HistoryEntry;
                if (
                    entry.title?.toLowerCase().includes(q) ||
                    entry.author?.toLowerCase().includes(q) ||
                    entry.resolvedUrl?.toLowerCase().includes(q)
                ) {
                    results.push(entry);
                }
                cursor.continue();
            } else {
                // Sort by downloadedAt desc
                results.sort((a, b) => b.downloadedAt - a.downloadedAt);
                resolve(results);
            }
        };
        
        request.onerror = () => reject(request.error);
    });
}

export async function deleteHistory(id: string): Promise<void> {
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
        const tx = database.transaction(HISTORY_STORE, 'readwrite');
        const store = tx.objectStore(HISTORY_STORE);
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function clearHistory(): Promise<void> {
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
        const tx = database.transaction(HISTORY_STORE, 'readwrite');
        const store = tx.objectStore(HISTORY_STORE);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ═══════════════════════════════════════════════════════════════
// EXPORT / IMPORT
// ═══════════════════════════════════════════════════════════════

export async function exportHistory(): Promise<ExportData> {
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
        const tx = database.transaction(HISTORY_STORE, 'readonly');
        const store = tx.objectStore(HISTORY_STORE);
        const request = store.getAll();
        
        request.onsuccess = () => {
            const history = request.result as HistoryEntry[];
            const platforms: Record<string, number> = {};
            
            history.forEach(h => {
                platforms[h.platform] = (platforms[h.platform] || 0) + 1;
            });
            
            resolve({
                version: 1,
                exportedAt: Date.now(),
                history: history.sort((a, b) => b.downloadedAt - a.downloadedAt),
                stats: {
                    total: history.length,
                    platforms,
                },
            });
        };
        
        request.onerror = () => reject(request.error);
    });
}

export async function exportHistoryAsJSON(): Promise<string> {
    const data = await exportHistory();
    return JSON.stringify(data, null, 2);
}

export async function exportHistoryAsBlob(): Promise<Blob> {
    const json = await exportHistoryAsJSON();
    return new Blob([json], { type: 'application/json' });
}

export async function downloadHistoryExport(filename?: string): Promise<void> {
    const blob = await exportHistoryAsBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `xtfetch-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function importHistory(data: ExportData | string, merge = true): Promise<{ imported: number; skipped: number }> {
    let exportData: ExportData;
    
    if (typeof data === 'string') {
        try {
            exportData = JSON.parse(data);
        } catch {
            throw new Error('Invalid JSON format');
        }
    } else {
        exportData = data;
    }
    
    if (!exportData.history || !Array.isArray(exportData.history)) {
        throw new Error('Invalid export data: missing history array');
    }
    
    const database = await openDB();
    let imported = 0;
    let skipped = 0;
    
    // Get existing IDs if merging
    const existingIds = new Set<string>();
    if (merge) {
        const existing = await getHistory(10000);
        existing.forEach(h => existingIds.add(h.contentId));
    } else {
        // Clear existing history
        await clearHistory();
    }
    
    // Import entries
    for (const entry of exportData.history) {
        // Skip duplicates based on contentId
        if (existingIds.has(entry.contentId)) {
            skipped++;
            continue;
        }
        
        try {
            await new Promise<void>((resolve, reject) => {
                const tx = database.transaction(HISTORY_STORE, 'readwrite');
                const store = tx.objectStore(HISTORY_STORE);
                
                // Generate new ID to avoid conflicts
                const newEntry = {
                    ...entry,
                    id: `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`,
                };
                
                const request = store.add(newEntry);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
            
            imported++;
            existingIds.add(entry.contentId);
        } catch {
            skipped++;
        }
    }
    
    return { imported, skipped };
}

export async function importHistoryFromFile(file: File, merge = true): Promise<{ imported: number; skipped: number }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const result = await importHistory(content, merge);
                resolve(result);
            } catch (err) {
                reject(err);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// ═══════════════════════════════════════════════════════════════
// MEDIA CACHE OPERATIONS
// ═══════════════════════════════════════════════════════════════

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getCachedMedia(cacheKey: string): Promise<MediaCacheEntry | null> {
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
        const tx = database.transaction(CACHE_STORE, 'readonly');
        const store = tx.objectStore(CACHE_STORE);
        const request = store.get(cacheKey);
        
        request.onsuccess = () => {
            const entry = request.result as MediaCacheEntry | undefined;
            if (!entry || entry.expiresAt < Date.now()) {
                resolve(null);
            } else {
                resolve(entry);
            }
        };
        
        request.onerror = () => reject(request.error);
    });
}

export async function setCachedMedia(entry: Omit<MediaCacheEntry, 'cachedAt' | 'expiresAt'>): Promise<void> {
    const database = await openDB();
    const now = Date.now();
    
    const fullEntry: MediaCacheEntry = {
        ...entry,
        cachedAt: now,
        expiresAt: now + CACHE_TTL_MS,
    };
    
    return new Promise((resolve, reject) => {
        const tx = database.transaction(CACHE_STORE, 'readwrite');
        const store = tx.objectStore(CACHE_STORE);
        const request = store.put(fullEntry);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function deleteCachedMedia(cacheKey: string): Promise<void> {
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
        const tx = database.transaction(CACHE_STORE, 'readwrite');
        const store = tx.objectStore(CACHE_STORE);
        const request = store.delete(cacheKey);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export async function clearExpiredCache(): Promise<number> {
    const database = await openDB();
    const now = Date.now();
    let count = 0;
    
    return new Promise((resolve, reject) => {
        const tx = database.transaction(CACHE_STORE, 'readwrite');
        const store = tx.objectStore(CACHE_STORE);
        const index = store.index('expiresAt');
        
        const request = index.openCursor(IDBKeyRange.upperBound(now));
        
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            
            if (cursor) {
                cursor.delete();
                count++;
                cursor.continue();
            } else {
                resolve(count);
            }
        };
        
        request.onerror = () => reject(request.error);
    });
}

export async function clearAllCache(): Promise<void> {
    const database = await openDB();
    
    return new Promise((resolve, reject) => {
        const tx = database.transaction(CACHE_STORE, 'readwrite');
        const store = tx.objectStore(CACHE_STORE);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ═══════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════

export async function getStorageStats(): Promise<{
    historyCount: number;
    cacheCount: number;
    platforms: Record<string, number>;
    estimatedSize: string;
}> {
    const database = await openDB();
    
    const historyCount = await getHistoryCount();
    
    const cacheCount = await new Promise<number>((resolve, reject) => {
        const tx = database.transaction(CACHE_STORE, 'readonly');
        const store = tx.objectStore(CACHE_STORE);
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    
    // Get platform breakdown
    const platforms: Record<string, number> = {};
    const history = await getHistory(10000);
    history.forEach(h => {
        platforms[h.platform] = (platforms[h.platform] || 0) + 1;
    });
    
    // Estimate size
    let estimatedSize = 'Unknown';
    if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
            const estimate = await navigator.storage.estimate();
            if (estimate.usage) {
                const mb = estimate.usage / (1024 * 1024);
                estimatedSize = mb < 1 ? `${(mb * 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`;
            }
        } catch { /* ignore */ }
    }
    
    return {
        historyCount,
        cacheCount,
        platforms,
        estimatedSize,
    };
}

// ═══════════════════════════════════════════════════════════════
// FULL BACKUP (ZIP)
// ═══════════════════════════════════════════════════════════════

export interface FullBackupData {
    version: number;
    exportedAt: number;
    appVersion: string;
    history: ExportData;
    settings: Record<string, string>;
}

export async function createFullBackup(): Promise<FullBackupData> {
    // Get history from IndexedDB
    const historyData = await exportHistory();
    
    // Get settings from LocalStorage
    const settings: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
            settings[key] = localStorage.getItem(key) || '';
        }
    }
    
    return {
        version: 1,
        exportedAt: Date.now(),
        appVersion: '1.0.0',
        history: historyData,
        settings,
    };
}

export async function downloadFullBackupAsZip(filename?: string): Promise<void> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    const backup = await createFullBackup();
    
    // Add manifest
    zip.file('manifest.json', JSON.stringify({
        version: backup.version,
        exportedAt: backup.exportedAt,
        appVersion: backup.appVersion,
        historyCount: backup.history.stats.total,
        settingsCount: Object.keys(backup.settings).length,
    }, null, 2));
    
    // Add history
    zip.file('history.json', JSON.stringify(backup.history, null, 2));
    
    // Add settings
    zip.file('settings.json', JSON.stringify(backup.settings, null, 2));
    
    // Generate and download
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `xtfetch-backup-${new Date().toISOString().split('T')[0]}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export async function importFullBackupFromZip(file: File, options?: { mergeHistory?: boolean }): Promise<{
    historyImported: number;
    historySkipped: number;
    settingsImported: number;
}> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    
    let historyImported = 0;
    let historySkipped = 0;
    let settingsImported = 0;
    
    // Import history
    const historyFile = zip.file('history.json');
    if (historyFile) {
        const historyContent = await historyFile.async('string');
        const historyData = JSON.parse(historyContent) as ExportData;
        const result = await importHistory(historyData, options?.mergeHistory ?? true);
        historyImported = result.imported;
        historySkipped = result.skipped;
    }
    
    // Import settings
    const settingsFile = zip.file('settings.json');
    if (settingsFile) {
        const settingsContent = await settingsFile.async('string');
        const settings = JSON.parse(settingsContent) as Record<string, string>;
        Object.entries(settings).forEach(([key, value]) => {
            if (typeof value === 'string') {
                localStorage.setItem(key, value);
                settingsImported++;
            }
        });
    }
    
    return { historyImported, historySkipped, settingsImported };
}
