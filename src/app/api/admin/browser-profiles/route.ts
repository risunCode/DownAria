/**
 * Admin Browser Profiles API
 * GET: List all profiles with stats
 * POST: Add new profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/core/security';
import { supabase } from '@/core/database';

export async function GET(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
        return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
    }

    try {
        // Get all profiles
        const { data: profiles, error } = await supabase
            .from('browser_profiles')
            .select('*')
            .order('platform')
            .order('priority', { ascending: false });

        if (error) throw error;

        // Get stats
        const { data: stats } = await supabase
            .from('browser_profiles_stats')
            .select('*');

        // Calculate totals
        const totals = {
            total: profiles?.length || 0,
            enabled: profiles?.filter(p => p.enabled).length || 0,
            totalUses: profiles?.reduce((sum, p) => sum + (p.use_count || 0), 0) || 0,
            totalSuccess: profiles?.reduce((sum, p) => sum + (p.success_count || 0), 0) || 0,
            totalErrors: profiles?.reduce((sum, p) => sum + (p.error_count || 0), 0) || 0,
        };

        return NextResponse.json({
            success: true,
            data: {
                profiles: profiles || [],
                stats: stats || [],
                totals,
            }
        });
    } catch (error) {
        return NextResponse.json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to fetch profiles' 
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    if (!supabase) {
        return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
    }

    try {
        const body = await request.json();
        const {
            platform = 'all',
            label,
            user_agent,
            sec_ch_ua,
            sec_ch_ua_platform,
            sec_ch_ua_mobile = '?0',
            accept_language = 'en-US,en;q=0.9',
            browser = 'chrome',
            device_type = 'desktop',
            os,
            is_chromium = false,
            priority = 5,
            enabled = true,
            note,
        } = body;

        // Validation
        if (!label || !user_agent) {
            return NextResponse.json({ success: false, error: 'Label and user_agent are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('browser_profiles')
            .insert({
                platform,
                label,
                user_agent,
                sec_ch_ua: sec_ch_ua || null,
                sec_ch_ua_platform: sec_ch_ua_platform || null,
                sec_ch_ua_mobile,
                accept_language,
                browser,
                device_type,
                os: os || null,
                is_chromium,
                priority,
                enabled,
                note: note || null,
            })
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to create profile' 
        }, { status: 500 });
    }
}
