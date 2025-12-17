/**
 * Facebook Scraper Service
 * 
 * Supported Content Types:
 * ========================
 * 1. POSTS (Images) - /posts/, /photos/, permalink.php, /share/p/
 *    - Public: Works without cookie
 *    - Private: Requires cookie
 * 
 * 2. VIDEOS - /videos/, /watch/, /reel/, /share/v/, /share/r/
 *    - Public: Works without cookie
 *    - Private: Requires cookie
 * 
 * 3. STORIES - /stories/
 *    - Always requires cookie (private by nature)
 * 
 * URL Patterns:
 * =============
 * - Share URLs: /share/p/ (post), /share/v/ (video), /share/r/ (reel)
 * - Direct URLs: /posts/, /photos/, /videos/, /watch/, /reel/, /stories/
 * - Permalink: permalink.php?story_fbid=...
 * - Short URLs: fb.watch, fb.me
 */

import { MediaFormat } from '@/lib/types';
import { decodeHtml, extractMeta, normalizeUrl, cleanTrackingParams, getCache, setCache, decodeUrl } from '@/lib/utils/http';
import { matchesPlatform } from './api-config';
import { resolveUrl, BROWSER_HEADERS, ScraperResult } from './fetch-helper';

// ============================================================================
// CONSTANTS & HELPERS
// ============================================================================

/** Validate Facebook media URL */
const isValidFbMedia = (url: string) => 
    url?.length > 30 && /fbcdn|scontent/.test(url) && !/<|>/.test(url);

/** 
 * Skip patterns for non-content images
 * - bd9a62: comment images
 * - 23dd7b: stickers/emoji
 * - 50ce42: suggested content thumbnails
 * - 9a7156: profile pictures
 * - 1d2534, e99d92, a6c039, 72b077, ba09c1: various UI elements
 * - f4d7c3, 0f7a8c, 3c5e9a: suggested/related posts
 * - d41d8c: feed suggestions
 */
const SKIP_IMAGE_SIDS = [
    'bd9a62', '23dd7b', '50ce42', '9a7156', 
    '1d2534', 'e99d92', 'a6c039', '72b077', 'ba09c1',
    'f4d7c3', '0f7a8c', '3c5e9a', 'd41d8c'
];

const isSkipImage = (url: string) => {
    // Skip by _nc_sid patterns
    for (const sid of SKIP_IMAGE_SIDS) {
        if (url.includes(`_nc_sid=${sid}`)) return true;
    }
    // Skip by URL patterns
    return /emoji|sticker|static|rsrc|profile|avatar|\/cp0\/|\/[ps]\d+x\d+\/|_s\d+x\d+|stp=(?:cp0_)?dst-(?:jpg|png)_p\d+x\d+|\.webp\?/i.test(url);
};

/** Get quality label from height */
const getQualityLabel = (h: number) => 
    h >= 2160 ? '4K 2160p' : h >= 1440 ? '2K 1440p' : h >= 1080 ? 'FHD 1080p' : 
    h >= 720 ? 'HD 720p' : h >= 540 ? 'SD 540p' : h >= 480 ? 'SD 480p' : `${h}p`;

/** Get numeric resolution from quality string for sorting */
const getResolutionValue = (quality: string): number => {
    const match = quality.match(/(\d{3,4})p?/i);
    if (match) return parseInt(match[1]);
    if (/4k|2160/i.test(quality)) return 2160;
    if (/2k|1440/i.test(quality)) return 1440;
    if (/fhd|1080/i.test(quality)) return 1080;
    if (/hd|720/i.test(quality)) return 720;
    if (/540/i.test(quality)) return 540;
    if (/sd|480/i.test(quality)) return 480;
    if (/360/i.test(quality)) return 360;
    return 0;
};

/** Deduplicate and sort formats by resolution (highest first) */
function dedupeAndSortFormats(formats: MediaFormat[]): MediaFormat[] {
    // Separate by type
    const videos = formats.filter(f => f.type === 'video');
    const images = formats.filter(f => f.type === 'image');
    const others = formats.filter(f => f.type !== 'video' && f.type !== 'image');
    
    // Dedupe videos by URL
    const seenUrls = new Set<string>();
    let uniqueVideos = videos.filter(v => {
        if (seenUrls.has(v.url)) return false;
        seenUrls.add(v.url);
        return true;
    });
    
    // For stories: group by itemId and keep only highest quality per story
    const storyVideos = uniqueVideos.filter(v => v.itemId?.startsWith('story-'));
    const nonStoryVideos = uniqueVideos.filter(v => !v.itemId?.startsWith('story-'));
    
    if (storyVideos.length > 0) {
        // Group by story number (extract from itemId like "story-1", "story-2")
        const storyGroups = new Map<string, MediaFormat[]>();
        storyVideos.forEach(v => {
            // Extract story number from quality like "Story 1 HD" or itemId
            const numMatch = v.quality.match(/Story\s*(\d+)/i) || v.itemId?.match(/story-(\d+)/);
            const key = numMatch ? `story-${numMatch[1]}` : v.itemId || 'story-unknown';
            if (!storyGroups.has(key)) storyGroups.set(key, []);
            storyGroups.get(key)!.push(v);
        });
        
        // Keep only highest quality per story
        const bestStories: MediaFormat[] = [];
        storyGroups.forEach((group, key) => {
            group.sort((a, b) => getResolutionValue(b.quality) - getResolutionValue(a.quality));
            const best = group[0];
            // Rename quality to just "Story N"
            const numMatch = key.match(/story-(\d+)/);
            if (numMatch) {
                best.quality = `Story ${numMatch[1]}`;
                best.itemId = `story-${numMatch[1]}`;
            }
            bestStories.push(best);
        });
        
        // Sort stories by number
        bestStories.sort((a, b) => {
            const aNum = parseInt(a.itemId?.match(/\d+/)?.[0] || '0');
            const bNum = parseInt(b.itemId?.match(/\d+/)?.[0] || '0');
            return aNum - bNum;
        });
        
        uniqueVideos = [...nonStoryVideos, ...bestStories];
    }
    
    // Sort non-story videos by resolution (highest first)
    nonStoryVideos.sort((a, b) => getResolutionValue(b.quality) - getResolutionValue(a.quality));
    
    // Return: non-story videos first (sorted by res), then stories (sorted by number), then images
    return [...nonStoryVideos, ...uniqueVideos.filter(v => v.itemId?.startsWith('story-')), ...images, ...others];
}

/** Extract unique image ID from URL */
const getImageId = (url: string): string | null => {
    // Pattern: 597516095_122153492966839573_6129536845350690653_n.jpg
    let match = url.match(/\/(\d+_\d+_\d+_[a-z])\.(?:jpg|jpeg|png|webp)/i);
    if (match) return match[1];
    // Pattern: numeric ID
    match = url.match(/\/(\d{10,}_\d+)[_.].*\.(?:jpg|jpeg|png)/i);
    if (match) return match[1];
    // Pattern: oh parameter
    match = url.match(/[?&]oh=([^&]+)/);
    return match ? match[1] : null;
};

// ============================================================================
// CONTENT TYPE DETECTION
// ============================================================================

type ContentType = 'post' | 'video' | 'reel' | 'story' | 'unknown';

const detectContentType = (url: string): ContentType => {
    if (/\/stories\//.test(url)) return 'story';
    if (/\/reel\/|\/share\/r\//.test(url)) return 'reel';
    if (/\/videos?\/|\/watch\/|\/share\/v\//.test(url)) return 'video';
    if (/\/posts\/|\/photos?\/|permalink\.php|\/share\/p\//.test(url)) return 'post';
    return 'unknown';
};

const requiresCookie = (type: ContentType): boolean => type === 'story';

// ============================================================================
// URL RESOLUTION
// ============================================================================

async function resolveShareUrl(url: string, headers: HeadersInit): Promise<string> {
    console.log(`[Facebook] Resolving share URL: ${url}`);
    
    // For share URLs, just use redirect:follow - it's more reliable
    // The final URL will be the actual post URL
    try {
        const res = await fetch(url, { headers, redirect: 'follow' });
        const finalUrl = res.url;
        console.log(`[Facebook] Resolved to: ${finalUrl.substring(0, 80)}...`);
        return finalUrl;
    } catch {
        return url;
    }
}

// ============================================================================
// MEDIA EXTRACTION - VIDEOS
// ============================================================================

interface ExtractedMedia {
    formats: MediaFormat[];
    seenUrls: Set<string>;
}

/** Extract video thumbnail from HTML */
function extractVideoThumbnail(html: string): string | undefined {
    const patterns = [
        /"previewImage":\{"uri":"(https:[^"]+)"/,
        /"preferred_thumbnail":\{"image":\{"uri":"(https:[^"]+)"/,
        /"thumbnailImage":\{"uri":"(https:[^"]+)"/,
        /"poster_image":\{"uri":"(https:[^"]+)"/,
        /property="og:image"\s+content="(https:[^"]+)"/,
    ];
    
    for (const re of patterns) {
        const m = html.match(re);
        if (m) {
            const url = m[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&');
            if (isValidFbMedia(url)) return url;
        }
    }
    return undefined;
}

function extractVideos(decoded: string, seenUrls: Set<string>, thumbnail?: string): MediaFormat[] {
    const formats: MediaFormat[] = [];
    const foundQualities = new Set<string>();
    
    const add = (quality: string, url: string) => {
        if (!isValidFbMedia(url) || seenUrls.has(url) || foundQualities.has(quality)) return;
        seenUrls.add(url);
        foundQualities.add(quality);
        formats.push({ quality, type: 'video', url, format: 'mp4', itemId: 'video-main', thumbnail });
    };
    
    // Standard video patterns
    const patterns = [
        { re: /"playable_url_quality_hd":"([^"]+)"/g, q: 'HD' },
        { re: /"hd_src":"([^"]+)"/g, q: 'HD' },
        { re: /"hd_src_no_ratelimit":"([^"]+)"/g, q: 'HD' },
        { re: /"playable_url":"([^"]+)"/g, q: 'SD' },
        { re: /"sd_src":"([^"]+)"/g, q: 'SD' },
        { re: /"sd_src_no_ratelimit":"([^"]+)"/g, q: 'SD' },
        { re: /"browser_native_hd_url":"([^"]+)"/g, q: 'HD' },
        { re: /"browser_native_sd_url":"([^"]+)"/g, q: 'SD' },
    ];
    
    for (const { re, q } of patterns) {
        let m;
        while ((m = re.exec(decoded)) !== null) {
            const url = decodeUrl(m[1]);
            if (url.includes('.mp4')) add(q, url);
        }
    }
    
    // DASH manifest
    const dashRe = /"height":(\d+)[^}]*?"base_url":"(https:[^"]+\.mp4[^"]*)"/g;
    let dm;
    while ((dm = dashRe.exec(decoded)) !== null) {
        const h = parseInt(dm[1]);
        if (h >= 360) add(getQualityLabel(h), decodeUrl(dm[2]));
    }
    
    return formats;
}

function extractProgressiveVideos(decoded: string, seenUrls: Set<string>, thumbnail?: string): MediaFormat[] {
    const formats: MediaFormat[] = [];
    const foundQualities = new Set<string>();
    const progressiveRe = /"progressive_url":"(https:[^"]+\.mp4[^"]*)"/g;
    let m;
    
    while ((m = progressiveRe.exec(decoded)) !== null) {
        const url = decodeUrl(m[1]);
        if (!seenUrls.has(url)) {
            seenUrls.add(url);
            const isHD = /720|1080|_hd|tag=.*720p|1080p/i.test(url);
            const quality = isHD ? 'HD 720p' : 'SD 360p';
            // Skip if we already have this quality
            if (foundQualities.has(quality)) continue;
            foundQualities.add(quality);
            formats.push({
                quality,
                type: 'video',
                url,
                format: 'mp4',
                itemId: 'video-main',
                thumbnail
            });
        }
    }
    
    return formats;
}

// ============================================================================
// MEDIA EXTRACTION - STORIES
// ============================================================================

function extractStoryMedia(html: string, decoded: string, seenUrls: Set<string>): MediaFormat[] {
    const formats: MediaFormat[] = [];
    
    // Extract thumbnails first
    const thumbnails: string[] = [];
    const thumbPatterns = [
        /"previewImage":\{"uri":"(https:[^"]+)"/g,
        /"story_thumbnail":\{"uri":"(https:[^"]+)"/g,
        /"poster_image":\{"uri":"(https:[^"]+)"/g,
    ];
    
    for (const re of thumbPatterns) {
        let m;
        while ((m = re.exec(decoded)) !== null) {
            const url = decodeUrl(m[1]);
            if (isValidFbMedia(url) && !/emoji|sticker|rsrc|profile|avatar/i.test(url)) {
                if (!thumbnails.includes(url)) thumbnails.push(url);
            }
        }
        if (thumbnails.length > 0) break;
    }
    
    // Extract story videos - group SD/HD pairs
    const storyVideoRe = /"progressive_url":"(https:[^"]+\.mp4[^"]*)","failure_reason":null,"metadata":\{"quality":"(HD|SD)"\}/g;
    let m;
    
    // Collect all videos with their quality
    const storyVideos: { url: string; quality: string; isHD: boolean }[] = [];
    while ((m = storyVideoRe.exec(decoded)) !== null) {
        const url = decodeUrl(m[1]);
        if (!seenUrls.has(url)) {
            seenUrls.add(url);
            storyVideos.push({ url, quality: m[2], isHD: m[2] === 'HD' });
        }
    }
    
    // Group by pairs (SD followed by HD, or vice versa) - Facebook returns them in order
    // Each story has 2 versions: SD and HD. We keep only HD (or SD if no HD)
    const storyCount = Math.ceil(storyVideos.length / 2);
    for (let i = 0; i < storyCount; i++) {
        const pair = storyVideos.slice(i * 2, i * 2 + 2);
        // Prefer HD
        const best = pair.find(v => v.isHD) || pair[0];
        if (best) {
            formats.push({
                quality: `Story ${i + 1}`,
                type: 'video',
                url: best.url,
                format: 'mp4',
                itemId: `story-${i + 1}`,
                thumbnail: thumbnails[i]
            });
        }
    }
    
    // Extract story images (t51.82787 pattern)
    const storyImageRe = /https:\/\/scontent[^"'\s<>]+?\.jpg[^"'\s<>]*/gi;
    const storyImages: string[] = [];
    
    while ((m = storyImageRe.exec(html)) !== null) {
        const url = m[0].replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
        const isHighRes = /s(1080|2048|1440)x|_n\.jpg/.test(url);
        const isThumb = /s\d{2,3}x\d{2,3}|fb\d+_s\d+x\d+/.test(url);
        
        if (/t51\.82787/.test(url) && isHighRes && !isThumb && !seenUrls.has(url)) {
            if (!storyImages.includes(url)) storyImages.push(url);
        }
    }
    
    storyImages.forEach((url, i) => {
        seenUrls.add(url);
        formats.push({
            quality: `Story Image ${i + 1}`,
            type: 'image',
            url,
            format: 'jpg',
            itemId: `story-img-${i + 1}`,
            thumbnail: url
        });
    });
    
    if (storyImages.length > 0) {
        console.log(`[Facebook] Found ${storyImages.length} story image(s)`);
    }
    
    return formats;
}

// ============================================================================
// MEDIA EXTRACTION - POST IMAGES
// ============================================================================

/** Extract post ID from various URL formats */
function extractPostId(url: string): string | null {
    // Share URL: /share/p/1BbCMHGHMG
    let match = url.match(/\/share\/p\/([A-Za-z0-9]+)/);
    if (match) return match[1];
    
    // Permalink: story_fbid=123456789
    match = url.match(/story_fbid=(\d+)/);
    if (match) return match[1];
    
    // Photo URL: /photo/?fbid=123456789 or /photos/123456789
    match = url.match(/(?:fbid=|\/photos?\/)(\d+)/);
    if (match) return match[1];
    
    // Posts URL: /posts/pfbid...
    match = url.match(/\/posts\/(pfbid[A-Za-z0-9]+)/);
    if (match) return match[1];
    
    return null;
}

/** Find the content block that contains the target post by ID */
function findPostContentBlock(html: string, postId: string | null): string | null {
    if (!postId) return null;
    
    // Find position of post ID in HTML
    const idPos = html.indexOf(postId);
    if (idPos === -1) return null;
    
    console.log(`[Facebook] Found post ID "${postId}" at position ${idPos}`);
    
    // Strategy: Find the JSON object that contains this post ID
    // Look for markers like "comet_sections", "attachments", "media" near the post ID
    
    // Search backwards for opening markers
    let searchStart = idPos;
    const markers = ['"comet_sections"', '"attachments"', '"story":{', '"node":{'];
    
    for (let i = idPos; i > Math.max(0, idPos - 50000); i--) {
        const chunk = html.substring(i, i + 20);
        for (const marker of markers) {
            if (chunk.startsWith(marker.substring(0, 15))) {
                searchStart = i;
                break;
            }
        }
        // Also stop at clear boundaries
        if (html.substring(i, i + 30).includes('"creation_story"')) {
            searchStart = i;
            break;
        }
    }
    
    // Search forward for closing - look for next post boundary or end markers
    let searchEnd = Math.min(html.length, idPos + 80000);
    const endMarkers = ['"related_content"', '"sponsored_data"', '"feed_unit"', '"page_info"'];
    
    for (let i = idPos + 1000; i < Math.min(html.length, idPos + 100000); i++) {
        const chunk = html.substring(i, i + 20);
        for (const marker of endMarkers) {
            if (chunk.includes(marker.substring(1, 15))) {
                searchEnd = i;
                break;
            }
        }
        if (searchEnd !== Math.min(html.length, idPos + 80000)) break;
    }
    
    console.log(`[Facebook] Post block: ${searchStart} to ${searchEnd} (${searchEnd - searchStart} bytes)`);
    
    return html.substring(searchStart, searchEnd);
}

function extractPostImages(html: string, decoded: string, seenUrls: Set<string>, fetchUrl: string, meta: { title?: string }): MediaFormat[] {
    const formats: MediaFormat[] = [];
    const seenIds = new Set<string>();
    let imgIdx = 0;
    
    const add = (url: string) => {
        const imgId = getImageId(url);
        if (isSkipImage(url) || (imgId && seenIds.has(imgId))) return false;
        if (imgId) seenIds.add(imgId);
        seenUrls.add(url);
        formats.push({
            quality: `Image ${++imgIdx}`,
            type: 'image',
            url,
            format: 'jpg',
            itemId: `img-${imgIdx}`,
            thumbnail: url
        });
        return true;
    };
    
    // Extract post ID from URL for targeted extraction
    const postId = extractPostId(fetchUrl);
    
    // For group posts: find group media set (gm.{id}) for accurate extraction
    // This links photos directly to the specific post, filtering out feed noise
    const gmMatch = decoded.match(/set=gm\.(\d+)/);
    let targetArea = decoded;
    let hasGroupMediaSet = false;
    let postBlock: string | null = null;
    
    if (gmMatch) {
        const gmSetId = gmMatch[1];
        const gmPos = decoded.indexOf(`gm.${gmSetId}`);
        if (gmPos > -1) {
            // Search 50KB before and 50KB after the gm reference
            const start = Math.max(0, gmPos - 50000);
            const end = Math.min(decoded.length, gmPos + 50000);
            targetArea = decoded.substring(start, end);
            hasGroupMediaSet = true;
            console.log(`[Facebook] Group media set gm.${gmSetId} found, using ${end - start} bytes context`);
        }
    }
    
    if (!hasGroupMediaSet) {
        // Fallback to post block method
        postBlock = findPostContentBlock(decoded, postId);
        if (postBlock) {
            targetArea = postBlock;
            console.log(`[Facebook] Using post-specific block for image extraction`);
        } else {
            console.log(`[Facebook] Using full HTML for image extraction`);
        }
    }
    
    // Method 1: viewer_image JSON pattern (most reliable for posts)
    // Format: "viewer_image":{"height":2048,"width":1365,"uri":"https:\/\/scontent..."}
    // Search in targetArea (group media context or post block) for accuracy
    const viewerRe = /"viewer_image":\{"height":\d+,"width":\d+,"uri":"(https:[^"]+)"/g;
    let m;
    while ((m = viewerRe.exec(targetArea)) !== null) {
        const url = m[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&');
        if (/t39\.30808|t51\.82787/.test(url) && !isSkipImage(url)) {
            add(url);
        }
    }
    if (imgIdx > 0) {
        console.log(`[Facebook] viewer_image method: ${imgIdx} image(s)`);
        return formats;
    }
    
    // Method 1b: story.php image extraction (for share URLs that redirect to story.php)
    // Pattern: "image":{"height":1080,"width":1080,"uri":"https:\/\/scontent..."}
    const storyImageRe = /"image":\{"height":\d+,"width":\d+,"uri":"(https:[^"]+)"/g;
    while ((m = storyImageRe.exec(targetArea)) !== null) {
        const url = m[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&');
        if (/scontent/.test(url) && !isSkipImage(url)) {
            add(url);
        }
    }
    if (imgIdx > 0) {
        console.log(`[Facebook] story.php image method: ${imgIdx} image(s)`);
        return formats;
    }
    
    // Method 2: Preload links with _nc_sid=127cfc (album/post images)
    // Only use this on full HTML since preload links are in <head>
    const preloadRe = /<link[^>]+rel="preload"[^>]+href="(https:\/\/scontent[^"]+_nc_sid=127cfc[^"]+)"/gi;
    while ((m = preloadRe.exec(html)) !== null) {
        add(m[1].replace(/&amp;/g, '&'));
    }
    if (imgIdx > 0) {
        console.log(`[Facebook] Preload 127cfc method: ${imgIdx} image(s)`);
        return formats;
    }
    
    // Method 3: Context-based using post ID anchor
    if (postBlock) {
        const imgRe = /https:\/\/scontent[^"'\s<>\\]+\.(?:jpg|jpeg)[^"'\s<>\\]*/gi;
        
        while ((m = imgRe.exec(postBlock)) !== null) {
            const url = decodeUrl(m[0]);
            // Must be post image type AND not thumbnail/small size
            if (/t51\.82787|t39\.30808/.test(url) && 
                !/\/[ps]\d{2,3}x\d{2,3}\/|_s\d+x\d+/.test(url) &&
                !isSkipImage(url)) {
                add(url);
            }
        }
        if (imgIdx > 0) {
            console.log(`[Facebook] Post-block context method: ${imgIdx} image(s)`);
            return formats;
        }
    }
    
    // Method 4: Legacy anchor-based (fallback if no post ID)
    const anchor = findPostAnchor(decoded, fetchUrl, meta);
    if (anchor.pos > -1 && !postBlock) {
        console.log(`[Facebook] Anchor: ${anchor.type} at pos ${anchor.pos}`);
        const postArea = decoded.substring(anchor.pos, Math.min(anchor.pos + 15000, decoded.length));
        const imgRe = /https:\/\/scontent[^"'\s<>\\]+\.(?:jpg|jpeg)[^"'\s<>\\]*/gi;
        
        while ((m = imgRe.exec(postArea)) !== null) {
            const url = decodeUrl(m[0]);
            if (/t51\.82787|t39\.30808/.test(url) && 
                !/\/[ps]\d{2,3}x\d{2,3}\/|_s\d+x\d+/.test(url) &&
                !isSkipImage(url)) {
                add(url);
            }
        }
        if (imgIdx > 0) {
            console.log(`[Facebook] Legacy anchor method: ${imgIdx} image(s)`);
            return formats;
        }
    }
    
    // Method 5: photo_image/full_width_image JSON patterns (use targetArea)
    const jsonPatterns = [
        /"photo_image":\{"uri":"(https:[^"]+)"/g,
        /"full_width_image":\{"uri":"(https:[^"]+)"/g,
    ];
    
    for (const re of jsonPatterns) {
        while ((m = re.exec(targetArea)) !== null) {
            const url = m[1].replace(/\\\//g, '/').replace(/\\u0026/g, '&');
            if (!/\/[ps]\d{2,3}x\d{2,3}\/|_s\d+x\d+|\/cp0\//.test(url) && !isSkipImage(url)) {
                add(url);
            }
        }
    }
    if (imgIdx > 0) {
        console.log(`[Facebook] JSON pattern method: ${imgIdx} image(s)`);
        return formats;
    }
    
    // Method 6: img tags with media-vc-image (last resort, full HTML)
    const imgTagRe = /<img[^>]+data-visualcompletion="media-vc-image"[^>]+src="(https:\/\/scontent[^"]+)"/gi;
    while ((m = imgTagRe.exec(html)) !== null) {
        add(m[1].replace(/&amp;/g, '&'));
    }
    if (imgIdx > 0) {
        console.log(`[Facebook] media-vc-image method: ${imgIdx} image(s)`);
    }
    
    // Clean URLs - remove size constraints
    formats.forEach(f => {
        if (f.type === 'image') {
            f.url = f.url.replace(/\/[ps]\d+x\d+\//, '/').replace(/&w=\d+/, '').replace(/&h=\d+/, '');
        }
    });
    
    return formats;
}

function findPostAnchor(decoded: string, fetchUrl: string, meta: { title?: string }): { type: string; pos: number } {
    // Try story_fbid from URL
    const storyMatch = fetchUrl.match(/story_fbid=([^&]+)/);
    if (storyMatch) {
        const pos = decoded.indexOf(storyMatch[1]);
        if (pos > -1) return { type: 'story_fbid', pos };
    }
    
    // Try title
    const title = meta.title?.substring(0, 20);
    if (title) {
        const pos = decoded.indexOf(title);
        if (pos > -1) return { type: 'title', pos };
    }
    
    // Try author from URL
    const authorMatch = fetchUrl.match(/facebook\.com\/([^/?]+)/);
    if (authorMatch && !['share', 'watch', 'reel', 'www', 'web'].includes(authorMatch[1])) {
        const pos = decoded.indexOf(authorMatch[1]);
        if (pos > -1) return { type: 'author', pos };
    }
    
    return { type: 'none', pos: -1 };
}

// ============================================================================
// MAIN SCRAPER
// ============================================================================

export async function scrapeFacebook(inputUrl: string, cookie?: string): Promise<ScraperResult> {
    // Check cache
    const cached = getCache<ScraperResult>(inputUrl);
    if (cached?.success) return cached;
    
    if (!matchesPlatform(inputUrl, 'facebook')) {
        return { success: false, error: 'Invalid Facebook URL' };
    }

    let fetchUrl = normalizeUrl(inputUrl, 'facebook');
    const contentType = detectContentType(fetchUrl);
    
    // Parse cookie - handle string or object/array
    let parsedCookie: string | undefined;
    if (typeof cookie === 'string') {
        parsedCookie = cookie;
        // If JSON string, parse it
        if (cookie.trim().startsWith('[')) {
            try {
                const arr = JSON.parse(cookie);
                if (Array.isArray(arr)) {
                    parsedCookie = arr
                        .filter((c: { name?: string; value?: string }) => c.name && c.value)
                        .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
                        .join('; ');
                }
            } catch { /* keep original string */ }
        }
    } else if (cookie && typeof cookie === 'object') {
        // Direct array or object (from JSON body parsing)
        const arr = Array.isArray(cookie) ? cookie : [cookie];
        parsedCookie = arr
            .filter((c: { name?: string; value?: string }) => c && c.name && c.value)
            .map((c: { name: string; value: string }) => `${c.name}=${c.value}`)
            .join('; ');
    }
    
    console.log(`[Facebook] URL: ${inputUrl}`);
    console.log(`[Facebook] Type: ${contentType}, Cookie: ${parsedCookie ? `Yes (${parsedCookie.length} chars)` : 'No'}`);

    // Stories require cookie
    if (requiresCookie(contentType) && !parsedCookie) {
        return { success: false, error: 'Facebook Stories require login. Please add your cookie in Settings.' };
    }

    try {
        const headers = parsedCookie ? { ...BROWSER_HEADERS, 'Cookie': parsedCookie } : BROWSER_HEADERS;
        
        // For share URLs, don't pre-resolve - let fetch handle redirect
        // This matches the test API behavior which works better
        
        // Resolve short URLs
        if (/fb\.watch|fb\.me|l\.facebook/.test(fetchUrl)) {
            fetchUrl = cleanTrackingParams(normalizeUrl(await resolveUrl(fetchUrl, 8000), 'facebook'));
        }
        
        // Stories work better with www.facebook.com (web.facebook.com redirects to login)
        const isStory = /\/stories\//.test(fetchUrl);
        if (isStory) {
            fetchUrl = fetchUrl.replace('web.facebook.com', 'www.facebook.com');
        }

        // Check if this is a group post (needs special handling)
        const isGroupPost = /\/groups\/|\/share\/p\//.test(fetchUrl);
        
        let response: Response;
        let html: string;
        
        if (isGroupPost && cookie) {
            // Group posts: 2-step fetch with delay (matches test script behavior)
            // Step 1: Resolve URL
            console.log(`[Facebook] Group post: resolving URL...`);
            const res1 = await fetch(fetchUrl, { headers, redirect: 'follow' });
            const resolvedUrl = res1.url;
            await res1.text(); // consume body
            console.log(`[Facebook] Resolved: ${resolvedUrl.substring(0, 70)}...`);
            
            // Step 2: Wait 3s then fetch full content (Facebook needs time to prepare)
            console.log(`[Facebook] Waiting 3s for Facebook...`);
            await new Promise(r => setTimeout(r, 3000));
            
            // Fetch with same headers - don't change domain
            console.log(`[Facebook] Fetching full content...`);
            response = await fetch(resolvedUrl, { headers, redirect: 'follow' });
            html = await response.text();
        } else {
            // Normal fetch
            console.log(`[Facebook] Fetching: ${fetchUrl.substring(0, 80)}...`);
            response = await fetch(fetchUrl, { headers, redirect: 'follow' });
            html = await response.text();
        }
        
        console.log(`[Facebook] Response: ${html.length} bytes, final URL: ${response.url.substring(0, 60)}...`);

        // Validate response
        if (html.length < 1000) {
            return { success: false, error: 'Facebook returned error page' };
        }
        
        // Check login requirement
        const needsLogin = (html.includes('login_form') || html.includes('Log in to Facebook')) 
            && !html.includes('"actorID":"') && html.length < 50000;
        if (needsLogin) {
            return { success: false, error: 'This content requires login. Please provide a cookie.' };
        }

        // Parse HTML
        const decoded = decodeHtml(html);
        const meta = extractMeta(html);
        const seenUrls = new Set<string>();
        let formats: MediaFormat[] = [];

        // Extract media based on content type
        const actualType = detectContentType(response.url);
        const isVideoContent = actualType === 'video' || actualType === 'reel';
        const isPostContent = actualType === 'post' || actualType === 'unknown';
        const isStoryContent = actualType === 'story';

        // Extract video thumbnail for video content
        const videoThumbnail = isVideoContent ? extractVideoThumbnail(html) : undefined;

        console.log(`[Facebook] Content type: ${actualType}, Video: ${isVideoContent}, Post: ${isPostContent}`);

        // 1. Stories (always extract from full page)
        if (isStory || isStoryContent) {
            formats.push(...extractStoryMedia(html, decoded, seenUrls));
        }
        
        // 2. Videos - extract from full page (simpler, more reliable)
        if (!isStory && !isStoryContent) {
            formats.push(...extractVideos(decoded, seenUrls, videoThumbnail));
            
            // Progressive videos fallback
            if (formats.filter(f => f.type === 'video').length === 0) {
                formats.push(...extractProgressiveVideos(decoded, seenUrls, videoThumbnail));
            }
        }
        
        // 3. Images - extract from full page
        if (!isStory && !isStoryContent && (isPostContent || formats.length === 0)) {
            formats.push(...extractPostImages(html, decoded, seenUrls, inputUrl, meta));
        }

        if (formats.length === 0) {
            return { success: false, error: 'No media found. Post may be private.' };
        }

        // Dedupe and sort formats
        formats = dedupeAndSortFormats(formats);

        // Extract metadata
        const author = extractAuthor(decoded, fetchUrl);
        const description = extractDescription(decoded);
        const postedAt = extractPostDate(decoded);
        let title = decodeHtml(meta.title || 'Facebook Post');
        title = title.replace(/^[\d.]+K?\s*views\s*·\s*[\d.]+K?\s*reactions?\s*\|\s*/i, '').trim();
        if (title.length > 100) title = title.substring(0, 100) + '...';
        
        // Use description as title if title is generic
        if ((title === 'Facebook' || title === 'Facebook Post') && description) {
            title = description.length > 80 ? description.substring(0, 80) + '...' : description;
        }

        const result: ScraperResult = {
            success: true,
            data: {
                title,
                thumbnail: meta.thumbnail || formats.find(f => f.thumbnail)?.thumbnail || '',
                author,
                description,
                duration: postedAt, // Store post date in duration field
                formats,
                url: inputUrl
            }
        };
        
        setCache(inputUrl, result);
        return result;
        
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Failed to fetch' };
    }
}

function extractDescription(decoded: string): string {
    // Try multiple patterns for caption/description
    const patterns = [
        // Reel/Video message text (most common for reels)
        /"message":\{"text":"([^"]+)"/,
        // Story/Post text
        /"story":\{[^}]*"message":\{"text":"([^"]+)"/,
        // Post message
        /"post":\{[^}]*"message":\{"text":"([^"]+)"/,
        // Content text
        /"content":\{"text":"([^"]+)"/,
        // Caption
        /"caption":"([^"]+)"/,
    ];
    
    for (const re of patterns) {
        const match = decoded.match(re);
        if (match?.[1]) {
            // Decode unicode escapes and clean up
            let desc = match[1]
                .replace(/\\n/g, '\n')
                .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
                .trim();
            // Skip if it's just "Public" or other generic text
            if (desc && desc !== 'Public' && desc.length > 2) {
                return desc;
            }
        }
    }
    
    return '';
}

function extractPostDate(decoded: string): string | undefined {
    // Try multiple patterns for post date (unix timestamp)
    const patterns = [
        /"creation_time":(\d{10})/,
        /"created_time":(\d{10})/,
        /"publish_time":(\d{10})/,
    ];
    
    for (const re of patterns) {
        const match = decoded.match(re);
        if (match?.[1]) {
            const ts = parseInt(match[1]);
            const date = new Date(ts * 1000);
            // Return ISO string
            return date.toISOString();
        }
    }
    
    return undefined;
}

function extractAuthor(decoded: string, fetchUrl: string): string {
    // From HTML - try multiple patterns (order matters: most specific first)
    const patterns = [
        // Reel/Video owner with enable_reels_tab
        /"name":"([^"]+)","enable_reels_tab_deeplink":true/,
        // Video owner in duration context
        /duration_in_ms":\d+,"owner":\{"__typename":"User"[^}]*"name":"([^"]+)"/,
        // Story owner
        /"story_bucket_owner":\{"__typename":"User"[^}]*"name":"([^"]+)"/,
        // Standard patterns
        /"owning_profile":\{"__typename":"User","name":"([^"]+)"/,
        /"owning_profile":\{"__typename":"Page","name":"([^"]+)"/,
        /"owner":\{"__typename":"User"[^}]*"name":"([^"]+)"/,
        /"owner":\{"__typename":"Page"[^}]*"name":"([^"]+)"/,
        /"actors":\[\{"__typename":"User","name":"([^"]+)"/,
    ];
    
    for (const re of patterns) {
        const match = decoded.match(re);
        if (match?.[1] && match[1] !== 'Facebook') {
            return match[1];
        }
    }
    
    // From URL (fallback)
    const urlMatch = fetchUrl.match(/facebook\.com\/([^/?]+)/);
    if (urlMatch && !['watch', 'reel', 'share', 'groups', 'www', 'web', 'stories', 'permalink.php'].includes(urlMatch[1])) {
        return urlMatch[1];
    }
    
    return 'Facebook';
}
