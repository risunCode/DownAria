'use client';

import { Play, Info } from 'lucide-react';
import { AdminCard } from '@/components/admin';

interface PlaygroundPanelProps {
    config: {
        playgroundEnabled: boolean;
        playgroundRateLimit: number;
    };
    onUpdateGlobal: (updates: Record<string, any>) => void;
}

export default function PlaygroundPanel({ config, onUpdateGlobal }: PlaygroundPanelProps) {
    return (
        <div className="space-y-6">
            {/* Guest Playground Section */}
            <AdminCard className="p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                        <Play className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <h3 className="font-semibold">Guest Playground</h3>
                        <p className="text-xs text-[var(--text-muted)]">Settings for /advanced page API testing</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Playground Enabled */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <div>
                            <div className="font-medium text-sm">Enable Playground</div>
                            <div className="text-xs text-[var(--text-muted)]">Allow guests to test API on /advanced</div>
                        </div>
                        <button
                            onClick={() => onUpdateGlobal({ playgroundEnabled: !config.playgroundEnabled })}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                                config.playgroundEnabled ? 'bg-green-500' : 'bg-[var(--bg-card)]'
                            }`}
                        >
                            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                                config.playgroundEnabled ? 'left-7' : 'left-1'
                            }`} />
                        </button>
                    </div>

                    {/* Playground Rate Limit */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                        <div>
                            <div className="font-medium text-sm">Playground Rate Limit</div>
                            <div className="text-xs text-[var(--text-muted)]">Max requests per 2 minutes</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                defaultValue={config.playgroundRateLimit}
                                onBlur={(e) => onUpdateGlobal({ playgroundRateLimit: parseInt(e.target.value) || 5 })}
                                className="w-20 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-sm text-center"
                                min={1}
                                max={50}
                            />
                            <span className="text-xs text-[var(--text-muted)]">req/2min</span>
                        </div>
                    </div>
                </div>
            </AdminCard>

            {/* Info */}
            <AdminCard>
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm flex-1">
                        <p className="font-medium text-[var(--text-secondary)] mb-2">Settings Info</p>
                        <ul className="space-y-1 text-xs text-[var(--text-muted)]">
                            <li>• <span className="text-yellow-400">Maintenance API</span> - Blocks /api requests, pages still accessible</li>
                            <li>• <span className="text-red-400">Maintenance Full</span> - Redirects all users to /maintenance page</li>
                            <li>• <span className="text-blue-400">Playground</span> - Guest API testing at /advanced (separate rate limit)</li>
                        </ul>
                    </div>
                </div>
            </AdminCard>
        </div>
    );
}