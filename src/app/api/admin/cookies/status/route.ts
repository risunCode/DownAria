/**
 * Admin Cookie Status API
 * Returns which platforms have admin cookies configured
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminCookie, type CookiePlatform } from '@/lib/utils/admin-cookie';
import { verifySession } from '@/lib/utils/admin-auth';

const PLATFORMS: CookiePlatform[] = ['facebook', 'instagram', 'twitter', 'weibo'];

export async function GET(request: NextRequest) {
    // Auth check - any logged in user can view status
    const auth = await verifySession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }
    const status: Record<string, boolean> = {};
    
    await Promise.all(
        PLATFORMS.map(async (platform) => {
            const cookie = await getAdminCookie(platform);
            status[platform] = !!cookie;
        })
    );
    
    return NextResponse.json(status);
}
