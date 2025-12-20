'use client';

import { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { useAnnouncements } from '@/hooks';

interface DismissedAnnouncement {
    id: string | number;
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
    const [shown, setShown] = useState(false);
    
    // Use SWR for announcements (cached, deduplicated)
    const { announcements } = useAnnouncements(page);

    useEffect(() => {
        // Load dismissed announcements from localStorage
        const stored = localStorage.getItem('xtf_announcements_read');
        if (stored) {
            try {
                const parsed: DismissedAnnouncement[] = JSON.parse(stored);
                // Filter out expired dismissals (older than 12 hours)
                const now = Date.now();
                const valid = parsed.filter(d => now - d.dismissedAt < DISMISS_DURATION);
                setDismissed(valid);
                // Update storage with only valid ones
                if (valid.length !== parsed.length) {
                    localStorage.setItem('xtf_announcements_read', JSON.stringify(valid));
                }
            } catch {
                setDismissed([]);
            }
        }
    }, []);

    useEffect(() => {
        if (!announcements.length || shown) return;

        const showAnnouncement = async () => {
            const now = Date.now();

            // Filter out dismissed (if show_once and within 12 hours)
            const toShow = announcements.filter(a => {
                if (a.show_once) {
                    const dismissal = dismissed.find(d => String(d.id) === String(a.id));
                    if (dismissal && now - dismissal.dismissedAt < DISMISS_DURATION) {
                        return false;
                    }
                }
                return true;
            });

            if (toShow.length === 0) return;

            setShown(true);

            // Show first announcement
            const ann = toShow[0];

            const result = await Swal.fire({
                title: ann.title,
                html: ann.message,
                icon: ICON_MAP[ann.type] || 'info',
                confirmButtonText: 'OK',
                showDenyButton: true,
                denyButtonText: "Don't show today",
                denyButtonColor: '#6b7280',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                confirmButtonColor: 'var(--accent-primary)',
            });

            // Mark as dismissed if user clicked "Don't show today"
            if (result.isDenied) {
                const newDismissed: DismissedAnnouncement[] = [
                    ...dismissed.filter(d => String(d.id) !== String(ann.id)),
                    { id: ann.id, dismissedAt: Date.now() }
                ];
                setDismissed(newDismissed);
                localStorage.setItem('xtf_announcements_read', JSON.stringify(newDismissed));
            }
        };

        // Small delay to not block initial render
        const timer = setTimeout(showAnnouncement, 500);
        return () => clearTimeout(timer);
    }, [announcements, dismissed, shown]);

    return null; // This component doesn't render anything
}
