'use client';

import { useState } from 'react';

interface TwitterMedia {
    type: 'video' | 'image' | 'gif';
    quality: string;
    url: string;
    thumbnail?: string;
    bitrate?: number;
    resolution?: string;
    duration?: string;
}

interface TwitterResult {
    success: boolean;
    data?: {
        tweetId: string;
        url: string;
        author: string;
        displayName: string;
        verified: boolean;
        profileImage: string;
        text: string;
        timestamp: string;
        engagement: {
            replies: number;
            retweets: number;
            quotes: number;
            likes: number;
            views: number | null;
            bookmarks: number;
        };
        media: TwitterMedia[];
        quotedTweet?: {
            author: string;
            text: string;
            url: string;
        };
        stats: {
            totalMedia: number;
            videos: number;
            images: number;
            gifs: number;
        };
    };
    error?: string;
    cached?: boolean;
    timing?: number;
}

export default function TwitterTestPage() {
    const [url, setUrl] = useState('');
    const [result, setResult] = useState<TwitterResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [rawJson, setRawJson] = useState(false);

    const testFetch = async () => {
        if (!url) return;
        setLoading(true);
        setResult(null);

        try {
            const res = await fetch(`/api/test/twitter?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            setResult(data);
        } catch (err) {
            setResult({ success: false, error: String(err) });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-900 text-white p-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-2">🐦 Twitter/X Test API</h1>
                <p className="text-neutral-400 mb-6">Test Syndication API extraction</p>

                {/* Input */}
                <div className="flex gap-2 mb-6">
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://x.com/user/status/123..."
                        className="flex-1 px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-blue-500"
                        onKeyDown={(e) => e.key === 'Enter' && testFetch()}
                    />
                    <button
                        onClick={testFetch}
                        disabled={loading || !url}
                        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-neutral-700 rounded-lg font-medium transition-colors"
                    >
                        {loading ? '⏳' : '🔍 Fetch'}
                    </button>
                </div>

                {/* Quick test URLs */}
                <div className="mb-6 flex flex-wrap gap-2">
                    <span className="text-neutral-500 text-sm">Quick test:</span>
                    {[
                        'https://x.com/elikilifoe/status/1869696177131561143',
                        'https://x.com/SpaceX/status/1868753929854464076',
                    ].map((testUrl, i) => (
                        <button
                            key={i}
                            onClick={() => setUrl(testUrl)}
                            className="text-xs px-2 py-1 bg-neutral-800 hover:bg-neutral-700 rounded"
                        >
                            Test {i + 1}
                        </button>
                    ))}
                </div>

                {/* Result */}
                {result && (
                    <div className="space-y-4">
                        {/* Status */}
                        <div className={`p-4 rounded-lg ${result.success ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
                            <div className="flex items-center justify-between">
                                <span className="font-medium">
                                    {result.success ? '✅ Success' : '❌ Failed'}
                                </span>
                                <div className="flex items-center gap-3 text-sm text-neutral-400">
                                    {result.cached && <span className="text-yellow-500">📦 Cached</span>}
                                    {result.timing && <span>⏱️ {result.timing}ms</span>}
                                </div>
                            </div>
                            {result.error && <p className="text-red-400 mt-2">{result.error}</p>}
                        </div>

                        {result.success && result.data && (
                            <>
                                {/* Author Info */}
                                <div className="p-4 bg-neutral-800 rounded-lg">
                                    <h3 className="font-medium mb-3 text-blue-400">👤 Author</h3>
                                    <div className="flex items-center gap-4">
                                        {result.data.profileImage && (
                                            <img 
                                                src={result.data.profileImage} 
                                                alt="Profile" 
                                                className="w-12 h-12 rounded-full"
                                            />
                                        )}
                                        <div>
                                            <p className="font-medium">
                                                {result.data.displayName}
                                                {result.data.verified && <span className="ml-1 text-blue-400">✓</span>}
                                            </p>
                                            <p className="text-neutral-400">@{result.data.author}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Tweet Content */}
                                <div className="p-4 bg-neutral-800 rounded-lg">
                                    <h3 className="font-medium mb-3 text-blue-400">📝 Tweet</h3>
                                    <p className="whitespace-pre-wrap mb-3">{result.data.text || '(no text)'}</p>
                                    <div className="flex flex-wrap gap-4 text-sm text-neutral-400">
                                        <span>🆔 {result.data.tweetId}</span>
                                        <span>🕐 {new Date(result.data.timestamp).toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Engagement */}
                                <div className="p-4 bg-neutral-800 rounded-lg">
                                    <h3 className="font-medium mb-3 text-green-400">📊 Engagement</h3>
                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center">
                                        <div>
                                            <p className="text-2xl font-bold">{result.data.engagement.replies.toLocaleString()}</p>
                                            <p className="text-xs text-neutral-400">💬 Replies</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">{result.data.engagement.retweets.toLocaleString()}</p>
                                            <p className="text-xs text-neutral-400">🔁 Retweets</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">{result.data.engagement.quotes.toLocaleString()}</p>
                                            <p className="text-xs text-neutral-400">💬 Quotes</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">{result.data.engagement.likes.toLocaleString()}</p>
                                            <p className="text-xs text-neutral-400">❤️ Likes</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">{result.data.engagement.views?.toLocaleString() || 'N/A'}</p>
                                            <p className="text-xs text-neutral-400">👁️ Views</p>
                                        </div>
                                        <div>
                                            <p className="text-2xl font-bold">{result.data.engagement.bookmarks.toLocaleString()}</p>
                                            <p className="text-xs text-neutral-400">🔖 Bookmarks</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Media */}
                                <div className="p-4 bg-neutral-800 rounded-lg">
                                    <h3 className="font-medium mb-3 text-purple-400">
                                        📹 Media ({result.data.stats.totalMedia})
                                        <span className="text-sm font-normal text-neutral-400 ml-2">
                                            {result.data.stats.videos > 0 && `${result.data.stats.videos} video `}
                                            {result.data.stats.images > 0 && `${result.data.stats.images} image `}
                                            {result.data.stats.gifs > 0 && `${result.data.stats.gifs} gif`}
                                        </span>
                                    </h3>
                                    
                                    {result.data.media.length === 0 ? (
                                        <p className="text-neutral-500">No media found</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {result.data.media.map((m, i) => (
                                                <div key={i} className="p-3 bg-neutral-900 rounded-lg">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                            m.type === 'video' ? 'bg-red-500/20 text-red-400' :
                                                            m.type === 'gif' ? 'bg-purple-500/20 text-purple-400' :
                                                            'bg-green-500/20 text-green-400'
                                                        }`}>
                                                            {m.type.toUpperCase()}
                                                        </span>
                                                        <span className="font-medium">{m.quality}</span>
                                                        {m.resolution && <span className="text-neutral-400 text-sm">{m.resolution}</span>}
                                                        {m.duration && <span className="text-neutral-400 text-sm">⏱️ {m.duration}</span>}
                                                        {m.bitrate && <span className="text-neutral-400 text-sm">{Math.round(m.bitrate/1000)}kbps</span>}
                                                    </div>
                                                    <a 
                                                        href={m.url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-blue-400 hover:text-blue-300 text-sm break-all"
                                                    >
                                                        {m.url}
                                                    </a>
                                                    {m.thumbnail && (
                                                        <img 
                                                            src={m.thumbnail} 
                                                            alt="Thumbnail" 
                                                            className="mt-2 max-h-32 rounded"
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Quoted Tweet */}
                                {result.data.quotedTweet && (
                                    <div className="p-4 bg-neutral-800 rounded-lg border-l-4 border-orange-500">
                                        <h3 className="font-medium mb-2 text-orange-400">💬 Quoted Tweet</h3>
                                        <p className="text-neutral-400 text-sm">@{result.data.quotedTweet.author}</p>
                                        <p className="mt-1">{result.data.quotedTweet.text}</p>
                                        <a 
                                            href={result.data.quotedTweet.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-400 text-sm hover:underline mt-2 inline-block"
                                        >
                                            View original →
                                        </a>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Raw JSON Toggle */}
                        <div className="p-4 bg-neutral-800 rounded-lg">
                            <button
                                onClick={() => setRawJson(!rawJson)}
                                className="text-sm text-neutral-400 hover:text-white"
                            >
                                {rawJson ? '▼' : '▶'} Raw JSON
                            </button>
                            {rawJson && (
                                <pre className="mt-3 p-3 bg-neutral-900 rounded text-xs overflow-auto max-h-96">
                                    {JSON.stringify(result, null, 2)}
                                </pre>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
