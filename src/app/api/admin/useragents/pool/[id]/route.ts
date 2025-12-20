/**
 * Admin User-Agent Pool Item API
 * GET: Get single user agent
 * PATCH: Update user agent
 * DELETE: Delete user agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/core/security';
import { supabase } from '@/core/database';

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
        return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
    }

    const { id } = await params;

    try {
        const { data, error } = await supabase
            .from('useragent_pool')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) {
            return NextResponse.json({ success: false, error: 'User agent not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('[UserAgent Pool] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch user agent' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
        return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
    }

    const { id } = await params;

    try {
        const body = await request.json();
        const allowedFields = ['platform', 'user_agent', 'device_type', 'browser', 'label', 'enabled', 'note'];
        const updates: Record<string, unknown> = {};

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates[field] = body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('useragent_pool')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('[UserAgent Pool] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to update user agent' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
        return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
    }

    const { id } = await params;

    try {
        const { error } = await supabase
            .from('useragent_pool')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[UserAgent Pool] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete user agent' }, { status: 500 });
    }
}
