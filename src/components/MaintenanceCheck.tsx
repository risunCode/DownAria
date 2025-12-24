'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import { useStatus } from '@/hooks';

// Paths that should NOT show maintenance overlay
const EXCLUDED_PATHS = [
    '/admin',
    '/auth',
];

/**
 * MaintenanceCheck Component
 * Note: Full maintenance is now handled directly in page.tsx with MaintenanceMode component
 * This component is kept for potential future use (e.g., showing banners for API-only maintenance)
 */
export function MaintenanceCheck({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { maintenanceType, isLoading } = useStatus();
    const [isAdmin, setIsAdmin] = useState(false);
    const [checked, setChecked] = useState(false);

    // Check if user is admin (has valid session in localStorage)
    useEffect(() => {
        const checkAdmin = () => {
            if (typeof window === 'undefined') return false;
            
            // Check for Supabase session
            const supabaseKey = Object.keys(localStorage).find(
                k => k.startsWith('sb-') && k.endsWith('-auth-token')
            );
            
            if (supabaseKey) {
                try {
                    const session = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
                    if (session?.access_token) {
                        setIsAdmin(true);
                        return;
                    }
                } catch {
                    // Invalid session
                }
            }
            setIsAdmin(false);
        };

        checkAdmin();
        setChecked(true);
    }, []);

    // Note: No redirect - maintenance page is shown directly in page.tsx
    // This component can be used for API-only maintenance banners in the future

    return <>{children}</>;
}

export default MaintenanceCheck;
