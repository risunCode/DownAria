'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, Info, Menu, X, Home, Settings, Palette, Sun, Moon, Sparkles, ChevronDown, Wrench } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
    YoutubeIcon, 
    FacebookIcon, 
    InstagramIcon, 
    XTwitterIcon, 
    TiktokIcon, 
    WeiboIcon, 
    DouyinIcon 
} from '@/components/ui/Icons';
import { ThemeType, saveTheme, initTheme } from '@/lib/utils/storage';

const THEMES: { id: ThemeType; label: string; icon: typeof Sun }[] = [
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'solarized', label: 'Solarized', icon: Sparkles },
];

interface PlatformStatus {
    id: string;
    name: string;
    enabled: boolean;
    status: 'active' | 'maintenance' | 'offline';
}

interface SidebarProps {
    children: React.ReactNode;
}

export function SidebarLayout({ children }: SidebarProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [themeOpen, setThemeOpen] = useState(false);
    const [currentTheme, setCurrentTheme] = useState<ThemeType>('dark');
    const [platformStatus, setPlatformStatus] = useState<PlatformStatus[]>([]);
    const themeRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();

    useEffect(() => {
        const theme = initTheme();
        setCurrentTheme(theme);
        
        // Fetch platform status from API
        fetch('/api/status')
            .then(res => res.json())
            .then(data => {
                if (data.platforms) setPlatformStatus(data.platforms);
            })
            .catch(() => {}); // Silently fail
    }, []);

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

    const CurrentThemeIcon = THEMES.find(t => t.id === currentTheme)?.icon || Palette;

    const navLinks = [
        { href: '/', label: 'Home', icon: Home },
        { href: '/history', label: 'History', icon: History },
        { href: '/advanced', label: 'Advanced', icon: Wrench },
        { href: '/settings', label: 'Settings', icon: Settings },
        { href: '/about', label: 'About', icon: Info },
    ];

    // Default platforms with dynamic status from API
    const platformsConfig = [
        { id: 'youtube', icon: YoutubeIcon, label: 'YouTube', color: 'text-red-500' },
        { id: 'facebook', icon: FacebookIcon, label: 'Facebook', color: 'text-blue-500' },
        { id: 'instagram', icon: InstagramIcon, label: 'Instagram', color: 'text-pink-500' },
        { id: 'twitter', icon: XTwitterIcon, label: 'Twitter/X', color: 'text-[var(--text-primary)]' },
        { id: 'tiktok', icon: TiktokIcon, label: 'TikTok', color: 'text-cyan-400' },
        { id: 'weibo', icon: WeiboIcon, label: 'Weibo', color: 'text-orange-500' },
        { id: 'douyin', icon: DouyinIcon, label: 'Douyin', color: 'text-[var(--text-muted)]' },
    ];
    
    // Merge with API status
    const platforms = platformsConfig.map(p => {
        const apiStatus = platformStatus.find(s => s.id === p.id);
        return {
            ...p,
            status: (apiStatus?.status || (p.id === 'douyin' ? 'offline' : 'active')) as 'active' | 'maintenance' | 'offline'
        };
    });

    const isActive = (href: string) => pathname === href;

    return (
        <div className="min-h-screen flex bg-[var(--bg-primary)]">
            {/* Mobile Header - Frosted Glass */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-[var(--bg-primary)]/80 backdrop-blur-md border-b border-[var(--border-color)]/50">
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
                    
                    {/* Right: Theme, Home & Settings */}
                    <div className="flex items-center gap-1">
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
                                                className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
                                                    currentTheme === theme.id
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
                            href="/"
                            className={`p-2 rounded-lg transition-colors ${
                                pathname === '/' 
                                    ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10' 
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                            }`}
                        >
                            <Home className="w-5 h-5" />
                        </Link>
                        <Link
                            href="/settings"
                            className={`p-2 rounded-lg transition-colors ${
                                pathname === '/settings' 
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
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                        />
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
                                onLinkClick={() => setSidebarOpen(false)}
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
    navLinks: { href: string; label: string; icon: any }[];
    platforms: { id: string; icon: any; label: string; color: string; status: 'active' | 'maintenance' | 'offline' }[];
    isActive: (href: string) => boolean;
    onLinkClick?: () => void;
}

function SidebarContent({ navLinks, platforms, isActive, onLinkClick }: SidebarContentProps) {
    return (
        <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="p-5 border-b border-[var(--border-color)]">
                <Link href="/" onClick={onLinkClick} className="flex items-center gap-3 group">
                    <motion.img
                        src="/icon.png"
                        alt="XTFetch"
                        whileHover={{ rotate: 10, scale: 1.05 }}
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
                    Navigation
                </p>
                {navLinks.map((link) => (
                    <Link
                        key={link.href}
                        href={link.href}
                        onClick={onLinkClick}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive(link.href)
                            ? 'bg-gradient-to-r from-[var(--accent-primary)]/20 to-[var(--accent-secondary)]/10 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                            }`}
                    >
                        <link.icon className="w-5 h-5" />
                        <span className="font-medium">{link.label}</span>
                    </Link>
                ))}

                {/* Platforms Section */}
                <div className="pt-6">
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-3 mb-3">
                        Supported Platforms
                    </p>
                    <div className="space-y-1">
                        {/* Hide YouTube and Douyin, show only main 5 platforms */}
                        {platforms
                            .filter(p => p.id !== 'youtube' && p.id !== 'douyin')
                            .map((platform, index) => (
                            <div
                                key={index}
                                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${
                                    platform.status === 'offline' ? 'opacity-50' : ''
                                }`}
                            >
                                <platform.icon className={`w-5 h-5 ${platform.color}`} />
                                <span className="text-sm text-[var(--text-secondary)] flex-1">{platform.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                    platform.status === 'active' 
                                        ? 'bg-green-500/20 text-green-400' 
                                        : platform.status === 'maintenance'
                                        ? 'bg-yellow-500/20 text-yellow-400'
                                        : 'bg-red-500/20 text-red-400'
                                }`}>
                                    {platform.status === 'active' ? 'Active' : platform.status === 'maintenance' ? 'Maintenance' : 'Offline'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-[var(--border-color)]">
                <div className="px-4">
                    <p className="text-xs text-[var(--text-muted)]">
                        © 2025 risunCode
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">
                        For personal use only
                    </p>
                </div>
            </div>
        </div>
    );
}
