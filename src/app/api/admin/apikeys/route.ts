/**
 * Admin API Keys Management
 * GET: List all keys
 * POST: Create/update/delete keys
 */

import { NextRequest, NextResponse } from 'next/server';
import {
    getAllApiKeys,
    createApiKey,
    updateApiKey,
    deleteApiKey,
    regenerateApiKey,
    resetKeyStats,
} from '@/lib/services/api-keys';
import { verifySession } from '@/lib/utils/admin-auth';

// Auth check helper
async function checkAuth(request: NextRequest): Promise<NextResponse | null> {
    const auth = await verifySession(request);
    if (!auth.valid) {
        return NextResponse.json({ success: false, error: auth.error || 'Unauthorized' }, { status: 401 });
    }
    return null;
}

// GET - List all API keys
export async function GET(request: NextRequest) {
    const authError = await checkAuth(request);
    if (authError) return authError;
    
    try {
        const keys = await getAllApiKeys();
        return NextResponse.json({ success: true, data: keys });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// POST - Create, update, delete, regenerate keys
export async function POST(request: NextRequest) {
    const authError = await checkAuth(request);
    if (authError) return authError;
    
    try {
        const body = await request.json();
        const { action, id, name, enabled, rateLimit, isTest, keyLength, keyFormat, validityDays, prefix } = body;

        switch (action) {
            case 'create': {
                if (!name) {
                    return NextResponse.json({ success: false, error: 'Name required' }, { status: 400 });
                }
                const result = await createApiKey(name, { 
                    rateLimit, 
                    expiresInDays: validityDays, 
                    isTest,
                    keyLength: keyLength || 32,
                    keyFormat: keyFormat || 'alphanumeric',
                    prefix: prefix || undefined
                });
                return NextResponse.json({ 
                    success: true, 
                    data: result.key,
                    plainKey: result.plainKey,
                    message: 'API key created. Save the key now - it won\'t be shown again!'
                });
            }

            case 'update': {
                if (!id) {
                    return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
                }
                const success = await updateApiKey(id, { name, enabled, rateLimit });
                if (!success) {
                    return NextResponse.json({ success: false, error: 'Key not found' }, { status: 404 });
                }
                return NextResponse.json({ success: true, message: 'Key updated' });
            }

            case 'delete': {
                if (!id) {
                    return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
                }
                const success = await deleteApiKey(id);
                if (!success) {
                    return NextResponse.json({ success: false, error: 'Key not found' }, { status: 404 });
                }
                return NextResponse.json({ success: true, message: 'Key deleted' });
            }

            case 'regenerate': {
                if (!id) {
                    return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
                }
                const result = await regenerateApiKey(id);
                if (!result) {
                    return NextResponse.json({ success: false, error: 'Key not found' }, { status: 404 });
                }
                return NextResponse.json({ 
                    success: true, 
                    data: result.key,
                    plainKey: result.plainKey,
                    message: 'Key regenerated. Save the new key!'
                });
            }

            case 'resetStats': {
                if (!id) {
                    return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
                }
                await resetKeyStats(id);
                return NextResponse.json({ success: true, message: 'Stats reset' });
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
