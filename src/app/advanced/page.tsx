'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Code, Loader2, FileVideo, Cloud, AlertTriangle, Clipboard, ExternalLink, Download, Link2, Play, Clock, CheckCircle, AlertCircle, Copy, Check, Image, Film, Webhook, Send, MessageSquare, Info, Bell, BellOff } from 'lucide-react';
import { SidebarLayout } from '@/components/Sidebar';
import { Button } from '@/components/ui/Button';
import { useDownloadManager } from '@/components/DownloadManager';
import Announcements from '@/components/Announcements';
import Swal from 'sweetalert2';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFacebook, faInstagram, faYoutube, faWeibo, faTwitter, faTiktok } from '@fortawesome/free-brands-svg-icons';

type TabType = 'playground' | 'facebook-html' | 'proxy' | 'discord';

export default function AdvancedPage() {
    const [activeTab, setActiveTab] = useState<TabType>('playground');

    return (
        <SidebarLayout>
            <Announcements page="advanced" />
            <div className="py-6 px-4 lg:px-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                        <h1 className="text-2xl font-bold gradient-text mb-2">Advanced Tools</h1>
                        <p className="text-sm text-[var(--text-muted)]">Power user features - extractors and proxies</p>
                    </motion.div>

                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-[var(--text-secondary)]">
                                <span className="font-medium text-amber-400">⚠️ Experimental:</span> These tools are for advanced users. Use responsibly.
                            </p>
                        </div>
                    </motion.div>

                    <div className="flex flex-wrap gap-2">
                        <TabButton active={activeTab === 'playground'} onClick={() => setActiveTab('playground')} icon={<Play className="w-4 h-4" />} label="API Playground" />
                        <TabButton active={activeTab === 'facebook-html'} onClick={() => setActiveTab('facebook-html')} icon={<Code className="w-4 h-4" />} label="FB HTML Extractor" />
                        <TabButton active={activeTab === 'proxy'} onClick={() => setActiveTab('proxy')} icon={<Cloud className="w-4 h-4" />} label="Direct Proxy" />
                        <TabButton active={activeTab === 'discord'} onClick={() => setActiveTab('discord')} icon={<Webhook className="w-4 h-4" />} label="Discord Webhook" />
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
                            {activeTab === 'discord' && <DiscordWebhookTab />}
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
            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
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

const PLATFORMS = [
    { id: 'facebook', name: 'Facebook', icon: faFacebook, color: 'text-blue-500', placeholder: 'https://www.facebook.com/share/p/...' },
    { id: 'instagram', name: 'Instagram', icon: faInstagram, color: 'text-pink-500', placeholder: 'https://www.instagram.com/p/...' },
    { id: 'twitter', name: 'Twitter/X', icon: faTwitter, color: 'text-sky-400', placeholder: 'https://x.com/user/status/...' },
    { id: 'tiktok', name: 'TikTok', icon: faTiktok, color: 'text-pink-400', placeholder: 'https://www.tiktok.com/@user/video/...' },
    { id: 'youtube', name: 'YouTube', icon: faYoutube, color: 'text-red-500', placeholder: 'https://www.youtube.com/watch?v=...' },
    { id: 'weibo', name: 'Weibo', icon: faWeibo, color: 'text-orange-500', placeholder: 'https://weibo.com/...' },
];

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
}

function ApiPlaygroundTab() {
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<PlaygroundResult | null>(null);
    const [copied, setCopied] = useState(false);
    const [rateLimit, setRateLimit] = useState({ remaining: 5, limit: 5 });
    const { startDownload } = useDownloadManager();

    const executeRequest = async () => {
        if (!url.trim()) return;
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
        } catch (err) {
            setResult({ success: false, error: err instanceof Error ? err.message : 'Request failed' });
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
            Swal.fire({ icon: 'error', title: 'Paste failed', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        }
    };

    return (
        <div className="space-y-4">
            {/* Info Card */}
            <div className="glass-card p-4">
                <div className="flex items-start gap-3">
                    <Play className="w-5 h-5 text-[var(--accent-primary)] shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h2 className="font-semibold">API Playground</h2>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            Test the download API without authentication. Rate limited to {rateLimit.limit} requests/minute.
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-[var(--text-muted)]">Remaining</div>
                        <div className={`text-lg font-bold ${rateLimit.remaining > 2 ? 'text-green-400' : rateLimit.remaining > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                            {rateLimit.remaining}/{rateLimit.limit}
                        </div>
                    </div>
                </div>
            </div>

            {/* Platform Icons */}
            <div className="flex flex-wrap gap-2 justify-center">
                {PLATFORMS.map(p => (
                    <div key={p.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)]">
                        <FontAwesomeIcon icon={p.icon} className={`w-4 h-4 ${p.color}`} />
                        <span className="text-xs">{p.name}</span>
                    </div>
                ))}
            </div>

            {/* Input */}
            <div className="glass-card p-4 space-y-3">
                <div className="flex gap-2">
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && executeRequest()}
                        placeholder="Paste any social media URL..."
                        className="input-url text-sm flex-1"
                    />
                    <Button onClick={handlePaste} variant="secondary" leftIcon={<Clipboard className="w-4 h-4" />}>
                        Paste
                    </Button>
                </div>
                <Button 
                    onClick={executeRequest} 
                    disabled={loading || !url.trim() || rateLimit.remaining === 0}
                    className="w-full"
                    leftIcon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                >
                    {loading ? 'Processing...' : rateLimit.remaining === 0 ? 'Rate Limited' : 'Send Request'}
                </Button>
            </div>

            {/* Result */}
            {result && (
                <div className="glass-card p-4 space-y-3">
                    {/* Status Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {result.success ? (
                                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">
                                    <CheckCircle className="w-3 h-3" /> Success
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold">
                                    <AlertCircle className="w-3 h-3" /> Error
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
                        <button onClick={copyJson} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]">
                            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* Error Message */}
                    {!result.success && result.error && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
                            {result.error}
                        </div>
                    )}

                    {/* Success Content */}
                    {result.success && result.data && (
                        <div className="space-y-3">
                            {/* Media Info */}
                            <div className="flex gap-3">
                                {result.data.thumbnail && (
                                    <img src={result.data.thumbnail} alt="" className="w-20 h-20 rounded-lg object-cover" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{result.data.title || 'Untitled'}</p>
                                    {result.data.author && (
                                        <p className="text-xs text-[var(--text-muted)]">@{result.data.author}</p>
                                    )}
                                    {result.data.usedCookie && (
                                        <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px]">
                                            🔒 Private content
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Formats */}
                            {result.data.formats && result.data.formats.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-medium text-[var(--text-muted)]">Available Formats ({result.data.formats.length})</p>
                                    <div className="space-y-1 max-h-40 overflow-y-auto">
                                        {result.data.formats.slice(0, 5).map((fmt, i) => (
                                            <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-secondary)]">
                                                {fmt.type === 'video' ? <Film className="w-4 h-4 text-purple-400" /> : <Image className="w-4 h-4 text-blue-400" />}
                                                <span className="text-xs flex-1 truncate">{fmt.quality || fmt.type || 'Media'}</span>
                                                <button 
                                                    onClick={() => startDownload(fmt.url, `${result.platform}_${Date.now()}.${fmt.type === 'video' ? 'mp4' : 'jpg'}`, result.platform || 'generic')}
                                                    className="p-1.5 rounded hover:bg-green-500/20 text-green-400"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        {result.data.formats.length > 5 && (
                                            <p className="text-xs text-[var(--text-muted)] text-center py-1">
                                                +{result.data.formats.length - 5} more formats
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* JSON Preview */}
                    <details className="group">
                        <summary className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-primary)]">
                            View JSON Response
                        </summary>
                        <pre className="mt-2 p-3 rounded-lg bg-[var(--bg-secondary)] text-[10px] font-mono overflow-x-auto overflow-y-auto max-h-48 max-w-full whitespace-pre-wrap break-all">
                            {JSON.stringify(result, null, 2)}
                        </pre>
                    </details>
                </div>
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
    const { startDownload } = useDownloadManager();
    const [htmlSize, setHtmlSize] = useState(0);

    useEffect(() => {
        const urlParam = searchParams.get('url');
        if (urlParam && !fbUrl) setFbUrl(decodeURIComponent(urlParam));
    }, [searchParams, fbUrl]);

    const handlePasteUrl = async () => {
        if (fbUrl.trim()) { setFbUrl(''); setResults([]); }
        else {
            try { setFbUrl(await navigator.clipboard.readText()); }
            catch { Swal.fire({ icon: 'error', title: 'Paste failed', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' }); }
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
            } catch { Swal.fire({ icon: 'error', title: 'Paste failed', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' }); }
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

            const patterns = [
                { re: /"playable_url_quality_hd":"([^"]+)"/g, q: 'HD Video' },
                { re: /"hd_src":"([^"]+)"/g, q: 'HD Video' },
                { re: /"playable_url":"([^"]+)"/g, q: 'SD Video' },
                { re: /"sd_src":"([^"]+)"/g, q: 'SD Video' },
            ];

            for (const { re, q } of patterns) {
                re.lastIndex = 0;
                let m;
                while ((m = re.exec(decoded)) !== null) {
                    const url = decodeUrl(m[1]);
                    if (url.includes('.mp4') && !seenUrls.has(url)) {
                        seenUrls.add(url);
                        found.push({ url, quality: q, type: 'video' });
                    }
                }
            }

            setResults(found);
            setHtml('');
            if (!found.length) Swal.fire({ icon: 'warning', title: 'No media found', timer: 2000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        } catch {
            Swal.fire({ icon: 'error', title: 'Parse error', timer: 2000, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-card p-5 space-y-5">
            <div className="flex items-center gap-3">
                <FileVideo className="w-5 h-5 text-blue-500" />
                <div>
                    <h2 className="font-semibold">Facebook HTML Extractor</h2>
                    <p className="text-xs text-[var(--text-muted)]">Extract videos from private posts via page source</p>
                </div>
            </div>

            {/* Step 1 */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white text-xs flex items-center justify-center font-bold">1</span>
                    <label className="text-sm font-medium">Facebook URL</label>
                </div>
                <div className="flex gap-2">
                    <input type="url" value={fbUrl} onChange={(e) => setFbUrl(e.target.value)} placeholder="https://www.facebook.com/..." className="input-url text-sm flex-1" />
                    <Button onClick={handlePasteUrl} variant={fbUrl.trim() ? 'secondary' : 'primary'} leftIcon={<Clipboard className="w-4 h-4" />}>
                        {fbUrl.trim() ? 'Clear' : 'Paste'}
                    </Button>
                </div>
            </div>

            {/* Step 2 */}
            {fbUrl.trim() && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white text-xs flex items-center justify-center font-bold">2</span>
                        <label className="text-sm font-medium">View Source URL</label>
                    </div>
                    <div className="flex gap-2">
                        <input type="text" value={`view-source:${fbUrl}`} readOnly className="input-url text-sm flex-1 font-mono text-[var(--text-muted)]" />
                        <Button onClick={async () => {
                            await navigator.clipboard.writeText(`view-source:${fbUrl}`);
                            Swal.fire({ icon: 'success', title: 'Copied!', text: 'Paste in new tab', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' });
                        }} leftIcon={<Clipboard className="w-4 h-4" />}>Copy</Button>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">Open in new tab → Ctrl+A → Ctrl+C</p>
                </div>
            )}

            {/* Step 3 */}
            {fbUrl.trim() && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-white text-xs flex items-center justify-center font-bold">3</span>
                        <label className="text-sm font-medium">Paste HTML Source</label>
                        {html.length > 0 && <span className="text-xs text-[var(--text-muted)]">({(html.length / 1024).toFixed(0)} KB)</span>}
                    </div>
                    
                    {isLoading ? (
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-[var(--bg-secondary)]">
                            <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-primary)]" />
                            <span className="text-sm">Extracting media URLs...</span>
                        </div>
                    ) : results.length > 0 ? (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                            <span className="text-sm text-green-400">✓ Found {results.length} media</span>
                            <Button size="sm" variant="secondary" onClick={() => { setResults([]); setHtml(''); }} leftIcon={<Clipboard className="w-3 h-3" />}>Extract New</Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <textarea
                                value={html}
                                onChange={(e) => setHtml(e.target.value)}
                                placeholder="Paste the entire HTML source code here (Ctrl+V)..."
                                className="w-full h-32 px-3 py-2 text-xs bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg font-mono resize-none focus:outline-none focus:border-[var(--accent-primary)]"
                            />
                            <div className="flex gap-2">
                                <Button 
                                    onClick={() => extractFromHtml(html)} 
                                    disabled={!html.trim()}
                                    leftIcon={<FileVideo className="w-4 h-4" />}
                                >
                                    Extract Media
                                </Button>
                                <Button 
                                    variant="secondary"
                                    onClick={handlePasteHtml}
                                    leftIcon={<Clipboard className="w-4 h-4" />}
                                >
                                    Paste from Clipboard
                                </Button>
                            </div>
                            <p className="text-xs text-[var(--text-muted)]">
                                Tip: If paste button doesn&apos;t work, manually paste (Ctrl+V) into the box above
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
                            <button onClick={() => startDownload(item.url, `FB_${Date.now()}.mp4`, 'facebook')} className="p-2 hover:bg-green-500/10 text-green-400 rounded"><Download className="w-4 h-4" /></button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// DIRECT PROXY TAB
// ═══════════════════════════════════════════════════════════════
function DirectProxyTab() {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState('');
    const [filename, setFilename] = useState('');
    const [fileSize, setFileSize] = useState('');
    const { startDownload } = useDownloadManager();

    const handlePaste = async () => {
        if (url.trim()) { setUrl(''); setDownloadUrl(''); setFilename(''); setFileSize(''); }
        else {
            try {
                const text = await navigator.clipboard.readText();
                setUrl(text);
                processUrl(text);
            } catch { Swal.fire({ icon: 'error', title: 'Paste failed', timer: 1500, showConfirmButton: false, background: 'var(--bg-card)', color: 'var(--text-primary)' }); }
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
                    const res = await fetch(`/api/proxy?url=${encodeURIComponent(`https://drive.google.com/file/d/${fileId}/view`)}&platform=generic&head=0`);
                    const html = await res.text();
                    const nameMatch = html.match(/<span class="uc-name-size"><a[^>]*>([^<]+)<\/a>\s*\(([^)]+)\)/);
                    if (nameMatch) { extractedFilename = nameMatch[1]; extractedSize = nameMatch[2]; }
                    finalUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
                }
            } else if (inputUrl.includes('dropbox.com')) {
                finalUrl = inputUrl.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
            }

            if (!extractedFilename) {
                try { extractedFilename = decodeURIComponent(new URL(finalUrl).pathname.split('/').pop() || ''); } catch {}
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

    return (
        <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-3">
                <Cloud className="w-5 h-5 text-purple-500" />
                <div>
                    <h2 className="font-semibold">Direct Link Proxy</h2>
                    <p className="text-xs text-[var(--text-muted)]">Download from Google Drive, Dropbox, Mediafire</p>
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
                    {url.trim() ? 'Clear' : 'Paste'}
                </Button>
            </div>

            {downloadUrl && (
                <div className="space-y-3 pt-4 border-t border-[var(--border-color)]">
                    <div className="p-2 rounded bg-[var(--bg-secondary)] text-xs font-mono break-all">{downloadUrl}</div>
                    <div className="flex items-center gap-2">
                        <input type="text" value={filename} onChange={(e) => setFilename(e.target.value)} className="input-url text-sm flex-1" />
                        {fileSize && <span className="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400">{fileSize}</span>}
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => startDownload(downloadUrl, filename, 'generic')} leftIcon={<Download className="w-4 h-4" />}>Download</Button>
                        <Button variant="secondary" onClick={() => window.open(downloadUrl, '_blank')} leftIcon={<Link2 className="w-4 h-4" />}>Open</Button>
                    </div>
                </div>
            )}
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════
// DISCORD WEBHOOK TAB (User - localStorage)
// ═══════════════════════════════════════════════════════════════

import { 
    UserDiscordSettings, 
    DEFAULT_USER_DISCORD, 
    DISCORD_STORAGE_KEY,
    getUserDiscordSettings,
    saveUserDiscordSettings,
    sendDiscordNotification 
} from '@/lib/utils/discord-webhook';

function DiscordWebhookTab() {
    const [settings, setSettings] = useState<UserDiscordSettings>(DEFAULT_USER_DISCORD);
    const [testMessage, setTestMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showTips, setShowTips] = useState(false);

    // Load from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(DISCORD_STORAGE_KEY);
            if (saved) {
                setSettings({ ...DEFAULT_USER_DISCORD, ...JSON.parse(saved) });
            }
        } catch {}
    }, []);

    // Save to localStorage
    const saveSettings = (newSettings: UserDiscordSettings) => {
        setSettings(newSettings);
        saveUserDiscordSettings(newSettings);
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Settings saved',
            showConfirmButton: false,
            timer: 1500,
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
    };

    const updateSetting = <K extends keyof UserDiscordSettings>(key: K, value: UserDiscordSettings[K]) => {
        const newSettings = { ...settings, [key]: value };
        saveSettings(newSettings);
    };

    const sendTestMessage = async () => {
        if (!settings.webhookUrl) {
            setResult({ success: false, message: 'Set webhook URL first' });
            return;
        }

        setIsSending(true);
        setResult(null);

        try {
            const payload: Record<string, unknown> = {
                username: 'XTFetch',
                avatar_url: 'https://xtfetch.vercel.app/icon.png',
            };

            if (testMessage.trim()) {
                payload.content = testMessage.trim();
            }

            if (settings.embedEnabled) {
                payload.embeds = [{
                    title: '🎬 Test Download Notification',
                    description: testMessage.trim() || 'This is a test message from XTFetch!',
                    color: parseInt(settings.embedColor.replace('#', ''), 16),
                    fields: [
                        { name: 'Platform', value: 'YouTube', inline: true },
                        { name: 'Quality', value: 'HD 1080p', inline: true },
                    ],
                    footer: {
                        text: settings.footerText || 'via XTFetch',
                        icon_url: 'https://xtfetch.vercel.app/icon.png',
                    },
                    timestamp: new Date().toISOString(),
                }];
            }

            const res = await fetch(settings.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok || res.status === 204) {
                setResult({ success: true, message: 'Message sent!' });
                setTestMessage('');
            } else {
                const error = await res.text();
                setResult({ success: false, message: error || `Error ${res.status}` });
            }
        } catch (err) {
            setResult({ success: false, message: err instanceof Error ? err.message : 'Failed to send' });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Info Card */}
            <div className="glass-card p-4">
                <div className="flex items-start gap-3">
                    <Webhook className="w-5 h-5 text-[#5865F2] shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h2 className="font-semibold">Discord Webhook</h2>
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            Get notified on Discord when downloads complete. Your webhook URL is stored locally.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowTips(!showTips)}
                        className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                    >
                        <Info className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Tips */}
            {showTips && (
                <div className="glass-card p-4 bg-blue-500/5 border-blue-500/20">
                    <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-400" />
                        How to get Discord Webhook URL
                    </h3>
                    <ol className="text-xs text-[var(--text-muted)] space-y-1 list-decimal list-inside">
                        <li>Open Discord and go to your server</li>
                        <li>Right-click a channel → Edit Channel</li>
                        <li>Go to Integrations → Webhooks</li>
                        <li>Click "New Webhook" or use existing one</li>
                        <li>Click "Copy Webhook URL"</li>
                        <li>Paste it below!</li>
                    </ol>
                </div>
            )}

            {/* Settings */}
            <div className="glass-card p-4 space-y-4">
                {/* Webhook URL */}
                <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Webhook URL</label>
                    <input
                        type="url"
                        value={settings.webhookUrl}
                        onChange={e => updateSetting('webhookUrl', e.target.value)}
                        placeholder="https://discord.com/api/webhooks/..."
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono"
                    />
                </div>

                {/* Auto Send Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-3">
                        {settings.autoSend ? (
                            <Bell className="w-5 h-5 text-green-400" />
                        ) : (
                            <BellOff className="w-5 h-5 text-[var(--text-muted)]" />
                        )}
                        <div>
                            <p className="text-sm font-medium">Auto-send on download</p>
                            <p className="text-xs text-[var(--text-muted)]">Automatically notify when download completes</p>
                        </div>
                    </div>
                    <button
                        onClick={() => updateSetting('autoSend', !settings.autoSend)}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                            settings.autoSend ? 'bg-green-500' : 'bg-[var(--bg-card)]'
                        }`}
                    >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                            settings.autoSend ? 'left-7' : 'left-1'
                        }`} />
                    </button>
                </div>

                {/* Embed Settings */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={settings.embedEnabled}
                            onChange={e => updateSetting('embedEnabled', e.target.checked)}
                            className="rounded"
                        />
                        Use rich embed (recommended)
                    </label>

                    {settings.embedEnabled && (
                        <div className="grid grid-cols-2 gap-3 pl-6">
                            <div>
                                <label className="block text-xs text-[var(--text-muted)] mb-1">Embed Color</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={settings.embedColor}
                                        onChange={e => updateSetting('embedColor', e.target.value)}
                                        className="w-10 h-9 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={settings.embedColor}
                                        onChange={e => updateSetting('embedColor', e.target.value)}
                                        className="flex-1 px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-mono"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-[var(--text-muted)] mb-1">Footer Text</label>
                                <input
                                    type="text"
                                    value={settings.footerText}
                                    onChange={e => updateSetting('footerText', e.target.value)}
                                    placeholder="via XTFetch"
                                    className="w-full px-2 py-1.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Test Message */}
            <div className="glass-card p-4 space-y-3">
                <h3 className="font-medium text-sm flex items-center gap-2">
                    <Send className="w-4 h-4 text-[var(--accent-primary)]" />
                    Send Test Message
                </h3>
                <textarea
                    value={testMessage}
                    onChange={e => setTestMessage(e.target.value)}
                    placeholder="Optional message content..."
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm resize-none"
                    rows={2}
                />
                <div className="flex items-center gap-3">
                    <Button
                        onClick={sendTestMessage}
                        disabled={isSending || !settings.webhookUrl}
                        leftIcon={isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    >
                        {isSending ? 'Sending...' : 'Send Test'}
                    </Button>
                    {result && (
                        <span className={`text-sm ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                            {result.success ? '✓' : '✗'} {result.message}
                        </span>
                    )}
                </div>
            </div>

            {/* Preview */}
            {settings.webhookUrl && settings.embedEnabled && (
                <div className="glass-card p-4">
                    <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Preview
                    </h3>
                    <div className="bg-[#313338] rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center overflow-hidden shrink-0">
                                <img src="/icon.png" alt="XT" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-white text-sm">XTFetch</span>
                                    <span className="px-1 py-0.5 text-[10px] bg-[#5865F2] text-white rounded">BOT</span>
                                </div>
                                <div className="rounded overflow-hidden max-w-md" style={{ borderLeft: `4px solid ${settings.embedColor}`, backgroundColor: '#2B2D31' }}>
                                    <div className="p-3">
                                        <h3 className="text-[#00A8FC] font-semibold text-sm mb-1">🎬 Download Complete</h3>
                                        <p className="text-[#DBDEE1] text-sm">Your video has been downloaded successfully!</p>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <div>
                                                <div className="text-xs text-white font-semibold">Platform</div>
                                                <div className="text-xs text-[#DBDEE1]">YouTube</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-white font-semibold">Quality</div>
                                                <div className="text-xs text-[#DBDEE1]">HD 1080p</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#3F4147]">
                                            <img src="/icon.png" alt="" className="w-4 h-4 rounded-full" />
                                            <span className="text-[#949BA4] text-xs">{settings.footerText || 'via XTFetch'}</span>
                                            <span className="text-[#949BA4] text-xs">• Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Re-export from utility for backward compatibility
export { getUserDiscordSettings, sendDiscordNotification } from '@/lib/utils/discord-webhook';
