/**
 * Admin Announcements API - Get ALL announcements (including disabled)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    void request; // Personal use - no auth required
    
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
