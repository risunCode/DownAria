'use client';

import { useState } from 'react';
import { 
    Cloud, 
    Loader2, 
    Clipboard, 
    Download, 
    Link2, 
    CheckCircle, 
    AlertCircle, 
    X 
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Swal from 'sweetalert2';
import { useTranslations } from 'next-intl';
import { getProxyUrl } from '@/lib/api/proxy';
import { PlatformId } from '@/lib/types';

interface ProxyDownloadItem {
    id: string;
    url: string;
    filename: string;
    fileSize: string;
    status: 'pending' | 'downloading' | 'done' | 'error';
    progress: number;
    speed: number;
    loaded: number;
    total: number;
    error?: string;
    startedAt: number;
}

export function DirectProxyTab() {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState('');
    const [filename, setFilename] = useState('');
    const [fileSize, setFileSize] = useState('');
    const [downloads, setDownloads] = useState<ProxyDownloadItem[]>([]);
    const t = useTranslations('advanced.proxy');

    const handlePaste = async () => {
        if (url.trim()) { 
            setUrl(''); 
            setDownloadUrl(''); 
            setFilename(''); 
            setFileSize(''); 
        } else {
            try {
                const text = await navigator.clipboard.readText();
                setUrl(text);
                processUrl(text);
            } catch { 
                Swal.fire({ 
                    icon: 'error', 
                    title: t('pasteFailed'), 
                    timer: 1500, 
                    showConfirmButton: false, 
                    background: 'var(--bg-card)', 
                    color: 'var(--text-primary)' 
                }); 
            }
        }
    };

    const processUrl = async (inputUrl: string) => {
        if (!inputUrl.trim()) return;
        setIsLoading(true);
        setDownloadUrl('');

        try {
            let finalUrl = inputUrl.trim();
            let extractedFilename = '';
            let extractedSize = '';

            if (inputUrl.includes('drive.google.com')) {
                const fileIdMatch = inputUrl.match(/\/d\/([^/]+)/);
                if (fileIdMatch) {
                    const fileId = fileIdMatch[1];
                    const res = await fetch(getProxyUrl(`https://drive.google.com/file/d/${fileId}/view`, { platform: 'generic' }));
                    const html = await res.text();
                    const nameMatch = html.match(/<span class="uc-name-size"><a[^>]*>([^<]+)<\/a>\s*\(([^)]+)\)/);
                    if (nameMatch) { 
                        extractedFilename = nameMatch[1]; 
                        extractedSize = nameMatch[2]; 
                    }
                    finalUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
                }
            } else if (inputUrl.includes('dropbox.com')) {
                finalUrl = inputUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
            }

            if (!extractedFilename) {
                try { 
                    extractedFilename = decodeURIComponent(new URL(finalUrl).pathname.split('/').pop() || ''); 
                } catch { }
            }

            setDownloadUrl(finalUrl);
            setFilename(extractedFilename || `download_${Date.now()}`);
            setFileSize(extractedSize);
        } catch {
            Swal.fire({ 
                icon: 'error', 
                title: 'Error', 
                timer: 2000, 
                showConfirmButton: false, 
                background: 'var(--bg-card)', 
                color: 'var(--text-primary)' 
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Inline download with progress
    const handleDownload = async () => {
        if (!downloadUrl || !filename) return;
        
        const downloadId = `proxy_${Date.now()}`;
        const newItem: ProxyDownloadItem = {
            id: downloadId,
            url: downloadUrl,
            filename,
            fileSize,
            status: 'downloading',
            progress: 0,
            speed: 0,
            loaded: 0,
            total: 0,
            startedAt: Date.now(),
        };
        
        setDownloads(prev => [newItem, ...prev]);
        
        // Clear input for next download
        setUrl('');
        setDownloadUrl('');
        setFilename('');
        setFileSize('');

        try {
            const proxyUrl = getProxyUrl(newItem.url, { filename: newItem.filename, platform: 'generic' });
            
            const response = await fetch(proxyUrl, {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { 'X-Requested-With': 'XMLHttpRequest' },
            });
            
            if (!response.ok) throw new Error(`Download failed: ${response.status}`);

            const contentLength = response.headers.get('content-length');
            const total = contentLength ? parseInt(contentLength) : 0;
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const chunks: Uint8Array[] = [];
            let loaded = 0;
            const startTime = Date.now();
            let lastUpdateTime = startTime;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                loaded += value.length;

                const now = Date.now();
                const elapsed = (now - startTime) / 1000;
                const speed = loaded / elapsed;
                const progress = total > 0 ? Math.round((loaded / total) * 100) : 0;

                // Update every 100ms
                if (now - lastUpdateTime >= 100) {
                    lastUpdateTime = now;
                    setDownloads(prev => prev.map(d => 
                        d.id === downloadId ? { ...d, progress, speed, loaded, total, status: 'downloading' } : d
                    ));
                }
            }

            // Create blob and trigger download
            const contentType = response.headers.get('content-type') || 'application/octet-stream';
            const blob = new Blob(chunks as BlobPart[], { type: contentType });
            const blobUrl = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.style.display = 'none';
            link.href = blobUrl;
            link.download = newItem.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

            // Update status to done
            setDownloads(prev => prev.map(d => 
                d.id === downloadId ? { ...d, status: 'done', progress: 100, loaded: blob.size, total: blob.size } : d
            ));

            // Log to history (IndexedDB)
            const { addHistory } = await import('@/lib/storage');
            await addHistory({
                platform: 'generic' as PlatformId,
                contentId: downloadId,
                resolvedUrl: newItem.url,
                title: newItem.filename,
                thumbnail: '',
                author: 'Direct Proxy',
                quality: newItem.fileSize || 'Unknown',
                type: 'video',
            });

        } catch (err) {
            console.error('Proxy download error:', err);
            setDownloads(prev => prev.map(d => 
                d.id === downloadId ? { 
                    ...d, 
                    status: 'error', 
                    error: err instanceof Error ? err.message : 'Download failed' 
                } : d
            ));
        }
    };

    const removeDownload = (id: string) => {
        setDownloads(prev => prev.filter(d => d.id !== id));
    };

    const formatSpeed = (bytesPerSec: number) => {
        if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
        if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
        return `${bytesPerSec.toFixed(0)} B/s`;
    };

    const formatSize = (bytes: number) => {
        if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
        if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${bytes} B`;
    };

    return (
        <div className="space-y-4">
            {/* Input Card */}
            <div className="glass-card p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <Cloud className="w-5 h-5 text-purple-500" />
                    <div>
                        <h2 className="font-semibold">{t('title')}</h2>
                        <p className="text-xs text-[var(--text-muted)]">{t('description')}</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                    {['Google Drive', 'Dropbox', 'Mediafire', 'Direct URLs'].map(s => (
                        <span key={s} className="px-2 py-1 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                            {s}
                        </span>
                    ))}
                </div>

                <div className="flex gap-2">
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => { 
                            setUrl(e.target.value); 
                            if (e.target.value.startsWith('http')) processUrl(e.target.value); 
                        }}
                        placeholder="https://drive.google.com/file/d/..."
                        className="input-url text-sm flex-1"
                    />
                    <Button 
                        onClick={handlePaste} 
                        variant={url.trim() ? 'secondary' : 'primary'} 
                        disabled={isLoading}
                        leftIcon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clipboard className="w-4 h-4" />}
                    >
                        {url.trim() ? t('clear') : t('paste')}
                    </Button>
                </div>

                {downloadUrl && (
                    <div className="space-y-3 pt-4 border-t border-[var(--border-color)]">
                        <div className="p-2 rounded bg-[var(--bg-secondary)] text-xs font-mono break-words overflow-hidden">
                            {downloadUrl}
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <input 
                                type="text" 
                                value={filename} 
                                onChange={(e) => setFilename(e.target.value)} 
                                className="input-url text-sm flex-1 min-w-0" 
                            />
                            {fileSize && (
                                <span className="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400 text-center flex-shrink-0">
                                    {fileSize}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                onClick={handleDownload} 
                                leftIcon={<Download className="w-4 h-4" />}
                            >
                                {t('download')}
                            </Button>
                            <Button 
                                variant="secondary" 
                                onClick={() => window.open(downloadUrl, '_blank')} 
                                leftIcon={<Link2 className="w-4 h-4" />}
                            >
                                {t('open')}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* Downloads List - Persists until refresh */}
            {downloads.length > 0 && (
                <div className="glass-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <Download className="w-4 h-4 text-purple-400" />
                            Downloads ({downloads.length})
                        </h3>
                        <button 
                            onClick={() => setDownloads([])}
                            className="text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors"
                        >
                            Clear All
                        </button>
                    </div>

                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {downloads.map((item) => (
                            <div key={item.id} className="p-3 rounded-lg bg-[var(--bg-secondary)] space-y-2">
                                {/* Header */}
                                <div className="flex items-center gap-2">
                                    {item.status === 'downloading' && (
                                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />
                                    )}
                                    {item.status === 'done' && (
                                        <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                                    )}
                                    {item.status === 'error' && (
                                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                    )}
                                    
                                    <span className="text-sm font-medium truncate flex-1 min-w-0">
                                        {item.filename}
                                    </span>
                                    
                                    <button 
                                        onClick={() => removeDownload(item.id)}
                                        className="p-1 hover:bg-red-500/20 rounded text-[var(--text-muted)] hover:text-red-400 flex-shrink-0"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Progress Bar */}
                                {item.status === 'downloading' && (
                                    <>
                                        <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-100"
                                                style={{ width: `${item.progress}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                                            <span>
                                                {formatSize(item.loaded)} / {item.total ? formatSize(item.total) : '?'}
                                            </span>
                                            <span className="text-purple-400">
                                                {formatSpeed(item.speed)} · {item.progress}%
                                            </span>
                                        </div>
                                    </>
                                )}

                                {/* Done */}
                                {item.status === 'done' && (
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-green-400">✓ Downloaded</span>
                                        <span className="text-[var(--text-muted)]">{formatSize(item.loaded)}</span>
                                    </div>
                                )}

                                {/* Error */}
                                {item.status === 'error' && (
                                    <div className="text-xs text-red-400">
                                        {item.error || 'Download failed'}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}