/**
 * Admin Alerts Config API
 * GET: Get alert configuration
 * PUT: Update alert configuration
 * POST: Test webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/core/security';
import { getAlertConfig, updateAlertConfig, sendTestAlert } from '@/lib/integrations/admin-alerts';

export async function GET(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    try {
        const config = await getAlertConfig();
        return NextResponse.json({ success: true, data: config });
    } catch (error) {
        return NextResponse.json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to get config' 
        }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        
        // Map camelCase to snake_case for DB
        const updates: Record<string, unknown> = {};
        
        if (body.webhookUrl !== undefined) updates.webhook_url = body.webhookUrl;
        if (body.enabled !== undefined) updates.enabled = body.enabled;
        if (body.alertErrorSpike !== undefined) updates.alert_error_spike = body.alertErrorSpike;
        if (body.alertCookieLow !== undefined) updates.alert_cookie_low = body.alertCookieLow;
        if (body.alertPlatformDown !== undefined) updates.alert_platform_down = body.alertPlatformDown;
        if (body.errorSpikeThreshold !== undefined) updates.error_spike_threshold = body.errorSpikeThreshold;
        if (body.errorSpikeWindow !== undefined) updates.error_spike_window = body.errorSpikeWindow;
        if (body.cookieLowThreshold !== undefined) updates.cookie_low_threshold = body.cookieLowThreshold;
        if (body.platformDownThreshold !== undefined) updates.platform_down_threshold = body.platformDownThreshold;
        if (body.cooldownMinutes !== undefined) updates.cooldown_minutes = body.cooldownMinutes;
        if (body.healthCheckEnabled !== undefined) updates.health_check_enabled = body.healthCheckEnabled;
        if (body.healthCheckInterval !== undefined) updates.health_check_interval = body.healthCheckInterval;
        
        const success = await updateAlertConfig(updates);
        
        if (success) {
            return NextResponse.json({ success: true });
        }
        return NextResponse.json({ success: false, error: 'Failed to update' }, { status: 500 });
    } catch (error) {
        return NextResponse.json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to update config' 
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = await verifyAdminSession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { action, webhookUrl } = body;
        
        if (action === 'test') {
            if (!webhookUrl) {
                return NextResponse.json({ success: false, error: 'Webhook URL required' }, { status: 400 });
            }
            
            const result = await sendTestAlert(webhookUrl);
            return NextResponse.json({ success: result.success, error: result.error });
        }
        
        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        return NextResponse.json({ 
            success: false, 
            error: error instanceof Error ? error.message : 'Failed to process request' 
        }, { status: 500 });
    }
}
