'use client';

import { useState } from 'react';

interface MediaItem {
    type: string;
    quality: string;
    url: string;
    format: string;
    width?: number;
    height?: number;
}

interface ApiResponse {
    success: boolean;
    error?: string;
    data?: {
        title: string;
        author: string;
        authorId: string | null;
        caption: string;
        thumbnail: string;
        postedAt: string | null;
        postType: string;
        postId: string | null;
        url: string;
        engagement: {
            views: number | null;
            likes: number | null;
            comments: number | null;
        };
        media: MediaItem[];
        stats: {
            totalMedia: number;
            videos: number;
            images: number;
        };
    };
}

export default function InstagramTestPage() {
    const [url, setUrl] = useState('https://www.instagram.com/p/DSR1plgEpZS/');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ApiResponse | null>(null);

    const handleTest = async () => {
        setLoading(true);
        setResult(null);

        try {
            const res = await fetch(`/api/test/instagram?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            setResult(data);
        } catch (err) {
            setResult({ success: false, error: String(err) });
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
            <h1 className="text-2xl font-bold mb-4 text-[#E1306C]">
                📸 Instagram API Test
            </h1>

            {/* Input */}
            <div className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Instagram URL..."
                    className="flex-1 px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-lg text-white text-sm"
                />
                <button
                    onClick={handleTest}
                    disabled={loading}
                    className={`px-6 py-3 rounded-lg font-semibold ${
                        loading ? 'bg-[#333] cursor-wait' : 'bg-[#E1306C] hover:bg-[#c13584] cursor-pointer'
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
                                <Stat label="Images" value={result.data.stats.images} color="text-pink-500" />
                                <Stat label="Type" value={result.data.postType} color="text-purple-400" isText />
                            </div>

                            {/* Engagement */}
                            {(result.data.engagement.views || result.data.engagement.likes ||
                                result.data.engagement.comments) && (
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
                                    </div>
                                </div>
                            )}

                            {/* Metadata */}
                            <div className="mb-6">
                                <h3 className="text-amber-500 mb-2 font-semibold">📋 Metadata</h3>
                                <Info label="Author" value={result.data.author} />
                                <Info label="Author ID" value={result.data.authorId} />
                                <Info label="Caption" value={result.data.caption} />
                                <Info label="Posted" value={result.data.postedAt} />
                                <Info label="Post ID" value={result.data.postId} />
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
                                        <div className="flex gap-2 mb-1 items-center">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                m.type === 'video' ? 'bg-green-500' : 'bg-pink-500'
                                            }`}>
                                                {m.type.toUpperCase()}
                                            </span>
                                            <span className="text-[#E1306C] font-semibold">{m.quality}</span>
                                            {m.width && m.height && (
                                                <span className="text-gray-400 text-xs">({m.width}x{m.height})</span>
                                            )}
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

function Stat({ label, value, color = 'text-white', isText = false }: { 
    label: string; 
    value: number | string; 
    color?: string;
    isText?: boolean;
}) {
    return (
        <div className="bg-[#0a0a0a] px-4 py-2 rounded-md text-center">
            <div className={`${isText ? 'text-lg' : 'text-2xl'} font-bold ${color}`}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </div>
            <div className="text-xs text-gray-500">{label}</div>
        </div>
    );
}

function Info({ label, value }: { label: string; value?: string | null }) {
    if (!value) return null;
    return (
        <div className="mb-1 text-sm">
            <span className="text-gray-500">{label}: </span>
            <span>{value}</span>
        </div>
    );
}
