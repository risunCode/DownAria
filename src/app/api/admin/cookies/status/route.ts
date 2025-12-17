/**
 * Admin Cookie Status API
 * Returns which platforms have admin cookies configured
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminCookie, type CookiePlatform } from '@/lib/utils/admin-cookie';

const PLATFORMS: CookiePlatform[] = ['facebook', 'instagram', 'twitter', 'weibo'];

export async function GET(request: NextRequest) {
    void request; // Personal use - no auth required
    
    const status: Record<string, boolean> = {};
    
    await Promise.all(
        PLATFORMS.map(async (platform) => {
            const cookie = await getAdminCookie(platform);
            status[platform] = !!cookie;
        })
    );
    
    return NextResponse.json(status);
}
