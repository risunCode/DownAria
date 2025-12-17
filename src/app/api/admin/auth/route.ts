import { NextRequest, NextResponse } from 'next/server';
import { validateAdminCredentials, generateAdminToken, verifyAdminToken } from '@/lib/utils/admin-auth';

// POST - Login
export async function POST(request: NextRequest) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json({ success: false, error: 'Username and password required' }, { status: 400 });
        }

        if (!validateAdminCredentials(username, password)) {
            return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
        }

        const token = generateAdminToken(username);
        
        const response = NextResponse.json({ success: true, token });
        
        // Also set as httpOnly cookie for browser requests
        response.cookies.set('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60, // 24 hours
            path: '/',
        });
        
        return response;
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
}

// GET - Verify token
export async function GET(request: NextRequest) {
    const result = verifyAdminToken(request);
    
    if (!result.valid) {
        return NextResponse.json({ success: false, error: result.error }, { status: 401 });
    }
    
    return NextResponse.json({ success: true, username: result.username });
}

// DELETE - Logout
export async function DELETE() {
    const response = NextResponse.json({ success: true });
    response.cookies.delete('admin_token');
    return response;
}
