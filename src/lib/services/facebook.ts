/**
 * Facebook Scraper Service (Optimized)
 * =====================================
 * Supports: /share/p|r|v/, /posts/, /reel/, /videos/, /watch/, /stories/, /groups/, /photos/
 * Cookie Required: Stories, some group posts
 */

import { MediaFormat } from '@/lib/types';
import { decodeHtml, extractMeta, normalizeUrl, cleanTrackingParams, decodeUrl } from '@/lib/utils/http';
import { parseCookie } from '@/lib/utils/cookie-parser';
import { matchesPlatform } from './api-config';
import { resolveUrlWithLog, BROWSER_HEADERS, ScraperResult, ScraperOptions, EngagementStats, fetchWithTimeout } from './fetch-helper';
import { getCache, setCache } from './cache';
import { createError, ScraperErrorCode } from './errors';
import { logger } from './logger';

// ============================================================================
// CONSTANTS & HELPERS
// ============================================================================

const SKIP_SIDS = ['bd9a62', '23dd7b', '50ce42', '9a7156', '1d2534', 'e99d92', 'a6c039', '72b077', 'ba09c1', 'f4d7c3', '0f7a8c', '3c5e9a', 'd41d8c'];
const isValidMedia = (url: string) => url?.length > 30 && /fbcdn|scontent/.test(url) && !/<|>/.test(url);
const isSkipImage = (url: string) => SKIP_SIDS.some(s => url.includes(`_nc_sid=${s}`)) || /emoji|sticker|static|rsrc|profile|avatar|\/cp0\/|\/[ps]\d+x\d+\/|_s\d+x\d+|\.webp\?/i.test(url);
const clean = (s: string) => s.replace(/\\\//g, '/').replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
const getQuality = (h: number) => h >= 1080 ? 'HD 1080p' : h >= 720 ? 'HD 720p' : h >= 480 ? 'SD 480p' : `${h}p`;
const getResValue = (q: string) => { const m = q.match(/(\d{3,4})/); return m ? parseInt(m[1]) : 0; };

// Age-restricted / Content detection patterns
const AGE_RESTRICTED_PATTERNS = [
    'You must be 18 years or older',
    'age-restricted',
    'AdultContentWarning',
    '"is_adult_content":true',
    'content_age_gate',
];

const PRIVATE_CONTENT_PATTERNS = [
    'This content isn\'t available',
    'content isn\'t available right now',
    'Sorry, this content isn\'t available',
    'The link you followed may be broken',
];

/**
 * Detect content issues - IMPROVED to avoid false positives
 * Only flags as issue if no media patterns found
 */
const detectContentIssue = (html: string): ScraperErrorCode | null => {
    const lower = html.toLowerCase();
    const hasMediaPatterns = html.includes('browser_native') || 
                             html.includes('all_subattachments') || 
                             html.includes('viewer_image') ||
                             html.includes('playable_url');
    
    // If we have media patterns, content is likely accessible
    if (hasMediaPatterns) return null;
    
    // Check age-restricted first
    for (const p of AGE_RESTRICTED_PATTERNS) {
        if (html.includes(p) || lower.includes(p.toLowerCase())) {
            return ScraperErrorCode.AGE_RESTRICTED;
        }
    }
    
    // Check private/unavailable - only in first 50KB (main content area)
    // Facebook pages often have "content isn't available" for related/suggested posts
    for (const p of PRIVATE_CONTENT_PATTERNS) {
        const idx = html.indexOf(p);
        if (idx > -1 && idx < 50000) {
            return ScraperErrorCode.PRIVATE_CONTENT;
        }
    }
    
    return null;
};

type ContentType = 'post' | 'video' | 'reel' | 'story' | 'group' | 'unknown';

const detectType = (url: string): ContentType => {
    if (/\/stories\//.test(url)) return 'story';
    if (/\/groups\//.test(url)) return 'group';
    if (/\/reel\/|\/share\/r\//.test(url)) return 'reel';
    if (/\/videos?\/|\/watch\/|\/share\/v\//.test(url)) return 'video';
    if (/\/posts\/|\/photos?\/|permalink|\/share\/p\//.test(url)) return 'post';
    return 'unknown';
};

// ============================================================================
// ID EXTRACTION
// ============================================================================

const extractVideoId = (url: string): string | null => url.match(/\/(?:reel|videos?)\/(\d+)/)?.[1] || null;

const extractPostId = (url: string): string | null => {
    const patterns = [
        /\/posts\/(pfbid[a-zA-Z0-9]+)/,
        /\/posts\/(\d+)/,
        /\/permalink\/(\d+)/,
        /story_fbid=(pfbid[a-zA-Z0-9]+)/,  // pfbid in permalink.php
        /story_fbid=(\d+)/,
        /\/photos?\/[^/]+\/(\d+)/,
        /\/share\/p\/([a-zA-Z0-9]+)/,
        /fbid=(\d+)/,  // /photo/?fbid=xxx format
    ];
    for (const re of patterns) {
        const m = url.match(re);
        if (m) return m[1];
    }
    return null;
};

// ============================================================================
// TARGETED BLOCK FINDER (v3 - Precise isolation, no related content)
// ============================================================================

/**
 * Find the exact JSON block for target content
 * Strategy: Find post/video ID, then isolate its JSON object
 */
function findTargetBlock(html: string, id: string | null, type: 'post' | 'video'): string {
    const MAX_SEARCH = type === 'video' ? 80000 : 100000;
    
    if (!id) {
        // No ID - use first occurrence strategy
        return html.length > MAX_SEARCH ? html.substring(0, MAX_SEARCH) : html;
    }

    // For pfbid, extract the unique part (skip 'pfbid' prefix)
    const searchKey = id.startsWith('pfbid') ? id.substring(5, 30) : id;
    
    // STEP 1: Find exact position of target ID
    let targetPos = -1;
    const idPatterns = type === 'video'
        ? [`"id":"${id}"`, `"video_id":"${id}"`, `/reel/${id}`, `/videos/${id}`, `"videoId":"${id}"`]
        : [`/posts/${id}`, `story_fbid=${id}`, `/permalink/${id}`, `"post_id":"${id}"`, id];

    for (const p of idPatterns) {
        const pos = html.indexOf(p);
        if (pos > -1) { 
            targetPos = pos; 
            break; 
        }
    }

    // Try partial match for pfbid
    if (targetPos === -1 && id.startsWith('pfbid')) {
        targetPos = html.indexOf(searchKey);
    }

    // STEP 2: For posts, find the BEST all_subattachments (main post, not related)
    // Strategy: Find all_subattachments after "comet_sections" or "creation_story" (main post markers)
    if (type === 'post') {
        const subKey = '"all_subattachments":{"count":';
        
        // Find main post marker first
        const cometPos = html.indexOf('"comet_sections"');
        const creationPos = html.indexOf('"creation_story"');
        const mainPostPos = Math.min(
            cometPos > -1 ? cometPos : Infinity,
            creationPos > -1 ? creationPos : Infinity
        );
        
        // Find all_subattachments AFTER main post marker (more accurate)
        let bestSubPos = -1;
        if (mainPostPos < Infinity) {
            // Search in area after main post marker
            const searchArea = html.substring(mainPostPos, mainPostPos + 300000);
            const subInArea = searchArea.indexOf(subKey);
            if (subInArea > -1) {
                bestSubPos = mainPostPos + subInArea;
            }
        }
        
        // Fallback: use first occurrence
        if (bestSubPos === -1) {
            bestSubPos = html.indexOf(subKey);
        }
        
        if (bestSubPos > -1) {
            // Find the closing of this attachment block
            let endPos = html.indexOf('"all_subattachments":', bestSubPos + 30);
            if (endPos === -1 || endPos - bestSubPos > 30000) {
                endPos = bestSubPos + 25000; // Increased for larger carousels
            }
            
            // Extract tight block around best subattachments
            const start = Math.max(0, bestSubPos - 500);
            const end = Math.min(html.length, endPos);
            return html.substring(start, end);
        }
        
        // No all_subattachments found - use comet_sections area for single/dual image posts
        if (mainPostPos < Infinity) {
            return html.substring(mainPostPos, Math.min(html.length, mainPostPos + 100000));
        }
        
        // Fallback: Find viewer_image near target
        if (targetPos > -1) {
            const viewerKey = '"viewer_image":';
            let viewerPos = html.indexOf(viewerKey, Math.max(0, targetPos - 3000));
            if (viewerPos === -1) viewerPos = html.indexOf(viewerKey);
            
            if (viewerPos > -1) {
                return html.substring(Math.max(0, viewerPos - 500), Math.min(html.length, viewerPos + 15000));
            }
        }
    }

    // STEP 3: For videos/reels, find video URL patterns near target
    if (type === 'video') {
        // Include progressive_url - cookie mode often returns this instead of browser_native
        const videoKeys = ['"browser_native_hd_url":', '"playable_url_quality_hd":', '"playable_url":', '"progressive_url":'];
        
        for (const key of videoKeys) {
            let pos = targetPos > -1 ? html.indexOf(key, Math.max(0, targetPos - 2000)) : -1;
            if (pos === -1) pos = html.indexOf(key);
            
            if (pos > -1) {
                // Larger block for progressive_url (may have multiple qualities)
                const blockSize = key.includes('progressive') ? 15000 : 10000;
                return html.substring(Math.max(0, pos - 1000), Math.min(html.length, pos + blockSize));
            }
        }
    }

    // STEP 4: Fallback - use target position with tight bounds
    if (targetPos > -1) {
        const before = type === 'video' ? 1500 : 5000;
        const after = type === 'video' ? 10000 : 20000;
        return html.substring(Math.max(0, targetPos - before), Math.min(html.length, targetPos + after));
    }

    // No target found - return first chunk (main content usually at start)
    return html.length > MAX_SEARCH ? html.substring(0, MAX_SEARCH) : html;
}

// ============================================================================
// VIDEO EXTRACTION (v3 - Precise, target video only)
// ============================================================================

function extractVideos(html: string, seenUrls: Set<string>, targetId?: string | null): MediaFormat[] {
    const formats: MediaFormat[] = [];
    const found = new Set<string>();
    
    // Get precise target block
    const area = findTargetBlock(html, targetId || null, 'video');

    // Get thumbnail from target area first
    const thumbRe = /"(?:previewImage|thumbnailImage|poster_image|preferred_thumbnail)"[^}]*?"uri":"(https:[^"]+)"/;
    const thumbMatch = area.match(thumbRe);
    const thumbnail = thumbMatch && /scontent|fbcdn/.test(thumbMatch[1]) ? clean(thumbMatch[1]) : undefined;

    const add = (quality: string, url: string) => {
        if (!url.includes('.mp4') && !isValidMedia(url)) return;
        if (seenUrls.has(url) || found.has(quality)) return;
        seenUrls.add(url); found.add(quality);
        formats.push({ quality, type: 'video', url, format: 'mp4', itemId: 'video-main', thumbnail });
    };

    // METHOD 1: browser_native (new format) - MOST RELIABLE
    // Search in target area first, then full HTML
    const hdNative = area.match(/"browser_native_hd_url":"([^"]+)"/) || html.match(/"browser_native_hd_url":"([^"]+)"/);
    const sdNative = area.match(/"browser_native_sd_url":"([^"]+)"/) || html.match(/"browser_native_sd_url":"([^"]+)"/);
    
    if (hdNative) add('HD', decodeUrl(hdNative[1]));
    if (sdNative) add('SD', decodeUrl(sdNative[1]));
    if (found.size > 0) return formats;

    // METHOD 2: playable_url (legacy format)
    const hdPlay = area.match(/"playable_url_quality_hd":"([^"]+)"/);
    const sdPlay = area.match(/"playable_url":"([^"]+)"/);
    
    if (hdPlay) add('HD', decodeUrl(hdPlay[1]));
    if (sdPlay) add('SD', decodeUrl(sdPlay[1]));
    if (found.size > 0) return formats;

    // METHOD 3: hd_src/sd_src (older format)
    const hdSrc = area.match(/"hd_src(?:_no_ratelimit)?":"([^"]+)"/);
    const sdSrc = area.match(/"sd_src(?:_no_ratelimit)?":"([^"]+)"/);
    
    if (hdSrc) add('HD', decodeUrl(hdSrc[1]));
    if (sdSrc) add('SD', decodeUrl(sdSrc[1]));
    if (found.size > 0) return formats;

    // METHOD 4: DASH manifest (for specific resolutions)
    // Only search in target area to avoid related videos
    const dashRe = /"height":(\d+)[^}]*?"base_url":"(https:[^"]+\.mp4[^"]*)"/g;
    let m;
    const dashVideos: { height: number; url: string }[] = [];
    
    while ((m = dashRe.exec(area)) !== null) {
        const height = parseInt(m[1]);
        if (height >= 360) {
            dashVideos.push({ height, url: decodeUrl(m[2]) });
        }
    }
    
    // Sort by height and pick best HD and SD
    if (dashVideos.length > 0) {
        dashVideos.sort((a, b) => b.height - a.height);
        const hd = dashVideos.find(v => v.height >= 720);
        const sd = dashVideos.find(v => v.height < 720 && v.height >= 360);
        
        if (hd) add('HD', hd.url);
        if (sd) add('SD', sd.url);
        if (found.size > 0) return formats;
    }

    // METHOD 5: Progressive URL (fallback)
    // Handle both .mp4 extension and fbcdn video URLs without extension
    const progRe = /"progressive_url":"(https:\/\/[^"]+)"/g;
    let progMatch;
    while ((progMatch = progRe.exec(area)) !== null && found.size < 2) {
        const url = decodeUrl(progMatch[1]);
        // Accept .mp4 or fbcdn/scontent video URLs
        if (/\.mp4|scontent.*\/v\/|fbcdn.*\/v\//.test(url)) {
            const quality = /720|1080|_hd/i.test(url) || found.size === 0 ? 'HD' : 'SD';
            add(quality, url);
        }
    }

    return formats;
}

// ============================================================================
// STORY EXTRACTION
// ============================================================================

function extractStories(html: string, seenUrls: Set<string>): MediaFormat[] {
    const formats: MediaFormat[] = [];
    let m;

    // Method 1: Extract videos with HD/SD quality pairs (preferred - has quality info)
    const storyRe = /"progressive_url":"(https:[^"]+\.mp4[^"]*)","failure_reason":null,"metadata":\{"quality":"(HD|SD)"\}/g;
    const videoPairs: { url: string; isHD: boolean }[] = [];
    while ((m = storyRe.exec(html)) !== null) {
        const url = decodeUrl(m[1]);
        if (!seenUrls.has(url)) { seenUrls.add(url); videoPairs.push({ url, isHD: m[2] === 'HD' }); }
    }

    // Method 2: Fallback - progressive_url without quality metadata
    if (videoPairs.length === 0) {
        const fallbackRe = /"progressive_url":"(https:[^"]+\.mp4[^"]*)"/g;
        while ((m = fallbackRe.exec(html)) !== null) {
            const url = decodeUrl(m[1]);
            if (!seenUrls.has(url)) {
                seenUrls.add(url);
                videoPairs.push({ url, isHD: /720p|1080p|_hd/.test(url) });
            }
        }
    }

    // Get thumbnails for videos
    const thumbs: string[] = [];
    const thumbRe = /"(?:previewImage|story_thumbnail|poster_image)":\{"uri":"(https:[^"]+)"/g;
    while ((m = thumbRe.exec(html)) !== null) {
        const url = clean(m[1]);
        if (isValidMedia(url) && !thumbs.includes(url)) thumbs.push(url);
    }

    // Process video pairs (HD/SD) - keep best quality
    let videoIdx = 0;
    if (videoPairs.some(v => v.isHD) && videoPairs.some(v => !v.isHD)) {
        const count = Math.ceil(videoPairs.length / 2);
        for (let i = 0; i < count; i++) {
            const pair = videoPairs.slice(i * 2, i * 2 + 2);
            const best = pair.find(v => v.isHD) || pair[0];
            if (best) {
                seenUrls.add(best.url);
                formats.push({ quality: `Story ${++videoIdx}`, type: 'video', url: best.url, format: 'mp4', itemId: `story-v-${videoIdx}`, thumbnail: thumbs[i] });
            }
        }
    } else if (videoPairs.length > 0) {
        videoPairs.forEach((v, i) => {
            seenUrls.add(v.url);
            formats.push({ quality: `Story ${++videoIdx}`, type: 'video', url: v.url, format: 'mp4', itemId: `story-v-${videoIdx}`, thumbnail: thumbs[i] });
        });
    }



    // Extract image stories (t51.82787 = story image type)
    const imgRe = /https:\/\/scontent[^"'\s<>\\]+t51\.82787[^"'\s<>\\]+\.jpg[^"'\s<>\\]*/gi;
    const storyImages: string[] = [];
    while ((m = imgRe.exec(html)) !== null) {
        const url = clean(decodeUrl(m[0]));
        // Only high-res images (1080+), skip thumbnails
        if (/s(1080|1440|2048)x/.test(url) && !seenUrls.has(url) && !storyImages.includes(url)) {
            storyImages.push(url);
        }
    }

    // Add image stories
    storyImages.forEach((url, i) => {
        seenUrls.add(url);
        formats.push({ quality: `Story Image ${i + 1}`, type: 'image', url, format: 'jpg', itemId: `story-img-${i + 1}`, thumbnail: url });
    });

    return formats;
}

// ============================================================================
// IMAGE EXTRACTION (v3 - Precise, no related content)
// ============================================================================

function extractImages(html: string, decoded: string, seenUrls: Set<string>, targetPostId?: string | null): MediaFormat[] {
    const formats: MediaFormat[] = [];
    const seenPaths = new Set<string>();
    let idx = 0;

    const add = (imgUrl: string, source: string = '') => {
        const path = imgUrl.split('?')[0];
        if (isSkipImage(imgUrl) || seenPaths.has(path)) return false;
        // Skip profile pictures (t39.30808-1) - only accept post images (-6, -0)
        if (/t39\.30808-1\//.test(imgUrl)) return false;
        seenPaths.add(path); seenUrls.add(imgUrl);
        formats.push({ quality: `Image ${++idx}`, type: 'image', url: imgUrl, format: 'jpg', itemId: `img-${idx}`, thumbnail: imgUrl });
        return true;
    };

    // Get precise target block
    const target = findTargetBlock(decoded, targetPostId || null, 'post');
    let m;

    // METHOD 1: all_subattachments (BEST - carousel/multi-image posts)
    // This is the most accurate - contains only images from target post
    const subStart = target.indexOf('"all_subattachments":{"count":');
    if (subStart > -1) {
        // Extract count to know expected images
        const countMatch = target.substring(subStart, subStart + 50).match(/"count":(\d+)/);
        const expectedCount = countMatch ? parseInt(countMatch[1]) : 0;
        
        // Find the nodes array within subattachments
        const nodesStart = target.indexOf('"nodes":[', subStart);
        if (nodesStart > -1 && nodesStart - subStart < 100) {
            // Find matching closing bracket - careful not to go too far
            let depth = 0;
            let nodesEnd = nodesStart + 9;
            for (let i = nodesStart + 8; i < target.length && i < nodesStart + 30000; i++) {
                if (target[i] === '[') depth++;
                if (target[i] === ']') {
                    if (depth === 0) { nodesEnd = i + 1; break; }
                    depth--;
                }
            }
            
            const nodesBlock = target.substring(nodesStart, nodesEnd);
            
            // Extract viewer_image from each node
            // t39.30808 = regular post images, t51.82787 = story-type images shared as posts
            const viewerRe = /"viewer_image":\{"height":(\d+),"width":(\d+),"uri":"(https:[^"]+)"/g;
            while ((m = viewerRe.exec(nodesBlock)) !== null) {
                const url = clean(m[3]);
                if (/scontent|fbcdn/.test(url) && /t39\.30808|t51\.82787/.test(url)) {
                    add(url, 'subattachments');
                }
            }
            
            // If we got expected count, we're done
            if (idx >= expectedCount && idx > 0) return formats;
        }
    }

    // METHOD 2: Single image post - look for viewer_image near target
    if (idx === 0) {
        // For single image, find the FIRST high-quality viewer_image
        const viewerRe = /"viewer_image":\{"height":(\d+),"width":(\d+),"uri":"(https:[^"]+)"/g;
        const candidates: { url: string; size: number }[] = [];
        
        while ((m = viewerRe.exec(target)) !== null) {
            const height = parseInt(m[1]);
            const width = parseInt(m[2]);
            const url = clean(m[3]);
            
            // Only high-res images (not thumbnails)
            // t39.30808 = regular, t51.82787 = story-type shared as post
            if (/scontent|fbcdn/.test(url) && height >= 400 && width >= 400) {
                if (/t39\.30808|t51\.82787/.test(url) && !/\/[ps]\d{2,3}x\d{2,3}\/|\/cp0\//.test(url)) {
                    candidates.push({ url, size: height * width });
                }
            }
        }
        
        // Sort by size (largest first) and take unique
        candidates.sort((a, b) => b.size - a.size);
        const addedUrls = new Set<string>();
        for (const c of candidates) {
            const basePath = c.url.split('?')[0].replace(/_n\.jpg$/, '');
            if (!addedUrls.has(basePath)) {
                addedUrls.add(basePath);
                add(c.url, 'viewer_image');
            }
        }
    }

    // METHOD 3: photo_image pattern (for single/dual image posts without subattachments)
    if (idx === 0) {
        const photoRe = /"photo_image":\{"uri":"(https:[^"]+)"/g;
        const photoUrls: string[] = [];
        while ((m = photoRe.exec(target)) !== null && photoUrls.length < 5) {
            const url = clean(m[1]);
            // Only high-res post images (t39.30808-6), skip profile pics (-1)
            if (/scontent|fbcdn/.test(url) && /t39\.30808-6/.test(url)) {
                if (!photoUrls.includes(url)) photoUrls.push(url);
            }
        }
        // Dedupe and add
        for (const url of photoUrls) {
            add(url, 'photo_image');
        }
    }

    // METHOD 4: Fallback - preload links (usually accurate for main content)
    if (idx === 0) {
        const preloadRe = /<link[^>]+rel="preload"[^>]+href="(https:\/\/scontent[^"]+_nc_sid=127cfc[^"]+)"/i;
        const preloadMatch = html.match(preloadRe);
        if (preloadMatch) {
            add(clean(preloadMatch[1]), 'preload');
        }
    }

    // METHOD 5: Single photo page - "image":{"uri":"..."} pattern
    if (idx === 0) {
        const imageUriRe = /"image":\{"uri":"(https:[^"]+t39\.30808[^"]+)"/g;
        while ((m = imageUriRe.exec(html)) !== null && idx < 3) {
            const url = clean(m[1]);
            if (/scontent|fbcdn/.test(url) && !/\/[ps]\d{2,3}x\d{2,3}\/|\/cp0\//.test(url)) {
                add(url, 'image_uri');
            }
        }
    }

    // METHOD 6: Last resort - t39.30808 pattern (limit to first few)
    if (idx === 0) {
        const t39Re = /https:\/\/scontent[^"'\s<>\\]+t39\.30808-6[^"'\s<>\\]+\.jpg/gi;
        let count = 0;
        while ((m = t39Re.exec(target)) !== null && count < 5) {
            const url = decodeUrl(m[0]);
            // Skip thumbnails and small images
            if (!/\/[ps]\d{2,3}x\d{2,3}\/|\/cp0\/|_s\d+x\d+|\/s\d{2,3}x\d{2,3}\//.test(url)) {
                if (add(url, 't39')) count++;
            }
        }
    }

    return formats;
}

// ============================================================================
// METADATA EXTRACTION (Compact)
// ============================================================================

function extractAuthor(html: string, url: string): string {
    const decode = (s: string) => s.replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    const patterns = [
        /"name":"([^"]+)","enable_reels_tab_deeplink":true/,
        /"owning_profile":\{"__typename":"(?:User|Page)","name":"([^"]+)"/,
        /"owner":\{"__typename":"(?:User|Page)"[^}]*"name":"([^"]+)"/,
        /"actors":\[\{"__typename":"User","name":"([^"]+)"/,
    ];
    for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1] && m[1] !== 'Facebook' && !/^(User|Page|Video|Photo|Post)$/i.test(m[1])) return decode(m[1]);
    }
    const urlMatch = url.match(/facebook\.com\/([^/?]+)/);
    if (urlMatch && !['watch', 'reel', 'share', 'groups', 'www', 'web', 'stories'].includes(urlMatch[1])) return urlMatch[1];
    return 'Facebook';
}

function extractDescription(html: string): string {
    const patterns = [/"message":\{"text":"([^"]+)"/, /"content":\{"text":"([^"]+)"/, /"caption":"([^"]+)"/];
    for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1] && m[1].length > 2) return m[1].replace(/\\n/g, '\n').replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    }
    return '';
}

const extractPostDate = (html: string): string | undefined => {
    const m = html.match(/"(?:creation|created|publish)_time":(\d{10})/);
    return m ? new Date(parseInt(m[1]) * 1000).toISOString() : undefined;
};

function extractEngagement(html: string): EngagementStats {
    const parse = (s: string) => {
        const n = parseFloat(s.replace(/,/g, ''));
        if (isNaN(n)) return 0;
        if (/[kK]$/.test(s)) return Math.round(n * 1000);
        if (/[mM]$/.test(s)) return Math.round(n * 1000000);
        return Math.round(n);
    };
    const e: EngagementStats = {};
    const likeM = html.match(/"reaction_count":\{"count":(\d+)/) || html.match(/"i18n_reaction_count":"([\d,\.KMkm]+)"/);
    if (likeM) e.likes = parse(likeM[1]);
    const commentM = html.match(/"comment_count":\{"total_count":(\d+)/) || html.match(/"comments":\{"total_count":(\d+)/);
    if (commentM) e.comments = parse(commentM[1]);
    const shareM = html.match(/"share_count":\{"count":(\d+)/) || html.match(/"reshares":\{"count":(\d+)/);
    if (shareM) e.shares = parse(shareM[1]);
    const viewM = html.match(/"video_view_count":(\d+)/) || html.match(/"play_count":(\d+)/);
    if (viewM) e.views = parse(viewM[1]);
    return e;
}

// ============================================================================
// MAIN SCRAPER
// ============================================================================

export async function scrapeFacebook(inputUrl: string, options?: ScraperOptions): Promise<ScraperResult> {
    const startTime = Date.now();

    // Cache check
    if (!options?.skipCache) {
        const cached = await getCache<ScraperResult>('facebook', inputUrl);
        if (cached?.success) { logger.cache('facebook', true); return { ...cached, cached: true }; }
    }
    logger.cache('facebook', false);

    if (!matchesPlatform(inputUrl, 'facebook')) return createError(ScraperErrorCode.INVALID_URL, 'Invalid Facebook URL');

    const parsedCookie = parseCookie(options?.cookie, 'facebook') || undefined;
    const hasCookie = !!parsedCookie;

    // Stories require cookie (check before resolve to fail fast)
    if (/\/stories\//.test(inputUrl) && !parsedCookie) {
        return createError(ScraperErrorCode.COOKIE_REQUIRED, 'Stories require login.');
    }

    // Internal scrape function - can be called with or without cookie
    const doScrape = async (useCookie: boolean): Promise<ScraperResult> => {
      try {
        const headers = useCookie && parsedCookie ? { ...BROWSER_HEADERS, Cookie: parsedCookie } : BROWSER_HEADERS;

        // OPTIMIZED: Single fetch - resolve + get HTML in one request
        // Use redirect:follow for both guest and cookie - works better with Facebook
        const fetchAndResolve = async (url: string): Promise<{ html: string; finalUrl: string }> => {
            logger.debug('facebook', `Fetching ${url.substring(0, 50)}... (cookie: ${useCookie})`);
            const res = await fetchWithTimeout(url, { headers, redirect: 'follow', timeout: 15000 });
            if (res.url.includes('/checkpoint/')) throw new Error('CHECKPOINT_REQUIRED');
            const html = await res.text();
            logger.debug('facebook', `Got ${(html.length/1024).toFixed(0)}KB from ${res.url.substring(0, 50)}...`);
            return { html, finalUrl: res.url };
        };

        // Single fetch: resolve + HTML in one call
        let { html, finalUrl } = await fetchAndResolve(inputUrl);
        
        // Detect content type from resolved URL
        const contentType = detectType(finalUrl);
        logger.type('facebook', contentType);
        logger.resolve('facebook', inputUrl, finalUrl);

        // Story: retry if no media found (lazy loading)
        if (contentType === 'story' && useCookie) {
            const countMedia = (h: string) => (h.match(/progressive_url":"https[^"]+\.mp4/g) || []).length;
            if (countMedia(html) === 0) {
                for (let i = 0; i < 2; i++) {
                    await new Promise(r => setTimeout(r, 200));
                    const retry = await fetchAndResolve(finalUrl);
                    if (countMedia(retry.html) > 0) { html = retry.html; break; }
                }
            }
        }

        // Check for error page (very small HTML)
        if (html.length < 10000 && html.includes('Sorry, something went wrong')) {
            return createError(ScraperErrorCode.API_ERROR, 'Facebook returned error page');
        }
        
        // Check for login required - but only if no media patterns found
        // Some pages show login form but still have media data
        const hasMediaPatterns = html.includes('browser_native') || 
                                 html.includes('all_subattachments') || 
                                 html.includes('viewer_image');
        if (!hasMediaPatterns && html.length < 500000 && 
            (html.includes('login_form') || html.includes('Log in to Facebook'))) {
            return createError(ScraperErrorCode.COOKIE_REQUIRED, 'This content requires login.');
        }

        // Detect content issues (age-restricted, private, etc.)
        const contentIssue = detectContentIssue(html);
        if (contentIssue && !useCookie) {
            // Return specific error so client knows to retry with cookie
            if (contentIssue === ScraperErrorCode.AGE_RESTRICTED) {
                return createError(ScraperErrorCode.AGE_RESTRICTED, 'Age-restricted content. Cookie required.');
            }
            if (contentIssue === ScraperErrorCode.PRIVATE_CONTENT) {
                return createError(ScraperErrorCode.PRIVATE_CONTENT, 'This content is private or unavailable.');
            }
        }

        const decoded = decodeHtml(html);
        const meta = extractMeta(html);
        const seenUrls = new Set<string>();
        let formats: MediaFormat[] = [];

        const actualType = detectType(finalUrl);
        const isVideo = actualType === 'video' || actualType === 'reel';
        const isPost = actualType === 'post' || actualType === 'group' || actualType === 'unknown';

        // Extract media
        if (actualType === 'story') {
            formats = extractStories(decoded, seenUrls);
        } else if (isVideo) {
            formats = extractVideos(decoded, seenUrls, extractVideoId(finalUrl));
        }
        if (isPost || (isVideo && formats.length === 0)) {
            formats.push(...extractImages(html, decoded, seenUrls, extractPostId(finalUrl)));
        }

        // If no media found, check for specific issues
        if (formats.length === 0) {
            // Re-check content issues with cookie (might still be restricted)
            if (contentIssue === ScraperErrorCode.AGE_RESTRICTED) {
                return createError(ScraperErrorCode.AGE_RESTRICTED, 'Age-restricted content. Try with a different cookie.');
            }
            if (contentIssue === ScraperErrorCode.PRIVATE_CONTENT) {
                return createError(ScraperErrorCode.PRIVATE_CONTENT, 'This content is private or has been removed.');
            }
            // Generic no media error
            return createError(ScraperErrorCode.NO_MEDIA, 'No media found. Post may be text-only or private.');
        }

        // Dedupe & sort
        const seen = new Set<string>();
        formats = formats.filter(f => { if (seen.has(f.url)) return false; seen.add(f.url); return true; });
        formats.sort((a, b) => (a.type === 'video' ? 0 : 1) - (b.type === 'video' ? 0 : 1) || getResValue(b.quality) - getResValue(a.quality));

        // Build result
        let title = decodeHtml(meta.title || 'Facebook Post').replace(/^[\d.]+K?\s*views.*?\|\s*/i, '').trim();
        if (title.length > 100) title = title.substring(0, 100) + '...';
        const description = extractDescription(decoded);
        if ((title === 'Facebook' || title === 'Facebook Post') && description) {
            title = description.length > 80 ? description.substring(0, 80) + '...' : description;
        }

        const videoCount = formats.filter(f => f.type === 'video').length;
        const imageCount = formats.filter(f => f.type === 'image').length;
        logger.media('facebook', { videos: videoCount, images: imageCount });
        logger.complete('facebook', Date.now() - startTime);

        const result: ScraperResult = {
            success: true,
            data: {
                title,
                thumbnail: meta.thumbnail || formats.find(f => f.thumbnail)?.thumbnail || '',
                author: extractAuthor(decoded, finalUrl),
                description,
                postedAt: extractPostDate(decoded),
                engagement: extractEngagement(decoded),
                formats,
                url: inputUrl
            }
        };

        setCache('facebook', inputUrl, result);
        return result;

      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch';
        if (msg === 'CHECKPOINT_REQUIRED') return createError(ScraperErrorCode.CHECKPOINT_REQUIRED);
        return createError(ScraperErrorCode.NETWORK_ERROR, msg);
      }
    }; // end doScrape

    // SMART RETRY LOGIC:
    // 1. Try WITHOUT cookie first (guest mode often has better video URLs)
    // 2. If no media found AND cookie available → retry WITH cookie
    // 3. Stories always use cookie (already checked above)
    
    const isStory = /\/stories\//.test(inputUrl);
    
    // Stories: always use cookie
    if (isStory) {
        return doScrape(true);
    }
    
    // Other content: try guest first
    const guestResult = await doScrape(false);
    
    // Check if we need to retry with cookie
    const shouldRetry = hasCookie && (
        // No media found or failed
        (!guestResult.success) ||
        (guestResult.data?.formats?.length === 0) ||
        // Specific retryable errors
        (guestResult.errorCode === ScraperErrorCode.AGE_RESTRICTED) ||
        (guestResult.errorCode === ScraperErrorCode.COOKIE_REQUIRED) ||
        (guestResult.errorCode === ScraperErrorCode.PRIVATE_CONTENT) ||
        (guestResult.errorCode === ScraperErrorCode.NO_MEDIA)
    );
    
    if (shouldRetry) {
        logger.debug('facebook', 'Retrying with cookie...');
        const cookieResult = await doScrape(true);
        
        // Return cookie result if better, otherwise return guest result
        if (cookieResult.success && (cookieResult.data?.formats?.length || 0) > 0) {
            return cookieResult;
        }
        // If cookie also failed, return the more informative error
        if (!guestResult.success && !cookieResult.success) {
            return cookieResult; // Cookie error usually more specific
        }
    }
    
    return guestResult;
}
