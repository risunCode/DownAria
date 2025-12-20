/**
 * Admin Fetch Utility
 * Wrapper for fetch that automatically includes Supabase auth token
 * 
 * Usage in admin pages:
 * import { adminFetch } from '@/lib/utils/admin-fetch';
 * const res = await adminFetch('/api/admin/services');
 * 
 * Or use the hook in components:
 * const { adminFetch } = useAdmin();
 */

import { supabase } from '@/core/database';
import { getEncrypted, setEncrypted, removeEncrypted, migrateToEncrypted } from '@/lib/storage/crypto';

// Legacy admin key storage (kept for backward compatibility)
const ADMIN_KEY_STORAGE = 'xtf_admin_key';

/**
 * Get admin key from localStorage (legacy) - ENCRYPTED
 */
export function getAdminKey(): string | null {
    if (typeof window === 'undefined') return null;
    // Auto-migrate unencrypted data
    migrateToEncrypted(ADMIN_KEY_STORAGE);
    return getEncrypted(ADMIN_KEY_STORAGE);
}

/**
 * Set admin key in localStorage (legacy) - ENCRYPTED
 */
export function setAdminKey(key: string): void {
    if (typeof window === 'undefined') return;
    setEncrypted(ADMIN_KEY_STORAGE, key);
}

/**
 * Clear admin key from localStorage (legacy)
 */
export function clearAdminKey(): void {
    if (typeof window === 'undefined') return;
    removeEncrypted(ADMIN_KEY_STORAGE);
}

/**
 * Check if admin key is set (legacy)
 */
export function hasAdminKey(): boolean {
    return !!getAdminKey();
}

/**
 * Get Supabase access token for API calls
 * With retry logic for race conditions during page load
 */
async function getSupabaseToken(retries = 3): Promise<string | null> {
    if (!supabase) return null;

    for (let i = 0; i < retries; i++) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                return session.access_token;
            }
            // Wait a bit before retry (session might not be ready yet)
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
            }
        } catch {
            if (i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
            }
        }
    }
    return null;
}

/**
 * Fetch wrapper that includes Supabase auth token
 * Can be used directly or via useAdmin() hook
 */
export async function adminFetch(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    const token = await getSupabaseToken();

    const headers = new Headers(options.headers);
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(url, {
        ...options,
        headers
    });
}

/**
 * JSON fetch helper for admin APIs
 */
export async function adminFetchJson<T = unknown>(
    url: string,
    options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
        const res = await adminFetch(url, options);
        const json = await res.json();
        return json;
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Request failed'
        };
    }
}

/**
 * Install admin fetch globally (call once in layout)
 * This patches window.fetch for /api/admin/* URLs to include auth token
 */
export function installAdminFetchGlobal(): void {
    if (typeof window === 'undefined') return;
    if ((window as unknown as { __adminFetchInstalled?: boolean }).__adminFetchInstalled) return;

    const originalFetch = window.fetch;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

        // Intercept admin API calls
        if (url.includes('/api/admin') || url.includes('/api/announcements')) {
            const token = await getSupabaseToken();
            if (token) {
                const headers = new Headers(init?.headers);
                headers.set('Authorization', `Bearer ${token}`);
                return originalFetch(input, { ...init, headers });
            }
        }

        return originalFetch(input, init);
    };

    (window as unknown as { __adminFetchInstalled?: boolean }).__adminFetchInstalled = true;
}
