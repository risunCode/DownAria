'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import { RefreshCw, Wrench, MessageSquare, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AdminCard } from '@/components/admin';
import { api } from '@/lib/api';

interface MaintenancePanelProps {
    config: { 
        maintenanceType: string; 
        maintenanceMessage: string;
        lastUpdated: string;
    };
    onRefetch: () => void;
}

export default function MaintenancePanel({ config, onRefetch }: MaintenancePanelProps) {
    const [updating, setUpdating] = useState<string | null>(null);

    const handleTypeChange = async (value: string) => {
        setUpdating(value);
        try {
            await api.put('/api/admin/services', { maintenanceType: value }, { auth: true });
            
            await Swal.fire({
                icon: 'success',
                title: 'Maintenance Mode Updated',
                text: `Maintenance mode set to: ${value}`,
                timer: 2000,
                showConfirmButton: false,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
            
            onRefetch();
        } catch (error) {
            await Swal.fire({
                icon: 'error',
                title: 'Update Failed',
                text: error instanceof Error ? error.message : 'Failed to update maintenance mode',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
        } finally {
            setUpdating(null);
        }
    };

    const handleMessageChange = async (message: string) => {
        try {
            await api.put('/api/admin/services', { maintenanceMessage: message }, { auth: true });
            onRefetch();
        } catch (error) {
            await Swal.fire({
                icon: 'error',
                title: 'Update Failed',
                text: 'Failed to update maintenance message',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
        }
    };

    const options = [
        { 
            value: 'off', 
            label: 'Off', 
            desc: 'All services running', 
            color: 'text-green-400', 
            bg: 'bg-green-500/10 border-green-500/30',
            icon: CheckCircle2
        },
        { 
            value: 'api', 
            label: 'API Only', 
            desc: 'Block API, pages OK', 
            color: 'text-yellow-400', 
            bg: 'bg-yellow-500/10 border-yellow-500/30',
            icon: AlertTriangle
        },
        { 
            value: 'full', 
            label: 'Full', 
            desc: 'Redirect all users', 
            color: 'text-red-400', 
            bg: 'bg-red-500/10 border-red-500/30',
            icon: AlertTriangle
        },
    ];

    return (
        <AdminCard className="p-5">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Wrench className="w-5 h-5 text-yellow-400" />
                </div>
                <div>
                    <h3 className="font-semibold">Maintenance Mode</h3>
                    <p className="text-xs text-[var(--text-muted)]">Control site availability</p>
                </div>
            </div>
            
            <div className="space-y-4">
                {/* Type Selector */}
                <div className="grid grid-cols-3 gap-3">
                    {options.map((opt) => {
                        const Icon = opt.icon;
                        return (
                            <motion.button
                                key={opt.value}
                                onClick={() => handleTypeChange(opt.value)}
                                disabled={updating !== null}
                                whileHover={{ scale: updating === null ? 1.02 : 1 }}
                                whileTap={{ scale: updating === null ? 0.98 : 1 }}
                                className={`p-3 rounded-xl border text-left transition-all relative ${
                                    config.maintenanceType === opt.value 
                                        ? opt.bg 
                                        : 'bg-[var(--bg-secondary)] border-[var(--border-color)] hover:border-[var(--accent-primary)]/50'
                                } ${updating !== null ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                                <AnimatePresence>
                                    {updating === opt.value && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl"
                                        >
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon className={`w-4 h-4 ${config.maintenanceType === opt.value ? opt.color : 'text-[var(--text-muted)]'}`} />
                                    <div className={`font-medium ${config.maintenanceType === opt.value ? opt.color : ''}`}>
                                        {opt.label}
                                    </div>
                                </div>
                                <div className="text-xs text-[var(--text-muted)]">{opt.desc}</div>
                            </motion.button>
                        );
                    })}
                </div>

                {/* Message */}
                <div>
                    <label className="text-sm text-[var(--text-muted)] mb-2 block">Maintenance Message</label>
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-[var(--text-muted)]" />
                        <input
                            type="text"
                            defaultValue={config.maintenanceMessage}
                            onBlur={(e) => handleMessageChange(e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                            placeholder="Message shown during maintenance..."
                        />
                    </div>
                </div>

                {/* Details (shown when maintenance is active) */}
                <AnimatePresence>
                    {config.maintenanceType !== 'off' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <MaintenanceDetails />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </AdminCard>
    );
}

// Maintenance Details Component
function MaintenanceDetails() {
    const [fields, setFields] = useState({
        content: '',
        lastUpdated: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const data = await api.get<{ success: boolean; data?: { maintenance_content?: string; maintenance_last_updated?: string } }>(
                    '/api/admin/settings', 
                    { auth: true }
                );
                
                if (data.success && data.data) {
                    setFields({
                        content: data.data.maintenance_content || '',
                        lastUpdated: data.data.maintenance_last_updated || '',
                    });
                }
            } catch (error) {
                console.error('Failed to fetch maintenance details:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, []);

    const saveField = async (key: string, value: string) => {
        setSaving(true);
        try {
            await api.put('/api/admin/settings', { [key]: value }, { auth: true });
        } catch (error) {
            await Swal.fire({
                icon: 'error',
                title: 'Save Failed',
                text: 'Failed to save maintenance details',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
        } finally {
            setSaving(false);
        }
    };

    const updateField = (key: keyof typeof fields, value: string) => {
        setFields(prev => ({ ...prev, [key]: value }));
    };

    const updateLastUpdated = async () => {
        const now = new Date().toLocaleString('id-ID', { 
            dateStyle: 'medium', 
            timeStyle: 'short' 
        });
        updateField('lastUpdated', now);
        await saveField('maintenance_last_updated', now);
        
        await Swal.fire({
            icon: 'success',
            title: 'Updated',
            text: 'Last updated timestamp refreshed',
            timer: 1500,
            showConfirmButton: false,
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });
    };

    if (loading) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-32 bg-[var(--bg-secondary)] rounded-lg animate-pulse"
            />
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4 pt-4 border-t border-[var(--border-color)]"
        >
            {/* Content (Full message) */}
            <div>
                <label className="text-sm text-[var(--text-muted)] mb-2 block">Content (Full message)</label>
                <textarea
                    value={fields.content}
                    onChange={(e) => updateField('content', e.target.value)}
                    onBlur={() => {
                        saveField('maintenance_content', fields.content);
                        updateLastUpdated();
                    }}
                    disabled={saving}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm resize-none focus:border-[var(--accent-primary)] focus:outline-none transition-colors disabled:opacity-50"
                    rows={3}
                    placeholder="Detailed maintenance message shown to users..."
                />
            </div>

            {/* Last Updated */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                <div>
                    <div className="text-sm text-[var(--text-muted)]">Last Status Updated</div>
                    <div className="text-sm font-medium">
                        {fields.lastUpdated || 'Never'}
                    </div>
                </div>
                <motion.button
                    onClick={updateLastUpdated}
                    disabled={saving}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-xs hover:border-[var(--accent-primary)]/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? (
                        <span className="flex items-center gap-2">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Updating...
                        </span>
                    ) : (
                        'Update Now'
                    )}
                </motion.button>
            </div>
        </motion.div>
    );
}