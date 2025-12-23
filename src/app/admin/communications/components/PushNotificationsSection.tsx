'use client';

import { useState, useCallback } from 'react';
import { Send, Users, Settings, AlertCircle, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { AdminCard, StatCard } from '@/components/admin';

interface PushStats {
    isConfigured: boolean;
    subscriberCount: number;
}

interface PushNotificationsSectionProps {
    pushStats: PushStats | null;
    pushLoading: boolean;
    onRefresh: () => void;
    getAuthHeaders: () => Record<string, string>;
}

export function PushNotificationsSection({ 
    pushStats, 
    pushLoading, 
    onRefresh, 
    getAuthHeaders 
}: PushNotificationsSectionProps) {
    const [sending, setSending] = useState(false);
    const [pushForm, setPushForm] = useState({ 
        title: '', 
        body: '', 
        url: '/' 
    });

    const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

    const sendPushNotification = async () => {
        if (!pushForm.title.trim()) {
            Swal.fire({ 
                icon: 'warning', 
                title: 'Title Required', 
                background: 'var(--bg-card)', 
                color: 'var(--text-primary)' 
            });
            return;
        }
        
        const confirm = await Swal.fire({
            icon: 'question',
            title: 'Send Push Notification?',
            html: `<p class="text-sm">This will send to <b>${pushStats?.subscriberCount || 0}</b> subscribers</p>`,
            showCancelButton: true,
            confirmButtonText: 'Send',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)'
        });
        
        if (!confirm.isConfirmed) return;

        setSending(true);
        try {
            const res = await fetch(`${API_URL}/api/admin/push`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(pushForm)
            });
            
            const data = await res.json();
            if (data.success) {
                Swal.fire({ 
                    icon: 'success', 
                    title: 'Sent!', 
                    html: `Sent: ${data.sent} | Failed: ${data.failed}`, 
                    background: 'var(--bg-card)', 
                    color: 'var(--text-primary)' 
                });
                setPushForm({ title: '', body: '', url: '/' });
                onRefresh();
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            Swal.fire({ 
                icon: 'error', 
                title: 'Failed', 
                text: error instanceof Error ? error.message : 'Unknown error', 
                background: 'var(--bg-card)', 
                color: 'var(--text-primary)' 
            });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Config Warning */}
            {!pushStats?.isConfigured && (
                <AdminCard className="border-amber-500/30 bg-amber-500/10">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                        <div>
                            <p className="font-medium text-amber-400">VAPID Keys Not Configured</p>
                            <p className="text-sm text-[var(--text-muted)] mt-1">
                                Add to backend .env (api-xtfetch): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
                            </p>
                        </div>
                    </div>
                </AdminCard>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <StatCard
                    icon={<Users className="w-5 h-5" />}
                    label="Subscribers"
                    value={(pushStats?.subscriberCount || 0).toString()}
                    color="text-blue-400"
                />
                <StatCard
                    icon={<Settings className="w-5 h-5" />}
                    label="VAPID Status"
                    value={pushStats?.isConfigured ? 'Ready' : 'Not Configured'}
                    color={pushStats?.isConfigured ? 'text-green-400' : 'text-red-400'}
                />
            </div>

            {/* Send Form */}
            <AdminCard>
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                    <Send className="w-5 h-5 text-[var(--accent-primary)]" /> Send Push Notification
                </h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Title *</label>
                        <input 
                            type="text" 
                            value={pushForm.title} 
                            onChange={e => setPushForm(f => ({ ...f, title: e.target.value }))}
                            placeholder="New Feature Available!" 
                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)]" 
                            maxLength={100} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Body</label>
                        <textarea 
                            value={pushForm.body} 
                            onChange={e => setPushForm(f => ({ ...f, body: e.target.value }))}
                            placeholder="Check out the latest updates..." 
                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] resize-none" 
                            rows={3} 
                            maxLength={200} 
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Click URL</label>
                        <input 
                            type="text" 
                            value={pushForm.url} 
                            onChange={e => setPushForm(f => ({ ...f, url: e.target.value }))}
                            placeholder="/" 
                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] font-mono text-sm" 
                        />
                    </div>
                    <button 
                        onClick={sendPushNotification} 
                        disabled={sending || !pushStats?.isConfigured || !pushStats?.subscriberCount}
                        className="w-full py-2.5 bg-[var(--accent-primary)] text-white rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {sending ? 'Sending...' : `Send to ${pushStats?.subscriberCount || 0} Subscribers`}
                    </button>
                </div>
            </AdminCard>
        </div>
    );
}