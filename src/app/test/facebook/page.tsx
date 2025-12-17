'use client';

import { useState } from 'react';

interface MediaItem {
    type: string;
    quality: string;
    url: string;
    format: string;
}

interface ApiResponse {
    success: boolean;
    error?: string;
    data?: {
        title: string;
        author: string;
        description: string;
        thumbnail: string;
        postedAt: string;
        url: string;
        engagement: {
            views: number | null;
            likes: number | null;
            comments: number | null;
            shares: number | null;
        };
        media: MediaItem[];
        stats: {
            totalMedia: number;
            videos: number;
            images: number;
        };
    };
}

export default function FacebookTestPage() {
    const [url, setUrl] = useState('https://www.facebook.com/share/p/17fLXtDXj9/');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ApiResponse | null>(null);

    const handleTest = async () => {
        setLoading(true);
        setResult(null);
        
        try {
            const res = await fetch(`/api/test/facebook?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            setResult(data);
        } catch (err) {
            setResult({ success: false, error: String(err) });
        }
        
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
            <h1 className="text-2xl font-bold mb-4 text-[#1877f2]">
                🧪 Facebook API Test
            </h1>
            
            {/* Input */}
            <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Facebook URL..."
                    className="flex-1 px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-lg text-white text-sm"
                />
                <button
                    onClick={handleTest}
                    disabled={loading}
                    className={`px-6 py-3 rounded-lg font-semibold ${
                        loading ? 'bg-[#333] cursor-wait' : 'bg-[#1877f2] hover:bg-[#1565c0] cursor-pointer'
                    }`}
                >
                    {loading ? '⏳ Loading...' : '🔍 Test'}
                </button>
            </div>

            {/* Result */}
            {result && (
                <div className={`bg-[#1a1a1a] rounded-xl p-6 border ${
                    result.success ? 'border-green-500' : 'border-red-500'
                }`}>
                    {/* Status */}
                    <div className="flex items-center gap-2 mb-4 text-lg font-semibold">
                        {result.success ? (
                            <span className="text-green-500">✅ Success</span>
                        ) : (
                            <span className="text-red-500">❌ {result.error}</span>
                        )}
                    </div>

                    {result.success && result.data && (
                        <>
                            {/* Stats */}
                            <div className="flex gap-4 mb-6 flex-wrap">
                                <Stat label="Total" value={result.data.stats.totalMedia} />
                                <Stat label="Videos" value={result.data.stats.videos} color="text-green-500" />
                                <Stat label="Images" value={result.data.stats.images} color="text-red-500" />
                            </div>

                            {/* Engagement */}
                            {(result.data.engagement.views || result.data.engagement.likes || 
                              result.data.engagement.comments || result.data.engagement.shares) && (
                                <div className="mb-6">
                                    <h3 className="text-pink-500 mb-2 font-semibold">📊 Engagement</h3>
                                    <div className="flex gap-4 flex-wrap">
                                        {result.data.engagement.views && (
                                            <Stat label="Views" value={result.data.engagement.views} color="text-blue-400" />
                                        )}
                                        {result.data.engagement.likes && (
                                            <Stat label="Likes" value={result.data.engagement.likes} color="text-pink-500" />
                                        )}
                                        {result.data.engagement.comments && (
                                            <Stat label="Comments" value={result.data.engagement.comments} color="text-amber-500" />
                                        )}
                                        {result.data.engagement.shares && (
                                            <Stat label="Shares" value={result.data.engagement.shares} color="text-cyan-500" />
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Metadata */}
                            <div className="mb-6">
                                <h3 className="text-amber-500 mb-2 font-semibold">📋 Metadata</h3>
                                <Info label="Title" value={result.data.title} />
                                <Info label="Author" value={result.data.author} />
                                <Info label="Description" value={result.data.description} />
                                <Info label="Posted" value={result.data.postedAt} />
                            </div>

                            {/* Thumbnail */}
                            {result.data.thumbnail && (
                                <div className="mb-6">
                                    <h3 className="text-purple-500 mb-2 font-semibold">🖼️ Thumbnail</h3>
                                    <img 
                                        src={result.data.thumbnail} 
                                        alt="Thumbnail"
                                        className="max-w-[300px] rounded-lg border border-[#333]"
                                    />
                                </div>
                            )}

                            {/* Media List */}
                            <div>
                                <h3 className="text-green-500 mb-2 font-semibold">📹 Media</h3>
                                {result.data.media.map((m, i) => (
                                    <div key={i} className="bg-[#0a0a0a] p-3 rounded-md mb-2 text-sm">
                                        <div className="flex gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                m.type === 'video' ? 'bg-green-500' : 'bg-red-500'
                                            }`}>
                                                {m.type.toUpperCase()}
                                            </span>
                                            <span className="text-[#1877f2] font-semibold">{m.quality}</span>
                                            <span className="text-gray-500">.{m.format}</span>
                                        </div>
                                        <a 
                                            href={m.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-gray-400 text-xs break-all hover:text-white"
                                        >
                                            {m.url.substring(0, 100)}...
                                        </a>
                                    </div>
                                ))}
                            </div>

                            {/* Raw JSON */}
                            <details className="mt-6">
                                <summary className="cursor-pointer text-gray-500 hover:text-white">
                                    📦 Raw JSON
                                </summary>
                                <pre className="bg-[#0a0a0a] p-4 rounded-md overflow-auto text-xs mt-2">
                                    {JSON.stringify(result, null, 2)}
                                </pre>
                            </details>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

function Stat({ label, value, color = 'text-white' }: { label: string; value: number; color?: string }) {
    return (
        <div className="bg-[#0a0a0a] px-4 py-2 rounded-md text-center">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
        </div>
    );
}

function Info({ label, value }: { label: string; value?: string }) {
    if (!value) return null;
    return (
        <div className="mb-1 text-sm">
            <span className="text-gray-500">{label}: </span>
            <span>{value}</span>
        </div>
    );
}
