/**
 * Cookie Pool Item API
 * GET - Get single cookie (full)
 * PATCH - Update cookie
 * DELETE - Delete cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/utils/admin-auth';
import {
    updatePooledCookie,
    deleteCookieFromPool,
    testCookieHealth
} from '@/lib/utils/cookie-pool';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyAdminSession(req);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const test = searchParams.get('test');

    try {
        // Test cookie health
        if (test === 'true') {
            const result = await testCookieHealth(id);
            return NextResponse.json({ success: true, data: result });
        }

        // Get full cookie data
        const { data, error } = await supabase
            .from('admin_cookie_pool')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            return NextResponse.json({ success: false, error: 'Cookie not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data });
    } catch (e) {
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyAdminSession(req);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        const body = await req.json();
        const { cookie, label, note, enabled, status, max_uses_per_hour } = body;

        const updates: Record<string, unknown> = {};
        if (cookie !== undefined) updates.cookie = cookie;
        if (label !== undefined) updates.label = label;
        if (note !== undefined) updates.note = note;
        if (enabled !== undefined) updates.enabled = enabled;
        if (status !== undefined) updates.status = status;
        if (max_uses_per_hour !== undefined) updates.max_uses_per_hour = max_uses_per_hour;

        // Reset cooldown if re-enabling or setting to healthy
        if (status === 'healthy' || enabled === true) {
            updates.cooldown_until = null;
            updates.last_error = null;
        }

        const result = await updatePooledCookie(id, updates);
        
        if (!result) {
            return NextResponse.json({ success: false, error: 'Cookie not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: result });
    } catch (e) {
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const auth = await verifyAdminSession(req);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    try {
        const success = await deleteCookieFromPool(id);
        
        if (!success) {
            return NextResponse.json({ success: false, error: 'Failed to delete' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ success: false, error: (e as Error).message }, { status: 500 });
    }
}
