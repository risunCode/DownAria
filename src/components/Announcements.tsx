'use client';

import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';

interface Announcement {
    id: number;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    show_once: boolean;
}

interface DismissedAnnouncement {
    id: number;
    dismissedAt: number; // timestamp
}

const ICON_MAP = {
    info: 'info',
    success: 'success',
    warning: 'warning',
    error: 'error',
} as const;

const DISMISS_DURATION = 12 * 60 * 60 * 1000; // 12 hours in ms

export default function Announcements({ page }: { page: string }) {
    const [dismissed, setDismissed] = useState<DismissedAnnouncement[]>([]);

    useEffect(() => {
        // Load dismissed announcements from localStorage
        const stored = localStorage.getItem('xtf_dismissed_announcements');
        if (stored) {
            try {
                const parsed: DismissedAnnouncement[] = JSON.parse(stored);
                // Filter out expired dismissals (older than 12 hours)
                const now = Date.now();
                const valid = parsed.filter(d => now - d.dismissedAt < DISMISS_DURATION);
                setDismissed(valid);
                // Update storage with only valid ones
                if (valid.length !== parsed.length) {
                    localStorage.setItem('xtf_dismissed_announcements', JSON.stringify(valid));
                }
            } catch {
                setDismissed([]);
            }
        }
    }, []);

    useEffect(() => {
        const fetchAndShow = async () => {
            try {
                const res = await fetch(`/api/announcements?page=${page}`);
                const json = await res.json();
                
                if (!json.success || !json.data?.length) return;

                const announcements: Announcement[] = json.data;
                const now = Date.now();
                
                // Filter out dismissed (if show_once and within 12 hours)
                const toShow = announcements.filter(a => {
                    if (a.show_once) {
                        const dismissal = dismissed.find(d => d.id === a.id);
                        if (dismissal && now - dismissal.dismissedAt < DISMISS_DURATION) {
                            return false;
                        }
                    }
                    return true;
                });

                if (toShow.length === 0) return;

                // Show first announcement
                const ann = toShow[0];
                
                const result = await Swal.fire({
                    title: ann.title,
                    html: ann.message,
                    icon: ICON_MAP[ann.type] || 'info',
                    confirmButtonText: 'OK',
                    showDenyButton: ann.show_once,
                    denyButtonText: "Don't show today",
                    denyButtonColor: '#6b7280',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    confirmButtonColor: 'var(--accent-primary)',
                });

                // Mark as dismissed if show_once AND user clicked "Don't show today"
                if (ann.show_once && result.isDenied) {
                    const newDismissed = [
                        ...dismissed.filter(d => d.id !== ann.id), // Remove old entry if exists
                        { id: ann.id, dismissedAt: Date.now() }
                    ];
                    setDismissed(newDismissed);
                    localStorage.setItem('xtf_dismissed_announcements', JSON.stringify(newDismissed));
                }
            } catch {
                // Failed to fetch announcements
            }
        };

        // Small delay to not block initial render
        const timer = setTimeout(fetchAndShow, 500);
        return () => clearTimeout(timer);
    }, [page, dismissed]);

    return null; // This component doesn't render anything
}
