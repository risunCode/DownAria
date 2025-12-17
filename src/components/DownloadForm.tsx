'use client';

import { useState, useEffect, FormEvent, useRef } from 'react';
import { motion } from 'framer-motion';
import { Download, Clipboard, Check, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Platform, PLATFORMS, validateUrl, detectPlatform, sanitizeUrl } from '@/lib/types';
import { LightbulbIcon, PlatformIcon } from '@/components/ui/Icons';

interface DownloadFormProps {
    platform: Platform;
    onPlatformChange: (platform: Platform) => void;
    onSubmit: (url: string) => void;
    isLoading: boolean;
    initialUrl?: string;
}

// Progress steps for loading animation
const PROGRESS_STEPS = [
    { progress: 15, text: 'Connecting...' },
    { progress: 35, text: 'Fetching page...' },
    { progress: 55, text: 'Extracting media...' },
    { progress: 75, text: 'Validating URLs...' },
    { progress: 90, text: 'Almost done...' },
];

// Rotating tips/hints
const TIPS = [
    'Paste any video URL to start',
    'Supports YouTube, TikTok, Instagram & more',
    'Auto-detects platform from URL',
    'Download in multiple qualities',
    'No watermark on most platforms',
    'Works with Reels, Shorts & Stories',
];

export function DownloadForm({ platform, onPlatformChange, onSubmit, isLoading, initialUrl }: DownloadFormProps) {
    const [url, setUrl] = useState(initialUrl || '');
    const [error, setError] = useState('');
    const [justPasted, setJustPasted] = useState(false);
    const [tipIndex, setTipIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const lastSubmittedUrl = useRef<string>('');
    const progressInterval = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const currentPlatform = PLATFORMS.find(p => p.id === platform);

    // Sync with initialUrl prop (for share page)
    useEffect(() => {
        if (initialUrl && initialUrl !== url) {
            setUrl(initialUrl);
        }
    }, [initialUrl]);

    // Progress bar animation when loading
    useEffect(() => {
        if (isLoading) {
            setProgress(0);
            setProgressText('Starting...');
            let stepIndex = 0;
            
            progressInterval.current = setInterval(() => {
                if (stepIndex < PROGRESS_STEPS.length) {
                    setProgress(PROGRESS_STEPS[stepIndex].progress);
                    setProgressText(PROGRESS_STEPS[stepIndex].text);
                    stepIndex++;
                }
            }, 800);
        } else {
            if (progressInterval.current) {
                clearInterval(progressInterval.current);
                progressInterval.current = null;
            }
            // Quick finish animation
            if (progress > 0) {
                setProgress(100);
                setProgressText('Done!');
                setTimeout(() => {
                    setProgress(0);
                    setProgressText('');
                }, 500);
            }
        }
        
        return () => {
            if (progressInterval.current) {
                clearInterval(progressInterval.current);
            }
        };
    }, [isLoading]);

    // Rotate tips every 3 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setTipIndex(prev => (prev + 1) % TIPS.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // Auto-submit when valid URL detected
    useEffect(() => {
        if (url.length > 15 && !isLoading) {
            const detected = detectPlatform(url);
            if (detected) {
                if (detected !== platform) onPlatformChange(detected);
                if (validateUrl(url, detected) && lastSubmittedUrl.current !== url) {
                    lastSubmittedUrl.current = url;
                    const timer = setTimeout(() => onSubmit(url), 300);
                    return () => clearTimeout(timer);
                }
            }
        }
    }, [url]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setError('');
        if (!url.trim()) { setError('Enter a URL'); return; }
        
        const detected = detectPlatform(url);
        if (detected && detected !== platform) onPlatformChange(detected);
        
        const target = detected || platform;
        if (!validateUrl(url, target)) {
            setError(`Invalid ${PLATFORMS.find(p => p.id === target)?.name} URL`);
            return;
        }
        onSubmit(url);
    };

    const handleUrlChange = (value: string) => {
        setUrl(value);
        setError('');
        if (value.length > 10) {
            const detected = detectPlatform(value);
            if (detected && detected !== platform) onPlatformChange(detected);
        }
    };

    // Process pasted text - always update even if same URL (force refresh)
    const processPastedText = (text: string) => {
        if (!text) return false;
        const cleanUrl = sanitizeUrl(text);
        if (cleanUrl) {
            setUrl(cleanUrl);
            setJustPasted(true);
            setTimeout(() => setJustPasted(false), 1500);
            setError('');
            // Reset lastSubmittedUrl to allow re-submit
            lastSubmittedUrl.current = '';
            const detected = detectPlatform(cleanUrl);
            if (detected && detected !== platform) onPlatformChange(detected);
            return true;
        }
        return false;
    };

    const handlePaste = async () => {
        setError('');
        
        // Method 1: Try modern Clipboard API first (works on HTTPS with user gesture)
        if (navigator.clipboard && navigator.clipboard.readText) {
            try {
                const text = await navigator.clipboard.readText();
                const cleanUrl = sanitizeUrl(text);
                if (cleanUrl) {
                    // Always update URL from clipboard, even if same (force refresh)
                    setUrl(cleanUrl);
                    setJustPasted(true);
                    setTimeout(() => setJustPasted(false), 1500);
                    setError('');
                    // Reset lastSubmittedUrl to allow re-submit of same URL
                    lastSubmittedUrl.current = '';
                    const detected = detectPlatform(cleanUrl);
                    if (detected && detected !== platform) onPlatformChange(detected);
                    return;
                }
                if (text && !cleanUrl) {
                    setError('No valid URL in clipboard');
                    return;
                }
            } catch {
                // Clipboard API failed, try fallback
            }
        }
        
        // Method 2: Focus input and let user paste manually
        // This is the most reliable cross-browser/device method
        if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
            
            // Try execCommand as fallback (deprecated but still works)
            try {
                const success = document.execCommand('paste');
                if (success) return;
            } catch {
                // execCommand not supported
            }
            
            // Show helpful message
            setError('Tap here and press Ctrl+V (or long-press → Paste)');
        }
    };

    // Global paste listener
    useEffect(() => {
        const handler = (e: ClipboardEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
            const text = e.clipboardData?.getData('text');
            if (text) {
                const cleanUrl = sanitizeUrl(text);
                if (cleanUrl && cleanUrl !== url) {
                    const detected = detectPlatform(cleanUrl);
                    if (detected) {
                        setUrl(cleanUrl);
                        setError('');
                        if (detected !== platform) onPlatformChange(detected);
                    }
                }
            }
        };
        window.addEventListener('paste', handler);
        return () => window.removeEventListener('paste', handler);
    }, [platform, url]);

    return (
        <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            className="w-full"
        >
            {/* Animated border wrapper - always spinning */}
            <div className="relative rounded-2xl p-[2px]">
                {/* Spinning gradient border - always visible */}
                <div className="absolute inset-0 rounded-2xl bg-[conic-gradient(from_var(--border-angle),var(--accent-primary)_0%,transparent_10%,transparent_90%,var(--accent-primary)_100%)] animate-spin-slow opacity-60" />
                {/* Card content - no hover effects */}
                <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 sm:p-6 space-y-4 relative rounded-2xl">
                {/* Rotating tip or platform indicator */}
                <div className="flex items-center justify-center text-sm h-6">
                    {url ? (
                        <div className="flex items-center gap-2">
                            <span className="text-[var(--text-muted)]">Downloading from</span>
                            <span 
                                className="font-semibold px-2 py-0.5 rounded-md"
                                style={{ 
                                    background: `${currentPlatform?.color}20`,
                                    color: currentPlatform?.color 
                                }}
                            >
                                <PlatformIcon platform={currentPlatform?.id || ''} className="w-4 h-4" /> {currentPlatform?.name}
                            </span>
                        </div>
                    ) : (
                        <span className="text-[var(--text-muted)] text-xs flex items-center gap-1">
                            <LightbulbIcon className="w-3 h-3 text-yellow-500" /> {TIPS[tipIndex]}
                        </span>
                    )}
                </div>

                {/* Input row */}
                <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1">
                        <Input
                            ref={inputRef}
                            type="url"
                            placeholder="Paste video URL..."
                            value={url}
                            onChange={(e) => handleUrlChange(e.target.value)}
                            onPaste={(e) => {
                                const text = e.clipboardData?.getData('text');
                                if (text && processPastedText(text)) {
                                    e.preventDefault(); // Prevent default if we handled it
                                }
                            }}
                            error={error}
                            disabled={isLoading}
                            className="w-full"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={handlePaste}
                            disabled={isLoading}
                            className="flex-1 sm:flex-none"
                        >
                            {justPasted ? <Check className="w-4 h-4 text-green-500" /> : <Clipboard className="w-4 h-4" />}
                            <span className="ml-1.5 sm:inline">{justPasted ? 'Done' : 'Paste'}</span>
                        </Button>
                        <Button
                            type="submit"
                            isLoading={isLoading}
                            className="flex-1 sm:flex-none"
                        >
                            <Download className="w-4 h-4" />
                            <span className="ml-1.5">{isLoading ? '...' : 'Go'}</span>
                        </Button>
                    </div>
                </div>

                {/* Progress bar */}
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2"
                    >
                        <div className="flex justify-between text-xs text-[var(--text-muted)]">
                            <span>{progressText}</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                            <motion.div
                                className="h-full rounded-full"
                                style={{
                                    background: `linear-gradient(90deg, ${currentPlatform?.color || 'var(--accent-primary)'}, var(--accent-secondary))`,
                                }}
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                            />
                        </div>
                    </motion.div>
                )}

                {/* YouTube limitation tips */}
                {platform === 'youtube' && url && !isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs"
                    >
                        <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                        <div className="text-yellow-200/80">
                            <span className="font-medium text-yellow-400">YouTube Limitation:</span>{' '}
                            Only 360p available. Sorry, HD streams are blocked by YouTube for server-side requests.
                        </div>
                    </motion.div>
                )}
                </div>
            </div>
        </motion.form>
    );
}
