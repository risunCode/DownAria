/**
 * Admin Cookies API
 * Manage global cookies for platforms
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/core/security';
import { 
  getAllAdminCookies, 
  setAdminCookie, 
  toggleAdminCookie, 
  deleteAdminCookie,
  parseCookie,
  validateCookie,
  type CookiePlatform 
} from '@/lib/cookies';

const VALID_PLATFORMS: CookiePlatform[] = ['facebook', 'instagram', 'weibo', 'twitter'];

// GET - List all admin cookies
export async function GET(request: NextRequest) {
  const auth = await verifyAdminSession(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  
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
  const auth = await verifyAdminSession(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  
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
  const auth = await verifyAdminSession(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  
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
  const auth = await verifyAdminSession(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
  }
  
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
