/**
 * Announcements API
 * GET - Get active announcements for a page (public)
 * POST/PUT/DELETE - Admin manage announcements (auth required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/core/database';
import { verifyAdminSession } from '@/core/security';

// Auth check helper - admin only for mutations
async function checkAuth(request: NextRequest): Promise<NextResponse | null> {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Admin access required' }, { status: 403 });
    }
    return null;
}

export async function GET(request: NextRequest) {
    if (!supabase) {
        return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });
    }

    const page = request.nextUrl.searchParams.get('page') || 'home';

    const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('enabled', true)
        .contains('pages', [page])
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, {
        headers: {
            // Cache for 60 seconds, allow stale for 2 minutes while revalidating
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
    });
}

export async function POST(request: NextRequest) {
    const authError = await checkAuth(request);
    if (authError) return authError;
    
    const db = supabaseAdmin || supabase;
    if (!db) {
        return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { title, message, type = 'info', pages = ['home'], enabled = true, show_once = false } = body;

        if (!title || !message) {
            return NextResponse.json({ success: false, error: 'Title and message required' }, { status: 400 });
        }

        const { data, error } = await db
            .from('announcements')
            .insert({ title, message, type, pages, enabled, show_once })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
}

export async function PUT(request: NextRequest) {
    const authError = await checkAuth(request);
    if (authError) return authError;
    
    const db = supabaseAdmin || supabase;
    if (!db) {
        return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
        }

        // Remove undefined/null values
        const cleanUpdates: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) cleanUpdates[key] = value;
        }

        const { data, error } = await db
            .from('announcements')
            .update(cleanUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
    }
}

export async function DELETE(request: NextRequest) {
    const authError = await checkAuth(request);
    if (authError) return authError;
    
    const db = supabaseAdmin || supabase;
    if (!db) {
        return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
        return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    }

    const { error } = await db
        .from('announcements')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
