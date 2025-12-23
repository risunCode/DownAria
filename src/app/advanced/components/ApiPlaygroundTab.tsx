'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    Play, 
    Loader2, 
    Clipboard, 
    AlertCircle, 
    CheckCircle, 
    Copy, 
    Check, 
    Image, 
    Film, 
    Info, 
    Eye, 
    Download, 
    Clock, 
    Code, 
    ExternalLink 
} from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
    faFacebook, 
    faInstagram, 
    faWeibo, 
    faTwitter, 
    faTiktok, 
    faYoutube, 
    IconDefinition 
} from '@fortawesome/free-brands-svg-icons';
import { Button } from '@/components/ui/Button';
import { MediaGallery } from '@/components/media';
import Swal from 'sweetalert2';
import { PLATFORMS as TYPE_PLATFORMS, PlatformId, MediaData } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { getProxyUrl } from '@/lib/api/proxy';
import { usePlayground } from '@/hooks';

// Platform icon mapping for advanced page
const PLATFORM_ICONS: Record<PlatformId, { icon: IconDefinition; color: string }> = {
    facebook: { icon: faFacebook, color: 'text-blue-500' },
    instagram: { icon: faInstagram, color: 'text-pink-500' },
    twitter: { icon: faTwitter, color: 'text-sky-400' },
    tiktok: { icon: faTiktok, color: 'text-pink-400' },
    weibo: { icon: faWeibo, color: 'text-orange-500' },
    youtube: { icon: faYoutube, color: 'text-red-500' },
};

// Get platforms with icons for display
const PLATFORMS = TYPE_PLATFORMS.map(p => ({
    ...p,
    icon: PLATFORM_ICONS[p.id].icon,
    iconColor: PLATFORM_ICONS[p.id].color,
}));

interface PlaygroundResult {
    success: boolean;
    platform?: string;
    data?: {
        title?: string;
        author?: string;
        thumbnail?: string;
        formats?: Array<{ url: string; quality?: string; type?: string }>;
        usedCookie?: boolean;
        responseTime?: number;
    };
    error?: string;
    rateLimit?: { remaining: number; limit: number };
    networkError?: boolean;
}

// Proxy thumbnail URL for CORS-blocked CDNs (Instagram, Facebook, etc.)
function getProxiedThumbnail(url: string | undefined): string | undefined {
    if (!url) return undefined;
    // Check if URL needs proxying (Instagram/Facebook CDN)
    if (url.includes('fbcdn.net') || url.includes('cdninstagram.com') || url.includes('scontent')) {
        return getProxyUrl(url, { inline: true });
    }
    return url;
}

export function ApiPlaygroundTab() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<PlaygroundResult | null>(null);
    const [copied, setCopied] = useState(false);
    const [urlError, setUrlError] = useState('');
    const [showGallery, setShowGallery] = useState(false);
    const t = useTranslations('advanced.playground');
    const tCommon = useTranslations('common');

    // Direct download function (no popup)
    const directDownload = async (downloadUrl: string, filename: string) => {
        try {
            const proxyUrl = getProxyUrl(downloadUrl, { filename, platform: 'generic' });
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
    
    // Use SWR for rate limit status (cached, deduplicated)
    const { remaining, limit, refresh: refreshRateLimit } = usePlayground();
    const [rateLimit, setRateLimit] = useState({ remaining: 5, limit: 5 });
    
    // Sync SWR data to local state
    useEffect(() => {
        setRateLimit({ remaining, limit });
    }, [remaining, limit]);

    // Simple URL validation (client-side)
    const validateUrl = (input: string): boolean => {
        if (!input.trim()) {
            setUrlError('');
            return false;
        }
        try {
            const parsed = new URL(input);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
                setUrlError(t('errors.invalidProtocol'));
                return false;
            }
            // Check if it's a supported platform
            const supportedDomains = [
                'facebook.com', 'fb.com', 'fb.watch', 
                'instagram.com', 
                'twitter.com', 'x.com', 
                'tiktok.com', 
                'weibo.com', 'weibo.cn', 
                'youtube.com', 'youtu.be'
            ];
            const isSupported = supportedDomains.some(d => parsed.hostname.includes(d));
            if (!isSupported) {
                setUrlError(t('errors.unsupportedPlatform'));
                return false;
            }
            setUrlError('');
            return true;
        } catch {
            setUrlError(t('errors.invalidFormat'));
            return false;
        }
    };

    const executeRequest = async () => {
        if (!url.trim()) return;
        if (!validateUrl(url)) return;
        setLoading(true);
        setResult(null);

        const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
        try {
            const res = await fetch(`${API_URL}/api/v1/playground`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: url.trim() })
            });
            const data = await res.json();
            setResult(data);
            if (data.rateLimit) {
                setRateLimit(data.rateLimit);
            }
            // Refresh SWR cache after request
            refreshRateLimit();
        } catch (err) {
            // Check for network errors
            const { analyzeNetworkError, isOnline } = await import('@/lib/utils/network');
            const networkStatus = analyzeNetworkError(err);
            const errorMsg = err instanceof Error ? err.message : '';
            
            if (networkStatus.type === 'offline' || networkStatus.type === 'timeout' || 
                errorMsg.toLowerCase().includes('failed to fetch') || !isOnline()) {
                setResult({ 
                    success: false, 
                    error: `${networkStatus.message}: ${networkStatus.suggestion}`,
                    networkError: true
                });
            } else {
                setResult({ 
                    success: false, 
                    error: err instanceof Error ? err.message : t('errors.requestFailed') 
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const copyJson = async () => {
        if (!result) return;
        await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setUrl(text);
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
    };

    return (
        <div className="space-y-4 w-full max-w-full overflow-hidden">
            {/* Info Card */}
            <div className="glass-card p-4 w-full max-w-full overflow-hidden">
                <div className="flex items-start gap-3">
                    <Play className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 overflow-hidden">
                        <h2 className="font-semibold truncate">{t('title')}</h2>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            {t('description', { limit: rateLimit.limit })}
                        </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                        <div className="text-xs text-[var(--text-muted)]">{t('remaining')}</div>
                        <div className={`text-lg font-bold ${
                            rateLimit.remaining > 2 ? 'text-green-400' : 
                            rateLimit.remaining > 0 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                            {rateLimit.remaining}/{rateLimit.limit}
                        </div>
                    </div>
                </div>

                {/* API Endpoint Info */}
                <details className="mt-3 pt-3 border-t border-[var(--border-color)]">
                    <summary className="text-xs text-[var(--accent-primary)] cursor-pointer hover:underline flex items-center gap-1">
                        <Code className="w-3 h-3" /> {t('viewApiEndpoint')}
                    </summary>
                    <div className="mt-2 space-y-3 text-xs overflow-hidden">
                        {/* Browser Test - GET */}
                        <div className="p-2 rounded bg-green-500/10 border border-green-500/20 overflow-hidden">
                            <p className="text-green-400 font-medium mb-1 flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> {t('api.testBrowser')}
                            </p>
                            <code className="text-[10px] break-all block">/api/playground?url=...</code>
                            <p className="text-[var(--text-muted)] text-[10px] mt-1">{t('api.testBrowserHint')}</p>
                        </div>

                        {/* POST Endpoint */}
                        <div className="p-2 rounded bg-[var(--bg-secondary)] font-mono overflow-hidden">
                            <span className="text-purple-400 font-bold">POST</span> <span className="text-[var(--text-primary)]">/api/playground</span>
                            <p className="text-[var(--text-muted)] text-[10px] mt-1 font-sans">{t('api.postHint')}</p>
                        </div>

                        {/* Request Body */}
                        <div className="overflow-hidden">
                            <p className="text-[var(--text-muted)] mb-1 font-medium flex items-center gap-1">
                                <Code className="w-3 h-3" /> {t('api.postBody')}
                            </p>
                            <pre className="p-2 rounded bg-[var(--bg-secondary)] font-mono text-[10px] overflow-x-auto">
                                {`{ "url": "https://..." }`}
                            </pre>
                        </div>

                        <p className="text-[var(--text-muted)] text-[10px] p-2 rounded bg-blue-500/10 border border-blue-500/20 flex items-start gap-1">
                            <Info className="w-3 h-3 text-blue-400 flex-shrink-0 mt-0.5" /> 
                            <span className="break-words">{t('api.noKeyRequired')}</span>
                        </p>
                    </div>
                </details>
            </div>

            {/* Platform Icons */}
            <div className="flex flex-wrap gap-2 justify-center">
                {PLATFORMS.map(p => (
                    <div key={p.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]">
                        <FontAwesomeIcon icon={p.icon} className={`w-4 h-4 ${p.iconColor}`} />
                        <span className="text-xs">{p.name}</span>
                    </div>
                ))}
            </div>

            {/* Input */}
            <div className="glass-card p-4 space-y-3 w-full max-w-full overflow-hidden box-border">
                <div className="flex gap-2 w-full max-w-full overflow-hidden">
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => {
                            setUrl(e.target.value);
                            if (e.target.value) validateUrl(e.target.value);
                            else setUrlError('');
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && !urlError && executeRequest()}
                        placeholder={t('placeholder')}
                        className={`flex-1 min-w-0 text-sm px-3 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] focus:border-[var(--accent-primary)] focus:outline-none ${
                            urlError ? 'border-red-500/50' : ''
                        }`}
                        style={{ maxWidth: 'calc(100% - 80px)' }}
                    />
                    <Button 
                        onClick={handlePaste} 
                        variant="secondary" 
                        leftIcon={<Clipboard className="w-4 h-4" />} 
                        className="flex-shrink-0"
                    >
                        {t('paste')}
                    </Button>
                </div>
                {urlError && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" /> 
                        <span className="truncate">{urlError}</span>
                    </p>
                )}
                <Button
                    onClick={executeRequest}
                    disabled={loading || !url.trim() || !!urlError || rateLimit.remaining === 0}
                    className="w-full"
                    leftIcon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                >
                    {loading ? tCommon('loading') : 
                     rateLimit.remaining === 0 ? t('rateLimited') : 
                     t('sendRequest')}
                </Button>
            </div>

            {/* Result */}
            {result && (
                <div className="glass-card p-4 space-y-3 w-full max-w-full overflow-hidden box-border">
                    {/* Status Header */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                            {result.success ? (
                                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">
                                    <CheckCircle className="w-3 h-3" /> {tCommon('success')}
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">
                                    <AlertCircle className="w-3 h-3" /> {tCommon('error')}
                                </span>
                            )}
                            {result.platform && (
                                <span className="px-2 py-1 rounded-full bg-[var(--bg-secondary)] text-xs capitalize">
                                    {result.platform}
                                </span>
                            )}
                            {result.data?.responseTime && (
                                <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                                    <Clock className="w-3 h-3" /> {result.data.responseTime}ms
                                </span>
                            )}
                        </div>
                        <button onClick={copyJson} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] flex-shrink-0">
                            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* Error Message */}
                    {!result.success && result.error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400 break-words overflow-hidden">
                            {result.error}
                        </div>
                    )}

                    {/* Success Content */}
                    {result.success && result.data && (
                        <div className="space-y-3 w-full max-w-full overflow-hidden">
                            {/* Media Info */}
                            <div className="flex gap-3 overflow-hidden">
                                {result.data.thumbnail && (
                                    <img 
                                        src={getProxiedThumbnail(result.data.thumbnail)} 
                                        alt="" 
                                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0" 
                                    />
                                )}
                                <div className="flex-1 min-w-0 overflow-hidden">
                                    <p className="font-medium text-sm line-clamp-1">
                                        {result.data.title || 'Untitled'}
                                    </p>
                                    {result.data.author && (
                                        <p className="text-xs text-[var(--text-muted)] truncate">
                                            @{result.data.author}
                                        </p>
                                    )}
                                    {result.data.usedCookie && (
                                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px]">
                                            🔒 Private
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Preview Button */}
                            {result.data.formats && result.data.formats.length > 0 && (
                                <button
                                    onClick={() => setShowGallery(true)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent-primary)] text-white font-medium hover:opacity-90 transition-opacity text-sm"
                                >
                                    <Eye className="w-4 h-4 flex-shrink-0" />
                                    <span>Preview ({result.data.formats.length})</span>
                                </button>
                            )}

                            {/* Formats List (collapsed) */}
                            {result.data.formats && result.data.formats.length > 0 && (
                                <details className="group">
                                    <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)]">
                                        {t('availableFormats')} ({result.data.formats.length})
                                    </summary>
                                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto overflow-x-hidden">
                                        {result.data.formats.slice(0, 5).map((fmt, i) => (
                                            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]">
                                                {fmt.type === 'video' ? 
                                                    <Film className="w-4 h-4 text-purple-400 flex-shrink-0" /> : 
                                                    <Image className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                                }
                                                <span className="text-xs flex-1 truncate min-w-0">
                                                    {fmt.quality || fmt.type || 'Media'}
                                                </span>
                                                <button
                                                    onClick={() => directDownload(
                                                        fmt.url, 
                                                        `${result.platform}_${Date.now()}.${fmt.type === 'video' ? 'mp4' : 'jpg'}`
                                                    )}
                                                    className="p-1.5 rounded hover:bg-green-500/20 text-green-400 flex-shrink-0"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        {result.data.formats.length > 5 && (
                                            <p className="text-xs text-[var(--text-muted)] text-center py-1">
                                                +{result.data.formats.length - 5} {t('moreFormats')}
                                            </p>
                                        )}
                                    </div>
                                </details>
                            )}
                        </div>
                    )}

                    {/* JSON Preview */}
                    <details className="group">
                        <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)]">
                            {t('viewJson')}
                        </summary>
                        <div className="mt-2 p-3 rounded-lg bg-[var(--bg-secondary)] overflow-hidden">
                            <pre className="text-[10px] font-mono whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                                {JSON.stringify(result, null, 2)}
                            </pre>
                        </div>
                    </details>
                </div>
            )}

            {/* Media Gallery */}
            {result?.success && result.data && (
                <MediaGallery
                    data={{
                        title: result.data.title || 'Untitled',
                        thumbnail: result.data.thumbnail || '',
                        author: result.data.author,
                        formats: (result.data.formats || []).map(f => ({
                            url: f.url,
                            quality: f.quality || 'Original',
                            type: (f.type as 'video' | 'image' | 'audio') || 'image',
                        })),
                        url: url,
                        responseTime: result.data.responseTime,
                    } as MediaData}
                    platform={(result.platform as PlatformId) || 'facebook'}
                    isOpen={showGallery}
                    onClose={() => setShowGallery(false)}
                />
            )}
        </div>
    );
}