'use client';

import { useState, useEffect, useLayoutEffect, createContext, useContext, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    LayoutDashboard, Key, Settings, LogOut, 
    ChevronLeft, Menu, Shield, Server, Users,
    ChevronDown, X, MessageSquare, Code
} from 'lucide-react';
import { signOut, getSession, getUserProfile, supabase } from '@/lib/supabase';
import { installAdminFetchGlobal } from '@/lib/utils/admin-fetch';

// ═══════════════════════════════════════════════════════════════
// TYPES & CONTEXT
// ═══════════════════════════════════════════════════════════════

export type UserRole = 'user' | 'admin';

interface UserProfile {
    id: string;
    email: string;
    username?: string;
    role: UserRole;
    display_name?: string;
    avatar_url?: string;
}

interface AdminContextType {
    user: UserProfile | null;
    isAdmin: boolean;
    canAccess: (requiredRole: UserRole) => boolean;
    adminFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AdminContext = createContext<AdminContextType>({
    user: null,
    isAdmin: false,
    canAccess: () => false,
    adminFetch: fetch,
});

export const useAdmin = () => useContext(AdminContext);

// ═══════════════════════════════════════════════════════════════
// NAVIGATION CONFIG - Redesigned 6-item structure
// ═══════════════════════════════════════════════════════════════

const NAV_ITEMS = {
    user: [
        { href: '/admin', label: 'Overview', icon: LayoutDashboard },
        { href: '/admin/access', label: 'Access', icon: Key },
        { href: '/admin/playground', label: 'Playground', icon: Code },
    ],
    admin: [
        { href: '/admin/services', label: 'Services', icon: Server },
        { href: '/admin/users', label: 'Users', icon: Users },
        { href: '/admin/communications', label: 'Communications', icon: MessageSquare },
        { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
};

const ROLE_HIERARCHY: Record<UserRole, number> = {
    user: 1,
    admin: 2,
};

// ═══════════════════════════════════════════════════════════════
// LAYOUT COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [isLoading, setIsLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [user, setUser] = useState<UserProfile | null>(null);

    // Admin fetch - uses global interceptor (installAdminFetchGlobal) for Bearer token
    const adminFetch = useCallback(async (url: string, options: RequestInit = {}) => {
        // Token injection handled by installAdminFetchGlobal()
        return fetch(url, options);
    }, []);

    // Install global fetch interceptor for admin APIs (use layoutEffect for earlier execution)
    useLayoutEffect(() => {
        installAdminFetchGlobal();
    }, []);

    // Check Supabase auth session
    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Check Supabase session
                const session = await getSession();
                
                if (!session?.user) {
                    // No session - redirect to login
                    router.push('/auth');
                    return;
                }
                
                // Get user profile from database
                const profile = await getUserProfile(session.user.id);
                
                if (profile) {
                    setUser({
                        id: profile.id,
                        email: profile.email || session.user.email || '',
                        username: profile.username,
                        role: profile.role || 'user',
                        display_name: profile.display_name || profile.username,
                        avatar_url: profile.avatar_url,
                    });
                } else {
                    // No profile yet, use basic info from session
                    setUser({
                        id: session.user.id,
                        email: session.user.email || '',
                        role: 'user',
                        display_name: session.user.email?.split('@')[0],
                    });
                }
                
                setIsLoading(false);
            } catch (error) {
                console.error('Auth check failed:', error);
                router.push('/auth');
            }
        };
        
        checkAuth();
        
        // Listen for auth state changes
        if (supabase) {
            const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_OUT' || !session) {
                    router.push('/');
                }
            });
            
            return () => subscription.unsubscribe();
        }
    }, [router]);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileMenuOpen(false);
        setUserMenuOpen(false);
    }, [pathname]);

    const handleLogout = async () => {
        await signOut();
        router.push('/');
    };

    const isAdmin = user?.role === 'admin';
    
    const canAccess = (requiredRole: UserRole): boolean => {
        if (!user) return false;
        return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[requiredRole];
    };

    // Get visible nav items based on role
    const getNavItems = () => {
        const items = [...NAV_ITEMS.user];
        if (isAdmin) items.push(...NAV_ITEMS.admin);
        return items;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
                <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    const navItems = getNavItems();
    const displayName = user.display_name || user.username || user.email.split('@')[0];
    const initials = displayName.slice(0, 2).toUpperCase();

    return (
        <AdminContext.Provider value={{ user, isAdmin, canAccess, adminFetch }}>
            <div className="min-h-screen bg-[var(--bg-primary)]">
                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* APPBAR */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <header className="fixed top-0 left-0 right-0 h-14 bg-[var(--bg-card)] border-b border-[var(--border-color)] z-50 flex items-center px-4">
                    {/* Left: Menu toggle + Logo */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (window.innerWidth < 768) {
                                    setMobileMenuOpen(!mobileMenuOpen);
                                } else {
                                    setSidebarOpen(!sidebarOpen);
                                }
                            }}
                            className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <Link href="/admin/dashboard" className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-[var(--accent-primary)]" />
                            <span className="font-bold text-sm hidden sm:block">XTFetch Admin</span>
                        </Link>
                    </div>

                    {/* Right: User menu */}
                    <div className="ml-auto relative">
                        <button
                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)] flex items-center justify-center text-white text-xs font-bold">
                                {initials}
                            </div>
                            <div className="hidden sm:block text-left">
                                <p className="text-sm font-medium">{displayName}</p>
                                <p className="text-[10px] text-[var(--text-muted)] capitalize">{user.role.replace('_', ' ')}</p>
                            </div>
                            <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                        </button>

                        {/* User Dropdown */}
                        <AnimatePresence>
                            {userMenuOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-lg overflow-hidden"
                                >
                                    <div className="p-3 border-b border-[var(--border-color)]">
                                        <p className="text-sm font-medium truncate">{user.email}</p>
                                        <p className="text-xs text-[var(--accent-primary)] capitalize">{user.role.replace('_', ' ')}</p>
                                    </div>
                                    <div className="p-1">
                                        <Link
                                            href="/"
                                            className="flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-[var(--bg-secondary)] transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            Back to App
                                        </Link>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-red-500/10 text-red-400 transition-colors"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            Logout
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </header>

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* SIDEBAR - Desktop */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <motion.aside
                    initial={false}
                    animate={{ width: sidebarOpen ? 220 : 64 }}
                    className="fixed left-0 top-14 bottom-0 bg-[var(--bg-card)] border-r border-[var(--border-color)] z-40 hidden md:flex flex-col"
                >
                    <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                        {/* User Section */}
                        {sidebarOpen && (
                            <p className="px-3 py-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                Menu
                            </p>
                        )}
                        {NAV_ITEMS.user.map((item) => {
                            const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    title={item.label}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                                        isActive
                                            ? 'bg-[var(--accent-primary)] text-white'
                                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                                    }`}
                                >
                                    <item.icon className="w-5 h-5 shrink-0" />
                                    {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                                </Link>
                            );
                        })}

                        {/* Admin Section */}
                        {isAdmin && (
                            <>
                                {sidebarOpen && (
                                    <p className="px-3 py-2 mt-4 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                                        Admin
                                    </p>
                                )}
                                {NAV_ITEMS.admin.map((item) => {
                                    const isActive = pathname.startsWith(item.href);
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            title={item.label}
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                                                isActive
                                                    ? 'bg-[var(--accent-primary)] text-white'
                                                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
                                            }`}
                                        >
                                            <item.icon className="w-5 h-5 shrink-0" />
                                            {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
                                        </Link>
                                    );
                                })}
                            </>
                        )}


                    </nav>
                </motion.aside>

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* SIDEBAR - Mobile */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <AnimatePresence>
                    {mobileMenuOpen && (
                        <>
                            {/* Backdrop */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setMobileMenuOpen(false)}
                                className="fixed inset-0 bg-black/50 z-40 md:hidden"
                            />
                            {/* Menu */}
                            <motion.aside
                                initial={{ x: -280 }}
                                animate={{ x: 0 }}
                                exit={{ x: -280 }}
                                className="fixed left-0 top-0 bottom-0 w-[280px] bg-[var(--bg-card)] z-50 md:hidden flex flex-col"
                            >
                                <div className="h-14 flex items-center justify-between px-4 border-b border-[var(--border-color)]">
                                    <div className="flex items-center gap-2">
                                        <Shield className="w-5 h-5 text-[var(--accent-primary)]" />
                                        <span className="font-bold">Admin</span>
                                    </div>
                                    <button
                                        onClick={() => setMobileMenuOpen(false)}
                                        className="p-2 rounded-lg hover:bg-[var(--bg-secondary)]"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                                    {navItems.map((item) => {
                                        const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                                                    isActive
                                                        ? 'bg-[var(--accent-primary)] text-white'
                                                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                                                }`}
                                            >
                                                <item.icon className="w-5 h-5" />
                                                <span className="font-medium">{item.label}</span>
                                            </Link>
                                        );
                                    })}
                                </nav>
                            </motion.aside>
                        </>
                    )}
                </AnimatePresence>

                {/* ═══════════════════════════════════════════════════════════════ */}
                {/* MAIN CONTENT */}
                {/* ═══════════════════════════════════════════════════════════════ */}
                <main 
                    className={`pt-14 transition-all duration-300 ${sidebarOpen ? 'md:ml-[220px]' : 'md:ml-16'}`}
                >
                    {children}
                </main>
            </div>
        </AdminContext.Provider>
    );
}
