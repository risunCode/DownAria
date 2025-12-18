/**
 * Instagram Scraper Service
 * ==========================
 * 
 * CONTENT TYPES:
 * - /p/xxx/      → Post (image, carousel, or video)
 * - /reel/xxx/   → Reel (always video)
 * - /tv/xxx/     → IGTV (always video)
 * - /stories/    → Story (always requires cookie)
 * 
 * FLOW:
 * 1. Stories → Direct fetch with cookie (always private)
 * 2. Post/Reel/TV → GraphQL (no cookie) → if null → GraphQL (cookie) → if null → error
 * 3. Embed only as emergency fallback for API issues
 */

import { MediaFormat } from '@/lib/types';
import { addFormat, decodeUrl } from '@/lib/utils/http';
import { parseCookie } from '@/lib/utils/cookie-parser';
import { matchesPlatform } from './api-config';
import { ScraperResult, ScraperOptions, EngagementStats, INSTAGRAM_GRAPHQL_HEADERS, INSTAGRAM_STORY_HEADERS } from './fetch-helper';
import { getCache, setCache } from './cache';
import { createError, ScraperErrorCode } from './errors';
import { logger } from './logger';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

type ContentType = 'post' | 'reel' | 'tv' | 'story';

const GRAPHQL_DOC_ID = '8845758582119845';

// Note: Cache is now centralized in cache.ts with platform-specific TTL

// ============================================================================
// URL DETECTION
// ============================================================================

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

// ============================================================================
// GRAPHQL API
// ============================================================================

interface GraphQLMedia {
    __typename: string;
    id: string;
    shortcode: string;
    display_url: string;
    is_video: boolean;
    video_url?: string;
    owner?: { username: string; full_name?: string; id: string };
    edge_media_to_caption?: { edges: Array<{ node: { text: string } }> };
    edge_sidecar_to_children?: { edges: Array<{ node: GraphQLMediaNode }> };
    display_resources?: Array<{ src: string; config_width: number }>;
    taken_at_timestamp?: number;
    edge_media_preview_like?: { count: number };
    edge_media_to_comment?: { count: number };
    video_view_count?: number;
}

interface GraphQLMediaNode {
    id: string;
    is_video: boolean;
    video_url?: string;
    display_url: string;
    display_resources?: Array<{ src: string; config_width: number }>;
}

async function fetchGraphQL(shortcode: string, cookie?: string): Promise<{ media: GraphQLMedia | null; error?: string }> {
    const variables = JSON.stringify({
        shortcode,
        fetch_tagged_user_count: null,
        hoisted_comment_id: null,
        hoisted_reply_id: null
    });
    
    const url = `https://www.instagram.com/graphql/query/?doc_id=${GRAPHQL_DOC_ID}&variables=${encodeURIComponent(variables)}`;
    const headers = cookie ? { ...INSTAGRAM_GRAPHQL_HEADERS, Cookie: cookie } : INSTAGRAM_GRAPHQL_HEADERS;
    
    try {
        const res = await fetch(url, { headers });
        
        if (!res.ok) {
            return { media: null, error: `HTTP ${res.status}` };
        }
        
        const data = await res.json();
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
    
    // Extract engagement & timestamp (unified format)
    const postedAt = media.taken_at_timestamp 
        ? new Date(media.taken_at_timestamp * 1000).toISOString() 
        : undefined;
    const engagement: EngagementStats = {
        likes: media.edge_media_preview_like?.count || 0,
        comments: media.edge_media_to_comment?.count || 0,
        views: media.video_view_count || 0,
    };
    
    // Carousel (GraphSidecar)
    if (media.edge_sidecar_to_children?.edges) {
        media.edge_sidecar_to_children.edges.forEach((edge, i) => {
            const node = edge.node;
            const itemId = node.id || `slide-${i}`;
            
            if (node.is_video && node.video_url) {
                addFormat(formats, `Video ${i + 1}`, 'video', node.video_url, {
                    itemId,
                    thumbnail: node.display_url,
                    filename: `${author}_slide_${i + 1}`
                });
            } else {
                const bestUrl = node.display_resources?.length
                    ? node.display_resources[node.display_resources.length - 1].src
                    : node.display_url;
                addFormat(formats, `Image ${i + 1}`, 'image', bestUrl, {
                    itemId,
                    thumbnail: node.display_url,
                    filename: `${author}_slide_${i + 1}`
                });
            }
        });
        
        if (!thumbnail && media.edge_sidecar_to_children.edges[0]?.node?.display_url) {
            thumbnail = media.edge_sidecar_to_children.edges[0].node.display_url;
        }
    }
    // Single Video (GraphVideo)
    else if (media.is_video && media.video_url) {
        addFormat(formats, 'Video', 'video', media.video_url, {
            itemId: media.id,
            thumbnail: media.display_url
        });
    }
    // Single Image (GraphImage)
    else if (media.display_url) {
        const bestUrl = media.display_resources?.length
            ? media.display_resources[media.display_resources.length - 1].src
            : media.display_url;
        addFormat(formats, 'Original', 'image', bestUrl, {
            itemId: media.id,
            thumbnail: media.display_url
        });
    }
    
    if (formats.length === 0) {
        return createError(ScraperErrorCode.NO_MEDIA, 'No media found in response');
    }
    
    // Determine content type
    const hasVideo = formats.some(f => f.type === 'video');
    const isCarousel = formats.length > 1;
    const type = isCarousel ? 'mixed' : (hasVideo ? 'video' : 'image');
    
    return {
        success: true,
        data: {
            title,
            thumbnail,
            author: author ? `@${author}` : '',
            authorName,
            description: caption,
            postedAt,
            engagement: (engagement.likes || engagement.comments || engagement.views) ? engagement : undefined,
            formats,
            url: `https://www.instagram.com/p/${shortcode}/`,
            type,
        }
    };
}

// ============================================================================
// EMBED FALLBACK (Emergency only)
// ============================================================================

async function fetchEmbed(shortcode: string): Promise<ScraperResult> {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
    
    try {
        const res = await fetch(embedUrl, { headers: INSTAGRAM_GRAPHQL_HEADERS });
        if (!res.ok) return createError(ScraperErrorCode.API_ERROR, `Embed HTTP ${res.status}`);
        
        const html = await res.text();
        if (html.length < 1000) return createError(ScraperErrorCode.NO_MEDIA, 'Empty embed response');
        
        const formats: MediaFormat[] = [];
        let thumbnail = '';
        
        // Extract video
        const videoMatch = html.match(/"video_url":"([^"]+)"/);
        if (videoMatch) {
            const videoUrl = decodeUrl(videoMatch[1]);
            addFormat(formats, 'Video', 'video', videoUrl, { itemId: 'video-main' });
        }
        
        // Extract image
        const imgMatch = html.match(/"display_url":"([^"]+)"/);
        if (imgMatch) {
            thumbnail = decodeUrl(imgMatch[1]);
            if (!formats.length) {
                addFormat(formats, 'Original', 'image', thumbnail, { itemId: 'image-main', thumbnail });
            }
        }
        
        if (formats.length === 0) {
            return createError(ScraperErrorCode.NO_MEDIA, 'No media in embed');
        }
        
        // Extract author
        const authorMatch = html.match(/"owner":\{"username":"([^"]+)"/);
        const author = authorMatch ? `@${authorMatch[1]}` : '';
        
        return {
            success: true,
            data: {
                title: 'Instagram Post',
                thumbnail,
                author,
                formats,
                url: `https://www.instagram.com/p/${shortcode}/`
            }
        };
    } catch (e) {
        return createError(ScraperErrorCode.NETWORK_ERROR, e instanceof Error ? e.message : 'Embed failed');
    }
}

// ============================================================================
// STORY SCRAPER (via Instagram API)
// ============================================================================

async function getUserId(username: string, cookie: string): Promise<string | null> {
    const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
    try {
        const res = await fetch(url, { headers: { ...INSTAGRAM_STORY_HEADERS, Cookie: cookie } });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.data?.user?.id || null;
    } catch {
        return null;
    }
}

interface StoryItem {
    pk: string;
    media_type: number; // 1 = image, 2 = video
    video_versions?: Array<{ url: string; width: number }>;
    image_versions2?: { candidates: Array<{ url: string; width: number }> };
}

async function scrapeStory(url: string, cookie?: string): Promise<ScraperResult> {
    const info = extractStoryInfo(url);
    if (!info) return createError(ScraperErrorCode.INVALID_URL, 'Invalid story URL');
    
    const { username, storyId } = info;
    logger.debug('instagram', `Story: @${username}, ID: ${storyId}`);
    
    // Stories ALWAYS require cookie
    if (!cookie) {
        return createError(ScraperErrorCode.COOKIE_REQUIRED, 'Stories require login. Please provide a cookie.');
    }
    
    try {
        // Step 1: Get user ID from username
        const userId = await getUserId(username, cookie);
        if (!userId) {
            return createError(ScraperErrorCode.NOT_FOUND, 'Could not find user');
        }
        logger.debug('instagram', `User ID: ${userId}`);
        
        // Step 2: Fetch stories via API
        const apiUrl = `https://www.instagram.com/api/v1/feed/reels_media/?reel_ids=${userId}`;
        const res = await fetch(apiUrl, { headers: { ...INSTAGRAM_STORY_HEADERS, Cookie: cookie } });
        
        if (!res.ok) {
            return createError(ScraperErrorCode.API_ERROR, `Story API error: ${res.status}`);
        }
        
        const data = await res.json();
        const items: StoryItem[] = data?.reels_media?.[0]?.items || [];
        
        if (items.length === 0) {
            return createError(ScraperErrorCode.NOT_FOUND, 'No stories available (may have expired)');
        }
        
        // Find the specific story by ID, or use first if not found
        let targetItem = items.find(item => item.pk === storyId) || items[0];
        const formats: MediaFormat[] = [];
        let thumbnail = '';
        
        // Extract media from target story
        if (targetItem.media_type === 2 && targetItem.video_versions?.length) {
            // Video story
            const sorted = [...targetItem.video_versions].sort((a, b) => (b.width || 0) - (a.width || 0));
            if (sorted[0]?.url) {
                addFormat(formats, 'HD Video', 'video', sorted[0].url, { itemId: `story-${targetItem.pk}` });
            }
            // Get thumbnail from image_versions2
            if (targetItem.image_versions2?.candidates?.length) {
                thumbnail = targetItem.image_versions2.candidates[0].url;
            }
        } else if (targetItem.image_versions2?.candidates?.length) {
            // Image story
            const sorted = [...targetItem.image_versions2.candidates].sort((a, b) => (b.width || 0) - (a.width || 0));
            if (sorted[0]?.url) {
                thumbnail = sorted[0].url;
                addFormat(formats, 'Original', 'image', sorted[0].url, { itemId: `story-${targetItem.pk}`, thumbnail });
            }
        }
        
        // Also add other stories if multiple
        if (items.length > 1) {
            items.forEach((item, idx) => {
                if (item.pk === targetItem.pk) return; // Skip already added
                
                if (item.media_type === 2 && item.video_versions?.length) {
                    const sorted = [...item.video_versions].sort((a, b) => (b.width || 0) - (a.width || 0));
                    if (sorted[0]?.url) {
                        addFormat(formats, `Story ${idx + 1} (Video)`, 'video', sorted[0].url, { 
                            itemId: `story-${item.pk}`,
                            thumbnail: item.image_versions2?.candidates?.[0]?.url
                        });
                    }
                } else if (item.image_versions2?.candidates?.length) {
                    const sorted = [...item.image_versions2.candidates].sort((a, b) => (b.width || 0) - (a.width || 0));
                    if (sorted[0]?.url) {
                        addFormat(formats, `Story ${idx + 1} (Image)`, 'image', sorted[0].url, { 
                            itemId: `story-${item.pk}`,
                            thumbnail: sorted[0].url
                        });
                    }
                }
            });
        }
        
        if (formats.length === 0) {
            return createError(ScraperErrorCode.NO_MEDIA, 'Could not extract story media');
        }
        
        return {
            success: true,
            data: {
                title: `${username}'s Story`,
                thumbnail,
                author: `@${username}`,
                description: `${items.length} story${items.length > 1 ? 's' : ''} available`,
                formats,
                url
            }
        };
    } catch (e) {
        return createError(ScraperErrorCode.NETWORK_ERROR, e instanceof Error ? e.message : 'Story fetch failed');
    }
}

// ============================================================================
// MAIN SCRAPER
// ============================================================================

export async function scrapeInstagram(url: string, options?: ScraperOptions): Promise<ScraperResult> {
    const { cookie: rawCookie, skipCache = false } = options || {};
    
    // Parse cookie (supports JSON format from Cookie Editor)
    const cookie = rawCookie ? parseCookie(rawCookie, 'instagram') || undefined : undefined;
    
    if (!matchesPlatform(url, 'instagram')) {
        return createError(ScraperErrorCode.INVALID_URL, 'Invalid Instagram URL');
    }
    
    const contentType = detectContentType(url);
    logger.type('instagram', contentType);
    
    // ─────────────────────────────────────────────────────────────────
    // STORIES: Always require cookie
    // ─────────────────────────────────────────────────────────────────
    if (contentType === 'story') {
        return scrapeStory(url, cookie);
    }
    
    // ─────────────────────────────────────────────────────────────────
    // POST / REEL / TV: GraphQL flow
    // ─────────────────────────────────────────────────────────────────
    const shortcode = extractShortcode(url);
    if (!shortcode) {
        return createError(ScraperErrorCode.INVALID_URL, 'Could not extract post ID from URL');
    }
    
    // Check cache
    if (!skipCache) {
        const cached = await getCache<ScraperResult>('instagram', url);
        if (cached?.success) {
            logger.cache('instagram', true);
            return { ...cached, cached: true };
        }
    }
    
    // Step 1: Try GraphQL without cookie (public content)
    logger.debug('instagram', 'GraphQL probe (no cookie)...');
    const { media, error: gqlError } = await fetchGraphQL(shortcode);
    
    if (media) {
        // PUBLIC content - success!
        logger.debug('instagram', `✓ Public content: ${media.__typename}`);
        const result = parseGraphQLMedia(media, shortcode);
        if (result.success) {
            setCache('instagram', url, result);
        }
        return result;
    }
    
    // Step 2: If null and we have cookie, try with cookie (age-restricted)
    if (cookie) {
        logger.debug('instagram', 'GraphQL retry (with cookie)...');
        const { media: authMedia } = await fetchGraphQL(shortcode, cookie);
        
        if (authMedia) {
            // AGE-RESTRICTED content - success with cookie!
            logger.debug('instagram', `✓ Age-restricted content: ${authMedia.__typename}`);
            const result = parseGraphQLMedia(authMedia, shortcode);
            if (result.success) {
                setCache('instagram', url, result);
            }
            return result;
        }
        
        // Still null with cookie = private account or deleted
        logger.debug('instagram', '✗ Private or deleted (cookie didn\'t help)');
        return createError(ScraperErrorCode.PRIVATE_CONTENT, 'Post is private or has been deleted');
    }
    
    // Step 3: No cookie provided, content requires auth
    // Check if it's an API error vs auth required
    if (gqlError && (gqlError.includes('HTTP 4') || gqlError.includes('HTTP 5'))) {
        // API error - try embed as emergency fallback
        logger.debug('instagram', 'API error, trying embed fallback...');
        const embedResult = await fetchEmbed(shortcode);
        if (embedResult.success) {
            setCache('instagram', url, embedResult);
            return embedResult;
        }
    }
    
    // Content requires authentication
    logger.debug('instagram', '✗ Requires authentication');
    return createError(ScraperErrorCode.COOKIE_REQUIRED, 'This post requires login. Please provide a cookie.');
}
