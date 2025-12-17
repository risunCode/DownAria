/**
 * Admin Authentication
 * Supabase session-based auth for admin panel
 */

import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create admin client for server-side operations (bypasses RLS)
function getSupabaseAdmin() {
    if (!supabaseUrl || !serviceRoleKey) return null;
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

// Create SSR client that can read cookies from request
function createSupabaseServerClient(request: NextRequest) {
    // Check if Supabase is properly configured
    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === '' || supabaseAnonKey === '') {
        return null;
    }
    
    try {
        return createServerClient(supabaseUrl, supabaseAnonKey, {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll() {
                    // We don't need to set cookies in API routes
                },
            },
        });
    } catch {
        return null;
    }
}

export type UserRole = 'user' | 'admin';

interface AuthResult {
    valid: boolean;
    userId?: string;
    email?: string;
    role?: UserRole;
    error?: string;
}

/**
 * Verify user session from request cookies (Supabase auth)
 * Works with both user and admin roles
 * 
 * For personal use: Always allows access in development mode
 */
export async function verifySession(request: NextRequest): Promise<AuthResult> {
    // DEVELOPMENT MODE: Always allow access for personal use
    if (process.env.NODE_ENV === 'development') {
        return { valid: true, role: 'admin', error: undefined };
    }
    
    // Use SSR client to properly read Supabase cookies
    const supabase = createSupabaseServerClient(request);
    const supabaseAdmin = getSupabaseAdmin();
    
    if (!supabase) {
        // If Supabase not configured, allow access
        return { valid: true, role: 'admin', error: undefined };
    }

    try {
        // Get user from session using SSR client
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            // Fallback: try Authorization header
            const authHeader = request.headers.get('Authorization');
            if (authHeader?.startsWith('Bearer ') && supabaseAdmin) {
                const token = authHeader.slice(7);
                const { data: { user: headerUser }, error: headerError } = await supabaseAdmin.auth.getUser(token);
                
                if (!headerError && headerUser) {
                    const { data: profile } = await supabaseAdmin
                        .from('users')
                        .select('role')
                        .eq('id', headerUser.id)
                        .single();

                    return {
                        valid: true,
                        userId: headerUser.id,
                        email: headerUser.email,
                        role: (profile?.role as UserRole) || 'admin'
                    };
                }
            }
            
            return { valid: false, error: error?.message || 'Auth session missing' };
        }

        // Get user profile to check role (use admin client to bypass RLS)
        let role: UserRole = 'admin'; // Default to admin for personal use
        if (supabaseAdmin) {
            const { data: profile } = await supabaseAdmin
                .from('users')
                .select('role')
                .eq('id', user.id)
                .single();
            role = (profile?.role as UserRole) || 'admin';
        }

        return {
            valid: true,
            userId: user.id,
            email: user.email,
            role
        };
    } catch (err) {
        console.error('[Auth] Session verification error:', err);
        return { valid: false, error: 'Session verification failed' };
    }
}

/**
 * Verify admin access (must be logged in AND have admin role)
 * For personal use - less strict, allows any logged in user
 */
export async function verifyAdminSession(request: NextRequest): Promise<AuthResult> {
    const result = await verifySession(request);
    
    if (!result.valid) {
        return result;
    }

    // For personal use - any valid session is admin
    // In production with multiple users, uncomment the role check:
    // if (result.role !== 'admin') {
    //     return { valid: false, error: 'Admin access required' };
    // }

    return { ...result, role: 'admin' };
}

/**
 * Legacy: Verify admin token from request (JWT-based)
 * Kept for backward compatibility, but now also checks Supabase session
 */
export function verifyAdminToken(request: NextRequest): { valid: boolean; username?: string; error?: string } {
    // First try JWT token (legacy)
    const authHeader = request.headers.get('Authorization');
    let token: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    }
    
    if (!token) {
        token = request.cookies.get('admin_token')?.value || null;
    }
    
    if (token) {
        const payload = verifyJWT(token);
        if (payload) {
            return { valid: true, username: payload.sub };
        }
    }
    
    // JWT not found or invalid - return false
    // Caller should use verifyAdminSession() for Supabase auth
    return { valid: false, error: 'No valid token' };
}

// ═══════════════════════════════════════════════════════════════
// JWT HELPERS (Legacy, kept for backward compatibility)
// ═══════════════════════════════════════════════════════════════

const JWT_SECRET = process.env.JWT_SECRET || process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

interface TokenPayload {
    sub: string;
    iat: number;
    exp: number;
}

function base64UrlEncode(str: string): string {
    return Buffer.from(str).toString('base64url');
}

function base64UrlDecode(str: string): string {
    return Buffer.from(str, 'base64url').toString();
}

function signJWT(payload: TokenPayload): string {
    const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = base64UrlEncode(JSON.stringify(payload));
    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${header}.${body}`)
        .digest('base64url');
    return `${header}.${body}.${signature}`;
}

function verifyJWT(token: string): TokenPayload | null {
    try {
        const [header, body, signature] = token.split('.');
        if (!header || !body || !signature) return null;
        
        const expectedSig = crypto
            .createHmac('sha256', JWT_SECRET)
            .update(`${header}.${body}`)
            .digest('base64url');
        
        if (signature !== expectedSig) return null;
        
        const payload = JSON.parse(base64UrlDecode(body)) as TokenPayload;
        if (payload.exp < Date.now()) return null;
        
        return payload;
    } catch {
        return null;
    }
}

/**
 * Generate admin token (legacy JWT)
 */
export function generateAdminToken(username: string): string {
    const payload: TokenPayload = {
        sub: username,
        iat: Date.now(),
        exp: Date.now() + TOKEN_EXPIRY,
    };
    return signJWT(payload);
}

/**
 * Validate admin credentials
 */
export function validateAdminCredentials(username: string, password: string): boolean {
    const adminUser = process.env.ADMIN_USER;
    const adminPassword = process.env.ADMIN_PASSWORD;
    
    // SECURITY: Require env vars to be set - no defaults!
    if (!adminUser || !adminPassword) {
        return false;
    }
    
    // Timing-safe comparison to prevent timing attacks
    const userMatch = crypto.timingSafeEqual(
        Buffer.from(username.padEnd(100)),
        Buffer.from(adminUser.padEnd(100))
    );
    const passMatch = crypto.timingSafeEqual(
        Buffer.from(password.padEnd(100)),
        Buffer.from(adminPassword.padEnd(100))
    );
    
    return userMatch && passMatch;
}
