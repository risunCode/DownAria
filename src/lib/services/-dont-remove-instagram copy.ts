/**
 * Instagram Scraper Service
 * Supports posts, reels, IGTV, carousels, and stories
 */

import * as cheerio from 'cheerio';
import { MediaFormat } from '@/lib/types';
import { addFormat, decodeUrl, getQualityLabel } from '@/lib/utils/http';
import { matchesPlatform, getBaseUrl } from './api-config';
import { browserFetch, ScraperResult } from './fetch-helper';

// ============================================================================
// STORIES SCRAPER
// ============================================================================

async function scrapeInstagramStory(url: string, cookie?: string): Promise<ScraperResult> {
    // Extract username and story ID from URL
    // Format: /stories/{username}/{story_id}/
    const storyMatch = url.match(/\/stories\/([^/]+)\/(\d+)/);
    if (!storyMatch) return { success: false, error: 'Invalid story URL format' };
    
    const [, username, storyId] = storyMatch;
    console.log(`[Instagram] Story: @${username}, ID: ${storyId}`);
    
    const formats: MediaFormat[] = [];
    let title = `${username}'s Story`;
    let thumbnail = '';
    
    try {
        const headers: HeadersInit = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
        };
        
        if (cookie) {
            headers['Cookie'] = cookie;
        }
        
        // Fetch story page
        const response = await fetch(url, { headers, redirect: 'follow' });
        const html = await response.text();
        
        console.log(`[Instagram] Story response: ${html.length} bytes`);
        
        // Method 1: Look for story media in JSON data
        // Pattern: "video_versions" or "image_versions2" near the story ID
        const decoded = html.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
        
        // Find video URLs (stories are usually videos)
        // Pattern: scontent.cdninstagram.com with t51.82787 (story type)
        const videoPatterns = [
            // video_versions array
            /"video_versions":\[([^\]]+)\]/g,
            // Direct video URL
            /"url":"(https:\/\/scontent[^"]+\.mp4[^"]*)"/g,
        ];
        
        // Try to find video versions
        const videoVersionsMatch = decoded.match(/"video_versions":\[([^\]]+)\]/);
        if (videoVersionsMatch) {
            try {
                const versions = JSON.parse(`[${videoVersionsMatch[1]}]`);
                // Sort by width (highest first)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                versions.sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
                
                if (versions[0]?.url) {
                    const videoUrl = decodeUrl(versions[0].url);
                    addFormat(formats, 'HD Video', 'video', videoUrl, { itemId: `story-${storyId}` });
                    console.log(`[Instagram] Found story video: ${videoUrl.substring(0, 60)}...`);
                }
            } catch (e) {
                console.log(`[Instagram] Failed to parse video_versions: ${e}`);
            }
        }
        
        // Method 2: Look for image versions (for image stories)
        if (!formats.length) {
            const imageVersionsMatch = decoded.match(/"image_versions2":\{"candidates":\[([^\]]+)\]/);
            if (imageVersionsMatch) {
                try {
                    const candidates = JSON.parse(`[${imageVersionsMatch[1]}]`);
                    // Sort by width (highest first)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    candidates.sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
                    
                    if (candidates[0]?.url) {
                        const imageUrl = decodeUrl(candidates[0].url);
                        addFormat(formats, 'Original', 'image', imageUrl, { itemId: `story-${storyId}`, thumbnail: imageUrl });
                        thumbnail = imageUrl;
                        console.log(`[Instagram] Found story image: ${imageUrl.substring(0, 60)}...`);
                    }
                } catch (e) {
                    console.log(`[Instagram] Failed to parse image_versions2: ${e}`);
                }
            }
        }
        
        // Method 3: Direct URL extraction from HTML
        // Look for scontent URLs with story patterns
        if (!formats.length) {
            // Video pattern
            const mp4Match = decoded.match(/https:\/\/scontent[^"'\s]+?\.mp4[^"'\s]*/);
            if (mp4Match) {
                const videoUrl = mp4Match[0].replace(/\\u0026/g, '&');
                addFormat(formats, 'Video', 'video', videoUrl, { itemId: `story-${storyId}` });
                console.log(`[Instagram] Found story video (direct): ${videoUrl.substring(0, 60)}...`);
            }
            
            // Image pattern - t51.82787 is story image type
            if (!formats.length) {
                const imgMatch = decoded.match(/https:\/\/scontent[^"'\s]+?t51\.82787[^"'\s]+?\.jpg[^"'\s]*/);
                if (imgMatch) {
                    const imageUrl = imgMatch[0].replace(/\\u0026/g, '&');
                    // Skip small thumbnails
                    if (!/p\d{2,3}x\d{2,3}/.test(imageUrl)) {
                        addFormat(formats, 'Original', 'image', imageUrl, { itemId: `story-${storyId}`, thumbnail: imageUrl });
                        thumbnail = imageUrl;
                        console.log(`[Instagram] Found story image (direct): ${imageUrl.substring(0, 60)}...`);
                    }
                }
            }
        }
        
        // Method 4: og:image fallback
        if (!formats.length) {
            const $ = cheerio.load(html);
            const ogImage = $('meta[property="og:image"]').attr('content');
            if (ogImage && ogImage.includes('scontent')) {
                addFormat(formats, 'Preview', 'image', ogImage, { itemId: `story-${storyId}`, thumbnail: ogImage });
                thumbnail = ogImage;
                console.log(`[Instagram] Found story image (og:image): ${ogImage.substring(0, 60)}...`);
            }
        }
        
        if (!formats.length) {
            return { success: false, error: 'Could not extract story media. Story may have expired or requires login.' };
        }
        
        return {
            success: true,
            data: {
                title,
                thumbnail,
                author: `@${username}`,
                formats,
                url
            }
        };
        
    } catch (e) {
        console.error(`[Instagram] Story error:`, e);
        return { success: false, error: e instanceof Error ? e.message : 'Failed to fetch story' };
    }
}

// ============================================================================
// GRAPHQL API METHOD
// ============================================================================

const GRAPHQL_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'X-IG-App-ID': '936619743392459',
    'X-Requested-With': 'XMLHttpRequest',
    'X-ASBD-ID': '129477',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
};

// GraphQL doc_id for media query (works for posts, reels, carousels)
const GRAPHQL_DOC_ID = '8845758582119845';

async function fetchInstagramGraphQL(shortcode: string, cookie?: string): Promise<ScraperResult> {
    const variables = JSON.stringify({
        shortcode,
        fetch_tagged_user_count: null,
        hoisted_comment_id: null,
        hoisted_reply_id: null
    });
    
    const url = `https://www.instagram.com/graphql/query/?doc_id=${GRAPHQL_DOC_ID}&variables=${encodeURIComponent(variables)}`;
    
    // Add cookie to headers if provided (for age-restricted/private content)
    const headers: Record<string, string> = { ...GRAPHQL_HEADERS };
    if (cookie) {
        headers['Cookie'] = cookie;
    }
    
    const res = await fetch(url, { headers });
    if (!res.ok) {
        return { success: false, error: `GraphQL error: ${res.status}` };
    }
    
    const data = await res.json();
    const media = data.data?.xdt_shortcode_media;
    
    if (!media) {
        return { success: false, error: 'No media found in GraphQL response' };
    }
    
    const formats: MediaFormat[] = [];
    const author = media.owner?.username || '';
    const caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || '';
    const title = caption ? (caption.length > 80 ? caption.substring(0, 80) + '...' : caption) : 'Instagram Post';
    let thumbnail = media.display_url || '';
    
    // Handle carousel (GraphSidecar)
    if (media.edge_sidecar_to_children?.edges) {
        const edges = media.edge_sidecar_to_children.edges;
        edges.forEach((edge: { node: { id: string; is_video: boolean; video_url?: string; display_url: string; display_resources?: Array<{ config_width: number; config_height: number; src: string }> } }, i: number) => {
            const node = edge.node;
            const itemId = node.id || `slide-${i}`;
            
            if (node.is_video && node.video_url) {
                addFormat(formats, `Video ${i + 1}`, 'video', node.video_url, {
                    itemId,
                    thumbnail: node.display_url,
                    filename: `${author}_slide_${i + 1}`
                });
            } else {
                // Get highest resolution image
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
        
        // Set thumbnail from first item
        if (!thumbnail && edges[0]?.node?.display_url) {
            thumbnail = edges[0].node.display_url;
        }
    }
    // Handle single video (GraphVideo)
    else if (media.is_video && media.video_url) {
        addFormat(formats, 'Video', 'video', media.video_url, {
            itemId: media.id,
            thumbnail: media.display_url
        });
    }
    // Handle single image (GraphImage)
    else if (media.display_url) {
        // Get highest resolution
        const bestUrl = media.display_resources?.length 
            ? media.display_resources[media.display_resources.length - 1].src 
            : media.display_url;
        addFormat(formats, 'Original', 'image', bestUrl, {
            itemId: media.id,
            thumbnail: media.display_url
        });
    }
    
    if (formats.length === 0) {
        return { success: false, error: 'Could not extract media from GraphQL' };
    }
    
    return {
        success: true,
        data: {
            title,
            thumbnail,
            author: author ? `@${author}` : '',
            description: caption,
            formats,
            url: `https://www.instagram.com/p/${shortcode}/`
        }
    };
}

// ============================================================================
// MAIN SCRAPER
// ============================================================================

// Simple in-memory cache
const igCache = new Map<string, { data: ScraperResult; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function scrapeInstagram(url: string, cookie?: string): Promise<ScraperResult> {
    if (!matchesPlatform(url, 'instagram')) return { success: false, error: 'Invalid Instagram URL' };
    
    // Check if it's a story URL
    if (url.includes('/stories/')) {
        return scrapeInstagramStory(url, cookie);
    }
    
    const shortcode = url.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1];
    if (!shortcode) return { success: false, error: 'Could not extract post ID' };

    // Check cache
    const cacheKey = `ig:${shortcode}`;
    const cached = igCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
        console.log(`[Instagram] Cache hit: ${shortcode}`);
        return cached.data;
    }

    let formats: MediaFormat[] = [];
    let title = 'Instagram Post', thumbnail = '', author = '';
    const urlType = url.includes('/reel') ? 'reel' : url.includes('/tv/') ? 'tv' : 'p';

    // ═══════════════════════════════════════════════════════════════
    // PRIMARY: GRAPHQL API (supports carousels, fast & reliable)
    // ═══════════════════════════════════════════════════════════════
    try {
        // Try without cookie first
        let graphqlResult = await fetchInstagramGraphQL(shortcode);
        
        // If failed and we have cookie, retry with cookie (for age-restricted/private)
        if (!graphqlResult.success && cookie) {
            console.log(`[Instagram] GraphQL retry with cookie...`);
            graphqlResult = await fetchInstagramGraphQL(shortcode, cookie);
        }
        
        if (graphqlResult.success && graphqlResult.data) {
            console.log(`[Instagram] GraphQL success: ${graphqlResult.data.formats.length} format(s)`);
            // Cache and return
            igCache.set(cacheKey, { data: graphqlResult, expires: Date.now() + CACHE_TTL });
            return graphqlResult;
        }
    } catch (e) {
        console.log(`[Instagram] GraphQL failed, trying embed...`);
    }

    // ═══════════════════════════════════════════════════════════════
    // FALLBACK: EMBED METHOD (for when GraphQL fails)
    // ═══════════════════════════════════════════════════════════════
    const embedUrls = [
        `https://www.instagram.com/${urlType}/${shortcode}/embed/`,
        `https://www.instagram.com/${urlType}/${shortcode}/embed/captioned/`,
        `https://www.instagram.com/p/${shortcode}/embed/`,
    ];

    for (const embedUrl of embedUrls) {
        if (formats.length) break;
        try {
            const embedRes = await browserFetch(embedUrl, 'instagram');
            if (!embedRes.ok) continue;
            
            const html = await embedRes.text();
            if (html.length < 500) continue;
            
            // Check for errors
            if (/This page isn't available|Login to see|Private Account/i.test(html)) continue;

            // Extract image/thumbnail FIRST (needed for video thumbnail)
            const imgMatch = html.match(/display_url\\?":\\?"(https:[^"]+)\\?"/) ||
                            html.match(/class="EmbeddedMediaImage"[^>]+src="([^"]+)"/) ||
                            html.match(/property="og:image"[^>]+content="([^"]+)"/) ||
                            html.match(/<img[^>]+src="(https:\/\/(?:scontent|instagram)[^"]+)"/);
            if (imgMatch) {
                const imgUrl = decodeUrl(imgMatch[1]).replace(/&amp;/g, '&');
                if ((imgUrl.includes('scontent') || imgUrl.includes('instagram')) && !/\/[sp]\d{2,3}x\d{2,3}\//.test(imgUrl)) {
                    thumbnail = imgUrl;
                }
            }

            // Extract video
            const videoMatch = html.match(/video_url\\?":\\?"(https:[^"]+)\\?"/i) ||
                              html.match(/https:[\\\/]+[^"'\s]+\.mp4[^"'\s]*/);
            if (videoMatch) {
                const videoUrl = decodeUrl(videoMatch[1] || videoMatch[0]);
                if (videoUrl.includes('.mp4') || videoUrl.includes('video')) {
                    addFormat(formats, 'Video', 'video', videoUrl, { itemId: 'video-main', thumbnail });
                }
            }

            // If no video, add image as format
            if (!formats.length && thumbnail) {
                addFormat(formats, 'Original', 'image', thumbnail, { itemId: 'image-main', thumbnail });
            }

            // Extract author
            const authorMatch = html.match(/"owner":\{"username":"([^"]+)"/) ||
                               html.match(/instagram\.com\/([a-zA-Z0-9_.]+)\/?\?/);
            if (authorMatch && !['p', 'reel', 'embed'].includes(authorMatch[1])) {
                author = authorMatch[1];
            }

            // Extract title from og:title
            const titleMatch = html.match(/property="og:title"[^>]+content="([^"]+)"/);
            if (titleMatch) title = titleMatch[1];

            if (formats.length) {
                console.log(`[Instagram] Embed success: ${formats.length} format(s)`);
                break;
            }
        } catch { /* continue to next embed URL */ }
    }

    // If embed worked, return early
    if (formats.length) {
        const seen = new Set<string>(), unique = formats.filter(f => { if (seen.has(f.url)) return false; seen.add(f.url); return true; });
        // Ensure thumbnail is properly decoded
        const cleanThumbnail = thumbnail ? decodeUrl(thumbnail).replace(/\\+$/, '') : '';
        console.log(`[Instagram] Thumbnail: ${cleanThumbnail.substring(0, 80)}...`);
        const result: ScraperResult = { success: true, data: { title, thumbnail: cleanThumbnail, author, formats: unique, url } };
        
        // Cache successful result
        igCache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
        
        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    // FALLBACK: MAIN PAGE (slower but more data)
    // ═══════════════════════════════════════════════════════════════
    let fetchUrl = `${getBaseUrl('instagram')}/${urlType}/${shortcode}/`;

    try {
        const headRes = await browserFetch(fetchUrl, 'instagram', { method: 'HEAD', redirect: 'follow' });
        if (headRes.url !== fetchUrl) fetchUrl = headRes.url;

        const response = await browserFetch(fetchUrl, 'instagram', { redirect: 'follow' });
        if (response.ok) {
            const html = await response.text(), $ = cheerio.load(html);
            title = $('meta[property="og:title"]').attr('content') || title;
            thumbnail = $('meta[property="og:image"]').attr('content') || '';
            const desc = $('meta[property="og:description"]').attr('content') || '';
            const authorM = desc.match(/^([^on]+) on Instagram/);
            if (authorM) author = authorM[1].trim();

            const ogVideo = $('meta[property="og:video"]').attr('content');
            if (ogVideo) addFormat(formats, 'Video (Meta)', 'video', ogVideo);

            // xdt_api patterns
            if (!formats.length) {
                const jsonScripts = $('script[type="application/json"][data-content-len]');
                const allScripts = jsonScripts.length > 0 ? jsonScripts : $('script[type="application/json"]');

                allScripts.each((_, el) => {
                    if (formats.length) return;
                    const text = $(el).html();
                    if (!text || (!text.includes('xdt_api__v1__media') && !text.includes('video_versions') && !text.includes('image_versions2'))) return;
                    try {
                        const data = JSON.parse(text);
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const find = (o: any): any => {
                            if (!o || typeof o !== 'object') return null;
                            if (o.xdt_api__v1__media__shortcode__web_info?.items) return o.xdt_api__v1__media__shortcode__web_info.items;
                            if (o.items && Array.isArray(o.items) && (o.items[0]?.video_versions || o.items[0]?.image_versions2)) return o.items;
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            if (o.xdt_api__v1__clips__home__connection_v2) return o.xdt_api__v1__clips__home__connection_v2?.edges?.map((e: any) => e?.node?.media).filter(Boolean);
                            for (const k in o) { const r = find(o[k]); if (r) return r; }
                            return null;
                        };
                        const items = find(data);
                        if (!items?.length) return;
                        const item = items[0];
                        author = item.user?.username || author;

                        if (item.video_versions?.length) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const sorted = [...item.video_versions].sort((a: any, b: any) => b.width - a.width);
                            addFormat(formats, getQualityLabel(sorted[0].height || 720), 'video', decodeUrl(sorted[0].url), { itemId: 'video-main' });
                            if (sorted.length > 1 && sorted[sorted.length - 1].url !== sorted[0].url)
                                addFormat(formats, `SD ${sorted[sorted.length - 1].height}p`, 'video', decodeUrl(sorted[sorted.length - 1].url), { itemId: 'video-main' });
                        }
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (item.image_versions2?.candidates?.length) { const best = item.image_versions2.candidates.sort((a: any, b: any) => b.width - a.width)[0]; if (best?.url) thumbnail = decodeUrl(best.url); }

                        // Carousel
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        item.carousel_media?.forEach((m: any, i: number) => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            if (m.video_versions?.length) { const best = m.video_versions.sort((a: any, b: any) => b.width - a.width)[0]; addFormat(formats, 'Video', 'video', decodeUrl(best.url), { itemId: `slide-${i}`, filename: `${author}_slide_${i + 1}` }); }
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            else if (m.image_versions2?.candidates?.length) { const best = m.image_versions2.candidates.sort((a: any, b: any) => b.width - a.width)[0]; addFormat(formats, 'Image', 'image', decodeUrl(best.url), { itemId: `slide-${i}`, thumbnail: decodeUrl(best.url), filename: `${author}_slide_${i + 1}` }); }
                        });

                        // Single image
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (!formats.length && item.image_versions2?.candidates?.length) { const best = item.image_versions2.candidates.sort((a: any, b: any) => b.width - a.width)[0]; addFormat(formats, 'Original', 'image', decodeUrl(best.url), { itemId: 'image-main' }); }
                    } catch { /* ignore */ }
                });
            }

            // SharedData fallback
            if (!formats.length) {
                const script = $('script').filter((_, el) => ($(el).html() || '').includes('window._sharedData')).html();
                if (script) {
                    const json = script.split('window._sharedData = ')[1]?.split(';')[0];
                    if (json) try {
                        const post = JSON.parse(json).entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
                        if (post) {
                            title = post.accessibility_caption || title; author = post.owner?.username || author; thumbnail = post.display_url || thumbnail;
                            if (post.__typename === 'GraphSidecar' && post.edge_sidecar_to_children) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                post.edge_sidecar_to_children.edges.forEach((e: any, i: number) => {
                                    const n = e.node;
                                    if (n.is_video && n.video_url) addFormat(formats, 'Video', 'video', n.video_url, { itemId: n.id, thumbnail: n.display_url, filename: `${author}_slide_${i + 1}` });
                                    else if (n.display_url) addFormat(formats, 'Image', 'image', n.display_url, { itemId: n.id, thumbnail: n.display_url, filename: `${author}_slide_${i + 1}` });
                                });
                            } else {
                                if (post.is_video && post.video_url) addFormat(formats, 'Video', 'video', post.video_url, { itemId: post.id, thumbnail: post.display_url });
                                else if (post.display_url) addFormat(formats, 'Image', 'image', post.display_url, { itemId: post.id, thumbnail: post.display_url });
                            }
                        }
                    } catch { /* ignore */ }
                }
            }
        }

        // Embed fallback
        if (!formats.length) {
            for (const embedPath of [`${urlType}/${shortcode}/embed/`, `p/${shortcode}/embed/`, `${urlType}/${shortcode}/embed/captioned/`]) {
                if (formats.length) break;
                const embedUrl = `https://www.instagram.com/${embedPath}`;
                const embedRes = await browserFetch(embedUrl, 'instagram');
                if (embedRes.ok) {
                    const html = await embedRes.text();

                    if (!formats.length) {
                        const vidM = html.match(/video_url\\?":\\?"(https:[^"]+)\\?"/i) || html.match(/video_url":"(https:[^"]+)"/i);
                        if (vidM) {
                            const u = vidM[1].replace(/\\\\\//g, '/').replace(/\\\//g, '/').replace(/\\u0026/g, '&');
                            if (u.includes('.mp4') || u.includes('video')) addFormat(formats, 'Video', 'video', u);
                        }
                    }

                    if (!formats.length) {
                        const mp4M = html.match(/https:\\\\\/\\\\\/instagram[^"\\]+\.mp4[^"\\]*/) || html.match(/https:\\\/\\\/instagram[^"\\]+\.mp4[^"\\]*/);
                        if (mp4M) {
                            const u = mp4M[0].replace(/\\\\\//g, '/').replace(/\\\//g, '/').replace(/\\u0026/g, '&');
                            addFormat(formats, 'Video', 'video', u);
                        }
                    }

                    const imgM = html.match(/display_url\\?":\\?"(https:[^"]+)\\?"/) || html.match(/display_url":"(https:[^"]+)"/);
                    if (imgM) {
                        const u = imgM[1].replace(/\\\\\//g, '/').replace(/\\\//g, '/').replace(/\\u0026/g, '&');
                        if (!/\/[sp]\d{2,3}x\d{2,3}\//.test(u) && u.includes('scontent')) {
                            thumbnail = thumbnail || u;
                            if (!formats.length) addFormat(formats, 'Original', 'image', u);
                        }
                    }

                    if (!author) {
                        const m = html.match(/instagram\.com\/([^\/?\"\\]+)/);
                        if (m && !['p', 'reel', 'reels', 'tv', 'embed'].includes(m[1])) author = '@' + m[1];
                    }
                }
            }
        }

        if (!formats.length) return { success: false, error: 'Could not extract media. Post may be private.' };
        const seen = new Set<string>(), unique = formats.filter(f => { if (seen.has(f.url)) return false; seen.add(f.url); return true; });
        const result: ScraperResult = { success: true, data: { title, thumbnail, author, formats: unique, url } };
        
        // Cache successful result
        igCache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL });
        // Cleanup old entries
        if (igCache.size > 100) {
            const now = Date.now();
            for (const [k, v] of igCache) { if (v.expires < now) igCache.delete(k); }
        }
        
        return result;
    } catch (e) { return { success: false, error: e instanceof Error ? e.message : 'Failed to fetch' }; }
}
