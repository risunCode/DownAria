/**
 * Public Service Status API
 * Returns platform status for client-side display (from Supabase)
 */

import { NextResponse } from 'next/server';
import { getServiceConfigAsync, loadConfigFromDB, supabase } from '@/core/database';

export async function GET() {
    // Force refresh from DB (bypass cache)
    await loadConfigFromDB();
    const config = await getServiceConfigAsync();
    
    const platforms = Object.values(config.platforms);
    // Check maintenanceType - 'off' means not in maintenance
    const maintenance = config.maintenanceType !== 'off' && config.maintenanceMode;
    const maintenanceMessage = config.maintenanceMessage;

    // Get simple maintenance details from global_settings if in maintenance
    let maintenanceContent: string | null = null;
    let maintenanceLastUpdated: string | null = null;
    
    if (maintenance && supabase) {
        const { data } = await supabase
            .from('global_settings')
            .select('key, value')
            .in('key', ['maintenance_content', 'maintenance_last_updated']);
        
        if (data) {
            for (const row of data) {
                if (row.key === 'maintenance_content') maintenanceContent = row.value;
                if (row.key === 'maintenance_last_updated') maintenanceLastUpdated = row.value;
            }
        }
    }

    // Map to public-safe format
    const status = platforms.map(p => ({
        id: p.id,
        name: p.name,
        enabled: p.enabled,
        status: !p.enabled ? 'offline' : maintenance ? 'maintenance' : 'active',
    }));

    return NextResponse.json({
        success: true,
        data: {
            maintenance,
            maintenanceMessage: maintenance ? maintenanceMessage : null,
            maintenanceContent: maintenance ? maintenanceContent : null,
            maintenanceLastUpdated: maintenance ? maintenanceLastUpdated : null,
            platforms: status,
        },
    }, {
        headers: {
            'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
    });
}
