/**
 * Facebook Scraper Service (Axios-based)
 * Supports: /share/p|r|v/, /posts/, /reel/, /videos/, /watch/, /stories/, /groups/, /photos/
 */

import { MediaFormat } from '@/lib/types';
import { decodeHtml, extractMeta, decodeUrl, httpGet, getRotatingHeaders, trackRequest, type EngagementStats } from '@/lib/http';
import { parseCookie } from '@/lib/cookies';
import { matchesPlatform } from './helper/api-config';
import { getCache, setCache } from './helper/cache';
import { createError, ScraperErrorCode, type ScraperResult, type ScraperOptions } from '@/core/scrapers/types';
import { logger } from './helper/logger';

// ============================================================================
// CONSTANTS & HELPERS
// ============================================================================

const SKIP_SIDS = ['bd9a62', '23dd7b', '50ce42', '9a7156', '1d2534', 'e99d92', 'a6c039', '72b077', 'ba09c1', 'f4d7c3', '0f7a8c', '3c5e9a', 'd41d8c'];
const isValidMedia = (url: string) => url?.length > 30 && /fbcdn|scontent/.test(url) && !/<|>/.test(url);
const isSkipImage = (url: string) => SKIP_SIDS.some(s => url.includes(`_nc_sid=${s}`)) || /emoji|sticker|static|rsrc|profile|avatar|\/cp0\/|\/[ps]\d+x\d+\/|_s\d+x\d+|\.webp\?/i.test(url);
const clean = (s: string) => s.replace(/\\\//g, '/').replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
const getQuality = (h: number) => h >= 1080 ? 'HD 1080p' : h >= 720 ? 'HD 720p' : h >= 480 ? 'SD 480p' : `${h}p`;
const getResValue = (q: string) => { const m = q.match(/(\d{3,4})/); return m ? parseInt(m[1]) : 0; };

const AGE_RESTRICTED_PATTERNS = ['You must be 18 years or older', 'age-restricted', 'AdultContentWarning', '"is_adult_content":true', 'content_age_gate'];
const PRIVATE_CONTENT_PATTERNS = ['This content isn\'t available', 'content isn\'t available right now', 'Sorry, this content isn\'t available', 'The link you followed may be broken'];

const detectContentIssue = (html: string): ScraperErrorCode | null => {
    const lower = html.toLowerCase();
    const hasMediaPatterns = html.includes('browser_native') || html.includes('all_subattachments') || html.includes('viewer_image') || html.includes('playable_url');
    if (hasMediaPatterns) return null;
    for (const p of AGE_RESTRICTED_PATTERNS) { if (html.includes(p) || lower.includes(p.toLowerCase())) return ScraperErrorCode.AGE_RESTRICTED; }
    for (const p of PRIVATE_CONTENT_PATTERNS) { const idx = html.indexOf(p); if (idx > -1 && idx < 50000) return ScraperErrorCode.PRIVATE_CONTENT; }
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

const extractVideoId = (url: string): string | null => url.match(/\/(?:reel|videos?)\/(\d+)/)?.[1] || null;
const extractPostId = (url: string): string | null => {
    const patterns = [/\/posts\/(pfbid[a-zA-Z0-9]+)/, /\/posts\/(\d+)/, /\/permalink\/(\d+)/, /story_fbid=(pfbid[a-zA-Z0-9]+)/, /story_fbid=(\d+)/, /\/photos?\/[^/]+\/(\d+)/, /\/share\/p\/([a-zA-Z0-9]+)/, /fbid=(\d+)/];
    for (const re of patterns) { const m = url.match(re); if (m) return m[1]; }
    return null;
};


// ============================================================================
// TARGETED BLOCK FINDER
// ============================================================================

function findTargetBlock(html: string, id: string | null, type: 'post' | 'video'): string {
    const MAX_SEARCH = type === 'video' ? 80000 : 100000;
    if (!id) return html.length > MAX_SEARCH ? html.substring(0, MAX_SEARCH) : html;

    const searchKey = id.startsWith('pfbid') ? id.substring(5, 30) : id;
    let targetPos = -1;
    const idPatterns = type === 'video'
        ? [`"id":"${id}"`, `"video_id":"${id}"`, `/reel/${id}`, `/videos/${id}`, `"videoId":"${id}"`]
        : [`/posts/${id}`, `story_fbid=${id}`, `/permalink/${id}`, `"post_id":"${id}"`, id];

    for (const p of idPatterns) { const pos = html.indexOf(p); if (pos > -1) { targetPos = pos; break; } }
    if (targetPos === -1 && id.startsWith('pfbid')) targetPos = html.indexOf(searchKey);

    if (type === 'post') {
        const subKey = '"all_subattachments":{"count":';
        const cometPos = html.indexOf('"comet_sections"');
        const creationPos = html.indexOf('"creation_story"');
        const mainPostPos = Math.min(cometPos > -1 ? cometPos : Infinity, creationPos > -1 ? creationPos : Infinity);

        let bestSubPos = -1;
        if (mainPostPos < Infinity) {
            const searchArea = html.substring(mainPostPos, mainPostPos + 300000);
            const subInArea = searchArea.indexOf(subKey);
            if (subInArea > -1) bestSubPos = mainPostPos + subInArea;
        }
        if (bestSubPos === -1) bestSubPos = html.indexOf(subKey);

        if (bestSubPos > -1) {
            let endPos = html.indexOf('"all_subattachments":', bestSubPos + 30);
            if (endPos === -1 || endPos - bestSubPos > 30000) endPos = bestSubPos + 25000;
            return html.substring(Math.max(0, bestSubPos - 500), Math.min(html.length, endPos));
        }

        if (mainPostPos < Infinity) return html.substring(mainPostPos, Math.min(html.length, mainPostPos + 100000));

        if (targetPos > -1) {
            const viewerKey = '"viewer_image":';
            let viewerPos = html.indexOf(viewerKey, Math.max(0, targetPos - 3000));
            if (viewerPos === -1) viewerPos = html.indexOf(viewerKey);
            if (viewerPos > -1) return html.substring(Math.max(0, viewerPos - 500), Math.min(html.length, viewerPos + 15000));
        }
    }

    if (type === 'video') {
        const videoKeys = ['"browser_native_hd_url":', '"playable_url_quality_hd":', '"playable_url":', '"progressive_url":'];
        for (const key of videoKeys) {
            let pos = targetPos > -1 ? html.indexOf(key, Math.max(0, targetPos - 2000)) : -1;
            if (pos === -1) pos = html.indexOf(key);
            if (pos > -1) {
                const blockSize = key.includes('progressive') ? 15000 : 10000;
                return html.substring(Math.max(0, pos - 1000), Math.min(html.length, pos + blockSize));
            }
        }
    }

    if (targetPos > -1) {
        const before = type === 'video' ? 1500 : 5000;
        const after = type === 'video' ? 10000 : 20000;
        return html.substring(Math.max(0, targetPos - before), Math.min(html.length, targetPos + after));
    }

    return html.length > MAX_SEARCH ? html.substring(0, MAX_SEARCH) : html;
}


// ============================================================================
// VIDEO EXTRACTION
// ============================================================================

function extractVideos(html: string, seenUrls: Set<string>, targetId?: string | null): MediaFormat[] {
    const formats: MediaFormat[] = [];
    const found = new Set<string>();
    const area = findTargetBlock(html, targetId || null, 'video');

    const thumbRe = /"(?:previewImage|thumbnailImage|poster_image|preferred_thumbnail)"[^}]*?"uri":"(https:[^"]+)"/;
    const thumbMatch = area.match(thumbRe);
    const thumbnail = thumbMatch && /scontent|fbcdn/.test(thumbMatch[1]) ? clean(thumbMatch[1]) : undefined;

    const add = (quality: string, url: string) => {
        if (!url.includes('.mp4') && !isValidMedia(url)) return;
        if (seenUrls.has(url) || found.has(quality)) return;
        seenUrls.add(url); found.add(quality);
        formats.push({ quality, type: 'video', url, format: 'mp4', itemId: 'video-main', thumbnail });
    };

    const hdNative = area.match(/"browser_native_hd_url":"([^"]+)"/) || html.match(/"browser_native_hd_url":"([^"]+)"/);
    const sdNative = area.match(/"browser_native_sd_url":"([^"]+)"/) || html.match(/"browser_native_sd_url":"([^"]+)"/);
    if (hdNative) add('HD', decodeUrl(hdNative[1]));
    if (sdNative) add('SD', decodeUrl(sdNative[1]));
    if (found.size > 0) return formats;

    const hdPlay = area.match(/"playable_url_quality_hd":"([^"]+)"/);
    const sdPlay = area.match(/"playable_url":"([^"]+)"/);
    if (hdPlay) add('HD', decodeUrl(hdPlay[1]));
    if (sdPlay) add('SD', decodeUrl(sdPlay[1]));
    if (found.size > 0) return formats;

    const hdSrc = area.match(/"hd_src(?:_no_ratelimit)?":"([^"]+)"/);
    const sdSrc = area.match(/"sd_src(?:_no_ratelimit)?":"([^"]+)"/);
    if (hdSrc) add('HD', decodeUrl(hdSrc[1]));
    if (sdSrc) add('SD', decodeUrl(sdSrc[1]));
    if (found.size > 0) return formats;

    const dashRe = /"height":(\d+)[^}]*?"base_url":"(https:[^"]+\.mp4[^"]*)"/g;
    let m;
    const dashVideos: { height: number; url: string }[] = [];
    while ((m = dashRe.exec(area)) !== null) {
        const height = parseInt(m[1]);
        if (height >= 360) dashVideos.push({ height, url: decodeUrl(m[2]) });
    }
    if (dashVideos.length > 0) {
        dashVideos.sort((a, b) => b.height - a.height);
        const hd = dashVideos.find(v => v.height >= 720);
        const sd = dashVideos.find(v => v.height < 720 && v.height >= 360);
        if (hd) add('HD', hd.url);
        if (sd) add('SD', sd.url);
        if (found.size > 0) return formats;
    }

    const progRe = /"progressive_url":"(https:\/\/[^"]+)"/g;
    let progMatch;
    while ((progMatch = progRe.exec(area)) !== null && found.size < 2) {
        const url = decodeUrl(progMatch[1]);
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

    const storyRe = /"progressive_url":"(https:[^"]+\.mp4[^"]*)","failure_reason":null,"metadata":\{"quality":"(HD|SD)"\}/g;
    const videoPairs: { url: string; isHD: boolean }[] = [];
    while ((m = storyRe.exec(html)) !== null) {
        const url = decodeUrl(m[1]);
        if (!seenUrls.has(url)) { seenUrls.add(url); videoPairs.push({ url, isHD: m[2] === 'HD' }); }
    }

    if (videoPairs.length === 0) {
        const fallbackRe = /"progressive_url":"(https:[^"]+\.mp4[^"]*)"/g;
        while ((m = fallbackRe.exec(html)) !== null) {
            const url = decodeUrl(m[1]);
            if (!seenUrls.has(url)) { seenUrls.add(url); videoPairs.push({ url, isHD: /720p|1080p|_hd/.test(url) }); }
        }
    }

    const thumbs: string[] = [];
    const thumbRe = /"(?:previewImage|story_thumbnail|poster_image)":\{"uri":"(https:[^"]+)"/g;
    while ((m = thumbRe.exec(html)) !== null) {
        const url = clean(m[1]);
        if (isValidMedia(url) && !thumbs.includes(url)) thumbs.push(url);
    }

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

    const imgRe = /https:\/\/scontent[^"'\s<>\\]+t51\.82787[^"'\s<>\\]+\.jpg[^"'\s<>\\]*/gi;
    const storyImages: string[] = [];
    while ((m = imgRe.exec(html)) !== null) {
        const url = clean(decodeUrl(m[0]));
        if (/s(1080|1440|2048)x/.test(url) && !seenUrls.has(url) && !storyImages.includes(url)) storyImages.push(url);
    }

    storyImages.forEach((url, i) => {
        seenUrls.add(url);
        formats.push({ quality: `Story Image ${i + 1}`, type: 'image', url, format: 'jpg', itemId: `story-img-${i + 1}`, thumbnail: url });
    });

    return formats;
}


// ============================================================================
// IMAGE EXTRACTION
// ============================================================================

function extractImages(html: string, decoded: string, seenUrls: Set<string>, targetPostId?: string | null): MediaFormat[] {
    const formats: MediaFormat[] = [];
    const seenPaths = new Set<string>();
    let idx = 0;

    const add = (imgUrl: string) => {
        const path = imgUrl.split('?')[0];
        if (isSkipImage(imgUrl) || seenPaths.has(path)) return false;
        if (/t39\.30808-1\//.test(imgUrl)) return false;
        seenPaths.add(path); seenUrls.add(imgUrl);
        formats.push({ quality: `Image ${++idx}`, type: 'image', url: imgUrl, format: 'jpg', itemId: `img-${idx}`, thumbnail: imgUrl });
        return true;
    };

    const target = findTargetBlock(decoded, targetPostId || null, 'post');
    let m;

    const subStart = target.indexOf('"all_subattachments":{"count":');
    if (subStart > -1) {
        const countMatch = target.substring(subStart, subStart + 50).match(/"count":(\d+)/);
        const expectedCount = countMatch ? parseInt(countMatch[1]) : 0;
        const nodesStart = target.indexOf('"nodes":[', subStart);
        if (nodesStart > -1 && nodesStart - subStart < 100) {
            let depth = 0, nodesEnd = nodesStart + 9;
            for (let i = nodesStart + 8; i < target.length && i < nodesStart + 30000; i++) {
                if (target[i] === '[') depth++;
                if (target[i] === ']') { if (depth === 0) { nodesEnd = i + 1; break; } depth--; }
            }
            const nodesBlock = target.substring(nodesStart, nodesEnd);
            const viewerRe = /"viewer_image":\{"height":(\d+),"width":(\d+),"uri":"(https:[^"]+)"/g;
            while ((m = viewerRe.exec(nodesBlock)) !== null) {
                const url = clean(m[3]);
                if (/scontent|fbcdn/.test(url) && /t39\.30808|t51\.82787/.test(url)) add(url);
            }
            if (idx >= expectedCount && idx > 0) return formats;
        }
    }

    if (idx === 0) {
        const viewerRe = /"viewer_image":\{"height":(\d+),"width":(\d+),"uri":"(https:[^"]+)"/g;
        const candidates: { url: string; size: number }[] = [];
        while ((m = viewerRe.exec(target)) !== null) {
            const height = parseInt(m[1]), width = parseInt(m[2]), url = clean(m[3]);
            if (/scontent|fbcdn/.test(url) && height >= 400 && width >= 400) {
                if (/t39\.30808|t51\.82787/.test(url) && !/\/[ps]\d{2,3}x\d{2,3}\/|\/cp0\//.test(url)) {
                    candidates.push({ url, size: height * width });
                }
            }
        }
        candidates.sort((a, b) => b.size - a.size);
        const addedUrls = new Set<string>();
        for (const c of candidates) {
            const basePath = c.url.split('?')[0].replace(/_n\.jpg$/, '');
            if (!addedUrls.has(basePath)) { addedUrls.add(basePath); add(c.url); }
        }
    }

    if (idx === 0) {
        const photoRe = /"photo_image":\{"uri":"(https:[^"]+)"/g;
        const photoUrls: string[] = [];
        while ((m = photoRe.exec(target)) !== null && photoUrls.length < 5) {
            const url = clean(m[1]);
            if (/scontent|fbcdn/.test(url) && /t39\.30808-6/.test(url) && !photoUrls.includes(url)) photoUrls.push(url);
        }
        for (const url of photoUrls) add(url);
    }

    if (idx === 0) {
        const preloadRe = /<link[^>]+rel="preload"[^>]+href="(https:\/\/scontent[^"]+_nc_sid=127cfc[^"]+)"/i;
        const preloadMatch = html.match(preloadRe);
        if (preloadMatch) add(clean(preloadMatch[1]));
    }

    if (idx === 0) {
        const imageUriRe = /"image":\{"uri":"(https:[^"]+t39\.30808[^"]+)"/g;
        while ((m = imageUriRe.exec(html)) !== null && idx < 3) {
            const url = clean(m[1]);
            if (/scontent|fbcdn/.test(url) && !/\/[ps]\d{2,3}x\d{2,3}\/|\/cp0\//.test(url)) add(url);
        }
    }

    if (idx === 0) {
        const t39Re = /https:\/\/scontent[^"'\s<>\\]+t39\.30808-6[^"'\s<>\\]+\.jpg/gi;
        let count = 0;
        while ((m = t39Re.exec(target)) !== null && count < 5) {
            const url = decodeUrl(m[0]);
            if (!/\/[ps]\d{2,3}x\d{2,3}\/|\/cp0\/|_s\d+x\d+|\/s\d{2,3}x\d{2,3}\//.test(url)) { if (add(url)) count++; }
        }
    }

    return formats;
}


// ============================================================================
// METADATA EXTRACTION
// ============================================================================

function extractAuthor(html: string, url: string): string {
    const decode = (s: string) => s.replace(/\\u([\dA-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
    const patterns = [/"name":"([^"]+)","enable_reels_tab_deeplink":true/, /"owning_profile":\{"__typename":"(?:User|Page)","name":"([^"]+)"/, /"owner":\{"__typename":"(?:User|Page)"[^}]*"name":"([^"]+)"/, /"actors":\[\{"__typename":"User","name":"([^"]+)"/];
    for (const re of patterns) { const m = html.match(re); if (m?.[1] && m[1] !== 'Facebook' && !/^(User|Page|Video|Photo|Post)$/i.test(m[1])) return decode(m[1]); }
    const urlMatch = url.match(/facebook\.com\/([^/?]+)/);
    if (urlMatch && !['watch', 'reel', 'share', 'groups', 'www', 'web', 'stories'].includes(urlMatch[1])) return urlMatch[1];
    return 'Facebook';
}

function extractDescription(html: string): string {
    const patterns = [/"message":\{"text":"([^"]+)"/, /"content":\{"text":"([^"]+)"/, /"caption":"([^"]+)"/];
    for (const re of patterns) { const m = html.match(re); if (m?.[1] && m[1].length > 2) return m[1].replace(/\\n/g, '\n').replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))); }
    return '';
}

const extractPostDate = (html: string): string | undefined => {
    const m = html.match(/"(?:creation|created|publish)_time":(\d{10})/);
    return m ? new Date(parseInt(m[1]) * 1000).toISOString() : undefined;
};

function extractEngagement(html: string): EngagementStats {
    const parse = (s: string) => { const n = parseFloat(s.replace(/,/g, '')); if (isNaN(n)) return 0; if (/[kK]$/.test(s)) return Math.round(n * 1000); if (/[mM]$/.test(s)) return Math.round(n * 1000000); return Math.round(n); };
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

    if (!options?.skipCache) {
        const cached = await getCache<ScraperResult>('facebook', inputUrl);
        if (cached?.success) { logger.cache('facebook', true); return { ...cached, cached: true }; }
    }
    logger.cache('facebook', false);

    if (!matchesPlatform(inputUrl, 'facebook')) return createError(ScraperErrorCode.INVALID_URL, 'Invalid Facebook URL');

    const parsedCookie = parseCookie(options?.cookie, 'facebook') || undefined;
    const hasCookie = !!parsedCookie;

    if (/\/stories\//.test(inputUrl) && !parsedCookie) {
        return createError(ScraperErrorCode.COOKIE_REQUIRED, 'Stories require login.');
    }

    const doScrape = async (useCookie: boolean): Promise<ScraperResult> => {
        try {
            // Track request for rate limiting
            trackRequest('facebook');

            // Use rotating headers for anti-ban
            const headers = getRotatingHeaders({
                platform: 'facebook',
                cookie: useCookie && parsedCookie ? parsedCookie : undefined
            });

            logger.debug('facebook', `Fetching ${inputUrl.substring(0, 50)}... (cookie: ${useCookie})`);
            const res = await httpGet(inputUrl, { headers, timeout: 10000 });

            if (res.finalUrl.includes('/checkpoint/')) throw new Error('CHECKPOINT_REQUIRED');
            const html = res.data;
            const finalUrl = res.finalUrl;

            logger.debug('facebook', `Got ${(html.length / 1024).toFixed(0)}KB from ${finalUrl.substring(0, 50)}...`);

            const contentType = detectType(finalUrl);
            logger.type('facebook', contentType);
            logger.resolve('facebook', inputUrl, finalUrl);

            // Story retry
            if (contentType === 'story' && useCookie) {
                const countMedia = (h: string) => (h.match(/progressive_url":"https[^"]+\.mp4/g) || []).length;
                if (countMedia(html) === 0) {
                    for (let i = 0; i < 2; i++) {
                        await new Promise(r => setTimeout(r, 200));
                        const retry = await httpGet(finalUrl, { headers, timeout: 15000 });
                        if (countMedia(retry.data) > 0) break;
                    }
                }
            }

            if (html.length < 10000 && html.includes('Sorry, something went wrong')) {
                return createError(ScraperErrorCode.API_ERROR, 'Facebook returned error page');
            }

            const hasMediaPatterns = html.includes('browser_native') || html.includes('all_subattachments') || html.includes('viewer_image');
            if (!hasMediaPatterns && html.length < 500000 && (html.includes('login_form') || html.includes('Log in to Facebook'))) {
                return createError(ScraperErrorCode.COOKIE_REQUIRED, 'This content requires login.');
            }

            const contentIssue = detectContentIssue(html);
            if (contentIssue && !useCookie) {
                if (contentIssue === ScraperErrorCode.AGE_RESTRICTED) return createError(ScraperErrorCode.AGE_RESTRICTED, 'Age-restricted content. Cookie required.');
                if (contentIssue === ScraperErrorCode.PRIVATE_CONTENT) return createError(ScraperErrorCode.PRIVATE_CONTENT, 'This content is private or unavailable.');
            }

            const decoded = decodeHtml(html);
            const meta = extractMeta(html);
            const seenUrls = new Set<string>();
            let formats: MediaFormat[] = [];

            const actualType = detectType(finalUrl);
            const isVideo = actualType === 'video' || actualType === 'reel';
            const isPost = actualType === 'post' || actualType === 'group' || actualType === 'unknown';

            if (actualType === 'story') formats = extractStories(decoded, seenUrls);
            else if (isVideo) formats = extractVideos(decoded, seenUrls, extractVideoId(finalUrl));
            if (isPost || (isVideo && formats.length === 0)) formats.push(...extractImages(html, decoded, seenUrls, extractPostId(finalUrl)));

            if (formats.length === 0) {
                if (contentIssue === ScraperErrorCode.AGE_RESTRICTED) return createError(ScraperErrorCode.AGE_RESTRICTED, 'Age-restricted content. Try with a different cookie.');
                if (contentIssue === ScraperErrorCode.PRIVATE_CONTENT) return createError(ScraperErrorCode.PRIVATE_CONTENT, 'This content is private or has been removed.');
                return createError(ScraperErrorCode.NO_MEDIA, 'No media found. Post may be text-only or private.');
            }

            const seen = new Set<string>();
            formats = formats.filter(f => { if (seen.has(f.url)) return false; seen.add(f.url); return true; });
            formats.sort((a, b) => (a.type === 'video' ? 0 : 1) - (b.type === 'video' ? 0 : 1) || getResValue(b.quality) - getResValue(a.quality));

            let title = decodeHtml(meta.title || 'Facebook Post').replace(/^[\d.]+K?\s*views.*?\|\s*/i, '').trim();
            if (title.length > 100) title = title.substring(0, 100) + '...';
            const description = extractDescription(decoded);
            if ((title === 'Facebook' || title === 'Facebook Post') && description) title = description.length > 80 ? description.substring(0, 80) + '...' : description;

            logger.media('facebook', { videos: formats.filter(f => f.type === 'video').length, images: formats.filter(f => f.type === 'image').length });
            logger.complete('facebook', Date.now() - startTime);

            const result: ScraperResult = { success: true, data: { title, thumbnail: meta.thumbnail || formats.find(f => f.thumbnail)?.thumbnail || '', author: extractAuthor(decoded, finalUrl), description, postedAt: extractPostDate(decoded), engagement: extractEngagement(decoded), formats, url: inputUrl } };
            setCache('facebook', inputUrl, result);
            return result;

        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to fetch';
            if (msg === 'CHECKPOINT_REQUIRED') return createError(ScraperErrorCode.CHECKPOINT_REQUIRED);
            return createError(ScraperErrorCode.NETWORK_ERROR, msg);
        }
    };

    const isStory = /\/stories\//.test(inputUrl);
    if (isStory) return doScrape(true);

    const guestResult = await doScrape(false);
    const shouldRetry = hasCookie && (!guestResult.success || (guestResult.data?.formats?.length === 0) || guestResult.errorCode === ScraperErrorCode.AGE_RESTRICTED || guestResult.errorCode === ScraperErrorCode.COOKIE_REQUIRED || guestResult.errorCode === ScraperErrorCode.PRIVATE_CONTENT || guestResult.errorCode === ScraperErrorCode.NO_MEDIA);

    if (shouldRetry) {
        logger.debug('facebook', 'Retrying with cookie...');
        const cookieResult = await doScrape(true);
        if (cookieResult.success && (cookieResult.data?.formats?.length || 0) > 0) return cookieResult;
        if (!guestResult.success && !cookieResult.success) return cookieResult;
    }

    return guestResult;
}
