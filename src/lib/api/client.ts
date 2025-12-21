/**
 * API Client for Backend Communication
 * Handles all requests to the backend API
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

export class ApiError extends Error {
    constructor(public status: number, message: string, public data?: unknown) {
        super(message);
        this.name = 'ApiError';
    }
}

interface FetchOptions extends Omit<RequestInit, 'body'> {
    auth?: boolean;
    body?: unknown;
}

function getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    // Try to get from Supabase session in localStorage
    const supabaseKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (supabaseKey) {
        try {
            const session = JSON.parse(localStorage.getItem(supabaseKey) || '{}');
            return session?.access_token || null;
        } catch {
            return null;
        }
    }
    return null;
}

export async function apiClient<T>(
    endpoint: string,
    options: FetchOptions = {}
): Promise<T> {
    const { auth = false, body, ...fetchOptions } = options;
    
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(fetchOptions.headers as Record<string, string>),
    };
    
    if (auth) {
        const token = getAuthToken();
        if (token) {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
        }
    }
    
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
    
    const response = await fetch(url, {
        ...fetchOptions,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
        throw new ApiError(response.status, data.error || 'Request failed', data);
    }
    
    return data as T;
}

// Convenience methods
export const api = {
    get: <T>(endpoint: string, options?: Omit<FetchOptions, 'method' | 'body'>) =>
        apiClient<T>(endpoint, { ...options, method: 'GET' }),
    
    post: <T>(endpoint: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
        apiClient<T>(endpoint, { ...options, method: 'POST', body }),
    
    put: <T>(endpoint: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
        apiClient<T>(endpoint, { ...options, method: 'PUT', body }),
    
    patch: <T>(endpoint: string, body?: unknown, options?: Omit<FetchOptions, 'method' | 'body'>) =>
        apiClient<T>(endpoint, { ...options, method: 'PATCH', body }),
    
    delete: <T>(endpoint: string, options?: Omit<FetchOptions, 'method'>) =>
        apiClient<T>(endpoint, { ...options, method: 'DELETE' }),
};

export default api;
