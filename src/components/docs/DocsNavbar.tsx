'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Code, BookOpen, HelpCircle, FileText, Rocket, ChevronRight } from 'lucide-react';

const navItems = [
    { href: '/docs', label: 'Getting Started', icon: Rocket },
    { href: '/docs/api', label: 'API', icon: Code, children: [
        { href: '/docs/api', label: 'Overview' },
        { href: '/docs/api/endpoints', label: 'Endpoints' },
        { href: '/docs/api/errors', label: 'Errors' },
    ]},
    { href: '/docs/guides/cookies', label: 'Guides', icon: BookOpen, children: [
        { href: '/docs/guides/cookies', label: 'Cookies' },
        { href: '/docs/guides/api-keys', label: 'API Keys' },
        { href: '/docs/guides/troubleshooting', label: 'Troubleshooting' },
    ]},
    { href: '/docs/faq', label: 'FAQ', icon: HelpCircle },
    { href: '/docs/changelog', label: 'Changelog', icon: FileText },
];

export function DocsNavbar() {
    const pathname = usePathname();

    // Get current section for breadcrumb
    const getBreadcrumb = () => {
        if (pathname === '/docs') return null;
        
        for (const item of navItems) {
            if (item.children) {
                const child = item.children.find(c => c.href === pathname);
                if (child) {
                    return { parent: item.label, current: child.label };
                }
            }
            if (item.href === pathname) {
                return { parent: null, current: item.label };
            }
        }
        return null;
    };

    const breadcrumb = getBreadcrumb();

    return (
        <div className="mb-6">
            {/* Breadcrumb */}
            {breadcrumb && (
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-4">
                    <Link href="/docs" className="hover:text-[var(--accent-primary)] transition-colors">
                        Docs
                    </Link>
                    {breadcrumb.parent && (
                        <>
                            <ChevronRight className="w-3 h-3" />
                            <span>{breadcrumb.parent}</span>
                        </>
                    )}
                    <ChevronRight className="w-3 h-3" />
                    <span className="text-[var(--text-primary)]">{breadcrumb.current}</span>
                </div>
            )}

            {/* Navigation Pills */}
            <div className="flex flex-wrap gap-2">
                {navItems.map((item) => {
                    const isActive = pathname === item.href || 
                        (item.children && item.children.some(c => c.href === pathname));
                    
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                isActive
                                    ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                            }`}
                        >
                            <item.icon className="w-3.5 h-3.5" />
                            {item.label}
                            {isActive && (
                                <motion.div
                                    layoutId="docs-nav-indicator"
                                    className="absolute inset-0 rounded-lg border border-[var(--accent-primary)]/30"
                                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                                />
                            )}
                        </Link>
                    );
                })}
            </div>

            {/* Sub-navigation for sections with children */}
            {navItems.map((item) => {
                if (!item.children) return null;
                const isParentActive = item.children.some(c => c.href === pathname);
                if (!isParentActive) return null;

                return (
                    <motion.div
                        key={item.href}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex gap-1 mt-3 pl-1"
                    >
                        {item.children.map((child) => (
                            <Link
                                key={child.href}
                                href={child.href}
                                className={`px-3 py-1 rounded-md text-xs transition-colors ${
                                    pathname === child.href
                                        ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-color)]'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                                }`}
                            >
                                {child.label}
                            </Link>
                        ))}
                    </motion.div>
                );
            })}
        </div>
    );
}
