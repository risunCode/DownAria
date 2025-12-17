/**
 * Global Settings Manager
 * Fetches and caches site settings from Supabase
 * Note: User agents are centralized in fetch-helper.ts
 */

import { supabase } from '@/lib/supabase';

export interface GlobalSettings {
    referral_enabled: boolean;
    referral_bonus: number;
    site_name: string;
    site_description: string;
    discord_invite: string;
    telegram_channel: string;
    github_repo: string;
}

// Default settings (fallback)
const DEFAULT_SETTINGS: GlobalSettings = {
    referral_enabled: true,
    referral_bonus: 0,
    site_name: 'XTFetch',
    site_description: 'Social Media Video Downloader',
    discord_invite: '',
    telegram_channel: '',
    github_repo: '',
};

// Cache
let settingsCache: GlobalSettings | null = null;
let lastFetch = 0;
const CACHE_TTL = 60000; // 1 minute

export async function getGlobalSettings(): Promise<GlobalSettings> {
    // Return cache if fresh
    if (settingsCache && Date.now() - lastFetch < CACHE_TTL) {
        return settingsCache;
    }

    if (!supabase) {
        return DEFAULT_SETTINGS;
    }

    try {
        const { data, error } = await supabase
            .from('global_settings')
            .select('key, value');

        if (error || !data) {
            return settingsCache || DEFAULT_SETTINGS;
        }

        // Parse settings
        const settings: GlobalSettings = { ...DEFAULT_SETTINGS };
        data.forEach(row => {
            const key = row.key as keyof GlobalSettings;
            if (key in settings) {
                if (key === 'referral_enabled') {
                    settings[key] = row.value === 'true';
                } else if (key === 'referral_bonus') {
                    settings[key] = parseInt(row.value) || 0;
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (settings as any)[key] = row.value;
                }
            }
        });

        settingsCache = settings;
        lastFetch = Date.now();
        return settings;
    } catch {
        return settingsCache || DEFAULT_SETTINGS;
    }
}

// Check if referral is enabled
export async function isReferralEnabled(): Promise<boolean> {
    const settings = await getGlobalSettings();
    return settings.referral_enabled;
}

// Clear cache (call after updating settings)
export function clearSettingsCache(): void {
    settingsCache = null;
    lastFetch = 0;
}
