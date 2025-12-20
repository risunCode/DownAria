/**
 * Cookie Pool API
 * GET - Get all cookies or stats
 * POST - Add new cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/core/security';
import {
    getCookiePoolStats,
    getCookiesByPlatform,
    addCookieToPool,
    type CookiePoolStats
} from '@/lib/cookies';

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
        // getCookiesByPlatform already handles decryption and adds cookiePreview
        if (platform) {
            const cookies = await getCookiesByPlatform(platform);
            // Cookie values are already masked with preview from getCookiesByPlatform
            // Just ensure we don't expose full encrypted cookie
            const masked = cookies.map(c => ({
                ...c,
                cookie: (c as { cookiePreview?: string }).cookiePreview || '[encrypted]', // Use preview instead of raw
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

        // addCookieToPool handles encryption automatically
        const result = await addCookieToPool(platform, cookie, { label, note, max_uses_per_hour });
        
        return NextResponse.json({ success: true, data: result });
    } catch (e) {
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
    }
}
