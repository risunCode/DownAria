/**
 * DownloadProgress - Reusable download progress bar
 * Used in DownloadPreview and MediaGallery
 */

'use client';

import { motion } from 'framer-motion';
import { formatBytes } from '@/lib/utils/format';

export interface DownloadProgressData {
    percent: number;
    loaded: number;
    total: number;
    speed: number;
    eta?: number;
    message?: string;
}

interface DownloadProgressProps {
    progress: DownloadProgressData;
    showSpeed?: boolean;
    showEta?: boolean;
    animated?: boolean;
    className?: string;
}

/**
 * Display download progress with bar, speed, and ETA
 */
export function DownloadProgress({
    progress,
    showSpeed = true,
    showEta = true,
    animated = true,
    className = ''
}: DownloadProgressProps) {
    const { percent, loaded, total, speed, eta, message } = progress;

    return (
        <div className={`space-y-1 ${className}`}>
            {/* Progress Bar */}
            <div className="w-full h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                {animated ? (
                    <motion.div
                        className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-purple-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.1, ease: 'linear' }}
                    />
                ) : (
                    <div
                        className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-purple-500 transition-all duration-300 ease-out"
                        style={{ width: `${percent}%` }}
                    />
                )}
            </div>

            {/* Stats Row */}
            <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
                {/* Left: Size progress or message */}
                <span>
                    {message || `${formatBytes(loaded)} / ${total ? formatBytes(total) : '?'}`}
                </span>

                {/* Right: Speed and ETA */}
                {(showSpeed || showEta) && (
                    <span className="text-[var(--accent-primary)] font-mono">
                        {showSpeed && speed > 0 && (
                            <>{(speed / 1024 / 1024).toFixed(1)} MB/s</>
                        )}
                        {showEta && eta !== undefined && eta > 0 && (
                            <> · {Math.ceil(eta)}s left</>
                        )}
                    </span>
                )}
            </div>
        </div>
    );
}

/**
 * Get progress text for button display
 */
export function getProgressText(progress: DownloadProgressData): string {
    if (progress.message) return progress.message;
    
    const parts: string[] = [];
    
    if (progress.percent > 0) {
        parts.push(`${progress.percent}%`);
    }
    
    if (progress.speed > 0) {
        const speedMB = (progress.speed / (1024 * 1024)).toFixed(1);
        parts.push(`${speedMB} MB/s`);
    }
    
    return parts.length > 0 ? parts.join(' · ') : 'Loading...';
}

export default DownloadProgress;
