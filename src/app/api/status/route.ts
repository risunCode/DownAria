/**
 * Public Service Status API
 * Returns platform status for client-side display (from Supabase)
 */

import { NextResponse } from 'next/server';
import { getServiceConfigAsync, loadConfigFromDB } from '@/core/database';

export async function GET() {
    // Refresh from DB
    await loadConfigFromDB();
    const config = await getServiceConfigAsync();
    
    const platforms = Object.values(config.platforms);
    const maintenance = config.maintenanceMode;
    const maintenanceMessage = config.maintenanceMessage;

    // Map to public-safe format
    const status = platforms.map(p => ({
        id: p.id,
        name: p.name,
        enabled: p.enabled,
        status: !p.enabled ? 'offline' : maintenance ? 'maintenance' : 'active',
    }));

    return NextResponse.json({
        maintenance,
        maintenanceMessage: maintenance ? maintenanceMessage : null,
        platforms: status,
    });
}
