'use client';

import { useState } from 'react';
import { Clipboard, AlertCircle, ExternalLink } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faYoutube } from '@fortawesome/free-brands-svg-icons';
import { Button } from '@/components/ui/Button';
import Swal from 'sweetalert2';

export function YouTubeSandboxTab() {
    const [url, setUrl] = useState('');
    const [videoId, setVideoId] = useState('');
    const [error, setError] = useState('');

    const extractVideoId = (input: string): string | null => {
        if (!input.trim()) return null;
        
        // Direct video ID (11 chars)
        if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) {
            return input.trim();
        }

        try {
            const parsed = new URL(input);
            
            // youtube.com/watch?v=VIDEO_ID
            if (parsed.hostname.includes('youtube.com')) {
                const v = parsed.searchParams.get('v');
                if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
                
                // youtube.com/embed/VIDEO_ID
                const embedMatch = parsed.pathname.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
                if (embedMatch) return embedMatch[1];
                
                // youtube.com/shorts/VIDEO_ID
                const shortsMatch = parsed.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
                if (shortsMatch) return shortsMatch[1];
            }
            
            // youtu.be/VIDEO_ID
            if (parsed.hostname === 'youtu.be') {
                const id = parsed.pathname.slice(1);
                if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
            }
        } catch {
            // Not a valid URL
        }
        
        return null;
    };

    const handleUrlChange = (input: string) => {
        setUrl(input);
        setError('');
        
        if (!input.trim()) {
            setVideoId('');
            return;
        }

        const id = extractVideoId(input);
        if (id) {
            setVideoId(id);
        } else {
            setVideoId('');
            setError('Invalid YouTube URL or video ID');
        }
    };

    const handlePaste = async () => {
        if (url.trim()) {
            setUrl('');
            setVideoId('');
            setError('');
        } else {
            try {
                const text = await navigator.clipboard.readText();
                handleUrlChange(text);
            } catch {
                Swal.fire({ 
                    icon: 'error', 
                    title: 'Paste failed', 
                    timer: 1500, 
                    showConfirmButton: false, 
                    background: 'var(--bg-card)', 
                    color: 'var(--text-primary)' 
                });
            }
        }
    };

    return (
        <div className="space-y-4">
            <div className="glass-card p-5 space-y-4">
                <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={faYoutube} className="w-5 h-5 text-red-500" />
                    <div>
                        <h2 className="font-semibold">YouTube Sandbox</h2>
                        <p className="text-xs text-[var(--text-muted)]">
                            Test YouTube embed player - experimental capture testing
                        </p>
                    </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <p className="text-xs text-amber-400">
                        ⚠️ This is for testing purposes only. YouTube embed players are protected by DRM and cannot be captured programmatically.
                    </p>
                </div>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=... or video ID"
                        className={`flex-1 min-w-0 text-sm px-3 py-2.5 rounded-lg bg-[var(--bg-secondary)] border ${
                            error ? 'border-red-500/50' : 'border-[var(--border-color)]'
                        } focus:border-[var(--accent-primary)] focus:outline-none`}
                    />
                    <Button 
                        onClick={handlePaste} 
                        variant={url.trim() ? 'secondary' : 'primary'} 
                        leftIcon={<Clipboard className="w-4 h-4" />}
                    >
                        {url.trim() ? 'Clear' : 'Paste'}
                    </Button>
                </div>

                {error && (
                    <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> {error}
                    </p>
                )}

                {videoId && (
                    <div className="space-y-3 pt-4 border-t border-[var(--border-color)]">
                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <span>Video ID:</span>
                            <code className="px-2 py-1 rounded bg-[var(--bg-secondary)] font-mono">
                                {videoId}
                            </code>
                        </div>
                        
                        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
                            <iframe
                                width="100%"
                                height="100%"
                                src={`https://www.youtube.com/embed/${videoId}`}
                                title="YouTube video player"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allowFullScreen
                            />
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')}
                                leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                            >
                                Open on YouTube
                            </Button>
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={async () => {
                                    await navigator.clipboard.writeText(`https://www.youtube.com/embed/${videoId}`);
                                    Swal.fire({ 
                                        icon: 'success', 
                                        title: 'Embed URL copied!', 
                                        timer: 1500, 
                                        showConfirmButton: false, 
                                        background: 'var(--bg-card)', 
                                        color: 'var(--text-primary)' 
                                    });
                                }}
                                leftIcon={<Clipboard className="w-3.5 h-3.5" />}
                            >
                                Copy Embed URL
                            </Button>
                        </div>

                        <div className="text-xs text-[var(--text-muted)] space-y-1">
                            <p>• This embed is for testing UI/UX only</p>
                            <p>• Video content is protected by YouTube's DRM</p>
                            <p>• Use the main downloader for actual downloads</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}