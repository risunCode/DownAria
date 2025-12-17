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

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url') || '';
    const cookie = request.nextUrl.searchParams.get('cookie') || undefined;
    
    if (!url) {
        return NextResponse.json(getApiInfo());
    }
    
    return handleDownload(request, { url, cookie });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        return handleDownload(request, { url: body.url, cookie: body.cookie });
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }
}
