'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { FileVideo, Loader2, Clipboard, ExternalLink, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Swal from 'sweetalert2';
import { useTranslations } from 'next-intl';
import { getProxyUrl } from '@/lib/api/proxy';

interface ExtractedMedia {
    url: string;
    quality: string;
    type: 'video' | 'image';
    thumbnail?: string;
}

export function FacebookHtmlTab() {
    const searchParams = useSearchParams();
    const [fbUrl, setFbUrl] = useState('');
    const [html, setHtml] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<ExtractedMedia[]>([]);
    const [htmlSize, setHtmlSize] = useState(0);
    const t = useTranslations('advanced.fbHtml');

    // Direct download function (no popup)
    const directDownload = async (url: string, filename: string) => {
        try {
            const proxyUrl = getProxyUrl(url, { filename, platform: 'facebook' });
            const response = await fetch(proxyUrl, { 
                credentials: 'same-origin', 
                headers: { 'X-Requested-With': 'XMLHttpRequest' } 
            });
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            link.click();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            Swal.fire({ 
                icon: 'success', 
                title: 'Downloaded!', 
                timer: 1500, 
                showConfirmButton: false, 
                background: 'var(--bg-card)', 
                color: 'var(--text-primary)' 
            });
        } catch {
            Swal.fire({ 
                icon: 'error', 
                title: 'Download failed', 
                timer: 1500, 
                showConfirmButton: false, 
                background: 'var(--bg-card)', 
                color: 'var(--text-primary)' 
            });
        }
    };

    useEffect(() => {
        const urlParam = searchParams.get('url');
        if (urlParam && !fbUrl) setFbUrl(decodeURIComponent(urlParam));
    }, [searchParams, fbUrl]);

    const handlePasteUrl = async () => {
        if (fbUrl.trim()) { 
            setFbUrl(''); 
            setResults([]); 
        } else {
            try { 
                setFbUrl(await navigator.clipboard.readText()); 
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

    const handlePasteHtml = async () => {
        if (html.trim()) { 
            setHtml(''); 
            setHtmlSize(0); 
            setResults([]); 
        } else {
            try {
                const text = await navigator.clipboard.readText();
                setHtmlSize(text.length);
                setHtml(text);
                setTimeout(() => extractFromHtml(text), 100);
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

    const decodeUrl = (s: string): string => {
        return s.replace(/\\u0025/g, '%')
                .replace(/\\u0026/g, '&')
                .replace(/\\u002F/g, '/')
                .replace(/\\\//g, '/')
                .replace(/\\"/g, '"')
                .replace(/&amp;/g, '&');
    };

    const extractFromHtml = async (htmlContent: string) => {
        if (!htmlContent.trim()) return;
        setIsLoading(true);
        setResults([]);

        try {
            const found: ExtractedMedia[] = [];
            const decoded = decodeUrl(htmlContent);
            const seenUrls = new Set<string>();
            const foundQualities = new Set<string>();

            const addVideo = (url: string, quality: string) => {
                const cleanUrl = decodeUrl(url);
                // Accept .mp4 or fbcdn/scontent video URLs
                if (!cleanUrl || seenUrls.has(cleanUrl)) return;
                if (!/\.mp4|scontent.*\/v\/|fbcdn.*\/v\//.test(cleanUrl)) return;
                seenUrls.add(cleanUrl);
                foundQualities.add(quality);
                found.push({ url: cleanUrl, quality, type: 'video' });
            };

            // METHOD 1: browser_native (newest format - most reliable)
            const hdNative = decoded.match(/"browser_native_hd_url":"([^"]+)"/);
            const sdNative = decoded.match(/"browser_native_sd_url":"([^"]+)"/);
            if (hdNative) addVideo(hdNative[1], 'HD Video');
            if (sdNative) addVideo(sdNative[1], 'SD Video');

            // METHOD 2: playable_url (legacy format)
            if (!foundQualities.has('HD Video')) {
                const hdPlay = decoded.match(/"playable_url_quality_hd":"([^"]+)"/);
                if (hdPlay) addVideo(hdPlay[1], 'HD Video');
            }
            if (!foundQualities.has('SD Video')) {
                const sdPlay = decoded.match(/"playable_url":"([^"]+)"/);
                if (sdPlay) addVideo(sdPlay[1], 'SD Video');
            }

            // METHOD 3: hd_src/sd_src (older format)
            if (!foundQualities.has('HD Video')) {
                const hdSrc = decoded.match(/"hd_src(?:_no_ratelimit)?":"([^"]+)"/);
                if (hdSrc) addVideo(hdSrc[1], 'HD Video');
            }
            if (!foundQualities.has('SD Video')) {
                const sdSrc = decoded.match(/"sd_src(?:_no_ratelimit)?":"([^"]+)"/);
                if (sdSrc) addVideo(sdSrc[1], 'SD Video');
            }

            // METHOD 4: DASH manifest (for specific resolutions)
            if (found.length === 0) {
                const dashRe = /"height":(\d+)[^}]*?"base_url":"(https:[^"]+\.mp4[^"]*)"/g;
                const dashVideos: { height: number; url: string }[] = [];
                let m;
                while ((m = dashRe.exec(decoded)) !== null) {
                    const height = parseInt(m[1]);
                    if (height >= 360) dashVideos.push({ height, url: decodeUrl(m[2]) });
                }
                if (dashVideos.length > 0) {
                    dashVideos.sort((a, b) => b.height - a.height);
                    const hd = dashVideos.find(v => v.height >= 720);
                    const sd = dashVideos.find(v => v.height < 720 && v.height >= 360);
                    if (hd) addVideo(hd.url, `HD ${hd.height}p`);
                    if (sd) addVideo(sd.url, `SD ${sd.height}p`);
                }
            }

            // METHOD 5: progressive_url (fallback)
            if (found.length === 0) {
                const progRe = /"progressive_url":"(https:\/\/[^"]+)"/g;
                let progMatch;
                while ((progMatch = progRe.exec(decoded)) !== null && found.length < 2) {
                    const url = decodeUrl(progMatch[1]);
                    if (/\.mp4|scontent.*\/v\/|fbcdn.*\/v\//.test(url)) {
                        const quality = /720|1080|_hd/i.test(url) || found.length === 0 ? 'HD Video' : 'SD Video';
                        if (!foundQualities.has(quality)) addVideo(url, quality);
                    }
                }
            }

            setResults(found);
            setHtml('');
            if (!found.length) {
                Swal.fire({ 
                    icon: 'warning', 
                    title: t('noMediaFound'), 
                    timer: 2000, 
                    showConfirmButton: false, 
                    background: 'var(--bg-card)', 
                    color: 'var(--text-primary)' 
                });
            }
        } catch {
            Swal.fire({ 
                icon: 'error', 
                title: t('parseError'), 
                timer: 2000, 
                showConfirmButton: false, 
                background: 'var(--bg-card)', 
                color: 'var(--text-primary)' 
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-card p-5 space-y-5">
            <div className="flex items-center gap-3">
                <FileVideo className="w-5 h-5 text-blue-500" />
                <div>
                    <h2 className="font-semibold">{t('title')}</h2>
                    <p className="text-xs text-[var(--text-muted)]">{t('description')}</p>
                </div>
            </div>

            {/* Step 1 */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white text-xs flex items-center justify-center font-bold">
                        1
                    </span>
                    <label className="text-sm font-medium">{t('step1')}</label>
                </div>
                <div className="flex gap-2">
                    <input 
                        type="url" 
                        value={fbUrl} 
                        onChange={(e) => setFbUrl(e.target.value)} 
                        placeholder="https://www.facebook.com/..." 
                        className="input-url text-sm flex-1" 
                    />
                    <Button 
                        onClick={handlePasteUrl} 
                        variant={fbUrl.trim() ? 'secondary' : 'primary'} 
                        leftIcon={<Clipboard className="w-4 h-4" />}
                    >
                        {fbUrl.trim() ? t('clear') : t('paste')}
                    </Button>
                </div>
            </div>

            {/* Step 2 */}
            {fbUrl.trim() && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white text-xs flex items-center justify-center font-bold">
                            2
                        </span>
                        <label className="text-sm font-medium">{t('step2')}</label>
                    </div>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={`view-source:${fbUrl}`} 
                            readOnly 
                            className="input-url text-sm flex-1 font-mono text-[var(--text-muted)]" 
                        />
                        <Button 
                            onClick={async () => {
                                await navigator.clipboard.writeText(`view-source:${fbUrl}`);
                                Swal.fire({ 
                                    icon: 'success', 
                                    title: t('copied'), 
                                    text: t('copyHint'), 
                                    timer: 1500, 
                                    showConfirmButton: false, 
                                    background: 'var(--bg-card)', 
                                    color: 'var(--text-primary)' 
                                });
                            }} 
                            leftIcon={<Clipboard className="w-4 h-4" />}
                        >
                            {t('copy')}
                        </Button>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{t('sourceHint')}</p>
                </div>
            )}

            {/* Step 3 */}
            {fbUrl.trim() && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white text-xs flex items-center justify-center font-bold">
                            3
                        </span>
                        <label className="text-sm font-medium">{t('step3')}</label>
                        {html.length > 0 && (
                            <span className="text-xs text-[var(--text-muted)]">
                                ({(html.length / 1024).toFixed(0)} KB)
                            </span>
                        )}
                    </div>

                    {isLoading ? (
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-[var(--bg-secondary)]">
                            <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-primary)]" />
                            <span className="text-sm">{t('extracting')}</span>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                            <span className="text-sm text-green-400">✓ {t('found', { count: results.length })}</span>
                            <Button 
                                size="sm" 
                                variant="secondary" 
                                onClick={() => { setResults([]); setHtml(''); }} 
                                leftIcon={<Clipboard className="w-3 h-3" />}
                            >
                                {t('extractNew')}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <textarea
                                value={html}
                                onChange={(e) => setHtml(e.target.value)}
                                placeholder={t('htmlPlaceholder')}
                                className="w-full h-32 px-3 py-2 text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg font-mono resize-none focus:outline-none focus:border-[var(--accent-primary)]"
                            />
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => extractFromHtml(html)}
                                    disabled={!html.trim()}
                                    leftIcon={<FileVideo className="w-4 h-4" />}
                                >
                                    {t('extractMedia')}
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={handlePasteHtml}
                                    leftIcon={<Clipboard className="w-4 h-4" />}
                                >
                                    {t('pasteFromClipboard')}
                                </Button>
                            </div>
                            <p className="text-xs text-[var(--text-muted)]">
                                {t('pasteHint')}
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Results */}
            {results.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-[var(--border-color)]">
                    {results.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                            <FileVideo className={`w-5 h-5 ${
                                item.quality.includes('HD') ? 'text-purple-400' : 'text-amber-400'
                            }`} />
                            <span className={`px-2 py-0.5 text-xs rounded ${
                                item.quality.includes('HD') ? 
                                'bg-purple-500/20 text-purple-400' : 
                                'bg-amber-500/20 text-amber-400'
                            }`}>
                                {item.quality}
                            </span>
                            <div className="flex-1" />
                            <button 
                                onClick={() => window.open(item.url, '_blank')} 
                                className="p-2 hover:bg-[var(--bg-card)] rounded"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </button>
                            <button 
                                onClick={() => directDownload(item.url, `FB_${Date.now()}.mp4`)} 
                                className="p-2 hover:bg-green-500/10 text-green-400 rounded"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}