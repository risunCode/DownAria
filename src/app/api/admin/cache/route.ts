/**
 * Admin Cache Management API
 * GET: Get cache stats
 * DELETE: Clear all cache
 * 
 * NOTE: Only Supabase cache now (in-memory cache removed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/core/security';
import { clearCache, getCacheStats } from '@/core/database';

// GET - Get cache statistics
export async function GET(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const stats = await getCacheStats();
    return NextResponse.json({ success: true, data: stats });
}

// DELETE - Clear all cache
export async function DELETE(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const cleared = await clearCache();

    return NextResponse.json({
        success: true,
        message: 'Cache cleared',
        cleared
    });
}
