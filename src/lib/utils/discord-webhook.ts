/**
 * Discord Webhook Utility
 * User-side webhook for download notifications
 * Settings stored in localStorage
 */

// App branding
const APP_NAME = 'XTFetch';
// Use PNG icon for Discord webhook avatar
// Note: Discord caches avatars, changes may take time to appear
const APP_ICON = 'https://xtfetch.vercel.app/icon.png';

export interface UserDiscordSettings {
    webhookUrl: string;
    autoSend: boolean;
    embedEnabled: boolean;
    embedColor: string;
    footerText: string;
}

export const DEFAULT_USER_DISCORD: UserDiscordSettings = {
    webhookUrl: '',
    autoSend: false,
    embedEnabled: true,
    embedColor: '#5865F2',
    footerText: 'via XTFetch',
};

export const DISCORD_STORAGE_KEY = 'xtfetch_discord_webhook';

// Get discord settings from localStorage
export function getUserDiscordSettings(): UserDiscordSettings | null {
    if (typeof window === 'undefined') return null;
    try {
        const saved = localStorage.getItem(DISCORD_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Ensure all required fields exist
            return { ...DEFAULT_USER_DISCORD, ...parsed };
        }
    } catch (e) {
        console.error('[Discord] Failed to parse settings:', e);
    }
    return null;
}

// Save discord settings to localStorage
export function saveUserDiscordSettings(settings: UserDiscordSettings): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(DISCORD_STORAGE_KEY, JSON.stringify(settings));
    } catch {}
}

// Format large numbers (1000 -> 1K, 1000000 -> 1M)
function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
}

// Duplicate message prevention - cache of recently sent messages
const recentMessages = new Set<string>();
const MESSAGE_CACHE_TTL = 60 * 1000; // 1 minute

// Rate limit tracking
let rateLimitUntil = 0; // Timestamp when rate limit expires
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 5000]; // Exponential backoff

function getMessageKey(data: { platform: string; sourceUrl?: string; thumbnail?: string }): string {
    // Create unique key from platform + URL or thumbnail
    return `${data.platform}:${data.sourceUrl || data.thumbnail || ''}`.toLowerCase();
}

function isDuplicateMessage(key: string): boolean {
    return recentMessages.has(key);
}

function markMessageSent(key: string): void {
    recentMessages.add(key);
    // Auto-remove after TTL
    setTimeout(() => recentMessages.delete(key), MESSAGE_CACHE_TTL);
    
    // Cleanup if too many entries
    if (recentMessages.size > 100) {
        const firstKey = recentMessages.values().next().value;
        if (firstKey) recentMessages.delete(firstKey);
    }
}

// Get base URL for proxy - works in browser
function getBaseUrl(): string {
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }
    // Fallback for SSR (shouldn't happen for Discord webhook)
    return process.env.NEXT_PUBLIC_BASE_URL || 'https://xtfetch.vercel.app';
}

// Convert CDN URL to proxy URL for Discord embedding
function getProxyUrl(mediaUrl: string, platform: string): string {
    const baseUrl = getBaseUrl();
    // Use inline=1 for Discord to embed properly
    return `${baseUrl}/api/proxy?url=${encodeURIComponent(mediaUrl)}&platform=${platform.toLowerCase()}&inline=1`;
}

// Helper to send request with rate limit handling
async function sendWithRateLimit(
    url: string, 
    options: RequestInit, 
    retryCount = 0
): Promise<Response> {
    // Check if we're still rate limited
    if (Date.now() < rateLimitUntil) {
        const waitTime = rateLimitUntil - Date.now();
        console.log(`[Discord] Rate limited, waiting ${waitTime}ms...`);
        await new Promise(r => setTimeout(r, waitTime));
    }
    
    const res = await fetch(url, options);
    
    // Handle rate limit (429)
    if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after');
        const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_DELAYS[retryCount] || 5000;
        rateLimitUntil = Date.now() + waitMs;
        
        console.log(`[Discord] Rate limited! Retry after ${waitMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        
        if (retryCount < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, waitMs));
            return sendWithRateLimit(url, options, retryCount + 1);
        }
    }
    
    return res;
}

// Send discord notification - returns result for UI feedback
export async function sendDiscordNotification(data: {
    platform: string;
    title: string;
    quality: string;
    thumbnail?: string;
    mediaUrl?: string; // Direct media URL (video or image)
    mediaType?: 'video' | 'image' | 'audio';
    sourceUrl?: string;
    author?: string;
    engagement?: { likes?: number; comments?: number; shares?: number; views?: number };
}): Promise<{ sent: boolean; reason?: string }> {
    const settings = getUserDiscordSettings();
    
    if (!settings?.webhookUrl) {
        return { sent: false, reason: 'no_webhook' };
    }
    
    if (!settings.autoSend) {
        return { sent: false, reason: 'auto_disabled' };
    }
    
    // Check if currently rate limited
    if (Date.now() < rateLimitUntil) {
        const waitSec = Math.ceil((rateLimitUntil - Date.now()) / 1000);
        return { sent: false, reason: `rate_limited_${waitSec}s` };
    }
    
    // Check for duplicate message
    const messageKey = getMessageKey(data);
    if (isDuplicateMessage(messageKey)) {
        return { sent: false, reason: 'duplicate' };
    }

    try {
        const payload: Record<string, unknown> = {
            username: APP_NAME,
            avatar_url: APP_ICON,
        };

        if (settings.embedEnabled) {
            // Build fields array - Order: Caption, Author, Engagement
            const fields: Array<{ name: string; value: string; inline: boolean }> = [];
            
            // 1. Caption/Title field
            if (data.title) {
                fields.push({ 
                    name: 'Caption', 
                    value: data.title.length > 200 ? data.title.substring(0, 200) + '...' : data.title, 
                    inline: false 
                });
            }
            
            // 2. Author field
            if (data.author) {
                fields.push({ name: 'Author', value: data.author, inline: true });
            }
            
            // 3. Engagement field (if available)
            if (data.engagement) {
                const engagementParts: string[] = [];
                if (data.engagement.views) engagementParts.push(`${formatNumber(data.engagement.views)} views`);
                if (data.engagement.likes) engagementParts.push(`${formatNumber(data.engagement.likes)} likes`);
                if (data.engagement.comments) engagementParts.push(`${formatNumber(data.engagement.comments)} comments`);
                if (data.engagement.shares) engagementParts.push(`${formatNumber(data.engagement.shares)} shares`);
                
                if (engagementParts.length > 0) {
                    fields.push({ name: 'Engagement', value: engagementParts.join(' · '), inline: true });
                }
            }

            const embed: Record<string, unknown> = {
                author: {
                    name: `${data.platform} Downloader`,
                },
                color: parseInt(settings.embedColor.replace('#', ''), 16),
                fields,
                footer: {
                    text: settings.footerText || 'via XTFetch',
                    icon_url: APP_ICON,
                },
                timestamp: new Date().toISOString(),
            };

            // For video: try upload as attachment, fallback to markdown link
            // For image: use embed with image
            console.log('[Discord] mediaType:', data.mediaType, 'mediaUrl:', data.mediaUrl?.substring(0, 100));
            if (data.mediaType === 'video' && data.mediaUrl) {
                // Add source URL to embed
                if (data.sourceUrl) {
                    embed.url = data.sourceUrl;
                    embed.title = 'Open Source';
                }
                
                // Try to upload video as attachment (max 25MB for non-Nitro)
                const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
                let uploadSuccess = false;
                
                try {
                    // Fetch video via proxy
                    const proxyUrl = getProxyUrl(data.mediaUrl, data.platform);
                    const videoRes = await fetch(proxyUrl);
                    
                    if (videoRes.ok) {
                        const videoBlob = await videoRes.blob();
                        console.log('[Discord] Video size:', videoBlob.size, 'bytes');
                        
                        if (videoBlob.size <= MAX_FILE_SIZE && videoBlob.size > 0) {
                            // Upload as attachment using FormData
                            const formData = new FormData();
                            const filename = `${data.platform.toLowerCase()}_video.mp4`;
                            formData.append('file', videoBlob, filename);
                            formData.append('payload_json', JSON.stringify({
                                username: APP_NAME,
                                avatar_url: APP_ICON,
                                embeds: [embed],
                            }));
                            
                            const uploadRes = await sendWithRateLimit(settings.webhookUrl, {
                                method: 'POST',
                                body: formData,
                            });
                            
                            if (uploadRes.ok || uploadRes.status === 204) {
                                uploadSuccess = true;
                                markMessageSent(messageKey);
                                return { sent: true };
                            }
                        }
                    }
                } catch (e) {
                    console.error('[Discord] Video upload failed:', e);
                }
                
                // Fallback: markdown link if upload failed or file too large
                if (!uploadSuccess) {
                    payload.content = `[${data.platform} Video](${data.mediaUrl})`;
                    payload.embeds = [embed];
                }
            } else {
                // Add source URL for non-video - makes embed clickable
                if (data.sourceUrl) {
                    embed.url = data.sourceUrl;
                    embed.title = 'Open Source';
                }
                
                // Image - show in embed
                if (data.mediaUrl && data.mediaType === 'image') {
                    embed.image = { url: data.mediaUrl };
                } else if (data.thumbnail) {
                    // Fallback to thumbnail
                    embed.image = { url: data.thumbnail };
                }
                
                payload.embeds = [embed];
            }
        } else {
            // Plain text with source link
            let content = `**${data.platform} Downloader**\n`;
            if (data.title) content += `${data.title}\n`;
            if (data.author) content += `by ${data.author}\n`;
            if (data.sourceUrl) content += `${data.sourceUrl}`;
            payload.content = content;
        }

        const res = await sendWithRateLimit(settings.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (res.ok || res.status === 204) {
            // Mark as sent to prevent duplicates
            markMessageSent(messageKey);
            return { sent: true };
        } else if (res.status === 429) {
            return { sent: false, reason: 'rate_limited' };
        } else {
            const errorText = await res.text().catch(() => '');
            console.error('[Discord] Send failed:', res.status, errorText);
            return { sent: false, reason: `error_${res.status}` };
        }
    } catch (err) {
        console.error('[Discord] Send error:', err);
        return { sent: false, reason: err instanceof Error ? err.message : 'unknown' };
    }
}
