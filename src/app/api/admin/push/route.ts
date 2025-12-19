/**
 * Admin Push Notification API
 * Send push notifications to all subscribers
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { verifyAdminToken } from '@/core/security';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Configure web-push with VAPID keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@xtfetch.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    url?: string;
    tag?: string;
    requireInteraction?: boolean;
}

// POST - Send push notification to all subscribers
export async function POST(request: NextRequest) {
    try {
        // Verify admin auth
        const authResult = await verifyAdminToken(request);
        if (!authResult.valid) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }
        
        // Check VAPID configuration
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            return NextResponse.json(
                { success: false, error: 'VAPID keys not configured' },
                { status: 500 }
            );
        }
        
        const payload: PushPayload = await request.json();
        
        if (!payload.title) {
            return NextResponse.json(
                { success: false, error: 'Title is required' },
                { status: 400 }
            );
        }
        
        // Get all active subscriptions
        const { data: subscriptions, error: fetchError } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('is_active', true);
        
        if (fetchError) {
            console.error('[Push] Fetch subscriptions error:', fetchError);
            return NextResponse.json(
                { success: false, error: 'Failed to fetch subscriptions' },
                { status: 500 }
            );
        }
        
        if (!subscriptions || subscriptions.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No active subscribers',
                sent: 0,
                failed: 0
            });
        }
        
        // Prepare notification payload
        const notificationPayload = JSON.stringify({
            title: payload.title,
            body: payload.body || '',
            icon: payload.icon || '/icon.png',
            badge: payload.badge || '/icon.png',
            tag: payload.tag || `xtfetch-${Date.now()}`,
            data: { url: payload.url || '/' },
            requireInteraction: payload.requireInteraction || false
        });
        
        // Send to all subscribers in parallel (no await inside loop for DB updates)
        const results = await Promise.allSettled(subscriptions.map(async (sub) => {
            return webpush.sendNotification(
                {
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.keys_p256dh,
                        auth: sub.keys_auth
                    }
                },
                notificationPayload,
                { timeout: 10000 } // 10s timeout per notification
            ).then(() => ({ success: true as const, endpoint: sub.endpoint }))
              .catch((error: { statusCode?: number }) => ({ 
                  success: false as const, 
                  endpoint: sub.endpoint, 
                  statusCode: error.statusCode 
              }));
        }));
        
        // Process results
        let sent = 0;
        let failed = 0;
        const successEndpoints: string[] = [];
        const failedEndpoints: string[] = [];
        
        for (const result of results) {
            if (result.status === 'fulfilled') {
                if (result.value.success) {
                    sent++;
                    successEndpoints.push(result.value.endpoint);
                } else {
                    failed++;
                    // Mark invalid subscriptions (410 Gone or 404)
                    if (result.value.statusCode === 410 || result.value.statusCode === 404) {
                        failedEndpoints.push(result.value.endpoint);
                    }
                }
            } else {
                failed++;
            }
        }
        
        // Batch update last_used_at for successful sends (fire and forget)
        if (successEndpoints.length > 0) {
            supabase
                .from('push_subscriptions')
                .update({ last_used_at: new Date().toISOString() })
                .in('endpoint', successEndpoints)
                .then(() => {});
        }
        
        // Batch mark invalid subscriptions as inactive (fire and forget)
        if (failedEndpoints.length > 0) {
            supabase
                .from('push_subscriptions')
                .update({ is_active: false })
                .in('endpoint', failedEndpoints)
                .then(() => {});
        }
        
        // Log notification history
        await supabase
            .from('push_notification_history')
            .insert({
                title: payload.title,
                body: payload.body,
                url: payload.url,
                sent_by: authResult.username || 'admin',
                total_sent: sent,
                total_failed: failed
            });
        
        return NextResponse.json({
            success: true,
            message: `Notification sent to ${sent} subscribers`,
            sent,
            failed,
            total: subscriptions.length
        });
        
    } catch (error) {
        console.error('[Push] Send notification error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET - Get push notification stats and history
export async function GET(request: NextRequest) {
    try {
        // Verify admin auth
        const authResult = await verifyAdminToken(request);
        if (!authResult.valid) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            );
        }
        
        // Get subscriber count
        const { count: subscriberCount } = await supabase
            .from('push_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);
        
        // Get recent notification history
        const { data: history } = await supabase
            .from('push_notification_history')
            .select('*')
            .order('sent_at', { ascending: false })
            .limit(10);
        
        // Check VAPID configuration
        const isConfigured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
        
        return NextResponse.json({
            success: true,
            data: {
                isConfigured,
                subscriberCount: subscriberCount || 0,
                history: history || []
            }
        });
        
    } catch (error) {
        console.error('[Push] Get stats error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
