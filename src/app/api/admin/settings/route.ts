/**
 * Admin Global Settings API
 * GET: Get all settings
 * POST: Update settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/core/database';
import { verifyAdminSession } from '@/core/security';

const getDb = () => supabaseAdmin || supabase;

export interface GlobalSettings {
    user_agent_chrome: string;
    user_agent_mobile: string;
    user_agent_safari: string;
    referral_enabled: string;
    referral_bonus: string;
    site_name: string;
    site_description: string;
    discord_invite: string;
    telegram_channel: string;
    github_repo: string;
    [key: string]: string;
}

// GET - Get all settings
export async function GET(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }
    
    const db = getDb();
    if (!db) {
        return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
    }

    try {
        const { data, error } = await db
            .from('global_settings')
            .select('*');

        if (error) throw error;

        // Convert to key-value object
        const settings: GlobalSettings = {} as GlobalSettings;
        data?.forEach(row => {
            settings[row.key] = row.value;
        });

        return NextResponse.json({ success: true, data: settings });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch settings'
        }, { status: 500 });
    }
}

// POST - Update settings
export async function POST(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }
    
    const db = getDb();
    if (!db) {
        return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 500 });
    }

    try {
        const body = await request.json();
        const { settings } = body as { settings: Record<string, string> };

        if (!settings || typeof settings !== 'object') {
            return NextResponse.json({ success: false, error: 'Invalid settings' }, { status: 400 });
        }

        // Upsert each setting
        const updates = Object.entries(settings).map(([key, value]) => ({
            key,
            value: String(value),
            updated_at: new Date().toISOString()
        }));

        const { error } = await db
            .from('global_settings')
            .upsert(updates, { onConflict: 'key' });

        if (error) throw error;

        return NextResponse.json({ success: true, message: 'Settings updated' });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update settings'
        }, { status: 500 });
    }
}
