/**
 * Admin Authentication
 * API Key-based auth for admin panel (secure & simple)
 * 
 * How it works:
 * 1. Admin panel stores key in localStorage after first setup
 * 2. Every admin API request includes X-Admin-Key header
 * 3. Backend verifies against ADMIN_SECRET_KEY env var
 * 
 * Benefits:
 * - No cookies = works everywhere (Vercel, local, etc)
 * - Simple to implement and debug
 * - Secure (key only sent over HTTPS)
 */

import crypto from 'crypto';
import { NextRequest } from 'next/server';

// Admin secret key from environment
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || process.env.API_SECRET_KEY || '';

export type UserRole = 'user' | 'admin';

interface AuthResult {
    valid: boolean;
    userId?: string;
    email?: string;
    role?: UserRole;
    error?: string;
}

/**
 * Verify admin access via API Key
 * 
 * Checks in order:
 * 1. X-Admin-Key header (primary method)
 * 2. Authorization: Bearer <key> header (alternative)
 * 3. ?admin_key=<key> query param (for testing only)
 */
export async function verifySession(request: NextRequest): Promise<AuthResult> {
    // If no admin key configured, allow access (dev mode / unconfigured)
    if (!ADMIN_SECRET_KEY) {
        console.warn('[Auth] ADMIN_SECRET_KEY not set - allowing all access');
        return { valid: true, role: 'admin' };
    }
    
    // Method 1: X-Admin-Key header (recommended)
    const adminKey = request.headers.get('X-Admin-Key');
    if (adminKey && timingSafeEqual(adminKey, ADMIN_SECRET_KEY)) {
        return { valid: true, role: 'admin' };
    }
    
    // Method 2: Authorization Bearer header
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        if (timingSafeEqual(token, ADMIN_SECRET_KEY)) {
            return { valid: true, role: 'admin' };
        }
    }
    
    // Method 3: Query param (for easy testing, not recommended for production)
    const queryKey = request.nextUrl.searchParams.get('admin_key');
    if (queryKey && timingSafeEqual(queryKey, ADMIN_SECRET_KEY)) {
        return { valid: true, role: 'admin' };
    }
    
    return { valid: false, error: 'Invalid or missing admin key' };
}

/**
 * Verify admin access (alias for verifySession)
 */
export async function verifyAdminSession(request: NextRequest): Promise<AuthResult> {
    return verifySession(request);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
    try {
        const bufA = Buffer.from(a.padEnd(100));
        const bufB = Buffer.from(b.padEnd(100));
        return crypto.timingSafeEqual(bufA, bufB);
    } catch {
        return false;
    }
}

/**
 * Get the admin key for client-side use
 * This is exposed via a public env var for the admin panel
 */
export function getAdminKeyForClient(): string | null {
    // Client should get this from NEXT_PUBLIC_ADMIN_KEY
    // or prompt user to enter it manually
    return null;
}
