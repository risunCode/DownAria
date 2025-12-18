'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Play, Copy, Check, Clock, AlertCircle, CheckCircle, 
    X, RefreshCw, Image, Film, Download, Code, Zap,
    ExternalLink, ChevronDown
} from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGlobe, faLock, faKey, faUserEdit, faChartBar, faMusic } from '@fortawesome/free-solid-svg-icons';
import { faFacebook, faInstagram, faYoutube, faWeibo, faTwitter } from '@fortawesome/free-brands-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface EndpointBase {
    id: string;
    name: string;
    icon: IconDefinition;
    iconColor: string;
    path: string;
    method: 'GET' | 'POST';
    description: string;
    samples: { name: string; url: string }[];
}

interface PlatformStats {
    enabled: boolean;
    avgResponseTime: number;
    successRate: number;
}

const ENDPOINT_CONFIGS: EndpointBase[] = [
    { 
        id: 'facebook', name: 'Facebook', icon: faFacebook, iconColor: 'text-blue-500', path: '/api', method: 'POST',
        description: 'Download videos, reels, stories & images',
        samples: [
            { name: 'Public Post (5 images)', url: 'https://www.facebook.com/share/p/1HBDxpAhPu/' },
            { name: 'Reel HD+SD', url: 'https://www.facebook.com/share/r/1A1cbTcJjn/' },
            { name: 'Group Post', url: 'https://web.facebook.com/share/p/17UTWNWYUb/' },
        ]
    },
    { 
        id: 'instagram', name: 'Instagram', icon: faInstagram, iconColor: 'text-pink-500', path: '/api', method: 'POST',
        description: 'Reels, posts, stories via Embed API',
        samples: [
            { name: 'Reel Video', url: 'https://www.instagram.com/reel/DKxABC123/' },
            { name: 'Carousel Post', url: 'https://www.instagram.com/p/DKxABC123/' },
        ]
    },
    { 
        id: 'twitter', name: 'Twitter/X', icon: faTwitter, iconColor: 'text-sky-400', path: '/api', method: 'POST',
        description: 'Videos & images via Syndication API',
        samples: [
            { name: 'Video Tweet', url: 'https://x.com/elonmusk/status/1234567890' },
        ]
    },
    { 
        id: 'tiktok', name: 'TikTok', icon: faMusic, iconColor: 'text-pink-400', path: '/api', method: 'POST',
        description: 'No watermark videos via TikWM',
        samples: [
            { name: 'TikTok Video', url: 'https://www.tiktok.com/@tiktok/video/7000000000000000000' },
        ]
    },
    { 
        id: 'youtube', name: 'YouTube', icon: faYoutube, iconColor: 'text-red-500', path: '/api', method: 'POST',
        description: 'Videos & Shorts via Innertube (360p)',
        samples: [
            { name: 'YouTube Video', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        ]
    },
    { 
        id: 'weibo', name: 'Weibo', icon: faWeibo, iconColor: 'text-orange-500', path: '/api', method: 'POST',
        description: 'Requires cookie (SUB)',
        samples: [
            { name: 'Weibo Post', url: 'https://weibo.com/1234567890/abc123' },
        ]
    },
];

interface TestEndpoint {
    name: string;
    path: string;
    icon: IconDefinition;
    iconColor: string;
}

const TEST_ENDPOINTS: TestEndpoint[] = [
    { name: 'Service Status', path: '/api/status', icon: faChartBar, iconColor: 'text-green-400' },
];

interface ApiResult { status: number; data: unknown; timing: number; }
interface AdminCookieStatus { [platform: string]: boolean; }

export default function PlaygroundPage() {
    const [modalEndpoint, setModalEndpoint] = useState<EndpointBase | null>(null);
    const [url, setUrl] = useState('');
    const [cookie, setCookie] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ApiResult | null>(null);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'gallery' | 'json'>('gallery');
    const [showSamples, setShowSamples] = useState(false);
    const [adminCookies, setAdminCookies] = useState<AdminCookieStatus>({});
    const [platformStats, setPlatformStats] = useState<Record<string, PlatformStats>>({});

    // Fetch admin cookie status and platform stats on mount
    useEffect(() => {
        fetch('/api/admin/cookies/status')
            .then(res => res.json())
            .then(data => setAdminCookies(data))
            .catch(() => {});
        
        // Fetch real stats from service config (admin API)
        fetch('/api/admin/services')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data?.platforms) {
                    const stats: Record<string, PlatformStats> = {};
                    for (const [id, p] of Object.entries(data.data.platforms) as [string, { enabled: boolean; stats: { totalRequests: number; successCount: number; avgResponseTime: number } }][]) {
                        const total = p.stats?.totalRequests || 0;
                        const success = p.stats?.successCount || 0;
                        stats[id] = {
                            enabled: p.enabled,
                            avgResponseTime: Math.round(p.stats?.avgResponseTime || 0),
                            successRate: total > 0 ? Math.round((success / total) * 100) : 0
                        };
                    }
                    setPlatformStats(stats);
                }
            })
            .catch(() => {});
    }, []);

    const openModal = (ep: EndpointBase) => {
        setModalEndpoint(ep);
        setUrl('');
        setCookie('');
        setResult(null);
        setActiveTab('gallery');
    };
    
    const hasAdminCookie = modalEndpoint ? adminCookies[modalEndpoint.id] : false;

    const closeModal = () => { setModalEndpoint(null); setResult(null); };

    const executeRequest = async () => {
        if (!modalEndpoint || !url.trim()) return;
        setLoading(true);
        const start = Date.now();
        try {
            const body: Record<string, string> = { url: url.trim() };
            if (cookie.trim()) body.cookie = cookie.trim();
            
            const res = await fetch(modalEndpoint.path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            setResult({ status: res.status, data, timing: Date.now() - start });
        } catch (err) {
            setResult({ status: 0, data: { error: err instanceof Error ? err.message : 'Failed' }, timing: Date.now() - start });
        } finally { setLoading(false); }
    };

    const selectSample = (sampleUrl: string) => { setUrl(sampleUrl); setShowSamples(false); };
    const copyJson = async () => {
        if (!result) return;
        await navigator.clipboard.writeText(JSON.stringify(result.data, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const isSuccess = result?.status && result.status >= 200 && result.status < 300;

    return (
        <div className="p-4 lg:p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <Code className="w-5 h-5 text-[var(--accent-primary)]" />
                        API Playground
                    </h1>
                    <p className="text-[var(--text-muted)] text-sm">Test API endpoints directly</p>
                </div>

                {/* POST Endpoints Grid */}
                <div>
                    <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-3 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-blue-500/20 text-blue-400">POST</span>
                        Download Endpoints
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ENDPOINT_CONFIGS.map((ep, i) => {
                            const stats = platformStats[ep.id];
                            const isEnabled = stats?.enabled !== false; // default true if not loaded
                            const avgTime = stats?.avgResponseTime ? `${stats.avgResponseTime}ms` : '—';
                            const successRate = stats?.successRate !== undefined ? `${stats.successRate}%` : '—';
                            return (
                                <motion.div key={ep.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                    className={`glass-card p-4 flex flex-col ${!isEnabled ? 'opacity-60' : ''}`}>
                                    <div className="flex items-start gap-3 mb-3">
                                        <FontAwesomeIcon icon={ep.icon} className={`w-8 h-8 ${ep.iconColor}`} />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold">{ep.name}</h3>
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-400">POST</span>
                                                {!isEnabled && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-400">OFF</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-[var(--text-muted)] mt-0.5">{ep.description}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] mb-4">
                                        <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-400" />{avgTime}</span>
                                        <span className="flex items-center gap-1">
                                            {isEnabled ? <CheckCircle className="w-3 h-3 text-green-400" /> : <AlertCircle className="w-3 h-3 text-red-400" />}
                                            {successRate}
                                        </span>
                                    </div>
                                    <button onClick={() => openModal(ep)}
                                        className="mt-auto w-full py-2.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                                        disabled={!isEnabled}>
                                        <Play className="w-4 h-4" />{isEnabled ? 'Execute' : 'Disabled'}
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* GET Test Endpoints */}
                <div>
                    <h2 className="text-sm font-semibold text-[var(--text-muted)] mb-3 flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs font-mono bg-green-500/20 text-green-400">GET</span>
                        Test Endpoints
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {TEST_ENDPOINTS.map((ep) => (
                            <a key={ep.path} href={ep.path} target="_blank" rel="noopener noreferrer"
                                className="glass-card p-3 flex items-center justify-between hover:border-[var(--accent-primary)] group">
                                <div className="flex items-center gap-2">
                                    <FontAwesomeIcon icon={ep.icon} className={`w-5 h-5 ${ep.iconColor}`} />
                                    <div>
                                        <p className="text-sm font-medium">{ep.name}</p>
                                        <code className="text-[10px] text-[var(--text-muted)]">{ep.path}</code>
                                    </div>
                                </div>
                                <ExternalLink className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--accent-primary)]" />
                            </a>
                        ))}
                    </div>
                </div>

                {/* API Documentation */}
                <div className="glass-card p-5">
                    <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <Code className="w-4 h-4 text-[var(--accent-primary)]" />
                        API Documentation
                    </h2>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                        {/* Endpoints */}
                        <div>
                            <h3 className="text-xs font-medium text-[var(--text-muted)] mb-2">Public Endpoints</h3>
                            <div className="space-y-2 text-xs font-mono">
                                <div className="p-2 rounded bg-[var(--bg-secondary)]">
                                    <span className="text-purple-400">POST</span> /api
                                    <span className="text-[var(--text-muted)] ml-2">← main (15/min)</span>
                                </div>
                                <div className="p-2 rounded bg-[var(--bg-secondary)]">
                                    <span className="text-green-400">GET</span> /api?url=...
                                </div>
                                <div className="p-2 rounded bg-[var(--bg-secondary)]">
                                    <span className="text-blue-400">POST</span> /api/playground
                                    <span className="text-[var(--text-muted)] ml-2">← user (5/2min)</span>
                                </div>
                            </div>
                        </div>

                        {/* Rate Limits */}
                        <div>
                            <h3 className="text-xs font-medium text-[var(--text-muted)] mb-2">Rate Limits</h3>
                            <div className="space-y-2 text-xs font-mono">
                                <div className="p-2 rounded bg-[var(--bg-secondary)]">
                                    <span className="text-purple-400">/api</span>
                                    <span className="text-[var(--text-muted)] ml-2">15 req/min • Home page</span>
                                </div>
                                <div className="p-2 rounded bg-[var(--bg-secondary)]">
                                    <span className="text-blue-400">/api/playground</span>
                                    <span className="text-[var(--text-muted)] ml-2">5 req/2min • /advanced</span>
                                </div>
                                <div className="p-2 rounded bg-[var(--bg-secondary)]">
                                    <span className="text-yellow-400">API Key</span>
                                    <span className="text-[var(--text-muted)] ml-2">Custom • Admin managed</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Example */}
                    <div className="mt-4 pt-4 border-t border-[var(--border-color)]">
                        <h3 className="text-xs font-medium text-[var(--text-muted)] mb-2">Usage Example</h3>
                        <div className="p-3 rounded bg-[var(--bg-secondary)] font-mono text-xs overflow-x-auto">
                            <span className="text-purple-400">POST</span> /api<br/>
                            <span className="text-[var(--text-muted)]">Body:</span> {'{'} <span className="text-blue-400">&quot;url&quot;</span>: <span className="text-green-400">&quot;https://instagram.com/p/xxx&quot;</span> {'}'}
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] mt-2">
                            Platforms: facebook, instagram, twitter, tiktok, youtube, weibo • No API key required
                        </p>
                    </div>
                </div>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {modalEndpoint && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeModal}>
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl"
                            onClick={(e) => e.stopPropagation()}>
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                                <div className="flex items-center gap-3">
                                    <FontAwesomeIcon icon={modalEndpoint.icon} className={`w-6 h-6 ${modalEndpoint.iconColor}`} />
                                    <div>
                                        <h2 className="font-bold">{modalEndpoint.name}</h2>
                                        <code className="text-xs text-[var(--text-muted)]">POST {modalEndpoint.path}</code>
                                    </div>
                                </div>
                                <button onClick={closeModal} className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"><X className="w-5 h-5" /></button>
                            </div>
                            {/* Body */}
                            <div className="p-4 space-y-4 max-h-[calc(90vh-140px)] overflow-y-auto">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">URL</label>
                                    <div className="relative">
                                        <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
                                            placeholder={`https://${modalEndpoint.id === 'twitter' ? 'x.com' : modalEndpoint.id + '.com'}/...`}
                                            className="w-full px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl font-mono text-sm pr-24"
                                            onKeyDown={(e) => e.key === 'Enter' && executeRequest()} />
                                        <button onClick={() => setShowSamples(!showSamples)}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--accent-primary)] hover:text-white text-xs font-medium flex items-center gap-1">
                                            Examples<ChevronDown className={`w-3 h-3 transition-transform ${showSamples ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>
                                    <AnimatePresence>
                                        {showSamples && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                                <div className="p-2 bg-[var(--bg-secondary)] rounded-lg space-y-1">
                                                    {modalEndpoint.samples.map((s, i) => (
                                                        <button key={i} onClick={() => selectSample(s.url)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-primary)] text-sm">
                                                            <p className="font-medium">{s.name}</p>
                                                            <code className="text-[10px] text-[var(--text-muted)] truncate block">{s.url}</code>
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium text-[var(--text-muted)]">Cookie (optional)</label>
                                        {hasAdminCookie && !cookie.trim() && (
                                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-semibold">
                                                <FontAwesomeIcon icon={faKey} className="w-2.5 h-2.5" />
                                                Admin cookie ready
                                            </span>
                                        )}
                                        {cookie.trim() && (
                                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-semibold">
                                                <FontAwesomeIcon icon={faUserEdit} className="w-2.5 h-2.5" />
                                                Using your cookie
                                            </span>
                                        )}
                                    </div>
                                    <input type="text" value={cookie} onChange={(e) => setCookie(e.target.value)} 
                                        placeholder={hasAdminCookie ? "Leave empty to use admin cookie, or paste yours to override..." : "Paste cookie for private content..."}
                                        className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl font-mono text-sm" />
                                </div>
                                <button onClick={executeRequest} disabled={loading || !url.trim()}
                                    className="w-full py-3 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                    {loading ? <><RefreshCw className="w-5 h-5 animate-spin" />Processing...</> : <><Play className="w-5 h-5" />Send Request</>}
                                </button>
                                {result && (
                                    <div className="space-y-3 pt-2 border-t border-[var(--border-color)]">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {isSuccess ? (
                                                    <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-bold"><CheckCircle className="w-4 h-4" />{result.status}</span>
                                                ) : (
                                                    <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm font-bold"><AlertCircle className="w-4 h-4" />{result.status || 'Error'}</span>
                                                )}
                                                <span className="text-sm text-[var(--text-muted)] flex items-center gap-1"><Clock className="w-3 h-3" />{result.timing}ms</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {/* Public/Private Badge */}
                                                {isSuccess && (
                                                    (result.data as MediaData)?.data?.usedCookie ? (
                                                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 text-xs font-semibold">
                                                            <FontAwesomeIcon icon={faLock} className="w-3 h-3" />
                                                            Private
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold">
                                                            <FontAwesomeIcon icon={faGlobe} className="w-3 h-3" />
                                                            Public
                                                        </span>
                                                    )
                                                )}
                                                <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] rounded-lg">
                                                    <button onClick={() => setActiveTab('gallery')} className={`px-3 py-1 rounded text-xs font-medium ${activeTab === 'gallery' ? 'bg-[var(--accent-primary)] text-white' : ''}`}>Gallery</button>
                                                    <button onClick={() => setActiveTab('json')} className={`px-3 py-1 rounded text-xs font-medium ${activeTab === 'json' ? 'bg-[var(--accent-primary)] text-white' : ''}`}>JSON</button>
                                                </div>
                                            </div>
                                        </div>
                                        {activeTab === 'gallery' ? <MediaGallery data={result.data} /> : (
                                            <div className="relative">
                                                <button onClick={copyJson} className="absolute top-2 right-2 p-2 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--accent-primary)] hover:text-white">
                                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                                <pre className="p-4 rounded-xl bg-[var(--bg-secondary)] text-xs font-mono max-h-64 overflow-auto">{JSON.stringify(result.data, null, 2)}</pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

interface MediaFormat { url: string; quality?: string; type?: string; thumbnail?: string; }
interface MediaData { success?: boolean; error?: string; data?: { title?: string; author?: string; thumbnail?: string; formats?: MediaFormat[]; usedCookie?: boolean; }; }

function MediaGallery({ data }: { data: unknown }) {
    const [expanded, setExpanded] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const d = data as MediaData;
    
    if (d?.error) return <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{d.error}</div>;
    if (!d?.success || !d?.data) return <div className="p-4 rounded-xl bg-[var(--bg-secondary)] text-center text-[var(--text-muted)] text-sm">No media found</div>;
    
    const { title, author, thumbnail, formats = [] } = d.data;
    
    // Dedupe by URL
    const seen = new Set<string>();
    const uniqueFormats = formats.filter(f => {
        if (seen.has(f.url)) return false;
        seen.add(f.url);
        return true;
    });
    
    const videos = uniqueFormats.filter(f => f.type === 'video');
    const images = uniqueFormats.filter(f => f.type === 'image');
    const allMedia = [...videos, ...images];
    const hasMultiple = allMedia.length > 1;
    const currentMedia = allMedia[currentIndex];
    
    const goNext = () => setCurrentIndex((i) => (i + 1) % allMedia.length);
    const goPrev = () => setCurrentIndex((i) => (i - 1 + allMedia.length) % allMedia.length);
    
    return (
        <div className="space-y-3">
            {/* Compact Header - Click thumbnail to expand */}
            <div className="flex gap-3 items-center">
                <button 
                    onClick={() => allMedia.length > 0 && setExpanded(true)}
                    className="relative w-14 h-14 rounded-xl overflow-hidden bg-[var(--bg-secondary)] flex-shrink-0 group cursor-pointer"
                >
                    {thumbnail && <img src={thumbnail} alt="" className="w-full h-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />}
                    {hasMultiple && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">+{allMedia.length}</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                        <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </button>
                <div className="flex-1 min-w-0">
                    {title && <p className="font-medium line-clamp-1 text-sm">{title}</p>}
                    {author && <p className="text-xs text-[var(--text-muted)]">{author}</p>}
                    <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)]">
                        {videos.length > 0 && <span className="flex items-center gap-1"><Film className="w-3 h-3" />{videos.length}</span>}
                        {images.length > 0 && <span className="flex items-center gap-1"><Image className="w-3 h-3" />{images.length}</span>}
                    </div>
                </div>
            </div>

            {/* Download Buttons */}
            <div className="flex flex-wrap gap-2">
                {uniqueFormats.map((f, i) => (
                    <a key={i} href={f.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80 text-white text-xs font-medium">
                        <Download className="w-3 h-3" />
                        {f.quality || (f.type === 'video' ? 'Video' : 'Image')}
                    </a>
                ))}
            </div>

            {/* Expanded Gallery Modal */}
            <AnimatePresence>
                {expanded && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center"
                        onClick={() => setExpanded(false)}
                    >
                        <motion.div 
                            initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                            className="relative max-w-4xl max-h-[90vh] w-full mx-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Close Button */}
                            <button onClick={() => setExpanded(false)} className="absolute -top-12 right-0 p-2 text-white/70 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                            
                            {/* Main Preview */}
                            <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
                                {currentMedia?.type === 'video' ? (
                                    <video key={currentMedia.url} src={currentMedia.url} poster={currentMedia.thumbnail || thumbnail} controls autoPlay className="w-full h-full object-contain" />
                                ) : (
                                    <img key={currentMedia?.url} src={currentMedia?.url} alt="" className="w-full h-full object-contain" />
                                )}
                                
                                {/* Nav Arrows */}
                                {hasMultiple && (
                                    <>
                                        <button onClick={goPrev} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center">
                                            <ChevronDown className="w-6 h-6 rotate-90" />
                                        </button>
                                        <button onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center">
                                            <ChevronDown className="w-6 h-6 -rotate-90" />
                                        </button>
                                    </>
                                )}
                                
                                {/* Counter */}
                                {hasMultiple && (
                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-white text-sm">
                                        {currentIndex + 1} / {allMedia.length}
                                    </div>
                                )}
                            </div>
                            
                            {/* Thumbnail Strip */}
                            {hasMultiple && (
                                <div className="flex gap-2 mt-3 justify-center overflow-x-auto">
                                    {allMedia.map((m, i) => (
                                        <button key={i} onClick={() => setCurrentIndex(i)}
                                            className={`relative flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden ${i === currentIndex ? 'ring-2 ring-white' : 'opacity-50 hover:opacity-100'}`}>
                                            <img src={m.thumbnail || m.url} alt="" className="w-full h-full object-cover" />
                                            {m.type === 'video' && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Play className="w-3 h-3 text-white" /></div>}
                                        </button>
                                    ))}
                                </div>
                            )}
                            
                            {/* Download Current */}
                            <a href={currentMedia?.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 mt-3 py-2 rounded-lg bg-[var(--accent-primary)] text-white font-medium">
                                <Download className="w-4 h-4" />Download {currentMedia?.quality || 'Media'}
                            </a>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
