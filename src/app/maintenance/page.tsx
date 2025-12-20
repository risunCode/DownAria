'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Wrench, Clock, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface MaintenanceInfo {
    message: string;
    content?: string;
    lastUpdated?: string;
}

export default function MaintenancePage() {
    const t = useTranslations('maintenance');
    const [info, setInfo] = useState<MaintenanceInfo>({ message: '' });
    const [loading, setLoading] = useState(true);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const fetchMaintenanceInfo = useCallback(async () => {
        try {
            const res = await fetch('/api/status?t=' + Date.now());
            const data = await res.json();
            
            if (data.success) {
                // If not in maintenance, redirect to home
                if (!data.data?.maintenance) {
                    window.location.href = '/';
                    return;
                }
                
                setInfo({
                    message: data.data?.maintenanceMessage || t('defaultMessage'),
                    content: data.data?.maintenanceContent,
                    lastUpdated: data.data?.maintenanceLastUpdated,
                });
                setLastChecked(new Date());
            }
        } catch {
            setInfo({ message: t('defaultMessage') });
        }
        setLoading(false);
    }, [t]);

    useEffect(() => {
        fetchMaintenanceInfo();
        
        // Poll every 60 seconds, but only when tab is visible
        let interval: NodeJS.Timeout | null = null;
        
        const startPolling = () => {
            if (!interval) {
                interval = setInterval(fetchMaintenanceInfo, 60000);
            }
        };
        
        const stopPolling = () => {
            if (interval) {
                clearInterval(interval);
                interval = null;
            }
        };
        
        const handleVisibility = () => {
            if (document.hidden) {
                stopPolling();
            } else {
                fetchMaintenanceInfo();
                startPolling();
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibility);
        startPolling();
        
        return () => {
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [fetchMaintenanceInfo]);

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-lg w-full"
            >
                {/* Main Card */}
                <div className="glass-card p-8 text-center">
                    {/* Icon */}
                    <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="inline-flex p-4 rounded-xl bg-yellow-500/10 mb-6"
                    >
                        <Wrench className="w-10 h-10 text-yellow-400" />
                    </motion.div>
                    
                    {/* Title */}
                    <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
                    
                    {/* Message */}
                    {loading ? (
                        <div className="h-5 w-64 mx-auto bg-[var(--bg-secondary)] rounded animate-pulse" />
                    ) : (
                        <p className="text-[var(--text-muted)] mb-4">{info.message}</p>
                    )}
                    
                    {/* Content (Full message) */}
                    {info.content && (
                        <div className="mt-4 p-4 rounded-lg bg-[var(--bg-secondary)] text-left">
                            <p className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap">{info.content}</p>
                        </div>
                    )}
                    
                    {/* Last Updated */}
                    {info.lastUpdated && (
                        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Last updated: {info.lastUpdated}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center mt-6">
                    <button
                        onClick={fetchMaintenanceInfo}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm hover:bg-[var(--bg-card)] transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Check Status
                    </button>
                    {lastChecked && (
                        <p className="text-xs text-[var(--text-muted)] mt-3">
                            Last checked: {lastChecked.toLocaleTimeString()}
                        </p>
                    )}
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                        {t('footer')}
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
