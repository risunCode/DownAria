/**
 * Admin Auth API
 * Check current auth status via Supabase session
 * 
 * GET - Check if user is authenticated and has admin role
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession, verifyAdminSession } from '@/core/security';

// GET - Check current auth status
export async function GET(request: NextRequest) {
    const auth = await verifySession(request);
    
    if (!auth.valid) {
        return NextResponse.json({ 
            success: false, 
            authenticated: false,
            error: auth.error 
        }, { status: 401 });
    }
    
    return NextResponse.json({ 
        success: true, 
        authenticated: true,
        userId: auth.userId,
        email: auth.email,
        username: auth.username,
        role: auth.role,
        isAdmin: auth.role === 'admin'
    });
}

// POST - Verify admin access specifically
export async function POST(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    
    if (!auth.valid) {
        return NextResponse.json({ 
            success: false, 
            error: auth.error || 'Admin access required'
        }, { status: auth.role ? 403 : 401 });
    }
    
    return NextResponse.json({ 
        success: true, 
        message: 'Admin access verified',
        userId: auth.userId,
        username: auth.username
    });
}
