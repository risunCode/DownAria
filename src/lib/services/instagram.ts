/**
 * Instagram Scraper Service
 * ==========================
 * FLOW:
 * 1. Stories → Direct fetch with cookie (always private)
 * 2. Post/Reel/TV → GraphQL (no cookie) → if null → GraphQL (cookie) → if null → error
 */

import { MediaFormat } from '@/lib/types';
import { addFormat, decodeUrl, httpGet, INSTAGRAM_HEADERS, type EngagementStats } from '@/lib/http';
import { parseCookie } from '@/lib/cookies';
import { matchesPlatform } from './helper/api-config';
import { getCache, setCache } from './helper/cache';
import { createError, ScraperErrorCode, type ScraperResult, type ScraperOptions } from '@/core/scrapers/types';
import { logger } from './helper/logger';

type ContentType = 'post' | 'reel' | 'tv' | 'story';
const GRAPHQL_DOC_ID = '8845758582119845';

function detectContentType(url: string): ContentType {
    if (url.includes('/stories/')) return 'story';
    if (url.includes('/reel/') || url.includes('/reels/')) return 'reel';
    if (url.includes('/tv/')) return 'tv';
    return 'post';
}

function extractShortcode(url: string): string | null {
    const match = url.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
}

function extractStoryInfo(url: string): { username: string; storyId: string } | null {
    const match = url.match(/\/stories\/([^/]+)\/(\d+)/);
    return match ? { username: match[1], storyId: match[2] } : null;
}

interface GraphQLMedia {
    __typename: string; id: string; shortcode: string; display_url: string; is_video: boolean;
    video_url?: string; owner?: { username: string; full_name?: string; id: string };
    edge_media_to_caption?: { edges: Array<{ node: { text: string } }> };
    edge_sidecar_to_children?: { edges: Array<{ node: GraphQLMediaNode }> };
    display_resources?: Array<{ src: string; config_width: number }>;
    taken_at_timestamp?: number; edge_media_preview_like?: { count: number };
    edge_media_to_comment?: { count: number }; video_view_count?: number;
}

interface GraphQLMediaNode {
    id: string; is_video: boolean; video_url?: string; display_url: string;
    display_resources?: Array<{ src: string; config_width: number }>;
}

async function fetchGraphQL(shortcode: string, cookie?: string): Promise<{ media: GraphQLMedia | null; error?: string }> {
    const variables = JSON.stringify({ shortcode, fetch_tagged_user_count: null, hoisted_comment_id: null, hoisted_reply_id: null });
    const url = `https://www.instagram.com/graphql/query/?doc_id=${GRAPHQL_DOC_ID}&variables=${encodeURIComponent(variables)}`;
    
    try {
        const res = await httpGet(url, { headers: cookie ? { ...INSTAGRAM_HEADERS, Cookie: cookie } : INSTAGRAM_HEADERS });
        if (res.status !== 200) return { media: null, error: `HTTP ${res.status}` };
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        return { media: data.data?.xdt_shortcode_media || null };
    } catch (e) {
        return { media: null, error: e instanceof Error ? e.message : 'Fetch failed' };
    }
}

function parseGraphQLMedia(media: GraphQLMedia, shortcode: string): ScraperResult {
    const formats: MediaFormat[] = [];
    const author = media.owner?.username || '';
    const authorName = media.owner?.full_name || '';
    const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || '';
    const title = caption ? (caption.length > 80 ? caption.substring(0, 80) + '...' : caption) : 'Instagram Post';
    let thumbnail = media.display_url || '';
    
    const postedAt = media.taken_at_timestamp ? new Date(media.taken_at_timestamp * 1000).toISOString() : undefined;
    const engagement: EngagementStats = { likes: media.edge_media_preview_like?.count || 0, comments: media.edge_media_to_comment?.count || 0, views: media.video_view_count || 0 };
    
    if (media.edge_sidecar_to_children?.edges) {
        media.edge_sidecar_to_children.edges.forEach((edge, i) => {
            const node = edge.node;
            const itemId = node.id || `slide-${i}`;
            if (node.is_video && node.video_url) {
                addFormat(formats, `Video ${i + 1}`, 'video', node.video_url, { itemId, thumbnail: node.display_url, filename: `${author}_slide_${i + 1}` });
            } else {
                const bestUrl = node.display_resources?.length ? node.display_resources[node.display_resources.length - 1].src : node.display_url;
                addFormat(formats, `Image ${i + 1}`, 'image', bestUrl, { itemId, thumbnail: node.display_url, filename: `${author}_slide_${i + 1}` });
            }
        });
        if (!thumbnail && media.edge_sidecar_to_children.edges[0]?.node?.display_url) thumbnail = media.edge_sidecar_to_children.edges[0].node.display_url;
    } else if (media.is_video && media.video_url) {
        addFormat(formats, 'Video', 'video', media.video_url, { itemId: media.id, thumbnail: media.display_url });
    } else if (media.display_url) {
        const bestUrl = media.display_resources?.length ? media.display_resources[media.display_resources.length - 1].src : media.display_url;
        addFormat(formats, 'Original', 'image', bestUrl, { itemId: media.id, thumbnail: media.display_url });
    }
    
    if (formats.length === 0) return createError(ScraperErrorCode.NO_MEDIA, 'No media found in response');
    
    const hasVideo = formats.some(f => f.type === 'video');
    const isCarousel = formats.length > 1;
    const type = isCarousel ? 'mixed' : (hasVideo ? 'video' : 'image');
    
    return { success: true, data: { title, thumbnail, author: author ? `@${author}` : '', authorName, description: caption, postedAt, engagement: (engagement.likes || engagement.comments || engagement.views) ? engagement : undefined, formats, url: `https://www.instagram.com/p/${shortcode}/`, type } };
}

async function fetchEmbed(shortcode: string): Promise<ScraperResult> {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    try {
        const res = await httpGet(embedUrl, { headers: INSTAGRAM_HEADERS });
        if (res.status !== 200) return createError(ScraperErrorCode.API_ERROR, `Embed HTTP ${res.status}`);
        const html = res.data;
        if (html.length < 1000) return createError(ScraperErrorCode.NO_MEDIA, 'Empty embed response');
        
        const formats: MediaFormat[] = [];
        let thumbnail = '';
        const videoMatch = html.match(/"video_url":"([^"]+)"/);
        if (videoMatch) addFormat(formats, 'Video', 'video', decodeUrl(videoMatch[1]), { itemId: 'video-main' });
        const imgMatch = html.match(/"display_url":"([^"]+)"/);
        if (imgMatch) { thumbnail = decodeUrl(imgMatch[1]); if (!formats.length) addFormat(formats, 'Original', 'image', thumbnail, { itemId: 'image-main', thumbnail }); }
        if (formats.length === 0) return createError(ScraperErrorCode.NO_MEDIA, 'No media in embed');
        const authorMatch = html.match(/"owner":\{"username":"([^"]+)"/);
        return { success: true, data: { title: 'Instagram Post', thumbnail, author: authorMatch ? `@${authorMatch[1]}` : '', formats, url: `https://www.instagram.com/p/${shortcode}/` } };
    } catch (e) {
        return createError(ScraperErrorCode.NETWORK_ERROR, e instanceof Error ? e.message : 'Embed failed');
    }
}

async function getUserId(username: string, cookie: string): Promise<string | null> {
    const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    try {
        const res = await httpGet(url, { headers: { ...INSTAGRAM_HEADERS, Cookie: cookie } });
        if (res.status !== 200) return null;
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        return data?.data?.user?.id || null;
    } catch { return null; }
}

interface StoryItem { pk: string; media_type: number; video_versions?: Array<{ url: string; width: number }>; image_versions2?: { candidates: Array<{ url: string; width: number }> } }

async function scrapeStory(url: string, cookie?: string): Promise<ScraperResult> {
    const info = extractStoryInfo(url);
    if (!info) return createError(ScraperErrorCode.INVALID_URL, 'Invalid story URL');
    const { username, storyId } = info;
    if (!cookie) return createError(ScraperErrorCode.COOKIE_REQUIRED, 'Stories require login. Please provide a cookie.');
    
    try {
        const userId = await getUserId(username, cookie);
        if (!userId) return createError(ScraperErrorCode.NOT_FOUND, 'Could not find user');
        
        const apiUrl = `https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=${userId}`;
        const res = await httpGet(apiUrl, { headers: { ...INSTAGRAM_HEADERS, Cookie: cookie } });
        if (res.status !== 200) return createError(ScraperErrorCode.API_ERROR, `Story API error: ${res.status}`);
        
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        const items: StoryItem[] = data?.reels_media?.[0]?.items || [];
        if (items.length === 0) return createError(ScraperErrorCode.NOT_FOUND, 'No stories available (may have expired)');
        
        const targetItem = items.find(item => item.pk === storyId) || items[0];
        const formats: MediaFormat[] = [];
        let thumbnail = '';
        
        if (targetItem.media_type === 2 && targetItem.video_versions?.length) {
            const sorted = [...targetItem.video_versions].sort((a, b) => (b.width || 0) - (a.width || 0));
            if (sorted[0]?.url) addFormat(formats, 'HD Video', 'video', sorted[0].url, { itemId: `story-${targetItem.pk}` });
            if (targetItem.image_versions2?.candidates?.length) thumbnail = targetItem.image_versions2.candidates[0].url;
        } else if (targetItem.image_versions2?.candidates?.length) {
            const sorted = [...targetItem.image_versions2.candidates].sort((a, b) => (b.width || 0) - (a.width || 0));
            if (sorted[0]?.url) { thumbnail = sorted[0].url; addFormat(formats, 'Original', 'image', sorted[0].url, { itemId: `story-${targetItem.pk}`, thumbnail }); }
        }
        
        if (items.length > 1) {
            items.forEach((item, idx) => {
                if (item.pk === targetItem.pk) return;
                if (item.media_type === 2 && item.video_versions?.length) {
                    const sorted = [...item.video_versions].sort((a, b) => (b.width || 0) - (a.width || 0));
                    if (sorted[0]?.url) addFormat(formats, `Story ${idx + 1} (Video)`, 'video', sorted[0].url, { itemId: `story-${item.pk}`, thumbnail: item.image_versions2?.candidates?.[0]?.url });
                } else if (item.image_versions2?.candidates?.length) {
                    const sorted = [...item.image_versions2.candidates].sort((a, b) => (b.width || 0) - (a.width || 0));
                    if (sorted[0]?.url) addFormat(formats, `Story ${idx + 1} (Image)`, 'image', sorted[0].url, { itemId: `story-${item.pk}`, thumbnail: sorted[0].url });
                }
            });
        }
        
        if (formats.length === 0) return createError(ScraperErrorCode.NO_MEDIA, 'Could not extract story media');
        return { success: true, data: { title: `${username}'s Story`, thumbnail, author: `@${username}`, description: `${items.length} story${items.length > 1 ? 's' : ''} available`, formats, url } };
    } catch (e) {
        return createError(ScraperErrorCode.NETWORK_ERROR, e instanceof Error ? e.message : 'Story fetch failed');
    }
}

export async function scrapeInstagram(url: string, options?: ScraperOptions): Promise<ScraperResult> {
    const { cookie: rawCookie, skipCache = false } = options || {};
    const cookie = rawCookie ? parseCookie(rawCookie, 'instagram') || undefined : undefined;
    
    if (!matchesPlatform(url, 'instagram')) return createError(ScraperErrorCode.INVALID_URL, 'Invalid Instagram URL');
    
    const contentType = detectContentType(url);
    logger.type('instagram', contentType);
    
    if (contentType === 'story') return scrapeStory(url, cookie);
    
    const shortcode = extractShortcode(url);
    if (!shortcode) return createError(ScraperErrorCode.INVALID_URL, 'Could not extract post ID from URL');
    
    if (!skipCache) {
        const cached = await getCache<ScraperResult>('instagram', url);
        if (cached?.success) { logger.cache('instagram', true); return { ...cached, cached: true }; }
    }
    
    // Step 1: GraphQL without cookie
    logger.debug('instagram', 'GraphQL probe (no cookie)...');
    const { media, error: gqlError } = await fetchGraphQL(shortcode);
    if (media) {
        const result = parseGraphQLMedia(media, shortcode);
        if (result.success) setCache('instagram', url, result);
        return result;
    }
    
    // Step 2: GraphQL with cookie
    if (cookie) {
        logger.debug('instagram', 'GraphQL retry (with cookie)...');
        const { media: authMedia } = await fetchGraphQL(shortcode, cookie);
        if (authMedia) {
            const result = parseGraphQLMedia(authMedia, shortcode);
            if (result.success) setCache('instagram', url, result);
            return result;
        }
        return createError(ScraperErrorCode.PRIVATE_CONTENT, 'Post is private or has been deleted');
    }
    
    // Step 3: Embed fallback
    if (gqlError && (gqlError.includes('HTTP 4') || gqlError.includes('HTTP 5'))) {
        logger.debug('instagram', 'API error, trying embed fallback...');
        const embedResult = await fetchEmbed(shortcode);
        if (embedResult.success) { setCache('instagram', url, embedResult); return embedResult; }
    }
    
    return createError(ScraperErrorCode.COOKIE_REQUIRED, 'This post requires login. Please provide a cookie.');
}
