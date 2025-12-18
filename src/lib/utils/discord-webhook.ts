/**
 * Discord Webhook Utility
 * User-side webhook for download notifications
 * Settings stored in localStorage
 * 
 * Discord Webhook Limits:
 * - 30 messages/minute per channel
 * - 50 requests/second per IP
 * - 200 MiB max payload size (with files)
 * - 10 embeds per message
 * - ~8-10MB for auto-embed videos in messages
 */

const APP_NAME = 'XTFetch';
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB - Discord stops auto-embedding above this

const getAppIcon = () => {
    if (typeof window !== 'undefined') {
        return `${window.location.origin}/icon.png`;
    }
    return `${process.env.NEXT_PUBLIC_BASE_URL || 'https://xt-fetch.vercel.app'}/icon.png`;
};

// Send method for large files
export type DiscordSendMethod = 'smart' | 'single' | 'double';

export interface UserDiscordSettings {
    webhookUrl: string;
    autoSend: boolean;
    embedEnabled: boolean;
    embedColor: string;
    footerText: string;
    sendMethod: DiscordSendMethod; // NEW: smart | single | double
}

export const DEFAULT_USER_DISCORD: UserDiscordSettings = {
    webhookUrl: '',
    autoSend: false,
    embedEnabled: true,
    embedColor: '#5865F2',
    footerText: 'via XTFetch',
    sendMethod: 'smart', // Default: auto-detect based on file size
};

export const DISCORD_STORAGE_KEY = 'xtfetch_discord_webhook';

export function getUserDiscordSettings(): UserDiscordSettings | null {
    if (typeof window === 'undefined') return null;
    try {
        const saved = localStorage.getItem(DISCORD_STORAGE_KEY);
        if (saved) {
            return { ...DEFAULT_USER_DISCORD, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.error('[Discord] Failed to parse settings:', e);
    }
    return null;
}

export function saveUserDiscordSettings(settings: UserDiscordSettings): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(DISCORD_STORAGE_KEY, JSON.stringify(settings));
    } catch {}
}

function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
}

function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return bytes + 'B';
}

// Duplicate prevention
const recentMessages = new Set<string>();
const MESSAGE_CACHE_TTL = 60 * 1000;

// Rate limit tracking with proper Discord headers
let rateLimitState = {
    remaining: 30,
    resetAt: 0,
    retryAfter: 0
};

function getMessageKey(data: { platform: string; sourceUrl?: string; mediaUrl?: string }): string {
    return `${data.platform}:${data.sourceUrl || data.mediaUrl || ''}`.toLowerCase();
}

function isDuplicate(key: string): boolean {
    return recentMessages.has(key);
}

function markSent(key: string): void {
    recentMessages.add(key);
    setTimeout(() => recentMessages.delete(key), MESSAGE_CACHE_TTL);
    if (recentMessages.size > 100) {
        const first = recentMessages.values().next().value;
        if (first) recentMessages.delete(first);
    }
}

function getBaseUrl(): string {
    if (typeof window !== 'undefined') return window.location.origin;
    return process.env.NEXT_PUBLIC_BASE_URL || 'https://xt-fetch.vercel.app';
}

function getProxyUrl(mediaUrl: string, platform: string): string {
    return `${getBaseUrl()}/api/proxy?url=${encodeURIComponent(mediaUrl)}&platform=${platform.toLowerCase()}&inline=1`;
}

// Get file size via HEAD request (returns 0 if unknown)
async function getFileSize(url: string, platform: string): Promise<number> {
    try {
        const isWeibo = platform.toLowerCase() === 'weibo';
        const targetUrl = isWeibo ? getProxyUrl(url, platform) : url;
        
        const res = await fetch(targetUrl, { method: 'HEAD' });
        const contentLength = res.headers.get('content-length');
        return contentLength ? parseInt(contentLength) : 0;
    } catch {
        return 0;
    }
}

// Check if file is large (>10MB) - for smart send method
export async function isLargeFile(url: string, platform: string): Promise<{ isLarge: boolean; size: number }> {
    const size = await getFileSize(url, platform);
    // If size unknown, assume large for Weibo (usually big files)
    const isLarge = size > LARGE_FILE_THRESHOLD || (size === 0 && platform.toLowerCase() === 'weibo');
    return { isLarge, size };
}

// Update rate limit state from response headers
function updateRateLimitFromHeaders(res: Response): void {
    const remaining = res.headers.get('X-RateLimit-Remaining');
    const resetAfter = res.headers.get('X-RateLimit-Reset-After');
    const retryAfter = res.headers.get('Retry-After');
    
    if (remaining !== null) {
        rateLimitState.remaining = parseInt(remaining);
    }
    if (resetAfter !== null) {
        rateLimitState.resetAt = Date.now() + parseFloat(resetAfter) * 1000;
    }
    if (retryAfter !== null) {
        rateLimitState.retryAfter = Date.now() + parseFloat(retryAfter) * 1000;
    }
}

// Check if we should wait before sending
function getRateLimitWait(): number {
    const now = Date.now();
    if (rateLimitState.retryAfter > now) {
        return rateLimitState.retryAfter - now;
    }
    if (rateLimitState.remaining <= 0 && rateLimitState.resetAt > now) {
        return rateLimitState.resetAt - now;
    }
    return 0;
}

// Send with rate limit handling
async function sendToWebhook(
    webhookUrl: string,
    options: RequestInit,
    retries = 3
): Promise<{ ok: boolean; status: number; retryAfter?: number; error?: string }> {
    // Check rate limit before sending
    const waitMs = getRateLimitWait();
    if (waitMs > 0) {
        console.log(`[Discord] Waiting ${waitMs}ms for rate limit...`);
        await new Promise(r => setTimeout(r, waitMs));
    }
    
    try {
        const res = await fetch(webhookUrl, options);
        updateRateLimitFromHeaders(res);
        
        if (res.ok || res.status === 204) {
            return { ok: true, status: res.status };
        }
        
        if (res.status === 429) {
            // Rate limited
            const retryAfter = res.headers.get('Retry-After');
            const waitSec = retryAfter ? parseFloat(retryAfter) : 5;
            
            console.log(`[Discord] Rate limited, retry after ${waitSec}s`);
            
            if (retries > 0) {
                await new Promise(r => setTimeout(r, waitSec * 1000));
                return sendToWebhook(webhookUrl, options, retries - 1);
            }
            
            return { ok: false, status: 429, retryAfter: waitSec };
        }
        
        // Other errors
        const errorText = await res.text().catch(() => '');
        return { ok: false, status: res.status, error: errorText };
    } catch (err) {
        return { ok: false, status: 0, error: err instanceof Error ? err.message : 'Network error' };
    }
}

export async function sendDiscordNotification(data: {
    platform: string;
    title: string;
    quality: string;
    thumbnail?: string;
    mediaUrl?: string;
    mediaType?: 'video' | 'image' | 'audio';
    sourceUrl?: string;
    author?: string;
    engagement?: { likes?: number; comments?: number; shares?: number; views?: number };
    fileSize?: number; // NEW: Pass file size from download button to skip HEAD request
}, manual = false): Promise<{ sent: boolean; reason?: string; details?: string }> {
    const settings = getUserDiscordSettings();
    
    if (!settings?.webhookUrl) {
        return { sent: false, reason: 'no_webhook' };
    }
    
    if (!manual && !settings.autoSend) {
        return { sent: false, reason: 'auto_disabled' };
    }
    
    // Check rate limit
    const waitMs = getRateLimitWait();
    if (waitMs > 1000) {
        const waitSec = Math.ceil(waitMs / 1000);
        return { sent: false, reason: 'rate_limited', details: `Rate limited. Try again in ${waitSec}s` };
    }
    
    // Check duplicate
    const messageKey = getMessageKey(data);
    if (isDuplicate(messageKey)) {
        return { sent: false, reason: 'duplicate', details: 'Already sent in the last minute' };
    }

    try {
        const appIcon = getAppIcon();
        
        // Build embed
        const fields: Array<{ name: string; value: string; inline: boolean }> = [];
        if (data.title) {
            fields.push({ 
                name: 'Caption', 
                value: data.title.length > 200 ? data.title.substring(0, 200) + '...' : data.title, 
                inline: false 
            });
        }
        if (data.author) {
            fields.push({ name: 'Author', value: data.author, inline: true });
        }
        if (data.engagement) {
            const parts: string[] = [];
            if (data.engagement.views) parts.push(`${formatNumber(data.engagement.views)} views`);
            if (data.engagement.likes) parts.push(`${formatNumber(data.engagement.likes)} likes`);
            if (data.engagement.comments) parts.push(`${formatNumber(data.engagement.comments)} comments`);
            if (data.engagement.shares) parts.push(`${formatNumber(data.engagement.shares)} shares`);
            if (parts.length > 0) {
                fields.push({ name: 'Engagement', value: parts.join(' · '), inline: true });
            }
        }

        const embed: Record<string, unknown> = {
            author: { name: `${data.platform} Downloader` },
            color: parseInt(settings.embedColor.replace('#', ''), 16),
            fields,
            footer: { text: settings.footerText || 'via XTFetch', icon_url: appIcon },
            timestamp: new Date().toISOString(),
        };
        
        if (data.sourceUrl) {
            embed.url = data.sourceUrl;
            embed.title = 'Open Source';
        }

        // Handle video - NO UPLOAD, just send link (faster!)
        if (data.mediaType === 'video' && data.mediaUrl) {
            const isWeibo = data.platform.toLowerCase() === 'weibo';
            const videoLinkUrl = isWeibo ? getProxyUrl(data.mediaUrl, data.platform) : data.mediaUrl;
            const mediaLabel = `${data.platform} ${data.quality || 'Video'}`;
            
            // Determine send method
            const sendMethod = settings.sendMethod || 'smart';
            let useDoubleMessage = sendMethod === 'double';
            
            // Smart mode: use file size from data if available, otherwise check
            if (sendMethod === 'smart') {
                // Use passed file size if available (from download button)
                if (data.fileSize && data.fileSize > 0) {
                    useDoubleMessage = data.fileSize > LARGE_FILE_THRESHOLD;
                    console.log(`[Discord] Smart mode: ${formatBytes(data.fileSize)} ${useDoubleMessage ? '> 10MB, using 2x' : '≤ 10MB, using 1x'}`);
                } else {
                    // Fallback: Weibo always large, others assume small
                    useDoubleMessage = isWeibo;
                    console.log(`[Discord] Smart mode: no size info, ${isWeibo ? 'Weibo=2x' : 'default=1x'}`);
                }
            }
            
            if (useDoubleMessage) {
                // 2x SEND: First rich embed (info), then wrapped link (video)
                console.log('[Discord] Using 2x send method');
                
                // Message 1: Rich embed with info (no video/image)
                const result1 = await sendToWebhook(settings.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: APP_NAME,
                        avatar_url: appIcon,
                        embeds: [embed],
                    }),
                });
                
                if (!result1.ok) {
                    if (result1.status === 429) {
                        return { sent: false, reason: 'rate_limited', details: `Rate limited. Try again in ${result1.retryAfter || 5}s` };
                    }
                    return { sent: false, reason: `error_${result1.status}`, details: result1.error };
                }
                
                // Small delay between messages
                await new Promise(r => setTimeout(r, 300));
                
                // Message 2: Wrapped link [Platform Type](url) - Discord will auto-embed video
                const result2 = await sendToWebhook(settings.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: APP_NAME,
                        avatar_url: appIcon,
                        content: `[${mediaLabel}](${videoLinkUrl})`,
                    }),
                });
                
                markSent(messageKey);
                if (!result2.ok) {
                    return { sent: true, details: 'Embed sent, video link failed' };
                }
                return { sent: true };
            } else {
                // 1x SEND: Link + embed in single message
                if (data.thumbnail) {
                    embed.image = { url: isWeibo ? getProxyUrl(data.thumbnail, data.platform) : data.thumbnail };
                }
                
                const result = await sendToWebhook(settings.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: APP_NAME,
                        avatar_url: appIcon,
                        content: `📹 [**${mediaLabel}**](${videoLinkUrl})`,
                        embeds: [embed],
                    }),
                });
                
                if (result.ok) {
                    markSent(messageKey);
                    return { sent: true };
                }
                
                if (result.status === 429) {
                    return { sent: false, reason: 'rate_limited', details: `Rate limited. Try again in ${result.retryAfter || 5}s` };
                }
                
                return { sent: false, reason: `error_${result.status}`, details: result.error };
            }
        }
        
        // Handle image - only Weibo needs proxy
        const isWeibo = data.platform.toLowerCase() === 'weibo';
        if (data.mediaType === 'image' && data.mediaUrl) {
            embed.image = { url: isWeibo ? getProxyUrl(data.mediaUrl, data.platform) : data.mediaUrl };
        } else if (data.thumbnail) {
            embed.image = { url: isWeibo ? getProxyUrl(data.thumbnail, data.platform) : data.thumbnail };
        }
        
        // Send embed
        const result = await sendToWebhook(settings.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: APP_NAME,
                avatar_url: appIcon,
                embeds: [embed],
            }),
        });
        
        if (result.ok) {
            markSent(messageKey);
            return { sent: true };
        }
        
        if (result.status === 429) {
            return { sent: false, reason: 'rate_limited', details: `Rate limited. Try again in ${result.retryAfter || 5}s` };
        }
        
        return { sent: false, reason: `error_${result.status}`, details: result.error };
    } catch (err) {
        console.error('[Discord] Send error:', err);
        return { sent: false, reason: 'error', details: err instanceof Error ? err.message : 'Unknown error' };
    }
}
