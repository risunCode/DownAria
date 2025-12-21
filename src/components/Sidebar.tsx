'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Info, Menu, X, Home, Settings, Palette, Sun, Moon, Sparkles, ChevronDown, Wrench, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    FacebookIcon,
    InstagramIcon,
    XTwitterIcon,
    TiktokIcon,
    WeiboIcon,
    YoutubeIcon,
} from '@/components/ui/Icons';
import { ThemeType, saveTheme, initTheme, getSettings } from '@/lib/storage';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useStatus } from '@/hooks/useStatus';

const THEMES: { id: ThemeType; label: string; icon: typeof Sun }[] = [
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'solarized', label: 'Solarized', icon: Sparkles },
];

// Memoized outside component - static config
const PLATFORMS_CONFIG = [
    { id: 'facebook', icon: FacebookIcon, label: 'Facebook', color: 'text-blue-500' },
    { id: 'instagram', icon: InstagramIcon, label: 'Instagram', color: 'text-pink-500' },
    { id: 'twitter', icon: XTwitterIcon, label: 'Twitter/X', color: 'text-[var(--text-primary)]' },
    { id: 'tiktok', icon: TiktokIcon, label: 'TikTok', color: 'text-cyan-400' },
    { id: 'youtube', icon: YoutubeIcon, label: 'YouTube', color: 'text-red-500' },
    { id: 'weibo', icon: WeiboIcon, label: 'Weibo', color: 'text-orange-500' },
] as const;

interface SidebarProps {
    children: React.ReactNode;
}

export function SidebarLayout({ children }: SidebarProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [themeOpen, setThemeOpen] = useState(false);
    const [currentTheme, setCurrentTheme] = useState<ThemeType>('dark');
    const [hideDocs, setHideDocs] = useState<boolean | null>(null); // null = loading
    const themeRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const router = useRouter();
    
    // Use SWR for platform status (auto-cached, deduplicated)
    const { platforms: platformStatus } = useStatus();

    useEffect(() => {
        const theme = initTheme();
        setCurrentTheme(theme);
        
        // Load hide docs setting
        const settings = getSettings();
        setHideDocs(settings.hideDocs || false);
    }, []);

    // Close sidebar on route change (for back/forward navigation)
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
                setThemeOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleThemeChange = (theme: ThemeType) => {
        saveTheme(theme);
        setCurrentTheme(theme);
        setThemeOpen(false);
    };

    // Handle navigation with smooth sidebar close animation
    const handleNavigation = useCallback((href: string) => {
        // If already on this page, just close sidebar
        if (pathname === href) {
            setSidebarOpen(false);
            return;
        }
        
        // Close sidebar first, then navigate after animation
        setSidebarOpen(false);
        
        // Wait for exit animation to complete before navigating
        setTimeout(() => {
            router.push(href);
        }, 200); // Match the spring animation duration
    }, [pathname, router]);

    const CurrentThemeIcon = THEMES.find(t => t.id === currentTheme)?.icon || Palette;

    // Memoize navLinks - only changes when hideDocs changes
    const navLinks = useMemo(() => [
        { href: '/', labelKey: 'home', icon: Home },
        { href: '/history', labelKey: 'history', icon: History },
        { href: '/advanced', labelKey: 'advanced', icon: Wrench },
        // Only show docs link after settings loaded AND hideDocs is false
        ...(hideDocs === false ? [{ href: '/docs', labelKey: 'docs', icon: BookOpen }] : []),
        { href: '/settings', labelKey: 'settings', icon: Settings },
        { href: '/about', labelKey: 'about', icon: Info },
    ], [hideDocs]);

    // Memoize platforms with status - only changes when platformStatus changes
    const platforms = useMemo(() => 
        PLATFORMS_CONFIG.map(p => {
            const apiStatus = platformStatus.find(s => s.id === p.id);
            return {
                ...p,
                status: (apiStatus?.status || 'active') as 'active' | 'maintenance' | 'offline'
            };
        }), [platformStatus]);

    // Memoize isActive function
    const isActive = useCallback((href: string) => pathname === href, [pathname]);

    return (
        <div className="min-h-screen flex bg-[var(--bg-primary)]">
            {/* Mobile Header - Solid background (no blur for mobile performance) */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
                <div className="flex items-center justify-between px-3 py-3">
                    {/* Left: Burger + Logo */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-secondary)]"
                        >
                            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                        <Link href="/" className="flex items-center gap-2">
                            <img src="/icon.png" alt="XTFetch" className="w-8 h-8 rounded-lg" />
                            <div>
                                <h1 className="text-sm font-bold gradient-text">XTFetch</h1>
                                <p className="text-[9px] text-[var(--text-muted)] -mt-0.5">Social Media Downloader</p>
                            </div>
                        </Link>
                    </div>

                    {/* Right: Language, Theme, Home & Settings */}
                    <div className="flex items-center gap-1">
                        {/* Language Switcher */}
                        <LanguageSwitcher showLabel={false} />
                        
                        {/* Theme Dropdown */}
                        <div ref={themeRef} className="relative">
                            <button
                                onClick={() => setThemeOpen(!themeOpen)}
                                className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors flex items-center gap-1"
                            >
                                <CurrentThemeIcon className="w-5 h-5" />
                                <ChevronDown className={`w-3 h-3 transition-transform ${themeOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <AnimatePresence>
                                {themeOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute right-0 top-full mt-2 w-36 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl z-50"
                                    >
                                        {THEMES.map((theme) => (
                                            <button
                                                key={theme.id}
                                                onClick={() => handleThemeChange(theme.id)}
                                                className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${currentTheme === theme.id
                                                        ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                                                    }`}
                                            >
                                                <theme.icon className="w-4 h-4" />
                                                <span>{theme.label}</span>
                                                {currentTheme === theme.id && (
                                                    <span className="ml-auto text-xs">✓</span>
                                                )}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        <Link
                            href="/settings"
                            className={`p-2 rounded-lg transition-colors ${pathname === '/settings'
                                    ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                                }`}
                        >
                            <Settings className="w-5 h-5" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {sidebarOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden fixed inset-0 z-40 bg-black/60"
                        />
                        {/* Menu */}
                        <motion.aside
                            initial={{ x: -280 }}
                            animate={{ x: 0 }}
                            exit={{ x: -280 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[280px] bg-[var(--bg-secondary)] border-r border-[var(--border-color)] overflow-y-auto"
                        >
                            <SidebarContent
                                navLinks={navLinks}
                                platforms={platforms}
                                isActive={isActive}
                                onNavigate={handleNavigation}
                            />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex lg:flex-col lg:w-[280px] lg:fixed lg:inset-y-0 lg:left-0 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] overflow-y-auto">
                <SidebarContent
                    navLinks={navLinks}
                    platforms={platforms}
                    isActive={isActive}
                />
            </aside>

            {/* Main Content */}
            <main className="flex-1 lg:ml-[280px]">
                {/* Mobile spacer */}
                <div className="lg:hidden h-[60px]" />
                <div className="min-h-screen">
                    {children}
                </div>
            </main>
        </div>
    );
}

interface SidebarContentProps {
    navLinks: { href: string; labelKey: string; icon: React.FC<{ className?: string }> }[];
    platforms: { id: string; icon: React.FC<{ className?: string }>; label: string; color: string; status: 'active' | 'maintenance' | 'offline' }[];
    isActive: (href: string) => boolean;
    onNavigate?: (href: string) => void;
}

function SidebarContent({ navLinks, platforms, isActive, onNavigate }: SidebarContentProps) {
    const t = useTranslations('nav');
    const tPlatforms = useTranslations('platforms');
    const tFooter = useTranslations('footer');

    // Handle link click - use custom navigation if provided (mobile), otherwise default Link behavior (desktop)
    const handleLinkClick = (e: React.MouseEvent, href: string) => {
        if (onNavigate) {
            e.preventDefault();
            onNavigate(href);
        }
    };
    
    return (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-5 border-b border-[var(--border-color)]">
                <Link 
                    href="/" 
                    onClick={(e) => handleLinkClick(e, '/')} 
                    className="flex items-center gap-3 group"
                >
                    <img
                        src="/icon.png"
                        alt="XTFetch"
                        className="w-11 h-11 rounded-xl shadow-lg shadow-[var(--accent-primary)]/20"
                    />
                    <div>
                        <h1 className="text-lg font-bold gradient-text">XTFetch</h1>
                        <p className="text-xs text-[var(--text-muted)] -mt-0.5">Social Media Downloader</p>
                    </div>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-3 mb-3">
                    {t('navigation')}
                </p>
                {navLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        onClick={(e) => handleLinkClick(e, link.href)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive(link.href)
                            ? 'bg-gradient-to-r from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                            }`}
                    >
                        <link.icon className="w-5 h-5" />
                        <span className="font-medium">{t(link.labelKey)}</span>
                    </Link>
                ))}

                {/* Platforms Section */}
                <div className="pt-6">
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-3 mb-3">
                        {t('supportedPlatforms')}
                    </p>
                    <div className="space-y-1">
                        {platforms.map((platform, index) => (
                                <div
                                    key={index}
                                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${platform.status === 'offline' ? 'opacity-50' : ''
                                        }`}
                                >
                                    <platform.icon className={`w-5 h-5 ${platform.color}`} />
                                    <span className="text-sm text-[var(--text-secondary)] flex-1">{tPlatforms(platform.id)}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${platform.status === 'active'
                                            ? 'bg-green-500/20 text-green-400'
                                            : platform.status === 'maintenance'
                                                ? 'bg-yellow-500/20 text-yellow-400'
                                                : 'bg-red-500/20 text-red-400'
                                        }`}>
                                        {tPlatforms(`status.${platform.status}`)}
                                    </span>
                                </div>
                            ))}
                    </div>
                </div>
            </nav>

            {/* Footer with hidden admin link */}
            <div className="p-4 border-t border-[var(--border-color)]">
                <div className="px-4">
                    <p className="text-xs text-[var(--text-muted)]">
                        {tFooter('copyright').split('risunCode')[0]}
                        <Link
                            href="/auth"
                            onClick={(e) => handleLinkClick(e, '/auth')}
                            className="hover:text-[var(--accent-primary)] transition-colors cursor-pointer"
                            title="🔐"
                        >
                            risunCode
                        </Link>
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                        {tFooter('personalUse')}
                    </p>
                </div>
            </div>
        </div>
    );
}
