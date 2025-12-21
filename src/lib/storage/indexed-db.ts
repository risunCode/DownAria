/**
 * IndexedDB Storage - Download History Only
 * ==========================================
 * Stores user's download history permanently (no auto-delete).
 * Caching is handled by Redis server-side.
 * 
 * Features:
 * - Unlimited history items
 * - Export to JSON or ZIP
 * - Import from backup
 * - Search and filter
 * - Platform-based filtering
 */

import { Platform } from '@/lib/types';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface HistoryEntry {
    id: string;                 // Unique ID (generated)
    platform: Platform;         // facebook, instagram, etc.
    contentId: string;          // Platform-specific content ID
    resolvedUrl: string;        // Final URL after resolution
    title: string;              // Content title/caption (truncated)
    thumbnail: string;          // Thumbnail URL
    author: string;             // Author username
    downloadedAt: number;       // Timestamp
    quality?: string;           // HD, SD, etc.
    type?: 'video' | 'image' | 'audio';
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
const DB_VERSION = 2; // Bumped version to remove cache store
const HISTORY_STORE = 'history';

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

            // Remove old cache store if exists (no longer needed, Redis handles caching)
            if (database.objectStoreNames.contains('media_cache')) {
                database.deleteObjectStore('media_cache');
            }
        };
    });
}

export async function initStorage(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
        await openDB();
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
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Truncate title to save space (max 200 chars)
    const title = entry.title?.substring(0, 200) || 'Untitled';
    
    const fullEntry: HistoryEntry = {
        ...entry,
        id,
        title,
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
                    entry.author?.toLowerCase().includes(q)
                ) {
                    results.push(entry);
                }
                cursor.continue();
            } else {
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
                stats: { total: history.length, platforms },
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
        exportData = JSON.parse(data);
    } else {
        exportData = data;
    }
    
    if (!exportData.history || !Array.isArray(exportData.history)) {
        throw new Error('Invalid export data');
    }
    
    const database = await openDB();
    let imported = 0;
    let skipped = 0;
    
    const existingIds = new Set<string>();
    if (merge) {
        const existing = await getHistory(10000);
        existing.forEach(h => existingIds.add(h.contentId));
    } else {
        await clearHistory();
    }
    
    for (const entry of exportData.history) {
        if (existingIds.has(entry.contentId)) {
            skipped++;
            continue;
        }
        
        try {
            await new Promise<void>((resolve, reject) => {
                const tx = database.transaction(HISTORY_STORE, 'readwrite');
                const store = tx.objectStore(HISTORY_STORE);
                const newEntry = {
                    ...entry,
                    id: `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`,
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
                const result = await importHistory(e.target?.result as string, merge);
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
// STATS
// ═══════════════════════════════════════════════════════════════

export async function getStorageStats(): Promise<{
    historyCount: number;
    platforms: Record<string, number>;
    estimatedSize: string;
}> {
    const historyCount = await getHistoryCount();
    
    const platforms: Record<string, number> = {};
    const history = await getHistory(10000);
    history.forEach(h => {
        platforms[h.platform] = (platforms[h.platform] || 0) + 1;
    });
    
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
    
    return { historyCount, platforms, estimatedSize };
}

// ═══════════════════════════════════════════════════════════════
// FULL BACKUP (ZIP)
// ═══════════════════════════════════════════════════════════════

import { getEncrypted, setEncrypted } from './crypto';

export interface FullBackupData {
    version: number;
    exportedAt: number;
    appVersion: string;
    history: ExportData;
    settings: Record<string, string>;
    // Decrypted sensitive data for cross-browser portability
    decryptedData?: Record<string, string>;
}

// Keys that use encrypted storage and need special handling
const ENCRYPTED_KEYS = [
    'xtf_cookie_facebook',
    'xtf_cookie_instagram', 
    'xtf_cookie_weibo',
    'xtf_cookie_twitter',
];

export async function createFullBackup(): Promise<FullBackupData> {
    const historyData = await exportHistory();
    
    const settings: Record<string, string> = {};
    const decryptedData: Record<string, string> = {};
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        
        const value = localStorage.getItem(key) || '';
        
        // For encrypted keys, try to decrypt and store separately
        if (ENCRYPTED_KEYS.includes(key)) {
            try {
                const decrypted = getEncrypted(key);
                if (decrypted) {
                    decryptedData[key] = decrypted;
                }
            } catch {
                // Skip if can't decrypt
            }
            // Don't include encrypted data in settings (not portable)
            continue;
        }
        
        // Skip encrypted data (starts with 'enc:') - not portable
        if (value.startsWith('enc:')) {
            continue;
        }
        
        settings[key] = value;
    }
    
    return {
        version: 2, // Bumped version for new format
        exportedAt: Date.now(),
        appVersion: '1.2.0',
        history: historyData,
        settings,
        decryptedData: Object.keys(decryptedData).length > 0 ? decryptedData : undefined,
    };
}

export async function downloadFullBackupAsZip(filename?: string): Promise<void> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const backup = await createFullBackup();
    
    zip.file('manifest.json', JSON.stringify({
        version: backup.version,
        exportedAt: backup.exportedAt,
        appVersion: backup.appVersion,
        historyCount: backup.history.stats.total,
        hasDecryptedData: !!backup.decryptedData,
    }, null, 2));
    zip.file('history.json', JSON.stringify(backup.history, null, 2));
    zip.file('settings.json', JSON.stringify(backup.settings, null, 2));
    
    // Include decrypted sensitive data if available
    if (backup.decryptedData) {
        zip.file('sensitive.json', JSON.stringify(backup.decryptedData, null, 2));
    }
    
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
    sensitiveImported: number;
}> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    
    let historyImported = 0, historySkipped = 0, settingsImported = 0, sensitiveImported = 0;
    
    // Import history
    const historyFile = zip.file('history.json');
    if (historyFile) {
        const content = await historyFile.async('string');
        const result = await importHistory(JSON.parse(content), options?.mergeHistory ?? true);
        historyImported = result.imported;
        historySkipped = result.skipped;
    }
    
    // Import regular settings (plain localStorage)
    const settingsFile = zip.file('settings.json');
    if (settingsFile) {
        const settings = JSON.parse(await settingsFile.async('string')) as Record<string, string>;
        Object.entries(settings).forEach(([key, value]) => {
            if (typeof value === 'string') {
                localStorage.setItem(key, value);
                settingsImported++;
            }
        });
    }
    
    // Import sensitive data (re-encrypt with new fingerprint)
    const sensitiveFile = zip.file('sensitive.json');
    if (sensitiveFile) {
        const sensitive = JSON.parse(await sensitiveFile.async('string')) as Record<string, string>;
        Object.entries(sensitive).forEach(([key, value]) => {
            if (typeof value === 'string' && ENCRYPTED_KEYS.includes(key)) {
                // Re-encrypt with current browser's fingerprint
                setEncrypted(key, value);
                sensitiveImported++;
            }
        });
    }
    
    return { historyImported, historySkipped, settingsImported, sensitiveImported };
}

// ═══════════════════════════════════════════════════════════════
// LEGACY COMPATIBILITY - Keep exports for existing code
// ═══════════════════════════════════════════════════════════════

/** @deprecated Cache is now handled by Redis. This is a no-op. */
export async function getCachedMedia(): Promise<null> { return null; }

/** @deprecated Cache is now handled by Redis. This is a no-op. */
export async function setCachedMedia(): Promise<void> { }

/** @deprecated Cache is now handled by Redis. This is a no-op. */
export async function clearExpiredCache(): Promise<number> { return 0; }

/** @deprecated Cache is now handled by Redis. This is a no-op. */
export async function clearAllCache(): Promise<void> { }
