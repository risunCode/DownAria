/**
 * Unified Download API - Auto-detect platform
 * 
 * POST /api/download
 * Body: { url: "https://...", cookie?: "..." }
 * Headers: X-API-Key or Authorization: Bearer
 * 
 * GET /api/download?url=...&key=...
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleDownload, getApiInfo } from '@/lib/services/download-handler';
import { rateLimit, getClientIP } from '@/core/security';

// Legacy API rate limit: 5 requests per 5 minutes
const LEGACY_RATE_LIMIT = { maxRequests: 5, windowMs: 5 * 60 * 1000 };

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url') || '';
    const cookie = request.nextUrl.searchParams.get('cookie') || undefined;
    
    if (!url) {
        return NextResponse.json(getApiInfo());
    }
    
    // Rate limiting
    const clientIP = getClientIP(request);
    const rl = await rateLimit(clientIP, 'legacy_download', LEGACY_RATE_LIMIT);
    if (!rl.allowed) {
        const resetIn = Math.ceil(rl.resetIn / 1000);
        return NextResponse.json({ 
            success: false, 
            error: `Rate limit exceeded. Try again in ${resetIn}s.`,
            resetIn 
        }, { status: 429 });
    }
    
    return handleDownload(request, { url, cookie });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        if (!body.url) {
            return NextResponse.json({ success: false, error: 'URL required' }, { status: 400 });
        }
        
        // Rate limiting
        const clientIP = getClientIP(request);
        const rl = await rateLimit(clientIP, 'legacy_download', LEGACY_RATE_LIMIT);
        if (!rl.allowed) {
            const resetIn = Math.ceil(rl.resetIn / 1000);
            return NextResponse.json({ 
                success: false, 
                error: `Rate limit exceeded. Try again in ${resetIn}s.`,
                resetIn 
            }, { status: 429 });
        }
        
        return handleDownload(request, { url: body.url, cookie: body.cookie });
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }
}
