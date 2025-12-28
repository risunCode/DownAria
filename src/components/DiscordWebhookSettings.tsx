'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Info, Loader2, Send, AlertCircle, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
    UserDiscordSettings,
    DEFAULT_USER_DISCORD,
    getUserDiscordSettings,
    saveUserDiscordSettings,
} from '@/lib/utils/discord-webhook';
import Swal from 'sweetalert2';

export function DiscordWebhookSettings() {
    const [settings, setSettings] = useState<UserDiscordSettings>(DEFAULT_USER_DISCORD);
    const [testMessage, setTestMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showTips, setShowTips] = useState(false);

    useEffect(() => {
        // Use getUserDiscordSettings which handles decryption
        const saved = getUserDiscordSettings();
        if (saved) {
            setSettings(saved);
        }
    }, []);

    const saveSettings = (newSettings: UserDiscordSettings) => {
        setSettings(newSettings);
        saveUserDiscordSettings(newSettings);
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Settings saved',
            showConfirmButton: false,
            timer: 1500,
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
    };

    const updateSetting = <K extends keyof UserDiscordSettings>(key: K, value: UserDiscordSettings[K]) => {
        const newSettings = { ...settings, [key]: value };
        saveSettings(newSettings);
    };

    const sendTestMessage = async () => {
        if (!settings.webhookUrl) {
            setResult({ success: false, message: 'Set webhook URL first' });
            return;
        }

        setIsSending(true);
        setResult(null);

        try {
            const payload: Record<string, unknown> = {
                username: 'DownAria',
                avatar_url: typeof window !== 'undefined' ? `${window.location.origin}/icon.png` : '/icon.png',
            };

            if (testMessage.trim()) {
                payload.content = testMessage.trim();
            }

            if (settings.embedEnabled) {
                payload.embeds = [{
                    title: '🎬 Test Download Notification',
                    description: testMessage.trim() || 'This is a test message from DownAria!',
                    color: parseInt(settings.embedColor.replace('#', ''), 16),
                    fields: [
                        { name: 'Platform', value: 'Instagram', inline: true },
                        { name: 'Quality', value: 'HD 1080p', inline: true },
                    ],
                    footer: {
                        text: settings.footerText || 'via DownAria',
                        icon_url: typeof window !== 'undefined' ? `${window.location.origin}/icon.png` : '/icon.png',
                    },
                    timestamp: new Date().toISOString(),
                }];
            }

            const res = await fetch(settings.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (res.ok || res.status === 204) {
                setResult({ success: true, message: 'Message sent!' });
                setTestMessage('');
            } else {
                const error = await res.text();
                setResult({ success: false, message: error || `Error ${res.status}` });
            }
        } catch (err) {
            setResult({ success: false, message: err instanceof Error ? err.message : 'Failed to send' });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Info Card */}
            <div className="flex items-start gap-3 p-4 rounded-lg bg-[var(--bg-secondary)]">
                <div className="w-10 h-10 rounded-lg bg-[#5865F2]/20 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold">Discord Webhook</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                        Get notified on Discord when downloads complete. Your webhook URL is stored locally.
                    </p>
                </div>
                <button
                    onClick={() => setShowTips(!showTips)}
                    className="p-2 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)]"
                >
                    <Info className="w-4 h-4" />
                </button>
            </div>

            {/* Tips */}
            {showTips && (
                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                    <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-400" />
                        How to get Discord Webhook URL
                    </h4>
                    <ol className="text-xs text-[var(--text-muted)] space-y-1 list-decimal list-inside">
                        <li>Open Discord and go to your server</li>
                        <li>Right-click a channel → Edit Channel</li>
                        <li>Go to Integrations → Webhooks</li>
                        <li>Click &quot;New Webhook&quot; or use existing one</li>
                        <li>Click &quot;Copy Webhook URL&quot;</li>
                        <li>Paste it below!</li>
                        <li className="mt-2 pt-2 border-t border-blue-500/10">To mention a user: <code>&lt;@USER_ID&gt;</code></li>
                        <li>To mention a role: <code>&lt;@&amp;ROLE_ID&gt;</code></li>
                        <li>Or use <code>@everyone</code> or <code>@here</code></li>
                    </ol>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Webhook URL</label>
                    <input
                        type="url"
                        value={settings.webhookUrl}
                        onChange={e => updateSetting('webhookUrl', e.target.value)}
                        placeholder="https://discord.com/api/webhooks/..."
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono"
                    />
                </div>
                <div>
                    <label className="block text-xs text-[var(--text-muted)] mb-1">Mention (Optional)</label>
                    <input
                        type="text"
                        value={settings.mention || ''}
                        onChange={e => updateSetting('mention', e.target.value)}
                        placeholder="@everyone, @here, or <@ID>"
                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono"
                    />
                </div>
            </div>

            {/* Auto Send Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-3">
                    {settings.autoSend ? (
                        <Bell className="w-5 h-5 text-green-400" />
                    ) : (
                        <BellOff className="w-5 h-5 text-[var(--text-muted)]" />
                    )}
                    <div>
                        <p className="text-sm font-medium">Auto-send on download</p>
                        <p className="text-xs text-[var(--text-muted)]">Automatically notify when download completes</p>
                    </div>
                </div>
                <button
                    onClick={() => updateSetting('autoSend', !settings.autoSend)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${settings.autoSend ? 'bg-green-500' : 'bg-[var(--bg-card)]'}`}
                >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.autoSend ? 'left-7' : 'left-1'}`} />
                </button>
            </div>

            {/* Embed Settings */}
            <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={settings.embedEnabled}
                        onChange={e => updateSetting('embedEnabled', e.target.checked)}
                        className="rounded"
                    />
                    Use rich embed (recommended)
                </label>

                {settings.embedEnabled && (
                    <div className="grid grid-cols-2 gap-3 pl-6">
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Embed Color</label>
                            <div className="flex gap-2">
                                <input
                                    type="color"
                                    value={settings.embedColor}
                                    onChange={e => updateSetting('embedColor', e.target.value)}
                                    className="w-10 h-9 rounded cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={settings.embedColor}
                                    onChange={e => updateSetting('embedColor', e.target.value)}
                                    className="flex-1 px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-xs font-mono"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-[var(--text-muted)] mb-1">Footer Text</label>
                            <input
                                type="text"
                                value={settings.footerText}
                                onChange={e => updateSetting('footerText', e.target.value)}
                                placeholder="via DownAria"
                                className="w-full px-2 py-1.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Video Send Method */}
            <div className="space-y-3 pt-3 border-t border-[var(--border-color)]">
                <div>
                    <h4 className="text-sm font-medium">Video/Media Send Method</h4>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Choose how media links or files are sent to your Discord channel.</p>
                </div>
                <div className="space-y-2">
                    {[
                        {
                            id: 'smart' as const,
                            label: 'Smart (Recommended)',
                            desc: 'Auto-detect: ≤10MB upload to Discord (Native player), >10MB send Link + Embed (Wrappred).'
                        },
                        {
                            id: 'single' as const,
                            label: 'Direct Send',
                            desc: 'Try to upload media directly to Discord if under 10MB. Best for instant playback.'
                        },
                        {
                            id: 'double' as const,
                            label: 'Link + Embed (Data Saver)',
                            desc: 'Send wrapped link and rich embed separately. Saves your internet data (no uploads).'
                        },
                    ].map(method => (
                        <label
                            key={method.id}
                            className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${settings.sendMethod === method.id
                                ? 'bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30'
                                : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)] border border-transparent'
                                }`}
                        >
                            <input
                                type="radio"
                                name="sendMethod"
                                checked={settings.sendMethod === method.id}
                                onChange={() => updateSetting('sendMethod', method.id)}
                                className="mt-0.5"
                            />
                            <div>
                                <p className="text-sm font-medium">{method.label}</p>
                                <p className="text-xs text-[var(--text-muted)]">{method.desc}</p>
                                {method.id !== 'double' && (
                                    <p className="text-[10px] text-amber-500/80 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Uploads use your device data/internet.
                                    </p>
                                )}
                            </div>
                        </label>
                    ))}
                </div>
                <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 space-y-2">
                    <p className="text-[11px] text-[var(--text-muted)]">
                        <strong className="text-blue-400">Why 2x Send?</strong> Discord usually doesn&apos;t auto-play video links above 10MB when combined with a rich embed. Sending the wrap link first fixes this.
                    </p>
                    <p className="text-[11px] text-[var(--text-muted)]">
                        <strong className="text-emerald-400">Data Usage:</strong> Link-based messages (Double/Wrapped) only send text (~1KB). Upload-based messages (Direct) send the actual file (MBs) using your internet.
                    </p>
                </div>
            </div>

            {/* Test Message */}
            <div className="pt-3 border-t border-[var(--border-color)] space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                    <Send className="w-4 h-4 text-[var(--accent-primary)]" />
                    Send Test Message
                </h4>
                <textarea
                    value={testMessage}
                    onChange={e => setTestMessage(e.target.value)}
                    placeholder="Optional message content..."
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm resize-none"
                    rows={2}
                />
                <div className="flex items-center gap-3">
                    <Button
                        onClick={sendTestMessage}
                        disabled={isSending || !settings.webhookUrl}
                        leftIcon={isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    >
                        {isSending ? 'Sending...' : 'Send Test'}
                    </Button>
                    {result && (
                        <span className={`text-sm ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                            {result.success ? '✓' : '✗'} {result.message}
                        </span>
                    )}
                </div>
            </div>

            {/* Preview */}
            {settings.webhookUrl && settings.embedEnabled && (
                <div className="pt-3 border-t border-[var(--border-color)]">
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Preview
                    </h4>
                    <div className="bg-[#313338] rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#5865F2] flex items-center justify-center overflow-hidden shrink-0">
                                <span className="text-white font-bold text-sm">XT</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-white text-sm">DownAria</span>
                                    <span className="px-1 py-0.5 text-[10px] bg-[#5865F2] text-white rounded">BOT</span>
                                </div>
                                <div className="rounded overflow-hidden max-w-md" style={{ borderLeft: `4px solid ${settings.embedColor}`, backgroundColor: '#2B2D31' }}>
                                    <div className="p-3">
                                        <h3 className="text-[#00A8FC] font-semibold text-sm mb-1">🎬 Download Complete</h3>
                                        <p className="text-[#DBDEE1] text-sm">Your video has been downloaded!</p>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <div>
                                                <div className="text-xs text-white font-semibold">Platform</div>
                                                <div className="text-xs text-[#DBDEE1]">Instagram</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-white font-semibold">Quality</div>
                                                <div className="text-xs text-[#DBDEE1]">HD 1080p</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#3F4147]">
                                            <span className="text-[#949BA4] text-xs">{settings.footerText || 'via DownAria'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
