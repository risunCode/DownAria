/**
 * Facebook Scraper Service
 * =========================
 * 
 * PUBLIC (No Cookie): /videos/, /watch/, /reel/, /share/r/, /posts/, /photos/, /share/p/
 * PRIVATE (Cookie Required): /groups/, /stories/, private posts
 * 
 * Cookie Format: JSON array (Cookie Editor) or string (name=value;)
 * Required Cookies: c_user, xs
 * 
 * KNOWN LIMITATION - LARGE CAROUSELS:
 * Facebook lazy-loads carousel images via JavaScript. Initial HTML only contains
 * the first ~5 images with their photo fbids. Remaining images are loaded dynamically
 * when user scrolls. Without a headless browser, we cannot extract all images from
 * carousels with >5 photos. This is a fundamental limitation of HTML scraping.
 */

import { MediaFormat } from '@/lib/types';
import { decodeHtml, extractMeta, normalizeUrl, cleanTrackingParams, decodeUrl } from '@/lib/utils/http';
import { parseCookie } from '@/lib/utils/cookie-parser';
import { matchesPlatform } from './api-config';
import { resolveUrl, BROWSER_HEADERS, ScraperResult, ScraperOptions, EngagementStats } from './fetch-helper';
import { getCache, setCache } from './cache';
import { createError, ScraperErrorCode } from './errors';
import { logger } from './logger';

// ============================================================================
// HELPERS
// ============================================================================

const isValidMedia = (url: string) => url?.length > 30 && /fbcdn|scontent/.test(url) && !/<|>/.test(url);

const SKIP_SIDS = ['bd9a62', '23dd7b', '50ce42', '9a7156', '1d2534', 'e99d92', 'a6c039', '72b077', 'ba09c1', 'f4d7c3', '0f7a8c', '3c5e9a', 'd41d8c'];

const isSkipImage = (url: string) => {
    if (SKIP_SIDS.some(sid => url.includes(`_nc_sid=${sid}`))) return true;
    return /emoji|sticker|static|rsrc|profile|avatar|\/cp0\/|\/[ps]\d+x\d+\/|_s\d+x\d+|\.webp\?/i.test(url);
};

const getQuality = (h: number) => 
    h >= 1080 ? 'HD 1080p' : h >= 720 ? 'HD 720p' : h >= 480 ? 'SD 480p' : `${h}p`;

const getResValue = (q: string): number => {
    const m = q.match(/(\d{3,4})/);
    return m ? parseInt(m[1]) : 0;
};

const normalizePath = (url: string): string => {
    try { return new URL(url).pathname.split('?')[0]; } 
    catch { return url.split('?')[0]; }
};

const clean = (s: string) => s.replace(/\\\//g, '/').replace(/\\u0026/g, '&').replace(/&amp;/g, '&');

type ContentType = 'post' | 'video' | 'reel' | 'story' | 'group' | 'unknown';

const detectType = (url: string): ContentType => {
    if (/\/stories\//.test(url)) return 'story';
    if (/\/groups\//.test(url)) return 'group';
    if (/\/reel\/|\/share\/r\//.test(url)) return 'reel';
    if (/\/videos?\/|\/watch\/|\/share\/v\//.test(url)) return 'video';
    if (/\/posts\/|\/photos?\/|permalink|\/share\/p\//.test(url)) return 'post';
    return 'unknown';
};

/**
 * Detect if URL ALWAYS requires cookie for access
 * Only return true for content that will NEVER work without cookie
 */
const requiresCookie = (url: string): boolean => {
    // Stories ALWAYS require cookie - no exception
    if (/\/stories\//.test(url)) return true;
    
    // Everything else (groups, posts, etc) - try without cookie first
    // Groups can be public or private, so don't fail fast
    return false;
};

// ============================================================================
// VIDEO EXTRACTION
// ============================================================================

/**
 * Extract video ID from Facebook URL
 * /reel/1234567890 -> 1234567890
 * /videos/1234567890 -> 1234567890
 */
function extractVideoId(url: string): string | null {
    const m = url.match(/\/(?:reel|videos?)\/(\d+)/);
    return m ? m[1] : null;
}

/**
 * Extract post identifier from Facebook URL
 * Returns pfbid, numeric post ID, or story_fbid
 */
function extractPostId(url: string): string | null {
    // pfbid format (new): /posts/pfbid02L3aX5...
    const pfbidMatch = url.match(/\/posts\/(pfbid[a-zA-Z0-9]+)/);
    if (pfbidMatch) return pfbidMatch[1];
    
    // Numeric post ID: /posts/1234567890
    const numericMatch = url.match(/\/posts\/(\d+)/);
    if (numericMatch) return numericMatch[1];
    
    // story_fbid param
    const storyMatch = url.match(/story_fbid=(\d+)/);
    if (storyMatch) return storyMatch[1];
    
    // photo fbid
    const photoMatch = url.match(/\/photos?\/[^/]+\/(\d+)/);
    if (photoMatch) return photoMatch[1];
    
    // share/p/ short code (will be in HTML as identifier)
    const shareMatch = url.match(/\/share\/p\/([a-zA-Z0-9]+)/);
    if (shareMatch) return shareMatch[1];
    
    return null;
}

/**
 * Find the JSON block containing the target post
 * Facebook HTML contains multiple post blocks (related, sidebar, etc)
 * We need to find the one that matches our target post
 */
function findTargetPostBlock(html: string, postId: string): string {
    // Try multiple patterns to find the post block
    const patterns = [
        // pfbid in URL patterns
        new RegExp(`/posts/${postId}`, 'g'),
        new RegExp(`"post_id":"[^"]*${postId.substring(0, 20)}`, 'g'),
        // For pfbid, also search for the encoded version in JSON
        new RegExp(`pfbid[^"]*${postId.substring(5, 15)}`, 'g'),
        // Numeric ID patterns
        new RegExp(`"id":"${postId}"`, 'g'),
        new RegExp(`story_fbid=${postId}`, 'g'),
    ];
    
    for (const pattern of patterns) {
        const match = pattern.exec(html);
        if (match) {
            // Extract larger area: 50KB before + 100KB after for posts with many images
            const start = Math.max(0, match.index - 50000);
            const end = Math.min(html.length, match.index + 100000);
            logger.debug('facebook', `Found target post block for ID ${postId.substring(0, 20)}... at pos ${match.index}`);
            return html.substring(start, end);
        }
    }
    
    logger.debug('facebook', `Post ID ${postId.substring(0, 20)}... not found, using full HTML`);
    return html;
}

/**
 * Find the JSON block containing the target video ID
 * Facebook HTML contains multiple video blocks for related content
 * We need to find the one that matches our target reel/video
 */
function findTargetVideoBlock(html: string, videoId: string): string {
    // Try multiple patterns to find the video block
    const patterns = [
        new RegExp(`"id":"${videoId}"`, 'g'),
        new RegExp(`"video_id":"${videoId}"`, 'g'),
        new RegExp(`/reel/${videoId}`, 'g'),
        new RegExp(`/videos/${videoId}`, 'g'),
    ];
    
    for (const pattern of patterns) {
        const match = pattern.exec(html);
        if (match) {
            // Extract larger area: 5KB before + 20KB after (video URLs can be far from ID)
            const start = Math.max(0, match.index - 5000);
            const end = Math.min(html.length, match.index + 20000);
            logger.debug('facebook', `Found target video block for ID ${videoId} at pos ${match.index}`);
            return html.substring(start, end);
        }
    }
    
    logger.debug('facebook', `Video ID ${videoId} not found, using full HTML`);
    return html;
}

function extractVideos(html: string, seenUrls: Set<string>, targetVideoId?: string | null): MediaFormat[] {
    const formats: MediaFormat[] = [];
    const found = new Set<string>();
    
    // If we have a target video ID, narrow down the search area
    const searchArea = targetVideoId ? findTargetVideoBlock(html, targetVideoId) : html;
    
    // Get thumbnail - try multiple patterns for different content types
    const thumbPatterns = [
        /"(?:previewImage|thumbnailImage|poster_image)":\{"uri":"(https:[^"]+)"/,
        /"preferred_thumbnail":\{"image":\{"uri":"(https:[^"]+)"/,
        /"cover_photo":\{"photo":\{"image":\{"uri":"(https:[^"]+)"/,
        /"thumbnail_image":\{"uri":"(https:[^"]+)"/,
        /"scrubber_preview_url":"(https:[^"]+)"/,
        /"firstFrameImage":\{"uri":"(https:[^"]+)"/,
        // Reel-specific patterns
        /"story_thumbnail":\{"uri":"(https:[^"]+)"/,
        /"image":\{"uri":"(https:\/\/scontent[^"]+)"/,
    ];
    let thumbnail: string | undefined;
    // Try searchArea first, then full HTML as fallback
    for (const re of thumbPatterns) {
        const m = searchArea.match(re) || (searchArea !== html ? html.match(re) : null);
        if (m && /scontent|fbcdn/.test(m[1])) {
            thumbnail = clean(m[1]);
            break;
        }
    }
    
    const add = (quality: string, url: string): boolean => {
        if (!isValidMedia(url) || seenUrls.has(url) || found.has(quality)) return false;
        seenUrls.add(url);
        found.add(quality);
        formats.push({ quality, type: 'video', url, format: 'mp4', itemId: 'video-main', thumbnail });
        return true;
    };
    
    // HD patterns - try first, early return if found
    // Note: Facebook Reels may not have .mp4 in URL, so we accept any valid fbcdn/scontent URL
    const hdPatterns = [/"playable_url_quality_hd":"([^"]+)"/, /"hd_src(?:_no_ratelimit)?":"([^"]+)"/, /"browser_native_hd_url":"([^"]+)"/];
    for (const re of hdPatterns) {
        const m = searchArea.match(re);
        if (m) {
            const url = decodeUrl(m[1]);
            // Accept fbcdn/scontent URLs even without .mp4 extension (Reels use different format)
            if (isValidMedia(url) || url.includes('.mp4')) add('HD', url);
        }
    }
    
    // SD patterns
    const sdPatterns = [/"playable_url":"([^"]+)"/, /"sd_src(?:_no_ratelimit)?":"([^"]+)"/, /"browser_native_sd_url":"([^"]+)"/];
    for (const re of sdPatterns) {
        const m = searchArea.match(re);
        if (m) {
            const url = decodeUrl(m[1]);
            // Accept fbcdn/scontent URLs even without .mp4 extension (Reels use different format)
            if (isValidMedia(url) || url.includes('.mp4')) add('SD', url);
        }
    }
    
    // Early return if we have both HD and SD
    if (found.has('HD') && found.has('SD')) return formats;
    
    // DASH manifest fallback
    if (formats.length === 0) {
        const dashRe = /"height":(\d+)[^}]*?"base_url":"(https:[^"]+\.mp4[^"]*)"/g;
        let dm;
        while ((dm = dashRe.exec(searchArea)) !== null) {
            const h = parseInt(dm[1]);
            if (h >= 360) add(getQuality(h), decodeUrl(dm[2]));
        }
    }
    
    // Progressive fallback (Facebook now uses URLs without .mp4 extension)
    if (formats.length === 0) {
        const progRe = /"progressive_url":"(https:\/\/[^"]+)"/g;
        let m;
        while ((m = progRe.exec(searchArea)) !== null) {
            const url = decodeUrl(m[1]);
            // Accept fbcdn/scontent URLs even without .mp4 extension
            if (isValidMedia(url)) {
                const isHD = /720|1080|_hd/i.test(url);
                // Don't use add() here - it has quality dedup that blocks multiple videos
                // For progressive URLs, we want HD and SD variants
                if (!seenUrls.has(url)) {
                    seenUrls.add(url);
                    formats.push({ 
                        quality: isHD ? 'HD' : 'SD', 
                        type: 'video', 
                        url, 
                        format: 'mp4', 
                        itemId: 'video-main', 
                        thumbnail 
                    });
                }
            }
        }
        // Dedupe: keep only best HD and best SD
        if (formats.length > 2) {
            const hd = formats.find(f => f.quality === 'HD');
            const sd = formats.find(f => f.quality === 'SD');
            formats.length = 0;
            if (hd) formats.push(hd);
            if (sd) formats.push(sd);
        }
    }
    
    // base_url fallback (for DASH segments without height info)
    if (formats.length === 0) {
        const baseRe = /"base_url":"(https:\/\/scontent[^"]+)"/g;
        let m;
        const baseUrls: string[] = [];
        while ((m = baseRe.exec(searchArea)) !== null) {
            const url = decodeUrl(m[1]);
            if (!seenUrls.has(url) && isValidMedia(url)) {
                baseUrls.push(url);
                seenUrls.add(url);
            }
        }
        // Take first few unique base_urls (usually sorted by quality)
        baseUrls.slice(0, 3).forEach((url, i) => {
            add(i === 0 ? 'HD' : i === 1 ? 'SD' : 'Low', url);
        });
    }
    
    return formats;
}

// ============================================================================
// STORY EXTRACTION
// ============================================================================

function extractStories(html: string, seenUrls: Set<string>): MediaFormat[] {
    const formats: MediaFormat[] = [];
    
    // Get thumbnails
    const thumbs: string[] = [];
    const thumbRe = /"(?:previewImage|story_thumbnail|poster_image)":\{"uri":"(https:[^"]+)"/g;
    let tm;
    while ((tm = thumbRe.exec(html)) !== null) {
        const url = clean(tm[1]);
        if (isValidMedia(url) && !thumbs.includes(url)) thumbs.push(url);
    }
    
    // Story videos with quality metadata
    const storyRe = /"progressive_url":"(https:[^"]+\.mp4[^"]*)","failure_reason":null,"metadata":\{"quality":"(HD|SD)"\}/g;
    const videos: { url: string; isHD: boolean }[] = [];
    let m;
    while ((m = storyRe.exec(html)) !== null) {
        const url = decodeUrl(m[1]);
        if (!seenUrls.has(url)) {
            seenUrls.add(url);
            videos.push({ url, isHD: m[2] === 'HD' });
        }
    }
    
    // Group pairs, keep HD
    const count = Math.ceil(videos.length / 2);
    for (let i = 0; i < count; i++) {
        const pair = videos.slice(i * 2, i * 2 + 2);
        const best = pair.find(v => v.isHD) || pair[0];
        if (best) {
            formats.push({
                quality: `Story ${i + 1}`,
                type: 'video',
                url: best.url,
                format: 'mp4',
                itemId: `story-${i + 1}`,
                thumbnail: thumbs[i]
            });
        }
    }
    
    // Only extract story images if NO videos found (image-only stories)
    // Otherwise the "images" are just video thumbnails
    if (formats.length === 0) {
        const imgRe = /https:\/\/scontent[^"'\s<>]+?\.jpg[^"'\s<>]*/gi;
        const imgs: string[] = [];
        while ((m = imgRe.exec(html)) !== null) {
            const url = clean(m[0]);
            // Only high-res story images (not thumbnails)
            if (/t51\.82787/.test(url) && /s(1080|2048|1440)x/.test(url) && !seenUrls.has(url)) {
                if (!imgs.includes(url)) imgs.push(url);
            }
        }
        
        imgs.forEach((url, i) => {
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
    }
    
    return formats;
}

// ============================================================================
// IMAGE EXTRACTION
// ============================================================================

// Get expected carousel count from all_subattachments
function getCarouselCount(decoded: string): number {
    const match = decoded.match(/"all_subattachments":\s*\{[^}]*"count":\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
}

function extractImages(html: string, decoded: string, seenUrls: Set<string>, url: string, meta: { title?: string }, targetPostId?: string | null): MediaFormat[] {
    const formats: MediaFormat[] = [];
    const seenPaths = new Set<string>();
    let idx = 0;
    
    const add = (imgUrl: string) => {
        const norm = normalizePath(imgUrl);
        if (isSkipImage(imgUrl) || seenPaths.has(norm)) return false;
        seenPaths.add(norm);
        seenUrls.add(imgUrl);
        formats.push({
            quality: `Image ${++idx}`,
            type: 'image',
            url: imgUrl,
            format: 'jpg',
            itemId: `img-${idx}`,
            thumbnail: imgUrl
        });
        return true;
    };
    
    // If we have a target post ID, narrow down the search area first
    let target = decoded;
    if (targetPostId) {
        target = findTargetPostBlock(decoded, targetPostId);
        logger.debug('facebook', `Using targeted post block (${(target.length / 1024).toFixed(0)}KB) for image extraction`);
    }
    
    // Fallback: Determine target area for group posts
    if (target === decoded) {
        const gmMatch = decoded.match(/set=gm\.(\d+)/);
        if (gmMatch) {
            const pos = decoded.indexOf(`gm.${gmMatch[1]}`);
            if (pos > -1) {
                // Use 200KB context (100KB before + 100KB after) for better coverage
                target = decoded.substring(Math.max(0, pos - 100000), Math.min(decoded.length, pos + 100000));
            }
        }
    }
    
    let m;
    
    // Method 1: viewer_image from all_subattachments (best for carousels)
    // Extract from all_subattachments first as it has the most reliable data
    const subMatch = decoded.match(/"all_subattachments":\{"count":\d+,"nodes":\[[\s\S]*?\]\}/);
    if (subMatch) {
        const viewerInSubRe = /"viewer_image":\{"height":\d+,"width":\d+,"uri":"(https:[^"]+)"/g;
        while ((m = viewerInSubRe.exec(subMatch[0])) !== null) {
            const imgUrl = clean(m[1]);
            if (/scontent|fbcdn/.test(imgUrl)) add(imgUrl);
        }
    }
    
    // Method 2: viewer_image (general - for non-carousel posts)
    const viewerRe = /"viewer_image":\{"height":\d+,"width":\d+,"uri":"(https:[^"]+)"/g;
    while ((m = viewerRe.exec(target)) !== null) {
        const imgUrl = clean(m[1]);
        if (/scontent|fbcdn/.test(imgUrl)) add(imgUrl);
    }
    
    // Method 3: image with dimensions (common in group posts)
    const imgDimRe = /"image":\{"height":\d+,"width":\d+,"uri":"(https:[^"]+)"/g;
    while ((m = imgDimRe.exec(target)) !== null) {
        const imgUrl = clean(m[1]);
        if (/scontent|fbcdn/.test(imgUrl) && !isSkipImage(imgUrl)) add(imgUrl);
    }
    
    // Method 4: Preload links
    const preloadRe = /<link[^>]+rel="preload"[^>]+href="(https:\/\/scontent[^"]+_nc_sid=127cfc[^"]+)"/gi;
    while ((m = preloadRe.exec(html)) !== null) add(clean(m[1]));
    
    // Method 5: JSON patterns (photo_image, full_width_image)
    const jsonRe = [/"photo_image":\{"uri":"(https:[^"]+)"/g, /"full_width_image":\{"uri":"(https:[^"]+)"/g];
    for (const re of jsonRe) {
        while ((m = re.exec(target)) !== null) {
            const imgUrl = clean(m[1]);
            if (!/\/[ps]\d{2,3}x\d{2,3}\/|\/cp0\//.test(imgUrl)) add(imgUrl);
        }
    }
    
    // Method 6: Direct t39.30808 pattern (post images)
    const t39Re = /https:\/\/scontent[^"'\s<>\\]+t39\.30808[^"'\s<>\\]+\.jpg[^"'\s<>\\]*/gi;
    while ((m = t39Re.exec(decoded)) !== null) {
        const imgUrl = decodeUrl(m[0]);
        if (!/\/[ps]\d{2,3}x\d{2,3}\/|\/cp0\/|_s\d+x\d+/.test(imgUrl)) add(imgUrl);
    }
    
    // Method 7: Anchor-based fallback (only if nothing found)
    if (idx === 0) {
        const anchor = findAnchor(decoded, url, meta);
        if (anchor > -1) {
            const area = decoded.substring(anchor, Math.min(anchor + 15000, decoded.length));
            const imgRe = /https:\/\/scontent[^"'\s<>\\]+\.(?:jpg|jpeg)[^"'\s<>\\]*/gi;
            while ((m = imgRe.exec(area)) !== null) {
                const imgUrl = decodeUrl(m[0]);
                if (/t51\.82787|t39\.30808/.test(imgUrl) && !/\/[ps]\d{2,3}x\d{2,3}\//.test(imgUrl)) add(imgUrl);
            }
        }
    }
    
    // Log warning if carousel has more images than extracted (Facebook lazy-loads)
    const expectedCount = getCarouselCount(decoded);
    if (expectedCount > 0 && idx < expectedCount) {
        logger.debug('facebook', `Carousel: extracted ${idx}/${expectedCount} images (Facebook lazy-loads remaining)`);
    }
    
    return formats;
}

function findAnchor(decoded: string, url: string, meta: { title?: string }): number {
    // Try story_fbid
    const fbidMatch = url.match(/story_fbid=([^&]+)/);
    if (fbidMatch) {
        const pos = decoded.indexOf(fbidMatch[1]);
        if (pos > -1) return pos;
    }
    // Try title
    if (meta.title) {
        const pos = decoded.indexOf(meta.title.substring(0, 20));
        if (pos > -1) return pos;
    }
    // Try author from URL
    const authorMatch = url.match(/facebook\.com\/([^/?]+)/);
    if (authorMatch && !['share', 'watch', 'reel', 'www', 'web', 'groups'].includes(authorMatch[1])) {
        const pos = decoded.indexOf(authorMatch[1]);
        if (pos > -1) return pos;
    }
    return -1;
}

// ============================================================================
// METADATA EXTRACTION
// ============================================================================

function extractAuthor(html: string, url: string): string {
    // Decode unicode escape sequences like \u82f1\u6797 -> 英林
    const decodeUnicode = (s: string) => {
        try {
            return s.replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
        } catch { return s; }
    };
    
    const patterns = [
        /"name":"([^"]+)","enable_reels_tab_deeplink":true/,
        /"owning_profile":\{"__typename":"(?:User|Page)","name":"([^"]+)"/,
        /"owner":\{"__typename":"(?:User|Page)"[^}]*"name":"([^"]+)"/,
        /"actors":\[\{"__typename":"User","name":"([^"]+)"/,
        /"short_name":"([^"]+)"/,
    ];
    for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1] && m[1] !== 'Facebook' && !/^(User|Page|Video|Photo|Post)$/i.test(m[1])) {
            return decodeUnicode(m[1]);
        }
    }
    
    // Fallback: extract author ID if name not found
    const idPatterns = [
        /"owning_profile":\{[^}]*"id":"(\d+)"/,
        /"owner":\{[^}]*"id":"(\d+)"/,
        /"actor_id":"(\d+)"/,
    ];
    for (const re of idPatterns) {
        const m = html.match(re);
        if (m?.[1]) return `User ${m[1]}`;
    }
    
    const urlMatch = url.match(/facebook\.com\/([^/?]+)/);
    if (urlMatch && !['watch', 'reel', 'share', 'groups', 'www', 'web', 'stories'].includes(urlMatch[1])) {
        return urlMatch[1];
    }
    return 'Facebook';
}

function extractDescription(html: string): string {
    const patterns = [/"message":\{"text":"([^"]+)"/, /"content":\{"text":"([^"]+)"/, /"caption":"([^"]+)"/];
    for (const re of patterns) {
        const m = html.match(re);
        if (m?.[1] && m[1] !== 'Public' && m[1].length > 2) {
            return m[1].replace(/\\n/g, '\n').replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
        }
    }
    return '';
}

function extractPostDate(html: string): string | undefined {
    const m = html.match(/"(?:creation|created|publish)_time":(\d{10})/);
    return m ? new Date(parseInt(m[1]) * 1000).toISOString() : undefined;
}

function extractEngagement(html: string): EngagementStats {
    const engagement: EngagementStats = {};
    
    // Reaction count (likes) - multiple patterns for different content types
    const likePatterns = [
        /"reaction_count":\{"count":(\d+)/,
        /"likecount":(\d+)/i,
        /"like_count":(\d+)/,
        /"reactors":\{"count":(\d+)/,
        /"i18n_reaction_count":"([\d,\.KMkm]+)"/,
        /"likers":\{"count":(\d+)/,
    ];
    for (const re of likePatterns) {
        const m = html.match(re);
        if (m) {
            engagement.likes = parseEngagementNumber(m[1]);
            logger.debug('facebook', `Engagement likes: ${m[1]} -> ${engagement.likes}`);
            break;
        }
    }
    
    // Comment count
    const commentPatterns = [
        /"comment_count":\{"total_count":(\d+)/,
        /"comments":\{"total_count":(\d+)/,
        /"comment_rendering_instance"[^}]*"count":(\d+)/,
        /"i18n_comment_count":"([\d,\.KMkm]+)"/,
        // Text pattern: "467 comments" or "1.2K komentar"
        /([\d,\.]+[KMkm]?)\s*(?:comments|komentar|bình luận)/i,
    ];
    for (const re of commentPatterns) {
        const m = html.match(re);
        if (m) {
            engagement.comments = parseEngagementNumber(m[1]);
            logger.debug('facebook', `Engagement comments: ${m[1]} -> ${engagement.comments}`);
            break;
        }
    }
    
    // Share count
    const sharePatterns = [
        /"share_count":\{"count":(\d+)/,
        /"reshares":\{"count":(\d+)/,
        /"i18n_share_count":"([\d,\.KMkm]+)"/,
        // Text pattern: "435 shares" or "1.2K bagikan"
        /([\d,\.]+[KMkm]?)\s*(?:shares|bagikan|chia sẻ)/i,
    ];
    for (const re of sharePatterns) {
        const m = html.match(re);
        if (m) {
            engagement.shares = parseEngagementNumber(m[1]);
            logger.debug('facebook', `Engagement shares: ${m[1]} -> ${engagement.shares}`);
            break;
        }
    }
    
    // View count (for videos/reels)
    const viewPatterns = [
        /"video_view_count":(\d+)/,
        /"play_count":(\d+)/,
        /"view_count":(\d+)/,
        /"i18n_play_count":"([\d,\.KMkm]+)"/,
    ];
    for (const re of viewPatterns) {
        const m = html.match(re);
        if (m) {
            engagement.views = parseEngagementNumber(m[1]);
            logger.debug('facebook', `Engagement views: ${m[1]} -> ${engagement.views}`);
            break;
        }
    }
    
    return engagement;
}

// Parse engagement numbers like "1.2K", "3.5M", "1,234"
function parseEngagementNumber(str: string): number {
    if (!str) return 0;
    const clean = str.replace(/,/g, '').trim();
    const num = parseFloat(clean);
    if (isNaN(num)) return 0;
    if (/[kK]$/.test(clean)) return Math.round(num * 1000);
    if (/[mM]$/.test(clean)) return Math.round(num * 1000000);
    return Math.round(num);
}

// ============================================================================
// DEDUPLICATION
// ============================================================================

function dedupeFormats(formats: MediaFormat[]): MediaFormat[] {
    const videos = formats.filter(f => f.type === 'video');
    const images = formats.filter(f => f.type === 'image');
    
    // Dedupe videos
    const seenUrls = new Set<string>();
    const uniqueVideos = videos.filter(v => {
        if (seenUrls.has(v.url)) return false;
        seenUrls.add(v.url);
        return true;
    });
    
    // Sort videos by resolution
    uniqueVideos.sort((a, b) => getResValue(b.quality) - getResValue(a.quality));
    
    return [...uniqueVideos, ...images];
}

// ============================================================================
// MAIN SCRAPER
// ============================================================================

export async function scrapeFacebook(inputUrl: string, options?: ScraperOptions): Promise<ScraperResult> {
    const cookie = options?.cookie;
    
    // Check cache
    if (!options?.skipCache) {
        const cached = getCache<ScraperResult>('facebook', inputUrl);
        if (cached?.success) return { ...cached, cached: true };
    }
    
    if (!matchesPlatform(inputUrl, 'facebook')) {
        return createError(ScraperErrorCode.INVALID_URL, 'Invalid Facebook URL');
    }

    let fetchUrl = normalizeUrl(inputUrl, 'facebook');
    const parsedCookie = parseCookie(cookie, 'facebook') || undefined;
    
    // Smart cookie strategy to avoid double-request pattern:
    // 1. If cookie provided → always use it (single request)
    // 2. If no cookie → try public, fail if login required
    // This prevents the suspicious pattern of: no-cookie request → cookie request
    const needsCookie = requiresCookie(fetchUrl);
    const useCookie = !!parsedCookie; // Always use cookie if available
    
    // Stories ALWAYS require cookie - fail fast if not provided
    if (needsCookie && !parsedCookie) {
        return createError(ScraperErrorCode.COOKIE_REQUIRED, 'Stories require login. Please provide a cookie.');
    }
    
    logger.url('facebook', inputUrl);
    logger.debug('facebook', `Cookie: ${useCookie ? 'Yes' : 'No'}, Required: ${needsCookie ? 'Yes' : 'No'}`);

    try {
        // Use cookie only when needed (smart decision) or for content that requires it
        const headers = useCookie ? { ...BROWSER_HEADERS, Cookie: parsedCookie } : BROWSER_HEADERS;
        
        // Resolve short URLs and share links (5s timeout for reliability)
        // /share/p/ = post, /share/v/ = video, /share/r/ = reel - these are direct links
        // /share/XXXX (alphanumeric without p/v/r prefix) = short code that needs resolution
        const needsResolve = /fb\.watch|fb\.me|l\.facebook/.test(fetchUrl) ||
            (/\/share\//.test(fetchUrl) && !/\/share\/[pvr]\//.test(fetchUrl));
        if (needsResolve) {
            const resolved = await resolveUrl(fetchUrl, 5000);
            fetchUrl = cleanTrackingParams(normalizeUrl(resolved, 'facebook'));
            logger.debug('facebook', `Resolved: ${fetchUrl.substring(0, 80)}...`);
            // Small delay after resolve to let Facebook prepare content
            await new Promise(r => setTimeout(r, 300));
        }
        
        const contentType = detectType(fetchUrl);
        
        // Stories need www domain
        if (contentType === 'story') {
            fetchUrl = fetchUrl.replace('web.facebook.com', 'www.facebook.com');
        }

        let html: string;
        let finalUrl: string;
        
        // Use manual redirect to preserve cookies across domain changes (www → web)
        // Facebook redirects www.facebook.com to web.facebook.com and cookies get lost with redirect:follow
        const fetchWithRedirect = async (url: string, maxRedirects = 10): Promise<{ html: string; finalUrl: string }> => {
            let currentUrl = url;
            for (let i = 0; i < maxRedirects; i++) {
                const res = await fetch(currentUrl, { headers, redirect: 'manual' });
                if (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308) {
                    const location = res.headers.get('location');
                    if (location) {
                        currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href;
                        logger.debug('facebook', `Redirect ${res.status} → ${currentUrl.substring(0, 80)}...`);
                        // Detect checkpoint (shadow ban / account verification required)
                        if (currentUrl.includes('/checkpoint/')) {
                            throw new Error('CHECKPOINT_REQUIRED');
                        }
                        continue;
                    }
                }
                // Use currentUrl as finalUrl since res.url is not reliable with redirect:manual
                return { html: await res.text(), finalUrl: currentUrl };
            }
            throw new Error('Too many redirects');
        };
        
        // Stories and Reels need special handling - Facebook needs time to prepare content
        const needsPolling = (contentType === 'story' && useCookie) || contentType === 'reel';
        if (needsPolling) {
            // First fetch to initialize session
            const initial = await fetchWithRedirect(fetchUrl);
            html = initial.html;
            finalUrl = initial.finalUrl;
            
            // Count media items to ensure we get all of them
            const countMedia = (h: string) => {
                // Videos: playable_url or progressive_url patterns
                const videos = (h.match(/playable_url(?:_quality_hd)?":"https/g) || []).length +
                              (h.match(/progressive_url":"https[^"]+\.mp4/g) || []).length;
                // Images for stories
                const images = (h.match(/t51\.82787.*?s(1080|2048|1440)x/g) || []).length;
                return videos + images;
            };
            
            let mediaCount = countMedia(html);
            const typeLabel = contentType === 'story' ? 'Story' : 'Reel';
            
            if (mediaCount === 0) {
                logger.debug('facebook', `${typeLabel} detected, polling for content...`);
                // Poll every 500ms, max 3s (6 attempts)
                for (let i = 0; i < 6; i++) {
                    await new Promise(r => setTimeout(r, 500));
                    const result = await fetchWithRedirect(fetchUrl);
                    const newCount = countMedia(result.html);
                    // Only update if we found more media
                    if (newCount > mediaCount) {
                        html = result.html;
                        finalUrl = result.finalUrl;
                        mediaCount = newCount;
                        logger.debug('facebook', `Found ${mediaCount} media items after ${(i + 1) * 500}ms`);
                    }
                    // Early exit only if we have media AND count stabilized (same as previous)
                    if (mediaCount > 0 && newCount === mediaCount && i >= 1) {
                        logger.debug('facebook', `Media count stabilized at ${mediaCount}`);
                        break;
                    }
                }
            } else {
                logger.debug('facebook', `${typeLabel} content found immediately (${mediaCount} items)`);
            }
        } else {
            // Single fetch for non-stories
            const result = await fetchWithRedirect(fetchUrl);
            html = result.html;
            finalUrl = result.finalUrl;
        }
        


        if (html.length < 1000) {
            return createError(ScraperErrorCode.API_ERROR, 'Facebook returned error page');
        }
        
        if ((html.includes('login_form') || html.includes('Log in to Facebook')) && html.length < 50000) {
            return createError(ScraperErrorCode.COOKIE_REQUIRED, 'This content requires login. Please provide a cookie.');
        }

        const decoded = decodeHtml(html);
        const meta = extractMeta(html);
        const seenUrls = new Set<string>();
        let formats: MediaFormat[] = [];

        const actualType = detectType(finalUrl);
        const isStory = actualType === 'story';
        const isPost = actualType === 'post' || actualType === 'unknown';



        // Extract based on type
        const isReel = actualType === 'reel';
        const isVideo = actualType === 'video' || isReel;
        
        // Extract video ID and post ID from final URL for targeted extraction
        const targetVideoId = extractVideoId(finalUrl);
        const targetPostId = extractPostId(finalUrl);
        if (targetVideoId) {
            logger.debug('facebook', `Target video ID: ${targetVideoId}`);
        }
        if (targetPostId) {
            logger.debug('facebook', `Target post ID: ${targetPostId.substring(0, 30)}...`);
        }
        
        if (isStory) {
            formats = extractStories(decoded, seenUrls);
        } else {
            // Always try video extraction first for videos/reels
            // Pass targetVideoId to extract the correct video (not related content)
            formats = extractVideos(decoded, seenUrls, targetVideoId);
            
            // For reels/videos: if no video found, debug what patterns exist
            if (isVideo && formats.length === 0) {
                // Debug: check what video patterns exist in HTML
                const debugPatterns = [
                    { name: 'playable_url_quality_hd', re: /"playable_url_quality_hd":"([^"]{50,100})/ },
                    { name: 'playable_url', re: /"playable_url":"([^"]{50,100})/ },
                    { name: 'hd_src', re: /"hd_src":"([^"]{50,100})/ },
                    { name: 'sd_src', re: /"sd_src":"([^"]{50,100})/ },
                    { name: 'browser_native_hd', re: /"browser_native_hd_url":"([^"]{50,100})/ },
                    { name: 'progressive_url', re: /"progressive_url":"([^"]{50,100})/ },
                ];
                for (const { name, re } of debugPatterns) {
                    const m = decoded.match(re);
                    if (m) logger.debug('facebook', `Found ${name}: ${m[1]}...`);
                }
                logger.debug('facebook', `${actualType}: No video found in HTML`);
                // Don't fall back to images for video content
            }
            
            // For posts or unknown: also extract images
            if (isPost || (!isVideo && formats.length === 0)) {
                formats.push(...extractImages(html, decoded, seenUrls, inputUrl, meta, targetPostId));
                
                // Check if carousel has more images than extracted
                // NOTE: Facebook lazy-loads carousel images, we can only get ~5 from initial HTML
                const expectedCount = getCarouselCount(decoded);
                const imageCount = formats.filter(f => f.type === 'image').length;
                
                if (expectedCount > imageCount) {
                    logger.debug('facebook', `Carousel: ${imageCount}/${expectedCount} images (Facebook lazy-loads remaining)`);
                }
            }
        }

        if (formats.length === 0) {
            return createError(ScraperErrorCode.NO_MEDIA, 'No media found. Post may be private.');
        }

        formats = dedupeFormats(formats);

        // Build result
        let title = decodeHtml(meta.title || 'Facebook Post');
        title = title.replace(/^[\d.]+K?\s*views.*?\|\s*/i, '').trim();
        if (title.length > 100) title = title.substring(0, 100) + '...';
        
        const description = extractDescription(decoded);
        if ((title === 'Facebook' || title === 'Facebook Post') && description) {
            title = description.length > 80 ? description.substring(0, 80) + '...' : description;
        }

        const engagement = extractEngagement(decoded);
        const postedAt = extractPostDate(decoded);
        
        const result: ScraperResult = {
            success: true,
            data: {
                title,
                thumbnail: meta.thumbnail || formats.find(f => f.thumbnail)?.thumbnail || '',
                author: extractAuthor(decoded, fetchUrl),
                description,
                postedAt,
                engagement: Object.keys(engagement).length > 0 ? engagement : undefined,
                formats,
                url: inputUrl
            }
        };
        
        setCache('facebook', inputUrl, result);
        return result;
        
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to fetch';
        if (msg === 'CHECKPOINT_REQUIRED') {
            return createError(ScraperErrorCode.CHECKPOINT_REQUIRED);
        }
        return createError(ScraperErrorCode.NETWORK_ERROR, msg);
    }
}
