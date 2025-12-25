/**
 * Discord Webhook Utility
 * User-side webhook for download notifications
 * Settings stored in localStorage (plain, for cross-browser backup compatibility)
 * 
 * Discord Webhook Limits:
 * - 30 messages/minute per channel
 * - 50 requests/second per IP
 * - 200 MiB max payload size (with files)
 * - 10 embeds per message
 * - ~8-10MB for auto-embed videos in messages
 */

import Swal from 'sweetalert2';
import { formatNumber, formatBytes } from './format';

const APP_NAME = 'DownAria';
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
    mention: string; // NEW: <@ID>, @everyone, @here
}

export const DEFAULT_USER_DISCORD: UserDiscordSettings = {
    webhookUrl: '',
    autoSend: false,
    embedEnabled: true,
    embedColor: '#5865F2',
    footerText: 'via DownAria',
    sendMethod: 'smart', // Default: auto-detect based on file size
    mention: '', // Default: no mention
};

// Storage key for Discord settings
export const DISCORD_STORAGE_KEY = 'xtf_discord';

// Use plain localStorage for cross-browser backup compatibility
// Webhook URLs are not super sensitive and users need portability
export function getUserDiscordSettings(): UserDiscordSettings | null {
    if (typeof window === 'undefined') return null;
    try {
        const saved = localStorage.getItem(DISCORD_STORAGE_KEY);
        if (saved) {
            // Handle legacy encrypted data - if it starts with 'enc:', clear it
            if (saved.startsWith('enc:')) {
                console.warn('[Discord] Found encrypted data, clearing for fresh start');
                localStorage.removeItem(DISCORD_STORAGE_KEY);
                return null;
            }
            return { ...DEFAULT_USER_DISCORD, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.error('[Discord] Failed to parse settings:', e);
        // Clear corrupted data
        localStorage.removeItem(DISCORD_STORAGE_KEY);
    }
    return null;
}

export function saveUserDiscordSettings(settings: UserDiscordSettings): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(DISCORD_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error('[Discord] Failed to save settings:', e);
    }
}

// Duplicate prevention
const recentMessages = new Map<string, number>(); // key -> timestamp
const MESSAGE_CACHE_TTL = 60 * 1000;
const MAX_CACHE_SIZE = 100;

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
    const timestamp = recentMessages.get(key);
    if (!timestamp) return false;
    // Check if expired
    if (Date.now() - timestamp > MESSAGE_CACHE_TTL) {
        recentMessages.delete(key);
        return false;
    }
    return true;
}

function markSent(key: string): void {
    // Cleanup old entries first if at capacity
    if (recentMessages.size >= MAX_CACHE_SIZE) {
        const now = Date.now();
        for (const [k, ts] of recentMessages.entries()) {
            if (now - ts > MESSAGE_CACHE_TTL) recentMessages.delete(k);
        }
        // If still at capacity, remove oldest
        if (recentMessages.size >= MAX_CACHE_SIZE) {
            const oldest = recentMessages.keys().next().value;
            if (oldest) recentMessages.delete(oldest);
        }
    }
    recentMessages.set(key, Date.now());
}

function getBaseUrl(): string {
    if (typeof window !== 'undefined') return window.location.origin;
    return process.env.NEXT_PUBLIC_BASE_URL || 'https://xt-fetch.vercel.app';
}

function getProxyUrl(mediaUrl: string, platform: string): string {
    return `${getBaseUrl()}/api/v1/proxy?url=${encodeURIComponent(mediaUrl)}&platform=${platform.toLowerCase()}&inline=1`;
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
        if (process.env.NODE_ENV === 'development') console.log(`[Discord] Waiting ${waitMs}ms for rate limit...`);
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

            if (process.env.NODE_ENV === 'development') console.log(`[Discord] Rate limited, retry after ${waitSec}s`);

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

// Helper to upload file to Discord (uses user's data)
async function sendFileToDiscord(
    webhookUrl: string,
    fileBlob: Blob,
    filename: string,
    payload: { content?: string; embeds?: any[]; username?: string; avatar_url?: string }
): Promise<{ ok: boolean; status: number; error?: string }> {
    const formData = new FormData();
    formData.append('payload_json', JSON.stringify(payload));
    formData.append('file0', fileBlob, filename);

    const res = await fetch(webhookUrl, {
        method: 'POST',
        body: formData,
    });

    if (res.ok || res.status === 204) {
        return { ok: true, status: res.status };
    }
    const errorText = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: errorText };
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
        const isWeibo = data.platform.toLowerCase() === 'weibo';

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
            footer: { text: settings.footerText || 'via DownAria', icon_url: appIcon },
            timestamp: new Date().toISOString(),
        };

        if (data.sourceUrl) {
            embed.url = data.sourceUrl;
            embed.title = 'Open Source';
        }

        // Handle media display
        if (data.mediaType === 'image' && data.mediaUrl) {
            // Photos: Use BIG image (bottom)
            embed.image = { url: isWeibo ? getProxyUrl(data.mediaUrl, data.platform) : data.mediaUrl };
        } else if (data.thumbnail) {
            // Videos/Other: Use THUMBNAIL (small, top-right)
            // This ensures we always have a visual, but avoids overriding the video player in 'link' mode.
            embed.thumbnail = { url: isWeibo ? getProxyUrl(data.thumbnail!, data.platform) : data.thumbnail! };
        }

        // Determine send method
        const sendMethod = settings.sendMethod || 'smart';
        const mediaLabel = `${data.platform} ${data.quality || (data.mediaType === 'video' ? 'Video' : 'Media')}`;

        // Use file size from data if available, otherwise check
        let finalSize = data.fileSize || 0;
        if (finalSize === 0 && data.mediaUrl) {
            const { size } = await isLargeFile(data.mediaUrl, data.platform);
            finalSize = size;
        }

        const isSmallMedia = finalSize > 0 && finalSize < LARGE_FILE_THRESHOLD;
        const shouldUpload = (sendMethod === 'smart' && isSmallMedia) || (sendMethod === 'single' && isSmallMedia);
        const useDoubleMessage = (sendMethod === 'double') || (sendMethod === 'smart' && !isSmallMedia);

        // UNIFIED CONFIRMATION DIALOG ---------------------------------------
        // If manual, show dialog for BOTH Upload and Link logic to ensure consistency.
        if (manual) {
            // Determine what method label to show
            let methodLabel = '';
            let warningText = '';
            let methodIcon = '';

            if (shouldUpload && data.mediaUrl) {
                methodLabel = 'Direct Upload'; // Gold
                methodIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
                warningText = '⚠️ This will upload media using your internet data.';
            } else {
                methodLabel = useDoubleMessage ? 'Link Embed (Double)' : 'Link Embed'; // Green
                methodIcon = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
                warningText = '✅ Sends a link. No data usage for upload.';
            }

            const result = await Swal.fire({
                title: 'Send to Discord?',
                html: `
                    <div class="text-left text-sm space-y-2 mt-4">
                        <div class="grid grid-cols-[80px_1fr] gap-2">
                            <span class="text-[var(--text-muted)]">Platform:</span>
                            <span class="font-medium text-[var(--text-primary)]">${data.platform}</span>
                            
                            <span class="text-[var(--text-muted)]">Type:</span>
                            <span class="font-medium text-[var(--text-primary)] flex items-center gap-1">
                                ${data.mediaType === 'video' ? '📹 Video' : '📷 Image'}
                            </span>
                            
                            <span class="text-[var(--text-muted)]">Quality:</span>
                            <span class="font-medium text-[var(--text-primary)]">${data.quality || 'Standard'}</span>

                            <span class="text-[var(--text-muted)]">Size:</span>
                            <span class="font-medium text-[var(--text-primary)]">${finalSize > 0 ? formatBytes(finalSize) : 'Unknown'}</span>

                            <span class="text-[var(--text-muted)]">Method:</span>
                            <span class="font-medium ${shouldUpload ? 'text-amber-500' : 'text-green-500'} flex items-center gap-1">
                                ${methodIcon}
                                ${methodLabel}
                            </span>
                        </div>
                        <p class="text-[10px] text-[var(--text-muted)] mt-3 pt-3 border-t border-[var(--border-color)]">
                            ${warningText}
                        </p>
                    </div>
                `,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Send',
                cancelButtonText: 'Cancel',
                confirmButtonColor: '#5865F2',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                reverseButtons: true
            });

            if (!result.isConfirmed) {
                return { sent: false, reason: 'cancelled' };
            }

            // Loading removed to run in background
        }
        // -------------------------------------------------------------------

        // UPLOAD LOGIC
        if (shouldUpload && data.mediaUrl) {
            if (process.env.NODE_ENV === 'development') console.log(`[Discord] Uploading small media (${formatBytes(finalSize)})`);
            try {
                const proxyUrl = getProxyUrl(data.mediaUrl, data.platform);
                const res = await fetch(proxyUrl);
                if (!res.ok) throw new Error('Proxy fetch failed');
                const blob = await res.blob();

                const fileExt = data.mediaType === 'video' ? 'mp4' : 'jpg';
                const filename = `DownAria_${data.platform}_${Date.now()}.${fileExt}`;

                // Send File + Embed in ONE message
                const result = await sendFileToDiscord(settings.webhookUrl, blob, filename, {
                    username: APP_NAME,
                    avatar_url: appIcon,
                    content: `${settings.mention ? settings.mention + ' ' : ''}✅ **${mediaLabel}**`,
                    embeds: [embed]
                });

                if (result.ok) {
                    markSent(messageKey);
                    return { sent: true };
                }
            } catch (err) {
                if (process.env.NODE_ENV === 'development') console.warn('[Discord] Upload failed, falling back to link:', err);
                if (manual) {
                    // Optional: Notify user that upload failed and we are falling back?
                    // Swal.fire(...) // Skipping to avoid double popup spam, just fall back
                }
                // Fall through to link logic
            }
        }

        // FALLBACK TO LINK (if >10MB or upload failed)
        if (data.mediaType === 'video' && data.mediaUrl) {
            const videoLinkUrl = isWeibo ? getProxyUrl(data.mediaUrl, data.platform) : data.mediaUrl;

            if (useDoubleMessage) {
                // 2x SEND: [Wrapped-Link] + Embed
                if (process.env.NODE_ENV === 'development') console.log('[Discord] Using 2x send method (Link -> Embed)');

                // Message 1: Wrapped link [Platform Type](url) - Discord will auto-embed video
                const result1 = await sendToWebhook(settings.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: APP_NAME,
                        avatar_url: appIcon,
                        content: `${settings.mention ? settings.mention + ' ' : ''}[${mediaLabel}](${videoLinkUrl})`,
                    }),
                });

                if (!result1.ok) {
                    if (result1.status === 429) {
                        return { sent: false, reason: 'rate_limited', details: `Rate limited. Try again in ${result1.retryAfter || 5}s` };
                    }
                    return { sent: false, reason: `error_${result1.status}`, details: result1.error };
                }

                markSent(messageKey);

                // Small delay between messages (2s to ensure ordering)
                await new Promise(r => setTimeout(r, 2000));

                // Message 2: Rich embed with info (no video/image)
                const result2 = await sendToWebhook(settings.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: APP_NAME,
                        avatar_url: appIcon,
                        embeds: [embed],
                    }),
                });

                if (!result2.ok) {
                    return { sent: true, details: 'Link sent, embed failed' };
                }
                return { sent: true };
            } else {
                // 1x SEND: Link + embed in single message
                // We now use embed.thumbnail (handled below) which is safe to use with video links.

                const result = await sendToWebhook(settings.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: APP_NAME,
                        avatar_url: appIcon,
                        content: `${settings.mention ? settings.mention + ' ' : ''}📹 [**${mediaLabel}**](${videoLinkUrl})`,
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
        } else if (data.thumbnail) {
            // Videos/Other: Use THUMBNAIL (small, top-right)
            // This ensures we always have a visual, but avoids overriding the video player in 'link' mode.
            embed.thumbnail = { url: isWeibo ? getProxyUrl(data.thumbnail!, data.platform) : data.thumbnail! };
        }

        // Send embed
        const result = await sendToWebhook(settings.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: APP_NAME,
                avatar_url: appIcon,
                content: settings.mention || undefined,
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
