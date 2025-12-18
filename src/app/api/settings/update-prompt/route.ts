/**
 * Public API - Update Prompt Settings
 * Returns settings for PWA update notification behavior
 * No auth required (public endpoint)
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export interface UpdatePromptSettings {
    enabled: boolean;
    mode: 'always' | 'once' | 'session';
    delay_seconds: number;
    dismissable: boolean;
    custom_message: string;
}

const DEFAULT_SETTINGS: UpdatePromptSettings = {
    enabled: true,
    mode: 'always',        // always = show every time, once = dismiss forever, session = dismiss per session
    delay_seconds: 0,      // delay before showing
    dismissable: true,     // can user dismiss it
    custom_message: '',    // custom message (empty = use default)
};

export async function GET() {
    try {
        if (!supabase) {
            return NextResponse.json({ success: true, data: DEFAULT_SETTINGS });
        }

        const { data, error } = await supabase
            .from('global_settings')
            .select('key, value')
            .like('key', 'update_prompt_%');

        if (error || !data) {
            return NextResponse.json({ success: true, data: DEFAULT_SETTINGS });
        }

        // Parse settings
        const settings: UpdatePromptSettings = { ...DEFAULT_SETTINGS };
        data.forEach(row => {
            const key = row.key.replace('update_prompt_', '') as keyof UpdatePromptSettings;
            if (key === 'enabled' || key === 'dismissable') {
                settings[key] = row.value === 'true';
            } else if (key === 'delay_seconds') {
                settings[key] = parseInt(row.value) || 0;
            } else if (key === 'mode') {
                settings[key] = row.value as 'always' | 'once' | 'session';
            } else if (key === 'custom_message') {
                settings[key] = row.value || '';
            }
        });

        return NextResponse.json({ success: true, data: settings });
    } catch {
        return NextResponse.json({ success: true, data: DEFAULT_SETTINGS });
    }
}
