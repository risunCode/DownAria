/**
 * Admin User-Agent Pool API
 * GET: List all user agents or stats
 * POST: Add new user agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/core/security';
import { supabase } from '@/core/database';

interface UserAgentEntry {
    id: string;
    platform: string;
    user_agent: string;
    device_type: 'desktop' | 'mobile' | 'tablet';
    browser: string | null;
    label: string | null;
    enabled: boolean;
    use_count: number;
    success_count: number;
    error_count: number;
    last_used_at: string | null;
    last_error: string | null;
    note: string | null;
    created_at: string;
    updated_at: string;
}

export async function GET(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
        return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const statsOnly = searchParams.get('stats') === 'true';
    const platform = searchParams.get('platform');

    try {
        if (statsOnly) {
            // Return aggregated stats
            const { data, error } = await supabase
                .from('useragent_pool_stats')
                .select('*');

            if (error) throw error;
            return NextResponse.json({ success: true, data });
        }

        // Return full list
        let query = supabase
            .from('useragent_pool')
            .select('*')
            .order('platform')
            .order('device_type')
            .order('created_at', { ascending: false });

        if (platform) {
            query = query.or(`platform.eq.${platform},platform.eq.all`);
        }

        const { data, error } = await query;
        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('[UserAgent Pool] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch user agents' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
        return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { platform, user_agent, device_type, browser, label, note } = body;

        if (!platform || !user_agent) {
            return NextResponse.json({ success: false, error: 'Platform and user_agent are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('useragent_pool')
            .insert({
                platform,
                user_agent: user_agent.trim(),
                device_type: device_type || 'desktop',
                browser: browser || null,
                label: label || null,
                note: note || null,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('[UserAgent Pool] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to add user agent' }, { status: 500 });
    }
}
