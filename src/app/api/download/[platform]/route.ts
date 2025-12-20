/**
 * Per-Platform Download API
 * 
 * POST /api/download/facebook
 * POST /api/download/instagram
 * POST /api/download/twitter
 * POST /api/download/tiktok
 * POST /api/download/weibo
 * 
 * Body: { url: "https://...", cookie?: "..." }
 * Headers: X-API-Key or Authorization: Bearer
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleDownload } from '@/lib/services/download-handler';
import { rateLimit, getClientIP } from '@/core/security';

const VALID_PLATFORMS = ['facebook', 'instagram', 'twitter', 'tiktok', 'weibo'];

// Legacy API rate limit: 5 requests per 5 minutes
const LEGACY_RATE_LIMIT = { maxRequests: 5, windowMs: 5 * 60 * 1000 };

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ platform: string }> }
) {
    const { platform } = await params;
    
    if (!VALID_PLATFORMS.includes(platform)) {
        return NextResponse.json({ 
            success: false, 
            error: `Invalid platform. Valid: ${VALID_PLATFORMS.join(', ')}` 
        }, { status: 400 });
    }
    
    const url = request.nextUrl.searchParams.get('url') || '';
    const cookie = request.nextUrl.searchParams.get('cookie') || undefined;
    
    if (!url) {
        return NextResponse.json({ 
            success: false, 
            error: 'URL required',
            usage: `GET /api/download/${platform}?url=VIDEO_URL`
        }, { status: 400 });
    }
    
    // Rate limiting
    const clientIP = getClientIP(request);
    const rl = await rateLimit(clientIP, `legacy_dl_${platform}`, LEGACY_RATE_LIMIT);
    if (!rl.allowed) {
        const resetIn = Math.ceil(rl.resetIn / 1000);
        return NextResponse.json({ 
            success: false, 
            error: `Rate limit exceeded. Try again in ${resetIn}s.`,
            resetIn 
        }, { status: 429 });
    }
    
    return handleDownload(request, { url, cookie, platform });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ platform: string }> }
) {
    const { platform } = await params;
    
    if (!VALID_PLATFORMS.includes(platform)) {
        return NextResponse.json({ 
            success: false, 
            error: `Invalid platform. Valid: ${VALID_PLATFORMS.join(', ')}` 
        }, { status: 400 });
    }
    
    try {
        const body = await request.json();
        
        if (!body.url) {
            return NextResponse.json({ success: false, error: 'URL required' }, { status: 400 });
        }
        
        // Rate limiting
        const clientIP = getClientIP(request);
        const rl = await rateLimit(clientIP, `legacy_dl_${platform}`, LEGACY_RATE_LIMIT);
        if (!rl.allowed) {
            const resetIn = Math.ceil(rl.resetIn / 1000);
            return NextResponse.json({ 
                success: false, 
                error: `Rate limit exceeded. Try again in ${resetIn}s.`,
                resetIn 
            }, { status: 429 });
        }
        
        return handleDownload(request, { url: body.url, cookie: body.cookie, platform });
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }
}
