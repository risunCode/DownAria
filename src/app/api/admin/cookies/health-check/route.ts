/**
 * Cookie Health Check API
 * POST: Run health check on all cookies
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/core/security';
import { getCookiesByPlatform, testCookieHealth } from '@/lib/cookies';
import { checkCookiePoolHealth, updateLastHealthCheck } from '@/lib/integrations/admin-alerts';

const PLATFORMS = ['facebook', 'instagram', 'twitter', 'weibo'] as const;

export async function POST(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    try {
        const results: Record<string, { 
            total: number; 
            healthy: number; 
            cooldown: number;
            expired: number;
            checked: string[];
            failed: string[];
        }> = {};

        for (const platform of PLATFORMS) {
            const cookies = await getCookiesByPlatform(platform);
            const enabledCookies = cookies.filter(c => c.enabled);
            
            const platformResult = { 
                total: enabledCookies.length, 
                healthy: 0, 
                cooldown: 0,
                expired: 0,
                checked: [] as string[],
                failed: [] as string[],
            };

            for (const cookie of enabledCookies) {
                const label = cookie.label || cookie.id.slice(0, 8);
                
                // Skip cookies already in cooldown/expired
                if (cookie.status === 'cooldown') {
                    platformResult.cooldown++;
                    continue;
                }
                if (cookie.status === 'expired') {
                    platformResult.expired++;
                    platformResult.failed.push(label);
                    continue;
                }

                // Test healthy cookies
                const health = await testCookieHealth(cookie.id);
                platformResult.checked.push(label);
                
                if (health.healthy) {
                    platformResult.healthy++;
                } else {
                    platformResult.failed.push(label);
                    platformResult.expired++;
                }
                
                // Small delay between checks to avoid rate limiting
                await new Promise(r => setTimeout(r, 500));
            }

            results[platform] = platformResult;
        }

        // Check if alert needed
        const statsForAlert: Record<string, { total: number; healthy: number }> = {};
        for (const [platform, data] of Object.entries(results)) {
            statsForAlert[platform] = { total: data.total, healthy: data.healthy };
        }
        await checkCookiePoolHealth(statsForAlert);

        // Update last check time
        await updateLastHealthCheck();

        // Summary
        const summary = {
            totalChecked: Object.values(results).reduce((sum, r) => sum + r.checked.length, 0),
            totalHealthy: Object.values(results).reduce((sum, r) => sum + r.healthy, 0),
            totalFailed: Object.values(results).reduce((sum, r) => sum + r.failed.length, 0),
        };

        return NextResponse.json({ 
            success: true, 
            data: { results, summary, checkedAt: new Date().toISOString() }
        });
    } catch (error) {
        return NextResponse.json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Health check failed' 
        }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    // Quick status check without running full health check
    try {
        const results: Record<string, { total: number; healthy: number; cooldown: number; expired: number }> = {};

        for (const platform of PLATFORMS) {
            const cookies = await getCookiesByPlatform(platform);
            const enabledCookies = cookies.filter(c => c.enabled);
            
            results[platform] = {
                total: enabledCookies.length,
                healthy: enabledCookies.filter(c => c.status === 'healthy').length,
                cooldown: enabledCookies.filter(c => c.status === 'cooldown').length,
                expired: enabledCookies.filter(c => c.status === 'expired').length,
            };
        }

        return NextResponse.json({ success: true, data: results });
    } catch (error) {
        return NextResponse.json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to get status' 
        }, { status: 500 });
    }
}
