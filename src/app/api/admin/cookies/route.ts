/**
 * Admin Cookies API
 * Manage global cookies for platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getAllAdminCookies, 
  setAdminCookie, 
  toggleAdminCookie, 
  deleteAdminCookie,
  type CookiePlatform 
} from '@/lib/utils/admin-cookie';
import { parseCookie, validateCookie } from '@/lib/utils/cookie-parser';
import { verifyAdminSession } from '@/lib/utils/admin-auth';

const VALID_PLATFORMS: CookiePlatform[] = ['facebook', 'instagram', 'weibo', 'twitter'];

// Auth check helper - admin only
async function checkAuth(request: NextRequest): Promise<NextResponse | null> {
  const auth = await verifyAdminSession(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error || 'Admin access required' }, { status: 403 });
  }
  return null;
}

// GET - List all admin cookies
export async function GET(request: NextRequest) {
  const authError = await checkAuth(request);
  if (authError) return authError;
  
  try {
    const cookies = await getAllAdminCookies();
    return NextResponse.json({ success: true, data: cookies });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch cookies' 
    }, { status: 500 });
  }
}

// POST - Create/Update cookie
export async function POST(request: NextRequest) {
  const authError = await checkAuth(request);
  if (authError) return authError;
  
  try {
    const { platform, cookie, note } = await request.json();
    
    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ success: false, error: 'Invalid platform' }, { status: 400 });
    }
    
    if (!cookie) {
      return NextResponse.json({ success: false, error: 'Cookie is required' }, { status: 400 });
    }
    
    // Parse and validate
    const parsed = parseCookie(cookie, platform);
    if (!parsed) {
      return NextResponse.json({ success: false, error: 'Invalid cookie format' }, { status: 400 });
    }
    
    const validation = validateCookie(parsed, platform);
    if (!validation.valid) {
      return NextResponse.json({ 
        success: false, 
        error: `Missing required cookies: ${validation.missing?.join(', ') || 'unknown'}` 
      }, { status: 400 });
    }
    
    const success = await setAdminCookie(platform, parsed, note);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to save cookie' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, message: 'Cookie saved' });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to save cookie' 
    }, { status: 500 });
  }
}

// PATCH - Toggle cookie enabled status
export async function PATCH(request: NextRequest) {
  const authError = await checkAuth(request);
  if (authError) return authError;
  
  try {
    const { platform, enabled } = await request.json();
    
    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ success: false, error: 'Invalid platform' }, { status: 400 });
    }
    
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'enabled must be boolean' }, { status: 400 });
    }
    
    const success = await toggleAdminCookie(platform, enabled);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to toggle cookie' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, message: `Cookie ${enabled ? 'enabled' : 'disabled'}` });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to toggle cookie' 
    }, { status: 500 });
  }
}

// DELETE - Remove cookie
export async function DELETE(request: NextRequest) {
  const authError = await checkAuth(request);
  if (authError) return authError;
  
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') as CookiePlatform;
    
    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      return NextResponse.json({ success: false, error: 'Invalid platform' }, { status: 400 });
    }
    
    const success = await deleteAdminCookie(platform);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Failed to delete cookie' }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, message: 'Cookie deleted' });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete cookie' 
    }, { status: 500 });
  }
}
