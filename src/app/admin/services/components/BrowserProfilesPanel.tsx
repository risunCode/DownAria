'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    RefreshCw, Plus, Info, Edit3, Trash2, Monitor, Smartphone, Tablet, Filter
} from 'lucide-react';
import Swal from 'sweetalert2';
import { AdminCard, PlatformIcon, type PlatformId } from '@/components/admin';
import { PLATFORM_OPTIONS, BROWSER_OPTIONS, DEVICE_OPTIONS, OS_OPTIONS } from '@/hooks/admin';

interface BrowserProfile {
    id: string;
    platform: string;
    label: string;
    user_agent: string;
    sec_ch_ua: string | null;
    sec_ch_ua_platform: string | null;
    sec_ch_ua_mobile: string;
    accept_language: string;
    browser: string;
    device_type: string;
    os: string | null;
    is_chromium: boolean;
    priority: number;
    enabled: boolean;
    use_count: number;
    success_count: number;
    error_count: number;
    note: string | null;
}

interface BrowserProfilesPanelProps {
    profiles: BrowserProfile[];
    totals: { 
        total: number; 
        enabled: number; 
        totalUses: number; 
        totalSuccess: number;
        totalErrors: number;
    };
    onRefresh: () => void;
    onAdd: (profile: Partial<BrowserProfile>) => Promise<BrowserProfile | null>;
    onUpdate: (id: string, updates: Partial<BrowserProfile>) => Promise<boolean>;
    onDelete: (id: string) => Promise<boolean>;
}

export default function BrowserProfilesPanel({
    profiles,
    totals,
    onRefresh,
    onAdd,
    onUpdate,
    onDelete,
}: BrowserProfilesPanelProps) {
    // State
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingProfile, setEditingProfile] = useState<BrowserProfile | null>(null);
    const [filterPlatform, setFilterPlatform] = useState('all');
    const [filterBrowser, setFilterBrowser] = useState('all');
    const [filterDevice, setFilterDevice] = useState('all');
    const [saving, setSaving] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        platform: 'all',
        label: '',
        user_agent: '',
        sec_ch_ua: '',
        sec_ch_ua_platform: '',
        sec_ch_ua_mobile: '?0',
        accept_language: 'en-US,en;q=0.9',
        browser: 'chrome',
        device_type: 'desktop',
        os: 'windows',
        is_chromium: true,
        priority: 5,
        enabled: true,
        note: '',
    });

    // Reset form
    const resetForm = () => {
        setFormData({
            platform: 'all',
            label: '',
            user_agent: '',
            sec_ch_ua: '',
            sec_ch_ua_platform: '',
            sec_ch_ua_mobile: '?0',
            accept_language: 'en-US,en;q=0.9',
            browser: 'chrome',
            device_type: 'desktop',
            os: 'windows',
            is_chromium: true,
            priority: 5,
            enabled: true,
            note: '',
        });
    };

    // Open add modal
    const handleOpenAdd = () => {
        resetForm();
        setEditingProfile(null);
        setShowAddModal(true);
    };

    // Open edit modal
    const handleOpenEdit = (profile: BrowserProfile) => {
        setFormData({
            platform: profile.platform,
            label: profile.label,
            user_agent: profile.user_agent,
            sec_ch_ua: profile.sec_ch_ua || '',
            sec_ch_ua_platform: profile.sec_ch_ua_platform || '',
            sec_ch_ua_mobile: profile.sec_ch_ua_mobile,
            accept_language: profile.accept_language,
            browser: profile.browser,
            device_type: profile.device_type,
            os: profile.os || 'windows',
            is_chromium: profile.is_chromium,
            priority: profile.priority,
            enabled: profile.enabled,
            note: profile.note || '',
        });
        setEditingProfile(profile);
        setShowAddModal(true);
    };

    // Handle save (add or update)
    const handleSave = async () => {
        if (!formData.label.trim() || !formData.user_agent.trim()) {
            await Swal.fire({
                title: 'Validation Error',
                text: 'Label and User-Agent are required',
                icon: 'error',
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
            });
            return;
        }

        setSaving(true);
        try {
            const profileData = {
                ...formData,
                sec_ch_ua: formData.sec_ch_ua || null,
                sec_ch_ua_platform: formData.sec_ch_ua_platform || null,
                os: formData.os || null,
                note: formData.note || null,
            };

            if (editingProfile) {
                // Update
                const success = await onUpdate(editingProfile.id, profileData);
                if (success) {
                    await Swal.fire({
                        title: 'Updated!',
                        text: 'Browser profile updated successfully',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false,
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                    });
                    setShowAddModal(false);
                    resetForm();
                }
            } else {
                // Add
                const result = await onAdd(profileData);
                if (result) {
                    await Swal.fire({
                        title: 'Added!',
                        text: 'Browser profile added successfully',
                        icon: 'success',
                        timer: 1500,
                        showConfirmButton: false,
                        background: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                    });
                    setShowAddModal(false);
                    resetForm();
                }
            }
        } finally {
            setSaving(false);
        }
    };

    // Handle delete
    const handleDelete = async (profile: BrowserProfile) => {
        const result = await Swal.fire({
            title: 'Delete Profile?',
            text: `Delete "${profile.label}"? This action cannot be undone.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel',
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
        });

        if (result.isConfirmed) {
            const success = await onDelete(profile.id);
            if (success) {
                await Swal.fire({
                    title: 'Deleted!',
                    text: 'Browser profile deleted successfully',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false,
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                });
            }
        }
    };

    // Handle toggle enabled
    const handleToggle = async (profile: BrowserProfile) => {
        await onUpdate(profile.id, { enabled: !profile.enabled });
    };

    // Filter profiles
    const filteredProfiles = profiles.filter(profile => {
        if (filterPlatform !== 'all' && profile.platform !== filterPlatform) return false;
        if (filterBrowser !== 'all' && profile.browser !== filterBrowser) return false;
        if (filterDevice !== 'all' && profile.device_type !== filterDevice) return false;
        return true;
    });

    // Helper components
    const DeviceIcon = ({ type }: { type: string }) => {
        if (type === 'mobile') return <Smartphone className="w-4 h-4" />;
        if (type === 'tablet') return <Tablet className="w-4 h-4" />;
        return <Monitor className="w-4 h-4" />;
    };

    const getBrowserColor = (browser: string) => {
        const colors: Record<string, string> = {
            chrome: 'text-green-400',
            firefox: 'text-orange-400',
            safari: 'text-blue-400',
            edge: 'text-cyan-400',
            opera: 'text-red-400',
        };
        return colors[browser] || 'text-gray-400';
    };

    return (
        <div className="space-y-6">
            {/* Stats Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-4 text-center"
                >
                    <div className="text-2xl font-bold text-[var(--text-primary)]">{totals.total}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Total Profiles</div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="glass-card p-4 text-center"
                >
                    <div className="text-2xl font-bold text-green-400">{totals.enabled}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Enabled</div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-card p-4 text-center"
                >
                    <div className="text-2xl font-bold text-blue-400">{totals.totalUses.toLocaleString()}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Total Uses</div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="glass-card p-4 text-center"
                >
                    <div className="text-2xl font-bold text-green-400">{totals.totalSuccess.toLocaleString()}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Success</div>
                </motion.div>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass-card p-4 text-center"
                >
                    <div className="text-2xl font-bold text-red-400">{totals.totalErrors.toLocaleString()}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Errors</div>
                </motion.div>
            </div>

            {/* Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-[var(--text-muted)]" />
                    <select
                        value={filterPlatform}
                        onChange={(e) => setFilterPlatform(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                    >
                        {PLATFORM_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <select
                        value={filterBrowser}
                        onChange={(e) => setFilterBrowser(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                    >
                        <option value="all">All Browsers</option>
                        {BROWSER_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <select
                        value={filterDevice}
                        onChange={(e) => setFilterDevice(e.target.value)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm"
                    >
                        <option value="all">All Devices</option>
                        {DEVICE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onRefresh}
                        className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleOpenAdd}
                        className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Profile
                    </button>
                </div>
            </div>

            {/* Profile List */}
            {filteredProfiles.length === 0 ? (
                <AdminCard>
                    <div className="text-center py-8 text-[var(--text-muted)]">
                        {profiles.length === 0 
                            ? 'No browser profiles found. Click "Add Profile" to create one.'
                            : 'No profiles match the current filters.'}
                    </div>
                </AdminCard>
            ) : (
                <div className="space-y-3">
                    {filteredProfiles.map((profile, idx) => {
                        const successRate = profile.success_count + profile.error_count > 0
                            ? Math.round((profile.success_count / (profile.success_count + profile.error_count)) * 100)
                            : 0;

                        return (
                            <motion.div
                                key={profile.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className="glass-card p-4 hover:border-[var(--accent-primary)]/30 transition-all"
                            >
                                <div className="flex items-start gap-4">
                                    {/* Device Icon */}
                                    <div className={`p-3 rounded-lg ${profile.enabled ? 'bg-[var(--accent-primary)]/10' : 'bg-[var(--bg-secondary)]'}`}>
                                        <DeviceIcon type={profile.device_type} />
                                    </div>

                                    {/* Profile Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-[var(--text-primary)]">{profile.label}</span>
                                            {profile.platform !== 'all' && (
                                                <PlatformIcon platform={profile.platform as PlatformId} size="sm" />
                                            )}
                                            <span className={`text-xs font-medium ${getBrowserColor(profile.browser)}`}>
                                                {profile.browser}
                                            </span>
                                            {profile.is_chromium && (
                                                <span className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400 font-medium">
                                                    Chromium
                                                </span>
                                            )}
                                            {!profile.enabled && (
                                                <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">
                                                    Disabled
                                                </span>
                                            )}
                                        </div>

                                        {/* User Agent */}
                                        <div className="text-xs text-[var(--text-muted)] truncate font-mono mb-2">
                                            {profile.user_agent}
                                        </div>

                                        {/* Stats */}
                                        <div className="flex flex-wrap items-center gap-3 text-xs">
                                            <span className="px-2 py-1 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                                                {profile.platform === 'all' ? 'All Platforms' : profile.platform}
                                            </span>
                                            <span className="px-2 py-1 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                                                {profile.device_type}
                                            </span>
                                            {profile.os && (
                                                <span className="px-2 py-1 rounded bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                                                    {profile.os}
                                                </span>
                                            )}
                                            <span className="text-[var(--text-muted)]">
                                                Priority: <span className="text-[var(--text-primary)] font-medium">{profile.priority}</span>
                                            </span>
                                            <span className="text-[var(--text-muted)]">
                                                Uses: <span className="text-blue-400 font-medium">{profile.use_count}</span>
                                            </span>
                                            <span className="text-[var(--text-muted)]">
                                                Success: <span className="text-green-400 font-medium">{profile.success_count}</span>
                                            </span>
                                            {profile.error_count > 0 && (
                                                <span className="text-[var(--text-muted)]">
                                                    Errors: <span className="text-red-400 font-medium">{profile.error_count}</span>
                                                </span>
                                            )}
                                            {profile.use_count > 0 && (
                                                <span className={`font-medium ${successRate >= 90 ? 'text-green-400' : successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                                                    {successRate}% success
                                                </span>
                                            )}
                                        </div>

                                        {/* Note */}
                                        {profile.note && (
                                            <div className="mt-2 text-xs text-[var(--text-muted)] italic">
                                                {profile.note}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleOpenEdit(profile)}
                                            className="p-2 hover:bg-[var(--bg-secondary)] rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors"
                                            title="Edit"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleToggle(profile)}
                                            className={`relative w-11 h-6 rounded-full transition-colors ${profile.enabled ? 'bg-green-500' : 'bg-gray-600'}`}
                                            title={profile.enabled ? 'Disable' : 'Enable'}
                                        >
                                            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${profile.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(profile)}
                                            className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Info Card */}
            <AdminCard>
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                    <div className="text-sm flex-1">
                        <p className="font-medium text-[var(--text-secondary)] mb-2">Browser Profiles System</p>
                        <ul className="space-y-1 text-xs text-[var(--text-muted)]">
                            <li>• <span className="text-purple-400">Full Headers</span> - Complete browser fingerprint including Sec-Ch-* headers for Chromium browsers</li>
                            <li>• <span className="text-blue-400">Priority</span> - Higher priority profiles (0-100) are selected more often during rotation</li>
                            <li>• <span className="text-green-400">Platform-specific</span> - Set profiles for specific platforms or use &quot;all&quot; for universal profiles</li>
                            <li>• <span className="text-orange-400">Chromium Detection</span> - Chrome, Edge, Opera have Sec-Ch-* headers; Firefox/Safari don&apos;t</li>
                        </ul>
                    </div>
                </div>
            </AdminCard>

            {/* Add/Edit Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => !saving && setShowAddModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                                <div>
                                    <h3 className="font-semibold text-lg">
                                        {editingProfile ? 'Edit Browser Profile' : 'Add Browser Profile'}
                                    </h3>
                                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                                        Configure browser fingerprint for anti-detection
                                    </p>
                                </div>
                                <button
                                    onClick={() => !saving && setShowAddModal(false)}
                                    className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                                    disabled={saving}
                                >
                                    <Plus className="w-5 h-5 rotate-45" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {/* Basic Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                                            Label <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.label}
                                            onChange={(e) => setFormData(f => ({ ...f, label: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                                            placeholder="Chrome 143 Windows Desktop"
                                            disabled={saving}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                                            Platform
                                        </label>
                                        <select
                                            value={formData.platform}
                                            onChange={(e) => setFormData(f => ({ ...f, platform: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                                            disabled={saving}
                                        >
                                            {PLATFORM_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                                            Browser
                                        </label>
                                        <select
                                            value={formData.browser}
                                            onChange={(e) => {
                                                const browser = e.target.value;
                                                const isChromium = ['chrome', 'edge', 'opera'].includes(browser);
                                                setFormData(f => ({ ...f, browser, is_chromium: isChromium }));
                                            }}
                                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                                            disabled={saving}
                                        >
                                            {BROWSER_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                                            Device Type
                                        </label>
                                        <select
                                            value={formData.device_type}
                                            onChange={(e) => setFormData(f => ({ ...f, device_type: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                                            disabled={saving}
                                        >
                                            {DEVICE_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                                            Operating System
                                        </label>
                                        <select
                                            value={formData.os}
                                            onChange={(e) => setFormData(f => ({ ...f, os: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                                            disabled={saving}
                                        >
                                            {OS_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* User Agent */}
                                <div>
                                    <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                                        User-Agent String <span className="text-red-400">*</span>
                                    </label>
                                    <textarea
                                        value={formData.user_agent}
                                        onChange={(e) => setFormData(f => ({ ...f, user_agent: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono resize-none focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                                        rows={3}
                                        placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
                                        disabled={saving}
                                    />
                                </div>

                                {/* Chromium Headers */}
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-secondary)]">
                                    <input
                                        type="checkbox"
                                        id="is_chromium"
                                        checked={formData.is_chromium}
                                        onChange={(e) => setFormData(f => ({ ...f, is_chromium: e.target.checked }))}
                                        className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                                        disabled={saving}
                                    />
                                    <label htmlFor="is_chromium" className="text-sm text-[var(--text-secondary)] cursor-pointer">
                                        Is Chromium-based browser (has Sec-Ch-* headers)
                                    </label>
                                </div>

                                {formData.is_chromium && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="space-y-3"
                                    >
                                        <div>
                                            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                                                Sec-Ch-Ua
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.sec_ch_ua}
                                                onChange={(e) => setFormData(f => ({ ...f, sec_ch_ua: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                                                placeholder='"Google Chrome";v="143", "Chromium";v="143", "Not-A.Brand";v="99"'
                                                disabled={saving}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                                                Sec-Ch-Ua-Platform
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.sec_ch_ua_platform}
                                                onChange={(e) => setFormData(f => ({ ...f, sec_ch_ua_platform: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm font-mono focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                                                placeholder='"Windows"'
                                                disabled={saving}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                                                Sec-Ch-Ua-Mobile
                                            </label>
                                            <select
                                                value={formData.sec_ch_ua_mobile}
                                                onChange={(e) => setFormData(f => ({ ...f, sec_ch_ua_mobile: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                                                disabled={saving}
                                            >
                                                <option value="?0">?0 (Desktop)</option>
                                                <option value="?1">?1 (Mobile)</option>
                                            </select>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Additional Settings */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                                            Accept-Language
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.accept_language}
                                            onChange={(e) => setFormData(f => ({ ...f, accept_language: e.target.value }))}
                                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                                            placeholder="en-US,en;q=0.9"
                                            disabled={saving}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                                            Priority (0-100)
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.priority}
                                            onChange={(e) => setFormData(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                                            min={0}
                                            max={100}
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.enabled}
                                                onChange={(e) => setFormData(f => ({ ...f, enabled: e.target.checked }))}
                                                className="w-4 h-4 rounded accent-[var(--accent-primary)]"
                                                disabled={saving}
                                            />
                                            <span className="text-sm text-[var(--text-secondary)]">Enabled</span>
                                        </label>
                                    </div>
                                </div>

                                {/* Note */}
                                <div>
                                    <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">
                                        Note (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.note}
                                        onChange={(e) => setFormData(f => ({ ...f, note: e.target.value }))}
                                        className="w-full px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-sm focus:border-[var(--accent-primary)] focus:outline-none transition-colors"
                                        placeholder="Optional note about this profile..."
                                        disabled={saving}
                                    />
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]/50 flex justify-end gap-2">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] text-sm font-medium transition-colors"
                                    disabled={saving}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !formData.label.trim() || !formData.user_agent.trim()}
                                    className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {saving && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    {saving ? 'Saving...' : editingProfile ? 'Update Profile' : 'Add Profile'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
