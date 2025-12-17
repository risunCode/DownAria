/**
 * Admin Services API
 * GET: Get all platform configs (from Supabase)
 * POST: Update platform config (syncs to Supabase)
 * PUT: Toggle maintenance mode (syncs to Supabase)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getServiceConfigAsync,
    updatePlatformConfig,
    setMaintenanceMode,
    setMaintenanceMessage,
    setGlobalRateLimit,
    setApiKeyRequired,
    resetPlatformStats,
    resetAllStats,
    resetToDefaults,
    loadConfigFromDB,
    type PlatformId
} from '@/lib/services/service-config';
import { verifySession, verifyAdminSession } from '@/lib/utils/admin-auth';

// Auth check helper - any logged in user can view
async function checkAuth(request: NextRequest): Promise<NextResponse | null> {
    const auth = await verifySession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }
    return null;
}

// Admin-only check helper
async function checkAdminAuth(request: NextRequest): Promise<NextResponse | null> {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Admin access required' }, { status: 403 });
    }
    return null;
}

// GET - Get all service configs
export async function GET(request: NextRequest) {
    const authError = await checkAuth(request);
    if (authError) return authError;
    
    try {
        // Force refresh from DB
        await loadConfigFromDB();
        const config = await getServiceConfigAsync();
        return NextResponse.json({
            success: true,
            data: config
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// POST - Update platform config (admin only)
export async function POST(request: NextRequest) {
    const authError = await checkAdminAuth(request);
    if (authError) return authError;
    
    try {
        const body = await request.json();
        const { action, platformId, ...updates } = body;

        switch (action) {
            case 'updatePlatform': {
                if (!platformId) {
                    return NextResponse.json({ success: false, error: 'platformId required' }, { status: 400 });
                }
                const success = await updatePlatformConfig(platformId as PlatformId, updates);
                if (!success) {
                    return NextResponse.json({ success: false, error: 'Platform not found or DB error' }, { status: 500 });
                }
                return NextResponse.json({ success: true, message: `${platformId} updated` });
            }

            case 'resetStats': {
                if (platformId) {
                    resetPlatformStats(platformId as PlatformId);
                    return NextResponse.json({ success: true, message: `${platformId} stats reset` });
                } else {
                    resetAllStats();
                    return NextResponse.json({ success: true, message: 'All stats reset' });
                }
            }

            case 'resetDefaults': {
                await resetToDefaults();
                return NextResponse.json({ success: true, message: 'Reset to defaults' });
            }

            default:
                return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// PUT - Global settings (maintenance mode, global rate limit, messages, apiKeyRequired) - admin only
export async function PUT(request: NextRequest) {
    const authError = await checkAdminAuth(request);
    if (authError) return authError;
    
    try {
        const body = await request.json();
        const { maintenanceMode, maintenanceMessage, globalRateLimit, apiKeyRequired } = body;

        if (maintenanceMode !== undefined) {
            await setMaintenanceMode(maintenanceMode);
        }
        
        if (maintenanceMessage !== undefined) {
            await setMaintenanceMessage(maintenanceMessage);
        }

        if (globalRateLimit !== undefined) {
            await setGlobalRateLimit(globalRateLimit);
        }

        if (apiKeyRequired !== undefined) {
            await setApiKeyRequired(apiKeyRequired);
        }

        const config = await getServiceConfigAsync();
        return NextResponse.json({
            success: true,
            message: 'Global settings updated',
            data: config
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
