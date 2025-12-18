/**
 * Push Subscription API
 * Handles user subscription management
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// POST - Subscribe to push notifications
export async function POST(request: NextRequest) {
    try {
        const { subscription } = await request.json();
        
        if (!subscription?.endpoint || !subscription?.keys) {
            return NextResponse.json(
                { success: false, error: 'Invalid subscription data' },
                { status: 400 }
            );
        }
        
        const userAgent = request.headers.get('user-agent') || '';
        
        // Upsert subscription (update if exists, insert if new)
        const { error } = await supabase
            .from('push_subscriptions')
            .upsert({
                endpoint: subscription.endpoint,
                keys_p256dh: subscription.keys.p256dh,
                keys_auth: subscription.keys.auth,
                user_agent: userAgent,
                is_active: true,
                last_used_at: new Date().toISOString()
            }, {
                onConflict: 'endpoint'
            });
        
        if (error) {
            console.error('[Push] Subscribe error:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to save subscription' },
                { status: 500 }
            );
        }
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Push] Subscribe error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// DELETE - Unsubscribe from push notifications
export async function DELETE(request: NextRequest) {
    try {
        const { endpoint } = await request.json();
        
        if (!endpoint) {
            return NextResponse.json(
                { success: false, error: 'Endpoint required' },
                { status: 400 }
            );
        }
        
        // Mark as inactive instead of deleting (for analytics)
        const { error } = await supabase
            .from('push_subscriptions')
            .update({ is_active: false })
            .eq('endpoint', endpoint);
        
        if (error) {
            console.error('[Push] Unsubscribe error:', error);
            return NextResponse.json(
                { success: false, error: 'Failed to unsubscribe' },
                { status: 500 }
            );
        }
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Push] Unsubscribe error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// GET - Check subscription status
export async function GET(request: NextRequest) {
    try {
        const endpoint = request.nextUrl.searchParams.get('endpoint');
        
        if (!endpoint) {
            // Return total subscriber count
            const { count, error } = await supabase
                .from('push_subscriptions')
                .select('*', { count: 'exact', head: true })
                .eq('is_active', true);
            
            if (error) throw error;
            
            return NextResponse.json({ 
                success: true, 
                subscriberCount: count || 0 
            });
        }
        
        // Check specific subscription
        const { data, error } = await supabase
            .from('push_subscriptions')
            .select('is_active')
            .eq('endpoint', endpoint)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            throw error;
        }
        
        return NextResponse.json({
            success: true,
            isSubscribed: data?.is_active || false
        });
    } catch (error) {
        console.error('[Push] Status check error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}
