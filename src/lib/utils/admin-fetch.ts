/**
 * Admin Fetch Utility
 * Wrapper for fetch that automatically includes X-Admin-Key header
 * 
 * Usage in admin pages:
 * import { adminFetch } from '@/lib/utils/admin-fetch';
 * const res = await adminFetch('/api/admin/services');
 * 
 * Or use the hook in components:
 * const { adminFetch } = useAdmin();
 */

const ADMIN_KEY_STORAGE = 'xtf_admin_key';

/**
 * Get admin key from localStorage
 */
export function getAdminKey(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ADMIN_KEY_STORAGE);
}

/**
 * Set admin key in localStorage
 */
export function setAdminKey(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ADMIN_KEY_STORAGE, key);
}

/**
 * Clear admin key from localStorage
 */
export function clearAdminKey(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ADMIN_KEY_STORAGE);
}

/**
 * Check if admin key is set
 */
export function hasAdminKey(): boolean {
    return !!getAdminKey();
}

/**
 * Fetch wrapper that includes X-Admin-Key header
 * Can be used directly or via useAdmin() hook
 */
export async function adminFetch(
    url: string,
    options: RequestInit = {}
): Promise<Response> {
    const adminKey = getAdminKey();
    
    const headers = new Headers(options.headers);
    if (adminKey) {
        headers.set('X-Admin-Key', adminKey);
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
 * This patches window.fetch for /api/admin/* URLs
 */
export function installAdminFetchGlobal(): void {
    if (typeof window === 'undefined') return;
    
    const originalFetch = window.fetch;
    
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        
        // Only intercept admin API calls
        if (url.includes('/api/admin')) {
            const adminKey = getAdminKey();
            if (adminKey) {
                const headers = new Headers(init?.headers);
                headers.set('X-Admin-Key', adminKey);
                return originalFetch(input, { ...init, headers });
            }
        }
        
        return originalFetch(input, init);
    };
}
