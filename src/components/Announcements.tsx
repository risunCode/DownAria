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

const ICON_MAP = {
    info: 'info',
    success: 'success',
    warning: 'warning',
    error: 'error',
} as const;

export default function Announcements({ page }: { page: string }) {
    const [shown, setShown] = useState<number[]>([]);

    useEffect(() => {
        // Load shown announcements from localStorage
        const stored = localStorage.getItem('xtf_shown_announcements');
        if (stored) {
            setShown(JSON.parse(stored));
        }
    }, []);

    useEffect(() => {
        const fetchAndShow = async () => {
            try {
                const res = await fetch(`/api/announcements?page=${page}`);
                const json = await res.json();
                
                if (!json.success || !json.data?.length) return;

                const announcements: Announcement[] = json.data;
                
                // Filter out already shown (if show_once)
                const toShow = announcements.filter(a => {
                    if (a.show_once && shown.includes(a.id)) return false;
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
                    denyButtonText: "Don't show again",
                    denyButtonColor: '#6b7280',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    confirmButtonColor: 'var(--accent-primary)',
                });

                // Mark as shown if show_once AND user clicked "Don't show again"
                if (ann.show_once && (result.isDenied || result.isConfirmed)) {
                    const newShown = [...shown, ann.id];
                    setShown(newShown);
                    localStorage.setItem('xtf_shown_announcements', JSON.stringify(newShown));
                }
            } catch {
                // Failed to fetch announcements
            }
        };

        // Small delay to not block initial render
        const timer = setTimeout(fetchAndShow, 500);
        return () => clearTimeout(timer);
    }, [page, shown]);

    return null; // This component doesn't render anything
}
