/**
 * Admin Playground Examples API
 * GET: List all examples
 * POST: Add new example
 * DELETE: Remove example
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/core/database';
import { verifyAdminSession } from '@/core/security';

export interface PlaygroundExample {
    id: string;
    platform: string;
    name: string;
    url: string;
    created_at: string;
}

// GET - List all examples
export async function GET(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
        return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
    }

    try {
        const platform = request.nextUrl.searchParams.get('platform');
        
        let query = supabase
            .from('playground_examples')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (platform) {
            query = query.eq('platform', platform);
        }

        const { data, error } = await query;

        if (error) throw error;

        return NextResponse.json({ success: true, data: data || [] });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch examples'
        }, { status: 500 });
    }
}

// POST - Add new example
export async function POST(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
        return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
    }

    try {
        const { platform, name, url } = await request.json();

        if (!platform || !name || !url) {
            return NextResponse.json({ success: false, error: 'platform, name, and url are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('playground_examples')
            .insert({ platform, name, url })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to add example'
        }, { status: 500 });
    }
}

// DELETE - Remove example
export async function DELETE(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
        return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
    }

    try {
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('playground_examples')
            .delete()
            .eq('id', id);

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Example deleted' });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to delete example'
        }, { status: 500 });
    }
}
