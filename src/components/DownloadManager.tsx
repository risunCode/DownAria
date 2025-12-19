'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Loader2, X, Minus, CheckCircle, XCircle, Wifi, Pause, Play, Download, GripVertical } from 'lucide-react';
import { usePendingDownload } from '@/lib/contexts/PendingDownloadContext';
import { PLATFORMS } from '@/lib/types';
import { sendDiscordNotification } from '@/lib/utils/discord-webhook';
import { formatBytes, formatSpeed } from '@/lib/utils/format-utils';

// Types
export interface DownloadTask {
    id: string;
    filename: string;
    progress: number;
    status: 'downloading' | 'paused' | 'done' | 'error' | 'cancelled';
    speed: number;
    downloaded: number;
    total: number;
    abortController?: AbortController;
    url?: string;
    platform?: string;
    discordSent?: boolean; // Track if Discord notification was sent
}

interface DownloadContextType {
    tasks: DownloadTask[];
    addTask: (task: DownloadTask) => void;
    updateTask: (id: string, updates: Partial<DownloadTask>) => void;
    removeTask: (id: string) => void;
    cancelTask: (id: string) => void;
    pauseTask: (id: string) => void;
    resumeTask: (id: string) => void;
    startDownload: (url: string, filename: string, platform: string) => Promise<void>;
    setMinimized: (minimized: boolean) => void;
}

const DownloadContext = createContext<DownloadContextType | null>(null);

export function useDownloadManager() {
    const ctx = useContext(DownloadContext);
    if (!ctx) throw new Error('useDownloadManager must be used within DownloadManagerProvider');
    return ctx;
}



export function DownloadManagerProvider({ children }: { children: ReactNode }) {
    const [tasks, setTasks] = useState<DownloadTask[]>([]);
    const [isMinimized, setIsMinimized] = useState(false);

    const addTask = useCallback((task: DownloadTask) => {
        setTasks(prev => [...prev, task]);
        setIsMinimized(false);
    }, []);

    const updateTask = useCallback((id: string, updates: Partial<DownloadTask>) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }, []);

    const removeTask = useCallback((id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));
    }, []);

    const cancelTask = useCallback((id: string) => {
        setTasks(prev => {
            const task = prev.find(t => t.id === id);
            if (task?.abortController) task.abortController.abort();
            return prev.map(t => t.id === id ? { ...t, status: 'cancelled' as const } : t);
        });
    }, []);

    const pauseTask = useCallback((id: string) => {
        setTasks(prev => {
            const task = prev.find(t => t.id === id);
            if (task?.abortController) task.abortController.abort();
            return prev.map(t => t.id === id ? { ...t, status: 'paused' as const, speed: 0 } : t);
        });
    }, []);

    const startDownloadInternal = useCallback(async (url: string, filename: string, platform: string, existingTaskId?: string) => {
        const taskId = existingTaskId || `dl-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}&platform=${platform}`;
        const abortController = new AbortController();
        let finalFilename = filename;

        if (existingTaskId) {
            updateTask(taskId, { status: 'downloading', speed: 0, abortController });
        } else {
            addTask({ id: taskId, filename, progress: 0, status: 'downloading', speed: 0, downloaded: 0, total: 0, abortController, url, platform });
        }

        try {
            const res = await fetch(proxyUrl, { signal: abortController.signal });
            const contentLength = res.headers.get('content-length');
            const total = contentLength ? parseInt(contentLength, 10) : 0;
            const contentType = res.headers.get('content-type') || '';
            const contentDisposition = res.headers.get('content-disposition') || '';

            if (contentDisposition) {
                const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                if (match) finalFilename = match[1].replace(/['"]/g, '').trim();
            }

            if (!finalFilename.includes('.') || finalFilename.endsWith('.txt')) {
                const extMap: Record<string, string> = {
                    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
                    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
                    'audio/mpeg': '.mp3', 'audio/mp4': '.m4a',
                };
                for (const [mime, ext] of Object.entries(extMap)) {
                    if (contentType.includes(mime)) {
                        finalFilename = finalFilename.replace(/\.[^.]+$/, '') + ext;
                        break;
                    }
                }
            }

            if (!finalFilename.includes('.') || finalFilename.endsWith('.txt')) {
                try {
                    const urlObj = new URL(url);
                    const urlFilename = urlObj.pathname.split('/').pop() || '';
                    if (urlFilename.includes('.')) {
                        const ext = urlFilename.substring(urlFilename.lastIndexOf('.'));
                        if (ext.length <= 5) finalFilename = finalFilename.replace(/\.[^.]+$/, '') + ext;
                    }
                } catch { /* ignore */ }
            }

            updateTask(taskId, { filename: finalFilename });
            if (!res.body) throw new Error('No body');

            const reader = res.body.getReader();
            const chunks: BlobPart[] = [];
            let received = 0, lastTime = Date.now(), lastReceived = 0;
            updateTask(taskId, { total });

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                received += value.length;
                const now = Date.now(), timeDiff = now - lastTime;
                if (timeDiff >= 500) {
                    const speed = ((received - lastReceived) / timeDiff) * 1000;
                    lastTime = now; lastReceived = received;
                    updateTask(taskId, { progress: total > 0 ? Math.round((received / total) * 100) : 0, downloaded: received, speed });
                }
            }

            updateTask(taskId, { progress: 100, downloaded: received, speed: 0, status: 'done' });
            const blob = new Blob(chunks);
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl; a.download = finalFilename; a.click();
            URL.revokeObjectURL(blobUrl);
            setTimeout(() => setIsMinimized(true), 2000);

            // Send Discord notification if enabled
            const discordResult = await sendDiscordNotification({
                platform: platform.charAt(0).toUpperCase() + platform.slice(1),
                title: finalFilename,
                quality: total > 0 ? `${(total / (1024 * 1024)).toFixed(1)} MB` : 'Unknown',
                sourceUrl: url, // Original URL
            });
            if (discordResult.sent) {
                updateTask(taskId, { discordSent: true });
            }
        } catch (e) {
            if ((e as Error).name === 'AbortError') {
                setTasks(prev => {
                    const task = prev.find(t => t.id === taskId);
                    if (task?.status !== 'paused') return prev.map(t => t.id === taskId ? { ...t, status: 'cancelled' as const } : t);
                    return prev;
                });
            } else {
                updateTask(taskId, { status: 'error' });
            }
        }
    }, [addTask, updateTask]);

    const resumeTask = useCallback((id: string) => {
        setTasks(prev => {
            const task = prev.find(t => t.id === id);
            if (task && task.status === 'paused' && task.url && task.platform) {
                startDownloadInternal(task.url, task.filename, task.platform, id);
            }
            return prev;
        });
    }, [startDownloadInternal]);

    const startDownload = useCallback(async (url: string, filename: string, platform: string) => {
        await startDownloadInternal(url, filename, platform);
    }, [startDownloadInternal]);

    const setMinimized = useCallback((minimized: boolean) => setIsMinimized(minimized), []);

    return (
        <DownloadContext.Provider value={{ tasks, addTask, updateTask, removeTask, cancelTask, pauseTask, resumeTask, startDownload, setMinimized }}>
            {children}
            <FloatingDownloadPopup isMinimized={isMinimized} setIsMinimized={setIsMinimized} />
        </DownloadContext.Provider>
    );
}


// Floating Popup Component with 2 tabs: Current (active + last 1 history), History (full)
function FloatingDownloadPopup({ isMinimized, setIsMinimized }: { isMinimized: boolean; setIsMinimized: (v: boolean) => void }) {
    const pathname = usePathname();
    const { tasks, removeTask, cancelTask, pauseTask, resumeTask } = useDownloadManager();
    const { queue } = usePendingDownload();
    const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

    // Drag to close
    const dragY = useMotionValue(0);
    const opacity = useTransform(dragY, [0, 100], [1, 0]);
    const scale = useTransform(dragY, [0, 100], [1, 0.9]);

    const activeTasks = tasks.filter(t => t.status !== 'cancelled');
    const downloadingOrPaused = activeTasks.filter(t => t.status === 'downloading' || t.status === 'paused');
    const historyTasks = activeTasks.filter(t => t.status === 'done' || t.status === 'error');
    const downloadingTasks = tasks.filter(t => t.status === 'downloading');
    const totalSpeed = downloadingTasks.reduce((acc, t) => acc + t.speed, 0);
    const totalProgress = activeTasks.length > 0 ? Math.round(activeTasks.reduce((acc, t) => acc + t.progress, 0) / activeTasks.length) : 0;

    // Current tab: active downloads + last 1 history item (so it's not empty)
    const lastHistoryItem = historyTasks.length > 0 ? [historyTasks[historyTasks.length - 1]] : [];
    const currentTasks = downloadingOrPaused.length > 0 ? downloadingOrPaused : lastHistoryItem;

    const totalCount = activeTasks.length + queue.length;

    // Visibility logic:
    // - Always show on /advanced page
    // - On other pages: only show if there are active downloads
    const isAdvancedPage = pathname === '/advanced';
    const hasActiveDownloads = downloadingTasks.length > 0;

    // Hide completely if not on advanced page AND no active downloads
    if (!isAdvancedPage && !hasActiveDownloads) {
        return null;
    }

    const speedFormatted = formatSpeed(totalSpeed);

    const getPlatformIcon = (platform: string) => {
        const p = PLATFORMS.find(pl => pl.id === platform);
        return p?.icon || '📁';
    };



    // Minimized bubble - show when minimized OR when empty
    if (isMinimized) {
        return (
            <div className="fixed bottom-4 right-4 z-[9999]">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="relative cursor-pointer" onClick={() => { if (totalCount > 0) setIsMinimized(false); }}>
                    <div className="w-14 h-14 rounded-full overflow-hidden shadow-2xl border-2 border-[var(--accent-primary)] hover:scale-110 transition-transform">
                        <img src="/icon.png" alt="XTFetch" className="w-full h-full object-cover" />
                    </div>
                    {downloadingTasks.length > 0 && (
                        <svg className="absolute inset-0 w-14 h-14 -rotate-90">
                            <circle cx="28" cy="28" r="26" fill="none" stroke="var(--accent-primary)" strokeWidth="3"
                                strokeDasharray={`${(totalProgress / 100) * 163.36} 163.36`} className="transition-all duration-300" />
                        </svg>
                    )}
                    {totalCount > 0 && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-[var(--accent-primary)] rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg">
                            {totalCount}
                        </div>
                    )}
                    {downloadingTasks.length > 0 && totalSpeed > 0 && (
                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-[var(--accent-primary)] font-mono font-medium bg-[var(--bg-card)] px-2 py-0.5 rounded-full shadow border border-[var(--border-color)]">
                            {speedFormatted.mb}
                        </div>
                    )}
                </motion.div>
            </div>
        );
    }

    // Show empty state bubble if no items
    if (totalCount === 0) {
        return (
            <div className="fixed bottom-4 right-4 z-[9999]">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="relative cursor-pointer opacity-50 hover:opacity-75 transition-opacity">
                    <div className="w-14 h-14 rounded-full overflow-hidden shadow-2xl border-2 border-[var(--accent-primary)]">
                        <img src="/icon.png" alt="XTFetch" className="w-full h-full object-cover" />
                    </div>
                </motion.div>
            </div>
        );
    }

    return (
        <AnimatePresence>
            <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[9999]">
                <motion.div
                    initial={{ opacity: 0, y: 100, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 100, scale: 0.8 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    drag="y"
                    dragElastic={0.2}
                    dragConstraints={{ top: 0, bottom: 150 }}
                    onDragEnd={(event, info) => {
                        if (info.offset.y > 100) {
                            setIsMinimized(true);
                        }
                    }}
                    style={{ opacity, scale }}
                    className="w-full sm:w-96 rounded-xl overflow-hidden shadow-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                    {/* Header - Drag Handle */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[var(--accent-primary)] to-purple-600 cursor-grab active:cursor-grabbing select-none">
                        <div className="flex items-center gap-3">
                            <GripVertical className="w-5 h-5 text-white/60 hover:text-white transition-colors" />
                            <img src="/icon.png" alt="XTFetch" className="w-6 h-6 rounded-full" />
                            <span className="font-semibold text-white">Downloads</span>
                            {downloadingTasks.length > 0 && (
                                <span className="px-2 py-0.5 text-xs bg-white/20 rounded-full text-white">{downloadingTasks.length} active</span>
                            )}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
                            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title="Minimize"><Minus className="w-4 h-4 text-white" /></button>
                    </div>

                    {/* Tabs - Current & History only */}
                    <div className="flex border-b border-[var(--border-color)]">
                        {(['current', 'history'] as const).map(tab => {
                            const count = tab === 'current' ? currentTasks.length : historyTasks.length;
                            return (
                                <button key={tab} onClick={(e) => { e.stopPropagation(); setActiveTab(tab); }}
                                    className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab
                                            ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] bg-[var(--bg-secondary)]'
                                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                        }`}>
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)} {count > 0 && `(${count})`}
                                </button>
                            );
                        })}
                    </div>

                    {/* Network Speed Bar */}
                    {downloadingTasks.length > 0 && activeTab === 'current' && (
                        <div className="px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)] flex items-center gap-3">
                            <Wifi className="w-4 h-4 text-green-500" />
                            <div className="flex-1 flex items-center justify-between text-xs">
                                <span className="text-[var(--text-muted)]">Speed:</span>
                                <div className="flex gap-3">
                                    <span className="text-[var(--accent-primary)] font-mono font-medium">{speedFormatted.mb}</span>
                                    <span className="text-[var(--text-muted)] font-mono">({speedFormatted.mbit})</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Content */}
                    <div className="max-h-64 sm:max-h-72 overflow-y-auto">
                        {activeTab === 'current' && (
                            currentTasks.length === 0 ? (
                                <div className="p-6 text-center text-[var(--text-muted)] text-sm">No active downloads</div>
                            ) : currentTasks.map(task => (
                                <TaskItem key={task.id} task={task} pauseTask={pauseTask} resumeTask={resumeTask} cancelTask={cancelTask} removeTask={removeTask} />
                            ))
                        )}

                        {activeTab === 'history' && (
                            historyTasks.length === 0 ? (
                                <div className="p-6 text-center text-[var(--text-muted)] text-sm">No download history</div>
                            ) : historyTasks.map(task => (
                                <TaskItem key={task.id} task={task} pauseTask={pauseTask} resumeTask={resumeTask} cancelTask={cancelTask} removeTask={removeTask} />
                            ))
                        )}
                    </div>

                    {/* Footer actions */}
                    {activeTab === 'history' && historyTasks.length > 0 && (
                        <div className="px-4 py-2 border-t border-[var(--border-color)]">
                            <button onClick={() => historyTasks.forEach(t => removeTask(t.id))} className="w-full py-1.5 text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors">
                                Clear History
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

// Task Item Component
function TaskItem({ task, pauseTask, resumeTask, cancelTask, removeTask }: {
    task: DownloadTask;
    pauseTask: (id: string) => void;
    resumeTask: (id: string) => void;
    cancelTask: (id: string) => void;
    removeTask: (id: string) => void;
}) {
    return (
        <div className="p-2 sm:p-3 border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-secondary)]/50 transition-colors">
            <div className="flex items-start gap-2 sm:gap-3">
                <div className="mt-0.5 shrink-0">
                    {task.status === 'downloading' && <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent-primary)] animate-spin" />}
                    {task.status === 'paused' && <Pause className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />}
                    {task.status === 'done' && <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />}
                    {task.status === 'error' && <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium truncate" title={task.filename}>{task.filename}</p>
                    <div className="mt-1">
                        <div className="w-full h-1 sm:h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                            <motion.div className={`h-full ${task.status === 'done' ? 'bg-green-500' : task.status === 'error' ? 'bg-red-500' : 'bg-gradient-to-r from-[var(--accent-primary)] to-purple-500'}`}
                                initial={{ width: 0 }} animate={{ width: `${task.progress}%` }} transition={{ duration: 0.3 }} />
                        </div>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-[9px] sm:text-[10px] text-[var(--text-muted)]">
                        <span className="truncate flex items-center gap-1">
                            {task.status === 'done' ? '✓ Complete' : task.status === 'error' ? '✗ Failed' : `${formatBytes(task.downloaded)} / ${task.total > 0 ? formatBytes(task.total) : '?'}`}
                            {task.status === 'done' && task.discordSent && (
                                <span className="text-[#5865F2]" title="Discord notified">📨</span>
                            )}
                        </span>
                        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            {task.status === 'downloading' && task.speed > 0 && <span className="text-[var(--accent-primary)] font-mono text-[8px] sm:text-[10px]">{formatSpeed(task.speed).mb}</span>}
                            <span className="font-medium">{task.progress}%</span>
                        </div>
                    </div>
                </div>
                <div className="shrink-0 flex items-center gap-0.5 sm:gap-1">
                    {task.status === 'downloading' && (
                        <>
                            <button onClick={() => pauseTask(task.id)} className="p-0.5 sm:p-1 text-[var(--text-muted)] hover:text-amber-500 rounded transition-colors" title="Pause"><Pause className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                            <button onClick={() => cancelTask(task.id)} className="p-0.5 sm:p-1 text-[var(--text-muted)] hover:text-red-500 rounded transition-colors" title="Cancel"><X className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                        </>
                    )}
                    {task.status === 'paused' && (
                        <>
                            <button onClick={() => resumeTask(task.id)} className="p-0.5 sm:p-1 text-[var(--text-muted)] hover:text-green-500 rounded transition-colors" title="Resume"><Play className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                            <button onClick={() => cancelTask(task.id)} className="p-0.5 sm:p-1 text-[var(--text-muted)] hover:text-red-500 rounded transition-colors" title="Cancel"><X className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                        </>
                    )}
                    {(task.status === 'done' || task.status === 'error') && (
                        <button onClick={() => removeTask(task.id)} className="p-0.5 sm:p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded transition-colors" title="Remove"><X className="w-3 h-3 sm:w-4 sm:h-4" /></button>
                    )}
                </div>
            </div>
        </div>
    );
}
