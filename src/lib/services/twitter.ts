/**
 * Twitter/X Scraper Service
 * ==========================
 * FLOW:
 * 1. Syndication API (no cookie) → works for most public tweets
 * 2. If no media → GraphQL API with cookie (age-restricted content)
 */

import { MediaFormat } from '@/lib/types';
import { addFormat, httpGet, BROWSER_HEADERS, type EngagementStats } from '@/lib/http';
import { matchesPlatform, getApiEndpoint } from './helper/api-config';
import { getCache, setCache } from './helper/cache';
import { createError, ScraperErrorCode, type ScraperResult, type ScraperOptions } from '@/core/scrapers/types';
import { logger } from './helper/logger';

const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

interface TweetData {
    text?: string;
    user?: { screen_name?: string; name?: string };
    mediaDetails?: MediaDetail[];
    photos?: { url: string }[];
    created_at?: string;
    engagement?: { replies?: number; retweets?: number; likes?: number; views?: number; bookmarks?: number };
}

interface MediaDetail {
    type: 'video' | 'photo' | 'animated_gif';
    media_key?: string;
    media_url_https?: string;
    video_info?: { variants?: { content_type: string; url: string; bitrate?: number }[] };
}

async function fetchSyndication(tweetId: string): Promise<{ data: TweetData | null; error?: string }> {
    try {
        const url = `${getApiEndpoint('twitter', 'syndication')}?id=${tweetId}&lang=en&token=x`;
        const res = await httpGet(url, { platform: 'twitter', headers: { Referer: 'https://platform.twitter.com/' } });
        if (res.status !== 200) return { data: null, error: `HTTP ${res.status}` };
        const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        return { data };
    } catch (e) {
        return { data: null, error: e instanceof Error ? e.message : 'Fetch failed' };
    }
}

function getCt0(cookie: string): string {
    const match = cookie.match(/ct0=([^;]+)/);
    return match ? match[1] : '';
}

async function fetchWithGraphQL(tweetId: string, cookie: string): Promise<{ data: TweetData | null; error?: string }> {
    try {
        const ct0 = getCt0(cookie);
        if (!ct0) return { data: null, error: 'Missing ct0 token in cookie' };
        
        const variables = { focalTweetId: tweetId, with_rux_injections: false, includePromotedContent: true, withCommunity: true, withQuickPromoteEligibilityTweetFields: true, withBirdwatchNotes: true, withVoice: true, withV2Timeline: true };
        const features = { creator_subscriptions_tweet_preview_api_enabled: true, c9s_tweet_anatomy_moderator_badge_enabled: true, tweetypie_unmention_optimization_enabled: true, responsive_web_edit_tweet_api_enabled: true, graphql_is_translatable_rweb_tweet_is_translatable_enabled: true, view_counts_everywhere_api_enabled: true, longform_notetweets_consumption_enabled: true, responsive_web_twitter_article_tweet_consumption_enabled: false, tweet_awards_web_tipping_enabled: false, responsive_web_home_pinned_timelines_enabled: true, freedom_of_speech_not_reach_fetch_enabled: true, standardized_nudges_misinfo: true, tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true, longform_notetweets_rich_text_read_enabled: true, longform_notetweets_inline_media_enabled: true, responsive_web_graphql_exclude_directive_enabled: true, verified_phone_label_enabled: false, responsive_web_media_download_video_enabled: false, responsive_web_graphql_skip_user_profile_image_extensions_enabled: false, responsive_web_graphql_timeline_navigation_enabled: true, responsive_web_enhance_cards_enabled: false };
        
        const url = `https://x.com/i/api/graphql/xOhkmRac04YFZmOzU9PJHg/TweetDetail?variables=${encodeURIComponent(JSON.stringify(variables))}&features=${encodeURIComponent(JSON.stringify(features))}`;
        
        const res = await httpGet(url, {
            timeout: 15000,
            headers: { ...BROWSER_HEADERS, 'Authorization': `Bearer ${BEARER_TOKEN}`, 'Cookie': cookie, 'X-Csrf-Token': ct0, 'X-Twitter-Auth-Type': 'OAuth2Session', 'X-Twitter-Active-User': 'yes', 'X-Twitter-Client-Language': 'en' },
        });
        
        if (res.status !== 200) return { data: null, error: `GraphQL API error: ${res.status}` };
        
        const json = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        const instructions = json?.data?.threaded_conversation_with_injections_v2?.instructions || [];
        const addEntries = instructions.find((i: { type: string }) => i.type === 'TimelineAddEntries');
        const tweetEntry = addEntries?.entries?.find((e: { entryId: string }) => e.entryId === `tweet-${tweetId}`);
        if (!tweetEntry) return { data: null, error: 'Tweet not found in response' };
        
        const tweetResult = tweetEntry.content?.itemContent?.tweet_results?.result;
        const tweet = tweetResult?.tweet || tweetResult;
        const legacy = tweet?.legacy;
        if (!legacy) return { data: null, error: 'Could not parse tweet data' };
        
        const mediaDetails: MediaDetail[] = [];
        const extMedia = legacy.extended_entities?.media || legacy.entities?.media || [];
        for (const m of extMedia) {
            if (m.type === 'photo') mediaDetails.push({ type: 'photo', media_key: m.id_str, media_url_https: m.media_url_https });
            else if (m.type === 'video' || m.type === 'animated_gif') mediaDetails.push({ type: m.type, media_key: m.id_str, media_url_https: m.media_url_https, video_info: m.video_info });
        }
        if (mediaDetails.length === 0) return { data: null, error: 'No media in tweet' };
        
        const userLegacy = tweet.core?.user_results?.result?.legacy;
        return {
            data: {
                text: legacy.full_text || '',
                user: { screen_name: userLegacy?.screen_name || '', name: userLegacy?.name || '' },
                mediaDetails,
                created_at: legacy.created_at || '',
                engagement: { replies: legacy.reply_count || 0, retweets: legacy.retweet_count || 0, likes: legacy.favorite_count || 0, views: tweet.views?.count ? parseInt(tweet.views.count) : 0, bookmarks: legacy.bookmark_count || 0 },
            }
        };
    } catch (e) {
        return { data: null, error: e instanceof Error ? e.message : 'GraphQL fetch failed' };
    }
}

function parseMedia(data: TweetData, username: string): { formats: MediaFormat[]; thumbnail: string } {
    const formats: MediaFormat[] = [];
    let thumbnail = '';
    
    (data.mediaDetails || []).forEach((media, idx) => {
        const itemId = media.media_key || `media-${idx}`;
        if (media.type === 'video' || media.type === 'animated_gif') {
            thumbnail = media.media_url_https || thumbnail;
            const variants = (media.video_info?.variants || []).filter(v => v.content_type === 'video/mp4' && v.url).sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            variants.forEach(v => {
                const m = v.url?.match(/\/(\d+)x(\d+)\//);
                const h = m ? Math.max(+m[1], +m[2]) : 0;
                const q = h >= 1080 ? 'FULLHD (1080p)' : h >= 720 ? 'HD (720p)' : h >= 480 ? 'SD (480p)' : v.bitrate && v.bitrate >= 2e6 ? 'HD (720p)' : 'SD (480p)';
                addFormat(formats, q, 'video', v.url, { itemId, thumbnail: media.media_url_https, filename: `${username}_video_${idx + 1}` });
            });
        } else if (media.type === 'photo') {
            const base = media.media_url_https || '';
            thumbnail = thumbnail || base;
            const m = base.match(/^(.+)\.(\w+)$/);
            if (m) {
                addFormat(formats, 'Original (4K)', 'image', `${m[1]}?format=${m[2]}&name=4096x4096`, { itemId, thumbnail: base, filename: `${username}_image_${idx + 1}` });
                addFormat(formats, 'Large', 'image', `${m[1]}?format=${m[2]}&name=large`, { itemId, thumbnail: base, filename: `${username}_image_${idx + 1}` });
            } else {
                addFormat(formats, 'Original', 'image', base, { itemId, thumbnail: base, filename: `${username}_image_${idx + 1}` });
            }
        }
    });
    
    if (!formats.length && data.photos) {
        data.photos.forEach((p, idx) => {
            const base = p.url || '';
            const m = base.match(/^(.+)\.(\w+)$/);
            thumbnail = thumbnail || base;
            if (m) {
                addFormat(formats, 'Original (4K)', 'image', `${m[1]}?format=${m[2]}&name=4096x4096`, { itemId: `photo-${idx}`, filename: `${username}_image_${idx + 1}` });
                addFormat(formats, 'Large', 'image', `${m[1]}?format=${m[2]}&name=large`, { itemId: `photo-${idx}`, filename: `${username}_image_${idx + 1}` });
            }
        });
    }
    return { formats, thumbnail };
}

export async function scrapeTwitter(url: string, options?: ScraperOptions): Promise<ScraperResult> {
    const { cookie, skipCache = false } = options || {};

    if (!matchesPlatform(url, 'twitter')) return createError(ScraperErrorCode.INVALID_URL, 'Invalid Twitter/X URL');
    
    const match = url.match(/\/(?:#!\/)?(\w+)\/status(?:es)?\/(\d+)/);
    if (!match) return createError(ScraperErrorCode.INVALID_URL, 'Could not extract tweet ID');

    const [, username, tweetId] = match;
    logger.type('twitter', 'tweet');
    
    if (!skipCache) {
        const cached = await getCache<ScraperResult>('twitter', url);
        if (cached?.success) { logger.cache('twitter', true); return { ...cached, cached: true }; }
    }

    // Step 1: Syndication API
    logger.debug('twitter', 'Trying Syndication API...');
    const { data: synData, error: synError } = await fetchSyndication(tweetId);
    
    if (synData) {
        const { formats, thumbnail } = parseMedia(synData, synData.user?.screen_name || username);
        if (formats.length > 0) {
            const seen = new Set<string>();
            const unique = formats.filter(f => { const k = `${f.quality}-${f.type}-${f.itemId || ''}`; if (seen.has(k)) return false; seen.add(k); return true; });
            const title = synData.text ? synData.text.substring(0, 100) + (synData.text.length > 100 ? '...' : '') : 'Twitter Post';
            const engagement: EngagementStats | undefined = synData.engagement ? { views: synData.engagement.views, likes: synData.engagement.likes, comments: synData.engagement.replies, shares: synData.engagement.retweets, bookmarks: synData.engagement.bookmarks, replies: synData.engagement.replies } : undefined;
            
            const result: ScraperResult = { success: true, data: { title, thumbnail, author: synData.user?.screen_name || username, authorName: synData.user?.name, postedAt: synData.created_at, engagement, formats: unique, url, type: unique.some(f => f.type === 'video') ? 'video' : 'image' } };
            logger.media('twitter', { videos: unique.filter(f => f.type === 'video').length, images: unique.filter(f => f.type === 'image').length });
            setCache('twitter', url, result);
            return result;
        }
    }
    
    // Step 2: GraphQL with cookie
    if (cookie) {
        logger.debug('twitter', 'Trying GraphQL API with cookie...');
        const { data: gqlData } = await fetchWithGraphQL(tweetId, cookie);
        if (gqlData) {
            const { formats, thumbnail } = parseMedia(gqlData, gqlData.user?.screen_name || username);
            if (formats.length > 0) {
                const seen = new Set<string>();
                const unique = formats.filter(f => { const k = `${f.quality}-${f.type}-${f.itemId || ''}`; if (seen.has(k)) return false; seen.add(k); return true; });
                const title = gqlData.text ? gqlData.text.substring(0, 100) + (gqlData.text.length > 100 ? '...' : '') : 'Twitter Post';
                const engagement: EngagementStats | undefined = gqlData.engagement ? { views: gqlData.engagement.views, likes: gqlData.engagement.likes, comments: gqlData.engagement.replies, shares: gqlData.engagement.retweets, bookmarks: gqlData.engagement.bookmarks, replies: gqlData.engagement.replies } : undefined;
                
                const result: ScraperResult = { success: true, data: { title, thumbnail, author: gqlData.user?.screen_name || username, authorName: gqlData.user?.name, postedAt: gqlData.created_at, engagement, formats: unique, url, usedCookie: true, type: unique.some(f => f.type === 'video') ? 'video' : 'image' } };
                setCache('twitter', url, result);
                return result;
            }
        }
    }
    
    if (!cookie && (synError?.includes('403') || !synData?.mediaDetails?.length)) {
        return createError(ScraperErrorCode.AGE_RESTRICTED, 'This tweet may be age-restricted. Please provide a cookie.');
    }
    return createError(ScraperErrorCode.NO_MEDIA, synError || 'No downloadable media found');
}
