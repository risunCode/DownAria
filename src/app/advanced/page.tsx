'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Code, Loader2, FileVideo, Cloud, AlertTriangle, Clipboard, ExternalLink, Download, Link2, Play, Clock, CheckCircle, AlertCircle, Copy, Check, Image, Film, Info, Bot, Eye, X } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import { Button } from '@/components/ui/Button';
import { MediaGallery } from '@/components/media';
import Announcements from '@/components/Announcements';
import Swal from 'sweetalert2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebook, faInstagram, faWeibo, faTwitter, faTiktok, faYoutube, IconDefinition } from '@fortawesome/free-brands-svg-icons';
import { PLATFORMS as TYPE_PLATFORMS, Platform, MediaData } from '@/lib/types';
import { useTranslations } from 'next-intl';
import { getProxyUrl } from '@/lib/api/proxy';

import { usePlayground } from '@/hooks';

type TabType = 'playground' | 'facebook-html' | 'proxy' | 'ai-chat';

// Proxy thumbnail URL for CORS-blocked CDNs (Instagram, Facebook, etc.)
function getProxiedThumbnail(url: string | undefined): string | undefined {
    if (!url) return undefined;
    // Check if URL needs proxying (Instagram/Facebook CDN)
    if (url.includes('fbcdn.net') || url.includes('cdninstagram.com') || url.includes('scontent')) {
        return getProxyUrl(url, { inline: true });
    }
    return url;
}

export default function AdvancedPage() {
    const [activeTab, setActiveTab] = useState<TabType>('playground');
    const t = useTranslations('advanced');

    return (
        <SidebarLayout>
            <Announcements page="advanced" />
            <div className="py-6 px-4 lg:px-8 overflow-x-hidden">
                <div className="max-w-4xl mx-auto space-y-6 overflow-hidden">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                        <h1 className="text-2xl font-bold gradient-text mb-2">{t('title')}</h1>
                        <p className="text-sm text-[var(--text-muted)]">{t('subtitle')}</p>
                    </motion.div>

                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-[var(--text-secondary)]">
                                <span className="font-medium text-amber-400">{t('warning.title')}</span> {t('warning.message')}
                            </p>
                        </div>
                    </motion.div>

                    <div className="flex flex-wrap gap-2">
                        <TabButton active={activeTab === 'playground'} onClick={() => setActiveTab('playground')} icon={<Play className="w-4 h-4" />} label={t('tabs.playground')} />
                        <TabButton active={activeTab === 'ai-chat'} onClick={() => setActiveTab('ai-chat')} icon={<Bot className="w-4 h-4" />} label="AI Chat" />
                        <TabButton active={activeTab === 'facebook-html'} onClick={() => setActiveTab('facebook-html')} icon={<Code className="w-4 h-4" />} label={t('tabs.fbHtml')} />
                        <TabButton active={activeTab === 'proxy'} onClick={() => setActiveTab('proxy')} icon={<Cloud className="w-4 h-4" />} label={t('tabs.proxy')} />
                    </div>

                    <AnimatePresence mode="wait">
                        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                            {activeTab === 'playground' && <ApiPlaygroundTab />}
                            {activeTab === 'facebook-html' && (
                                <Suspense fallback={<LoadingCard />}>
                                    <FacebookHtmlTab />
                                </Suspense>
                            )}
                            {activeTab === 'proxy' && <DirectProxyTab />}
                            {activeTab === 'ai-chat' && <AIChatTab />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </SidebarLayout>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-sm font-medium transition-all ${active
                ? 'bg-[var(--accent-primary)] text-white'
                : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
                }`}
        >
            {icon}
            {label}
        </button>
    );
}

function LoadingCard() {
    return <div className="glass-card p-5 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
}

// ═══════════════════════════════════════════════════════════════
// API PLAYGROUND TAB (Guest - Rate Limited)
// ═══════════════════════════════════════════════════════════════

// Platform icon mapping for advanced page
const PLATFORM_ICONS: Record<Platform, { icon: IconDefinition; color: string }> = {
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

function ApiPlaygroundTab() {
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
            const response = await fetch(proxyUrl, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            link.click();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            Swal.fire({ icon: 'success', title: 'Downloaded!', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        } catch {
            Swal.fire({ icon: 'error', title: 'Download failed', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
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
            const supportedDomains = ['facebook.com', 'fb.com', 'fb.watch', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com', 'weibo.com', 'weibo.cn', 'youtube.com', 'youtu.be'];
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

        try {
            const res = await fetch('/api/playground', {
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
                setResult({ success: false, error: err instanceof Error ? err.message : t('errors.requestFailed') });
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
            Swal.fire({ icon: 'error', title: t('pasteFailed'), timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
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
                        <div className={`text-lg font-bold ${rateLimit.remaining > 2 ? 'text-green-400' : rateLimit.remaining > 0 ? 'text-amber-400' : 'text-red-400'}`}>
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
                        className={`flex-1 min-w-0 text-sm px-3 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] focus:border-[var(--accent-primary)] focus:outline-none ${urlError ? 'border-red-500/50' : ''}`}
                        style={{ maxWidth: 'calc(100% - 80px)' }}
                    />
                    <Button onClick={handlePaste} variant="secondary" leftIcon={<Clipboard className="w-4 h-4" />} className="flex-shrink-0">
                        {t('paste')}
                    </Button>
                </div>
                {urlError && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{urlError}</span>
                    </p>
                )}
                <Button
                    onClick={executeRequest}
                    disabled={loading || !url.trim() || !!urlError || rateLimit.remaining === 0}
                    className="w-full"
                    leftIcon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                >
                    {loading ? tCommon('loading') : rateLimit.remaining === 0 ? t('rateLimited') : t('sendRequest')}
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
                                <span className="px-2 py-1 rounded-full bg-[var(--bg-secondary)] text-xs capitalize">{result.platform}</span>
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
                                    <img src={getProxiedThumbnail(result.data.thumbnail)} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0 overflow-hidden">
                                    <p className="font-medium text-sm line-clamp-1">{result.data.title || 'Untitled'}</p>
                                    {result.data.author && (
                                        <p className="text-xs text-[var(--text-muted)] truncate">@{result.data.author}</p>
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
                                                {fmt.type === 'video' ? <Film className="w-4 h-4 text-purple-400 flex-shrink-0" /> : <Image className="w-4 h-4 text-blue-400 flex-shrink-0" />}
                                                <span className="text-xs flex-1 truncate min-w-0">{fmt.quality || fmt.type || 'Media'}</span>
                                                <button
                                                    onClick={() => directDownload(fmt.url, `${result.platform}_${Date.now()}.${fmt.type === 'video' ? 'mp4' : 'jpg'}`)}
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
                    platform={(result.platform as Platform) || 'facebook'}
                    isOpen={showGallery}
                    onClose={() => setShowGallery(false)}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// FACEBOOK HTML TAB
// ═══════════════════════════════════════════════════════════════
interface ExtractedMedia {
    url: string;
    quality: string;
    type: 'video' | 'image';
    thumbnail?: string;
}

function FacebookHtmlTab() {
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
            const response = await fetch(proxyUrl, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
            if (!response.ok) throw new Error('Download failed');
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            link.click();
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            Swal.fire({ icon: 'success', title: 'Downloaded!', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        } catch {
            Swal.fire({ icon: 'error', title: 'Download failed', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        }
    };

    useEffect(() => {
        const urlParam = searchParams.get('url');
        if (urlParam && !fbUrl) setFbUrl(decodeURIComponent(urlParam));
    }, [searchParams, fbUrl]);

    const handlePasteUrl = async () => {
        if (fbUrl.trim()) { setFbUrl(''); setResults([]); }
        else {
            try { setFbUrl(await navigator.clipboard.readText()); }
            catch { Swal.fire({ icon: 'error', title: t('pasteFailed'), timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' }); }
        }
    };

    const handlePasteHtml = async () => {
        if (html.trim()) { setHtml(''); setHtmlSize(0); setResults([]); }
        else {
            try {
                const text = await navigator.clipboard.readText();
                setHtmlSize(text.length);
                setHtml(text);
                setTimeout(() => extractFromHtml(text), 100);
            } catch { Swal.fire({ icon: 'error', title: t('pasteFailed'), timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' }); }
        }
    };

    const decodeUrl = (s: string): string => {
        return s.replace(/\\u0025/g, '%').replace(/\\u0026/g, '&').replace(/\\u002F/g, '/').replace(/\\\//g, '/').replace(/\\"/g, '"').replace(/&amp;/g, '&');
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
            if (!found.length) Swal.fire({ icon: 'warning', title: t('noMediaFound'), timer: 2000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        } catch {
            Swal.fire({ icon: 'error', title: t('parseError'), timer: 2000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
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
                    <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white text-xs flex items-center justify-center font-bold">1</span>
                    <label className="text-sm font-medium">{t('step1')}</label>
                </div>
                <div className="flex gap-2">
                    <input type="url" value={fbUrl} onChange={(e) => setFbUrl(e.target.value)} placeholder="https://www.facebook.com/..." className="input-url text-sm flex-1" />
                    <Button onClick={handlePasteUrl} variant={fbUrl.trim() ? 'secondary' : 'primary'} leftIcon={<Clipboard className="w-4 h-4" />}>
                        {fbUrl.trim() ? t('clear') : t('paste')}
                    </Button>
                </div>
            </div>

            {/* Step 2 */}
            {fbUrl.trim() && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white text-xs flex items-center justify-center font-bold">2</span>
                        <label className="text-sm font-medium">{t('step2')}</label>
                    </div>
                    <div className="flex gap-2">
                        <input type="text" value={`view-source:${fbUrl}`} readOnly className="input-url text-sm flex-1 font-mono text-[var(--text-muted)]" />
                        <Button onClick={async () => {
                            await navigator.clipboard.writeText(`view-source:${fbUrl}`);
                            Swal.fire({ icon: 'success', title: t('copied'), text: t('copyHint'), timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
                        }} leftIcon={<Clipboard className="w-4 h-4" />}>{t('copy')}</Button>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{t('sourceHint')}</p>
                </div>
            )}

            {/* Step 3 */}
            {fbUrl.trim() && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white text-xs flex items-center justify-center font-bold">3</span>
                        <label className="text-sm font-medium">{t('step3')}</label>
                        {html.length > 0 && <span className="text-xs text-[var(--text-muted)]">({(html.length / 1024).toFixed(0)} KB)</span>}
                    </div>

                    {isLoading ? (
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-[var(--bg-secondary)]">
                            <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-primary)]" />
                            <span className="text-sm">{t('extracting')}</span>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                            <span className="text-sm text-green-400">✓ {t('found', { count: results.length })}</span>
                            <Button size="sm" variant="secondary" onClick={() => { setResults([]); setHtml(''); }} leftIcon={<Clipboard className="w-3 h-3" />}>{t('extractNew')}</Button>
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
                            <FileVideo className={`w-5 h-5 ${item.quality.includes('HD') ? 'text-purple-400' : 'text-amber-400'}`} />
                            <span className={`px-2 py-0.5 text-xs rounded ${item.quality.includes('HD') ? 'bg-purple-500/20 text-purple-400' : 'bg-amber-500/20 text-amber-400'}`}>{item.quality}</span>
                            <div className="flex-1" />
                            <button onClick={() => window.open(item.url, '_blank')} className="p-2 hover:bg-[var(--bg-card)] rounded"><ExternalLink className="w-4 h-4" /></button>
                            <button onClick={() => directDownload(item.url, `FB_${Date.now()}.mp4`)} className="p-2 hover:bg-green-500/10 text-green-400 rounded"><Download className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// DIRECT PROXY TAB - Inline Download with History
// ═══════════════════════════════════════════════════════════════

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

function DirectProxyTab() {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState('');
    const [filename, setFilename] = useState('');
    const [fileSize, setFileSize] = useState('');
    const [downloads, setDownloads] = useState<ProxyDownloadItem[]>([]);
    const t = useTranslations('advanced.proxy');

    const handlePaste = async () => {
        if (url.trim()) { setUrl(''); setDownloadUrl(''); setFilename(''); setFileSize(''); }
        else {
            try {
                const text = await navigator.clipboard.readText();
                setUrl(text);
                processUrl(text);
            } catch { Swal.fire({ icon: 'error', title: t('pasteFailed'), timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' }); }
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
                    if (nameMatch) { extractedFilename = nameMatch[1]; extractedSize = nameMatch[2]; }
                    finalUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
                }
            } else if (inputUrl.includes('dropbox.com')) {
                finalUrl = inputUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
            }

            if (!extractedFilename) {
                try { extractedFilename = decodeURIComponent(new URL(finalUrl).pathname.split('/').pop() || ''); } catch { }
            }

            setDownloadUrl(finalUrl);
            setFilename(extractedFilename || `download_${Date.now()}`);
            setFileSize(extractedSize);
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', timer: 2000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
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
                platform: 'generic' as Platform,
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
                d.id === downloadId ? { ...d, status: 'error', error: err instanceof Error ? err.message : 'Download failed' } : d
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
                        <span key={s} className="px-2 py-1 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">{s}</span>
                    ))}
                </div>

                <div className="flex gap-2">
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => { setUrl(e.target.value); if (e.target.value.startsWith('http')) processUrl(e.target.value); }}
                        placeholder="https://drive.google.com/file/d/..."
                        className="input-url text-sm flex-1"
                    />
                    <Button onClick={handlePaste} variant={url.trim() ? 'secondary' : 'primary'} disabled={isLoading}
                        leftIcon={isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clipboard className="w-4 h-4" />}>
                        {url.trim() ? t('clear') : t('paste')}
                    </Button>
                </div>

                {downloadUrl && (
                    <div className="space-y-3 pt-4 border-t border-[var(--border-color)]">
                        <div className="p-2 rounded bg-[var(--bg-secondary)] text-xs font-mono break-words overflow-hidden">{downloadUrl}</div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <input type="text" value={filename} onChange={(e) => setFilename(e.target.value)} className="input-url text-sm flex-1 min-w-0" />
                            {fileSize && <span className="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400 text-center flex-shrink-0">{fileSize}</span>}
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={handleDownload} leftIcon={<Download className="w-4 h-4" />}>{t('download')}</Button>
                            <Button variant="secondary" onClick={() => window.open(downloadUrl, '_blank')} leftIcon={<Link2 className="w-4 h-4" />}>{t('open')}</Button>
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
                                    {item.status === 'downloading' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" />}
                                    {item.status === 'done' && <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />}
                                    {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                                    
                                    <span className="text-sm font-medium truncate flex-1 min-w-0">{item.filename}</span>
                                    
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
                                            <span>{formatSize(item.loaded)} / {item.total ? formatSize(item.total) : '?'}</span>
                                            <span className="text-purple-400">{formatSpeed(item.speed)} · {item.progress}%</span>
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
                                    <div className="text-xs text-red-400">{item.error || 'Download failed'}</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}


// Re-export from utility for backward compatibility
export { getUserDiscordSettings, sendDiscordNotification } from '@/lib/utils/discord-webhook';

// ═══════════════════════════════════════════════════════════════
// AI CHAT TAB
// ═══════════════════════════════════════════════════════════════
function AIChatTab() {
    const { ChatContainer } = require('@/components/chat');
    
    return <ChatContainer />;
}
