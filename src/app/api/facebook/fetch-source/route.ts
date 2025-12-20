import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/core';
import { rateLimit, getClientIP } from '@/core/security';

// Legacy API rate limit: 5 requests per 5 minutes
const LEGACY_RATE_LIMIT = { maxRequests: 5, windowMs: 5 * 60 * 1000 };

// Only allow Facebook domains (SSRF prevention)
function isAllowedUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        return hostname.endsWith('facebook.com') || hostname.endsWith('fb.com');
    } catch {
        return false;
    }
}

export async function POST(request: NextRequest) {
    const clientIP = getClientIP(request);
    
    // Rate limiting
    const rl = await rateLimit(clientIP, 'legacy_fb_source', LEGACY_RATE_LIMIT);
    if (!rl.allowed) {
        const resetIn = Math.ceil(rl.resetIn / 1000);
        return NextResponse.json({ 
            success: false, 
            error: `Rate limit exceeded. Try again in ${resetIn}s.`,
            resetIn 
        }, { status: 429 });
    }
    
    try {
        const { url } = await request.json();

        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }
        
        // SSRF prevention - only allow Facebook URLs
        if (!isAllowedUrl(url)) {
            return NextResponse.json({ error: 'Only Facebook URLs allowed' }, { status: 400 });
        }

        logger.url('facebook/fetch-source', `Fetching: ${url.substring(0, 60)}...`);

        // Use view-source protocol to bypass some restrictions
        const viewSourceUrl = `view-source:${url}`;
        
        // Try direct fetch first with minimal headers
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                },
                redirect: 'follow',
            });

            if (response.ok) {
                const html = await response.text();
                if (html && html.length > 0) {
                    logger.debug('facebook/fetch-source', `Fetched ${html.length} bytes`);
                    return NextResponse.json({
                        success: true,
                        html,
                        size: html.length,
                    });
                }
            }
        } catch (e) {
            logger.debug('facebook/fetch-source', `Direct fetch failed, trying alternative...`);
        }

        // If direct fetch fails, return instruction to use view-source
        logger.error('facebook/fetch-source', 'Direct fetch blocked, user must use view-source');
        return NextResponse.json(
            { 
                error: 'Facebook blocked direct fetch. Please use Manual View Source method.',
                viewSourceUrl,
                instruction: 'Open the view-source URL in a new tab, copy all content, and paste in the textarea below.'
            },
            { status: 403 }
        );
    } catch (error) {
        logger.error('facebook/fetch-source', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch page' },
            { status: 500 }
        );
    }
}
