/**
 * Admin Announcements API - Get ALL announcements (including disabled)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/core/database';
import { verifyAdminSession } from '@/core/security';

export async function GET(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }
    
    const db = supabaseAdmin || supabase;
    if (!db) {
        return NextResponse.json({ success: false, error: 'DB not configured' }, { status: 500 });
    }

    // Admin needs to see ALL announcements (including disabled)
    const { data, error } = await db
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
}
