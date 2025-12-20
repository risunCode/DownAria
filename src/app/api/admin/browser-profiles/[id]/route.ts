/**
 * Admin Browser Profile by ID API
 * GET: Get single profile
 * PATCH: Update profile
 * DELETE: Delete profile
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
        return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
    }

    const { id } = await params;

    try {
        const { data, error } = await supabase
            .from('browser_profiles')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) {
            return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to fetch profile' 
        }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
        return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
    }

    const { id } = await params;

    try {
        const body = await request.json();
        
        // Build update object (only include provided fields)
        const updates: Record<string, unknown> = {};
        const allowedFields = [
            'platform', 'label', 'user_agent', 'sec_ch_ua', 'sec_ch_ua_platform',
            'sec_ch_ua_mobile', 'accept_language', 'browser', 'device_type', 'os',
            'is_chromium', 'priority', 'enabled', 'note'
        ];

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                updates[field] = body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('browser_profiles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Clear cache after update
        const { clearProfileCache } = await import('@/lib/http/anti-ban');
        clearProfileCache();

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to update profile' 
        }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
        return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
    }

    const { id } = await params;

    try {
        const { error } = await supabase
            .from('browser_profiles')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Clear cache after delete
        const { clearProfileCache } = await import('@/lib/http/anti-ban');
        clearProfileCache();

        return NextResponse.json({ success: true, message: 'Profile deleted' });
    } catch (error) {
        return NextResponse.json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to delete profile' 
        }, { status: 500 });
    }
}
