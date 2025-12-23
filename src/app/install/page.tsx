'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Download, Smartphone, Monitor, Share, Plus, MoreVertical,
    CheckCircle, ArrowRight, Zap, Bell, Wifi, WifiOff, 
    Apple, X
} from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

type PlatformId = 'ios' | 'android' | 'desktop' | 'unknown';
type Browser = 'chrome' | 'safari' | 'firefox' | 'edge' | 'samsung' | 'unknown';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPage() {
    const [platform, setPlatform] = useState<PlatformId>('unknown');
    const [browser, setBrowser] = useState<Browser>('unknown');
    const [isInstalled, setIsInstalled] = useState(false);
    const [isInstallable, setIsInstallable] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstructions, setShowInstructions] = useState(false);
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        // Detect platform
        const ua = navigator.userAgent.toLowerCase();
        if (/iphone|ipad|ipod/.test(ua)) {
            setPlatform('ios');
        } else if (/android/.test(ua)) {
            setPlatform('android');
        } else {
            setPlatform('desktop');
        }

        // Detect browser
        if (/chrome/.test(ua) && !/edge|edg/.test(ua)) {
            setBrowser('chrome');
        } else if (/safari/.test(ua) && !/chrome/.test(ua)) {
            setBrowser('safari');
        } else if (/firefox/.test(ua)) {
            setBrowser('firefox');
        } else if (/edge|edg/.test(ua)) {
            setBrowser('edge');
        } else if (/samsungbrowser/.test(ua)) {
            setBrowser('samsung');
        }

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
        }

        // Listen for install prompt
        const handleBeforeInstall = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstall);

        // Listen for app installed
        window.addEventListener('appinstalled', () => {
            setIsInstalled(true);
            setDeferredPrompt(null);
        });

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) {
            setShowInstructions(true);
            return;
        }

        setInstalling(true);
        try {
            await deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setIsInstalled(true);
            }
        } catch (err) {
            console.error('Install failed:', err);
        }
        setInstalling(false);
        setDeferredPrompt(null);
    };

    const t = useTranslations('install');

    const features = [
        { icon: Zap, titleKey: 'features.fast', descKey: 'features.fastDesc' },
        { icon: Bell, titleKey: 'features.notifications', descKey: 'features.notificationsDesc' },
        { icon: Wifi, titleKey: 'features.offline', descKey: 'features.offlineDesc' },
    ];

    return (
        <div className="min-h-screen bg-[var(--bg-primary)] overflow-hidden">
            {/* Animated Background */}
            <div className="fixed inset-0 pointer-events-none">
                <motion.div
                    animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.2, 0.1],
                    }}
                    transition={{ duration: 8, repeat: Infinity }}
                    className="absolute top-1/4 -left-32 w-96 h-96 bg-[var(--accent-primary)] rounded-full blur-[128px]"
                />
                <motion.div
                    animate={{ 
                        scale: [1.2, 1, 1.2],
                        opacity: [0.1, 0.15, 0.1],
                    }}
                    transition={{ duration: 10, repeat: Infinity }}
                    className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500 rounded-full blur-[128px]"
                />
            </div>

            <div className="relative z-10 max-w-2xl mx-auto px-4 py-12">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    {/* Animated Logo */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                        className="relative inline-block mb-6"
                    >
                        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[var(--accent-primary)] to-purple-600 flex items-center justify-center shadow-2xl shadow-[var(--accent-primary)]/30">
                            <Download className="w-12 h-12 text-white" />
                        </div>
                        {/* Pulse ring */}
                        <motion.div
                            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 rounded-3xl border-2 border-[var(--accent-primary)]"
                        />
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-3xl font-bold mb-2"
                    >
                        {t('title')}
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-[var(--text-muted)]"
                    >
                        {t('subtitle')}
                    </motion.p>
                </motion.div>

                {/* Already Installed */}
                {isInstalled && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card p-8 text-center mb-8"
                    >
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', delay: 0.2 }}
                        >
                            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                        </motion.div>
                        <h2 className="text-xl font-bold mb-2">{t('alreadyInstalled')}</h2>
                        <p className="text-[var(--text-muted)] mb-6">
                            {t('readyToUse')}
                        </p>
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--accent-primary)] text-white font-medium hover:opacity-90 transition-opacity"
                        >
                            {t('openApp')} <ArrowRight className="w-4 h-4" />
                        </Link>
                    </motion.div>
                )}

                {/* Install Card */}
                {!isInstalled && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="glass-card p-6 mb-8"
                    >
                        {/* Platform indicator */}
                        <div className="flex items-center justify-center gap-2 mb-6">
                            {platform === 'ios' && <Apple className="w-5 h-5" />}
                            {platform === 'android' && <Smartphone className="w-5 h-5" />}
                            {platform === 'desktop' && <Monitor className="w-5 h-5" />}
                            <span className="text-sm text-[var(--text-muted)]">
                                {platform === 'ios' && t('platform.ios')}
                                {platform === 'android' && t('platform.android')}
                                {platform === 'desktop' && t('platform.desktop')}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-muted)]">
                                {browser}
                            </span>
                        </div>

                        {/* Install Button */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleInstall}
                            disabled={installing}
                            className="w-full py-4 rounded-xl bg-gradient-to-r from-[var(--accent-primary)] to-purple-600 text-white font-semibold text-lg flex items-center justify-center gap-3 shadow-lg shadow-[var(--accent-primary)]/30 disabled:opacity-70"
                        >
                            {installing ? (
                                <>
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                    >
                                        <Download className="w-6 h-6" />
                                    </motion.div>
                                    {t('installing')}
                                </>
                            ) : (
                                <>
                                    <Download className="w-6 h-6" />
                                    {isInstallable ? t('installNow') : t('howToInstall')}
                                </>
                            )}
                        </motion.button>

                        {!isInstallable && platform === 'ios' && (
                            <p className="text-xs text-center text-[var(--text-muted)] mt-3">
                                {t('instructions.ios.note')}
                            </p>
                        )}
                    </motion.div>
                )}

                {/* Features */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="grid grid-cols-3 gap-4 mb-8"
                >
                    {features.map((feature, idx) => (
                        <motion.div
                            key={feature.titleKey}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.7 + idx * 0.1 }}
                            className="glass-card p-4 text-center"
                        >
                            <feature.icon className="w-8 h-8 mx-auto mb-2 text-[var(--accent-primary)]" />
                            <h3 className="font-medium text-sm mb-1">{t(feature.titleKey)}</h3>
                            <p className="text-xs text-[var(--text-muted)]">{t(feature.descKey)}</p>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Phone Mockup */}
                {!isInstalled && (
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className="relative mx-auto w-64"
                    >
                        {/* Phone frame */}
                        <div className="relative bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                            {/* Notch */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-gray-900 rounded-b-2xl z-10" />
                            
                            {/* Screen */}
                            <div className="relative bg-[var(--bg-primary)] rounded-[2.5rem] overflow-hidden aspect-[9/19]">
                                {/* App content preview */}
                                <div className="p-4 pt-10">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]" />
                                        <div className="h-4 w-20 bg-[var(--bg-secondary)] rounded" />
                                    </div>
                                    <div className="h-12 bg-[var(--bg-card)] rounded-xl mb-3" />
                                    <div className="grid grid-cols-5 gap-2 mb-4">
                                        {[...Array(5)].map((_, i) => (
                                            <motion.div
                                                key={i}
                                                animate={{ opacity: [0.5, 1, 0.5] }}
                                                transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
                                                className="aspect-square rounded-lg bg-[var(--bg-secondary)]"
                                            />
                                        ))}
                                    </div>
                                    <div className="space-y-2">
                                        {[...Array(3)].map((_, i) => (
                                            <div key={i} className="h-16 bg-[var(--bg-card)] rounded-xl" />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Floating elements */}
                        <motion.div
                            animate={{ y: [-5, 5, -5] }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="absolute -right-8 top-20 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-lg"
                        >
                            <Bell className="w-5 h-5 text-[var(--accent-primary)]" />
                        </motion.div>
                        <motion.div
                            animate={{ y: [5, -5, 5] }}
                            transition={{ duration: 4, repeat: Infinity }}
                            className="absolute -left-8 top-40 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-lg"
                        >
                            <WifiOff className="w-5 h-5 text-green-400" />
                        </motion.div>
                    </motion.div>
                )}

                {/* Back link */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="text-center mt-8"
                >
                    <Link
                        href="/"
                        className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                    >
                        {t('backToApp')}
                    </Link>
                </motion.div>
            </div>

            {/* Installation Instructions Modal */}
            <AnimatePresence>
                {showInstructions && (
                    <InstallInstructions
                        platform={platform}
                        browser={browser}
                        onClose={() => setShowInstructions(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}


// Installation Instructions Modal Component
function InstallInstructions({ 
    platform, 
    browser, 
    onClose 
}: { 
    platform: PlatformId; 
    browser: Browser; 
    onClose: () => void;
}) {
    const t = useTranslations('install');
    
    const getInstructions = () => {
        if (platform === 'ios') {
            return {
                title: t('instructions.ios.title'),
                icon: Apple,
                steps: [
                    { icon: Share, text: t('instructions.ios.step1') },
                    { icon: Plus, text: t('instructions.ios.step2') },
                    { icon: CheckCircle, text: t('instructions.ios.step3') },
                ],
                note: t('instructions.ios.note'),
            };
        }
        
        if (platform === 'android') {
            return {
                title: t('instructions.android.title'),
                icon: Smartphone,
                steps: [
                    { icon: MoreVertical, text: t('instructions.android.step1') },
                    { icon: Plus, text: t('instructions.android.step2') },
                    { icon: CheckCircle, text: t('instructions.android.step3') },
                ],
                note: t('instructions.android.note'),
            };
        }

        return {
            title: t('instructions.desktop.title'),
            icon: Monitor,
            steps: [
                { icon: Monitor, text: t('instructions.desktop.step1') },
                { icon: Plus, text: t('instructions.desktop.step2') },
                { icon: CheckCircle, text: t('instructions.desktop.step3') },
            ],
            note: t('instructions.desktop.note'),
        };
    };

    const instructions = getInstructions();

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-card w-full max-w-md overflow-hidden"
            >
                {/* Header */}
                <div className="p-6 border-b border-[var(--border-color)]">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center">
                                <instructions.icon className="w-6 h-6 text-[var(--accent-primary)]" />
                            </div>
                            <h2 className="text-xl font-bold">{instructions.title}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Steps */}
                <div className="p-6 space-y-4">
                    {instructions.steps.map((step, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="flex items-center gap-4"
                        >
                            <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white font-bold shrink-0">
                                {idx + 1}
                            </div>
                            <div className="flex items-center gap-3 flex-1">
                                <step.icon className="w-5 h-5 text-[var(--text-muted)] shrink-0" />
                                <span className="text-sm">{step.text}</span>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Note */}
                <div className="px-6 pb-6">
                    <div className="p-3 rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20">
                        <p className="text-xs text-[var(--text-muted)]">
                            💡 {instructions.note}
                        </p>
                    </div>
                </div>

                {/* Visual Guide for iOS */}
                {platform === 'ios' && (
                    <div className="px-6 pb-6">
                        <div className="flex items-center justify-center gap-4 p-4 rounded-xl bg-[var(--bg-secondary)]">
                            <motion.div
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="flex flex-col items-center"
                            >
                                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center mb-1">
                                    <Share className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-[10px] text-[var(--text-muted)]">Share</span>
                            </motion.div>
                            <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                            <motion.div
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                                className="flex flex-col items-center"
                            >
                                <div className="w-10 h-10 rounded-lg bg-gray-600 flex items-center justify-center mb-1">
                                    <Plus className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-[10px] text-[var(--text-muted)]">Add</span>
                            </motion.div>
                            <ArrowRight className="w-4 h-4 text-[var(--text-muted)]" />
                            <motion.div
                                animate={{ y: [0, -5, 0] }}
                                transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                                className="flex flex-col items-center"
                            >
                                <div className="w-10 h-10 rounded-lg bg-green-500 flex items-center justify-center mb-1">
                                    <CheckCircle className="w-5 h-5 text-white" />
                                </div>
                                <span className="text-[10px] text-[var(--text-muted)]">Done!</span>
                            </motion.div>
                        </div>
                    </div>
                )}

                {/* Close Button */}
                <div className="p-6 pt-0">
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)] transition-colors font-medium"
                    >
                        {t('gotIt')}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}
