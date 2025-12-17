import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export async function POST(request: NextRequest) {
    try {
        const { message, embed, webhookUrl } = await request.json();

        // Use provided webhookUrl or fall back to env var
        const targetWebhook = webhookUrl || DEFAULT_WEBHOOK_URL;

        if (!targetWebhook) {
            return NextResponse.json(
                { success: false, error: 'Discord webhook URL not configured' },
                { status: 500 }
            );
        }

        // Validate webhook URL format
        if (!targetWebhook.startsWith('https://discord.com/api/webhooks/') && 
            !targetWebhook.startsWith('https://discordapp.com/api/webhooks/')) {
            return NextResponse.json(
                { success: false, error: 'Invalid Discord webhook URL' },
                { status: 400 }
            );
        }

        if (!message && !embed) {
            return NextResponse.json(
                { success: false, error: 'Message or embed required' },
                { status: 400 }
            );
        }

        // Build webhook payload
        const payload: {
            content?: string;
            username?: string;
            avatar_url?: string;
            embeds?: Array<{
                title?: string;
                description?: string;
                color?: number;
                fields?: Array<{ name: string; value: string; inline?: boolean }>;
                timestamp?: string;
                footer?: { text: string };
            }>;
        } = {
            username: 'XTFetch',
            avatar_url: 'https://xt-fetch.vercel.app/icon.png',
        };

        if (message) {
            // Message content doesn't support markdown links
            // Just pass through as-is, Discord will auto-preview images
            payload.content = message;
        }

        if (embed) {
            // Clean up embed - remove undefined values and ensure proper structure
            const cleanEmbed: Record<string, unknown> = {};
            
            if (embed.title) cleanEmbed.title = embed.title;
            if (embed.description) {
                // Auto-wrap long URLs with markdown [domain](url) in embed description
                const urlRegex = /(https?:\/\/[^\s]+)/g;
                cleanEmbed.description = embed.description.replace(urlRegex, (url: string) => {
                    if (url.length > 50) {
                        try {
                            const urlObj = new URL(url);
                            const domain = urlObj.hostname.replace('www.', '');
                            return `[${domain}](${url})`;
                        } catch {
                            return `[url](${url})`;
                        }
                    }
                    return url;
                });
            }
            if (embed.color) cleanEmbed.color = embed.color;
            if (embed.timestamp) cleanEmbed.timestamp = embed.timestamp;
            
            if (embed.author?.name) {
                cleanEmbed.author = {
                    name: embed.author.name,
                    icon_url: embed.author.icon_url || 'https://xt-fetch.vercel.app/icon.png',
                };
            }
            
            if (embed.thumbnail?.url) {
                cleanEmbed.thumbnail = { url: embed.thumbnail.url };
            }
            
            if (embed.image?.url) {
                cleanEmbed.image = { url: embed.image.url };
            }
            
            if (embed.footer?.text) {
                cleanEmbed.footer = {
                    text: embed.footer.text,
                    icon_url: embed.footer.icon_url || undefined,
                };
            }
            
            payload.embeds = [cleanEmbed];
        }

        // Send to Discord
        const response = await fetch(targetWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            return NextResponse.json(
                { success: false, error: `Discord error: ${response.status}` },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, message: 'Sent to Discord' });
    } catch {
        return NextResponse.json(
            { success: false, error: 'Failed to send webhook' },
            { status: 500 }
        );
    }
}
