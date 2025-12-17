/**
 * Admin Auth API
 * Simple API key verification endpoint
 * 
 * POST - Verify admin key
 * GET - Check if key is valid
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/utils/admin-auth';

// POST - Verify admin key
export async function POST(request: NextRequest) {
    try {
        const { key } = await request.json();

        if (!key) {
            return NextResponse.json({ success: false, error: 'Admin key required' }, { status: 400 });
        }

        // Create a mock request with the key as header to verify
        const mockHeaders = new Headers();
        mockHeaders.set('X-Admin-Key', key);
        const mockRequest = new NextRequest(request.url, { headers: mockHeaders });
        
        const auth = await verifyAdminSession(mockRequest);
        
        if (!auth.valid) {
            return NextResponse.json({ success: false, error: 'Invalid admin key' }, { status: 401 });
        }
        
        return NextResponse.json({ success: true, message: 'Admin key verified' });
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
}

// GET - Check current auth status
export async function GET(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }
    
    return NextResponse.json({ success: true, role: auth.role });
}
