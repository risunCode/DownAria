'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, History, Info, Menu, X, Github, Heart, Palette, Sun, Moon, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { FacebookIcon, InstagramIcon, XTwitterIcon, TiktokIcon } from '@/components/ui/Icons';
import { ThemeType, saveTheme, initTheme } from '@/lib/storage';

const THEMES: { id: ThemeType; label: string; icon: typeof Sun }[] = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'solarized', label: 'Solarized', icon: Sparkles },
    { id: 'dark', label: 'Dark', icon: Moon },
];

export function Header() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [themeOpen, setThemeOpen] = useState(false);
    const [currentTheme, setCurrentTheme] = useState<ThemeType>('light');
    const themeRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const theme = initTheme();
        setCurrentTheme(theme);
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
        { href: '/', label: 'Home', icon: Download },
        { href: '/about', label: 'About', icon: Info },
        { href: '/history', label: 'History', icon: History },
    ];

    return (
        <>
            <motion.header
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed top-0 left-0 right-0 z-40 glass border-b border-[var(--border-color)]"
            >
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        {/* Mobile Menu Button - LEFT on mobile */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden p-2 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-secondary)] order-first"
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>

                        {/* Logo - CENTER on mobile, LEFT on desktop */}
                        <Link href="/" className="flex items-center gap-3 group md:order-first">
                            <motion.div
                                whileHover={{ rotate: 10, scale: 1.05 }}
                                className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center shadow-lg shadow-[var(--accent-primary)]/20"
                            >
                                <Download className="w-5 h-5 text-white" />
                            </motion.div>
                            <div>
                                <h1 className="text-xl font-bold gradient-text">XT</h1>
                                <p className="text-xs text-[var(--text-muted)] -mt-0.5">Social Downloader</p>
                            </div>
                        </Link>

                        {/* Spacer for mobile */}
                        <div className="md:hidden w-10" />

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-1">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all"
                                >
                                    <link.icon className="w-4 h-4" />
                                    <span>{link.label}</span>
                                </Link>
                            ))}
                            <div className="w-px h-6 bg-[var(--border-color)] mx-2" />
                            <a
                                href="https://github.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all"
                            >
                                <Github className="w-4 h-4" />
                                <span>GitHub</span>
                            </a>
                            <div className="w-px h-6 bg-[var(--border-color)] mx-2" />
                            {/* Theme Switcher */}
                            <div ref={themeRef} className="relative">
                                <button
                                    onClick={() => setThemeOpen(!themeOpen)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all"
                                >
                                    <CurrentThemeIcon className="w-4 h-4" />
                                </button>
                                <AnimatePresence>
                                    {themeOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute right-0 top-full mt-2 w-40 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl z-50"
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
                        </nav>
                    </div>
                </div>

                {/* Mobile Menu */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden border-t border-[var(--border-color)] overflow-hidden"
                        >
                            <div className="px-4 py-4 space-y-2 bg-[var(--bg-secondary)]">
                                {navLinks.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all"
                                    >
                                        <link.icon className="w-5 h-5" />
                                        <span className="font-medium">{link.label}</span>
                                    </Link>
                                ))}
                                <div className="border-t border-[var(--border-color)] pt-2 mt-2">
                                    <a
                                        href="https://github.com"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-all"
                                    >
                                        <Github className="w-5 h-5" />
                                        <span className="font-medium">GitHub</span>
                                    </a>
                                </div>
                                {/* Mobile Theme Switcher */}
                                <div className="border-t border-[var(--border-color)] pt-2 mt-2">
                                    <p className="px-4 py-2 text-xs text-[var(--text-muted)] font-medium">Theme</p>
                                    <div className="grid grid-cols-3 gap-2 px-4">
                                        {THEMES.map((theme) => (
                                            <button
                                                key={theme.id}
                                                onClick={() => handleThemeChange(theme.id)}
                                                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                                                    currentTheme === theme.id
                                                        ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]'
                                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                                                }`}
                                            >
                                                <theme.icon className="w-5 h-5" />
                                                <span className="text-[10px]">{theme.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.header>

            {/* Spacer for fixed header */}
            <div className="h-[72px]" />
        </>
    );
}

// Footer component
export function Footer() {
    return (
        <footer className="py-12 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
            <div className="max-w-6xl mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Logo & Description */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center">
                                <Download className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold gradient-text">XT</h3>
                                <p className="text-xs text-[var(--text-muted)]">Social Downloader</p>
                            </div>
                        </div>
                        <p className="text-sm text-[var(--text-muted)]">
                            Free and fast social media video downloader. Download from Facebook, Instagram, TikTok, and X.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h4 className="font-semibold text-[var(--text-primary)] mb-4">Quick Links</h4>
                        <ul className="space-y-2">
                            <li>
                                <Link href="/" className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors">
                                    Home
                                </Link>
                            </li>
                            <li>
                                <Link href="/about" className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors">
                                    About
                                </Link>
                            </li>
                            <li>
                                <Link href="/history" className="text-sm text-[var(--text-muted)] hover:text-[var(--accent-primary)] transition-colors">
                                    Download History
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Supported Platforms */}
                    <div>
                        <h4 className="font-semibold text-[var(--text-primary)] mb-4">Supported Platforms</h4>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 text-sm flex items-center gap-1.5"><FacebookIcon className="w-4 h-4" /> Facebook</span>
                            <span className="px-3 py-1.5 rounded-full bg-pink-500/10 text-pink-400 text-sm flex items-center gap-1.5"><InstagramIcon className="w-4 h-4" /> Instagram</span>
                            <span className="px-3 py-1.5 rounded-full bg-gray-500/10 text-gray-300 text-sm flex items-center gap-1.5"><XTwitterIcon className="w-4 h-4" /> Twitter</span>
                            <span className="px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 text-sm flex items-center gap-1.5"><TiktokIcon className="w-4 h-4" /> TikTok</span>
                        </div>
                    </div>
                </div>

                <div className="border-t border-[var(--border-color)] mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-[var(--text-muted)]">
                        © 2024 XT-Social-Downloader. For personal use only.
                    </p>
                    <p className="text-sm text-[var(--text-muted)] flex items-center gap-1">
                        Made with <Heart className="w-4 h-4 text-red-500 fill-red-500" /> for the community
                    </p>
                </div>
            </div>
        </footer>
    );
}
