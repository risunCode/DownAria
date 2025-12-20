/**
 * Admin Cache Management API
 * GET: Get cache stats
 * POST: Clear cache by platform or URL
 * DELETE: Clear all cache
 * 
 * Storage: Redis (Upstash) - migrated from Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/core/security';
import { clearCache, getCacheStats } from '@/core/database';
import { isRedisAvailable, redis, getResultCacheKey } from '@/lib/redis';
import type { PlatformId } from '@/core/database';

// GET - Get cache statistics
export async function GET(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const stats = await getCacheStats();
    return NextResponse.json({ 
        success: true, 
        data: {
            ...stats,
            storage: 'redis',
            available: isRedisAvailable()
        }
    });
}

// POST - Clear cache by platform or specific URL
export async function POST(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!isRedisAvailable() || !redis) {
        return NextResponse.json({ success: false, error: 'Redis not configured' }, { status: 503 });
    }

    try {
        const body = await request.json();
        const { platform, url } = body as { platform?: PlatformId; url?: string };

        // Clear specific URL cache
        if (url && platform) {
            const cacheKey = getResultCacheKey(platform, url);
            if (cacheKey) {
                await redis.del(cacheKey);
                return NextResponse.json({
                    success: true,
                    message: `Cache cleared for URL`,
                    cacheKey,
                    cleared: 1
                });
            }
            return NextResponse.json({ success: false, error: 'Could not generate cache key for URL' }, { status: 400 });
        }

        // Clear by platform
        if (platform) {
            const cleared = await clearCache(platform);
            return NextResponse.json({
                success: true,
                message: `Cache cleared for ${platform}`,
                platform,
                cleared
            });
        }

        return NextResponse.json({ success: false, error: 'Provide platform or url+platform' }, { status: 400 });
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }
}

// DELETE - Clear all cache
export async function DELETE(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!isRedisAvailable()) {
        return NextResponse.json({
            success: false,
            error: 'Redis not configured'
        }, { status: 503 });
    }

    const cleared = await clearCache();

    return NextResponse.json({
        success: true,
        message: 'Redis cache cleared',
        cleared,
        storage: 'redis'
    });
}
