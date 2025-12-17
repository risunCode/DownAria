/**
 * Per-Platform Download API
 * 
 * POST /api/download/facebook
 * POST /api/download/instagram
 * POST /api/download/twitter
 * POST /api/download/tiktok
 * POST /api/download/youtube
 * POST /api/download/weibo
 * 
 * Body: { url: "https://...", cookie?: "..." }
 * Headers: X-API-Key or Authorization: Bearer
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleDownload } from '@/lib/services/download-handler';

const VALID_PLATFORMS = ['facebook', 'instagram', 'twitter', 'tiktok', 'youtube', 'weibo'];

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
        return handleDownload(request, { url: body.url, cookie: body.cookie, platform });
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }
}
