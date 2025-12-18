/**
 * Admin Authentication
 * Supabase session-based auth for admin panel
 * 
 * How it works:
 * 1. User logs in via /auth (Supabase Auth)
 * 2. Session stored in cookies by Supabase
 * 3. Admin APIs verify session via Supabase
 * 4. Role checked from users table
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create server-side Supabase client
const supabase = supabaseUrl && supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;

export type UserRole = 'user' | 'admin';

interface AuthResult {
    valid: boolean;
    userId?: string;
    email?: string;
    username?: string;
    role?: UserRole;
    error?: string;
}

/**
 * Verify admin session via Supabase
 * Checks Authorization header for Bearer token (Supabase access token)
 */
export async function verifySession(request: NextRequest): Promise<AuthResult> {
    if (!supabase) {
        console.error('[Auth] Supabase not configured');
        return { valid: false, error: 'Auth service not configured' };
    }
    
    // Get token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return { valid: false, error: 'No authorization token' };
    }
    
    const token = authHeader.slice(7);
    
    try {
        // Verify the token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (error || !user) {
            return { valid: false, error: error?.message || 'Invalid token' };
        }
        
        // Get user profile with role from database
        const { data: profile } = await supabase
            .from('users')
            .select('username, role')
            .eq('id', user.id)
            .single();
        
        const role = (profile?.role as UserRole) || 'user';
        
        return {
            valid: true,
            userId: user.id,
            email: user.email,
            username: profile?.username,
            role
        };
    } catch (error) {
        console.error('[Auth] Session verification error:', error);
        return { valid: false, error: 'Session verification failed' };
    }
}

/**
 * Verify admin access - must have 'admin' role
 */
export async function verifyAdminSession(request: NextRequest): Promise<AuthResult> {
    const result = await verifySession(request);
    
    if (!result.valid) return result;
    
    // Check if user has admin role
    if (result.role !== 'admin') {
        return { 
            valid: false, 
            error: 'Admin access required',
            userId: result.userId,
            email: result.email,
            role: result.role
        };
    }
    
    return result;
}

/**
 * Verify admin token (alias for verifyAdminSession)
 * Returns { valid, username } for compatibility
 */
export async function verifyAdminToken(request: NextRequest): Promise<{ valid: boolean; username?: string; error?: string }> {
    const result = await verifyAdminSession(request);
    return {
        valid: result.valid,
        username: result.username || result.email || 'admin',
        error: result.error
    };
}
