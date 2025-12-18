/**
 * Public Cookie Status API
 * Returns which platforms have healthy admin cookies available
 * No auth required - does NOT expose cookie values
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface CookieStatus {
    platform: string;
    available: boolean;
    healthyCount: number;
}

export async function GET() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        return NextResponse.json({
            success: true,
            data: {
                facebook: { available: false, healthyCount: 0 },
                instagram: { available: false, healthyCount: 0 },
                twitter: { available: false, healthyCount: 0 },
                weibo: { available: false, healthyCount: 0 },
            }
        });
    }

    const supabase = createClient(url, key);

    try {
        // Check cookie pool - any enabled cookie (healthy, cooldown, or expired)
        const { data: poolData, error: poolError } = await supabase
            .from('admin_cookie_pool')
            .select('platform, status, enabled')
            .eq('enabled', true);

        // Also check legacy admin_cookies table
        const { data: legacyData, error: legacyError } = await supabase
            .from('admin_cookies')
            .select('platform, enabled')
            .eq('enabled', true);

        // Debug log
        console.log('[CookieStatus] Pool:', poolData?.length || 0, 'cookies, error:', poolError?.message);
        console.log('[CookieStatus] Legacy:', legacyData?.length || 0, 'cookies, error:', legacyError?.message);

        // Build status map
        const platforms = ['facebook', 'instagram', 'twitter', 'weibo'];
        const status: Record<string, CookieStatus> = {};

        for (const platform of platforms) {
            // Count healthy cookies in pool
            const healthyCount = poolData?.filter(c => c.platform === platform && c.status === 'healthy').length || 0;
            // Count any enabled cookie in pool (including cooldown/expired)
            const totalPoolCount = poolData?.filter(c => c.platform === platform).length || 0;
            // Check legacy table
            const hasLegacy = legacyData?.some(c => c.platform === platform) || false;

            // Available if has any cookie (healthy preferred, but any is better than none)
            status[platform] = {
                platform,
                available: totalPoolCount > 0 || hasLegacy,
                healthyCount: healthyCount + (hasLegacy ? 1 : 0),
            };
        }

        return NextResponse.json({ success: true, data: status });
    } catch (error) {
        console.error('[CookieStatus] Error:', error);
        return NextResponse.json({
            success: true,
            data: {
                facebook: { available: false, healthyCount: 0 },
                instagram: { available: false, healthyCount: 0 },
                twitter: { available: false, healthyCount: 0 },
                weibo: { available: false, healthyCount: 0 },
            }
        });
    }
}
