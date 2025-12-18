/**
 * Cookie Pool API
 * GET - Get all cookies or stats
 * POST - Add new cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/utils/admin-auth';
import {
    getCookiesByPlatform,
    getCookiePoolStats,
    addCookieToPool,
    type CookiePoolStats
} from '@/lib/utils/cookie-pool';

export async function GET(req: NextRequest) {
    const auth = await verifyAdminSession(req);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get('platform');
    const stats = searchParams.get('stats');

    try {
        // Get stats for all platforms
        if (stats === 'true') {
            const poolStats = await getCookiePoolStats();
            
            // Ensure all platforms are represented
            const platforms = ['facebook', 'instagram', 'twitter', 'weibo'];
            const result: CookiePoolStats[] = platforms.map(p => {
                const existing = poolStats.find(s => s.platform === p);
                return existing || {
                    platform: p,
                    total: 0,
                    enabled_count: 0,
                    healthy_count: 0,
                    cooldown_count: 0,
                    expired_count: 0,
                    disabled_count: 0,
                    total_uses: 0,
                    total_success: 0,
                    total_errors: 0
                };
            });
            
            return NextResponse.json({ success: true, data: result });
        }

        // Get cookies for specific platform
        if (platform) {
            const cookies = await getCookiesByPlatform(platform);
            // Mask cookie values for security
            const masked = cookies.map(c => ({
                ...c,
                cookie: c.cookie.substring(0, 50) + '...',
                cookiePreview: extractCookiePreview(c.cookie, platform)
            }));
            return NextResponse.json({ success: true, data: masked });
        }

        return NextResponse.json({ success: false, error: 'Missing platform or stats parameter' }, { status: 400 });
    } catch (e) {
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await verifyAdminSession(req);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { platform, cookie, label, note, max_uses_per_hour } = body;

        if (!platform || !cookie) {
            return NextResponse.json({ success: false, error: 'Missing platform or cookie' }, { status: 400 });
        }

        const result = await addCookieToPool(platform, cookie, { label, note, max_uses_per_hour });
        
        return NextResponse.json({ success: true, data: result });
    } catch (e) {
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
    }
}

// Helper: Extract preview info from cookie
function extractCookiePreview(cookie: string, platform: string): string {
    try {
        const parsed = JSON.parse(cookie);
        if (Array.isArray(parsed)) {
            const keys: Record<string, string[]> = {
                facebook: ['c_user', 'xs'],
                instagram: ['ds_user_id', 'sessionid'],
                twitter: ['auth_token', 'ct0'],
                weibo: ['SUB']
            };
            const found = parsed
                .filter((c: { name: string }) => keys[platform]?.includes(c.name))
                .map((c: { name: string; value: string }) => `${c.name}=${c.value.substring(0, 8)}...`);
            return found.join(', ') || 'No key cookies found';
        }
    } catch {
        // String format
        const match = cookie.match(/c_user=(\d+)|sessionid=([^;]+)|auth_token=([^;]+)|SUB=([^;]+)/);
        if (match) return match[0].substring(0, 30) + '...';
    }
    return 'Unknown format';
}
