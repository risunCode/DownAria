'use client';

import { useAdmin, type UserRole } from '@/app/admin/layout';
import { Shield, Lock } from 'lucide-react';
import Link from 'next/link';

interface AdminGuardProps {
    children: React.ReactNode;
    requiredRole?: UserRole;
    fallback?: React.ReactNode;
}

export default function AdminGuard({ 
    children, 
    requiredRole = 'admin',
    fallback 
}: AdminGuardProps) {
    const { canAccess, user } = useAdmin();

    if (!canAccess(requiredRole)) {
        if (fallback) return <>{fallback}</>;
        
        return (
            <div className="min-h-[60vh] flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                        <Lock className="w-8 h-8 text-red-400" />
                    </div>
                    <h2 className="text-xl font-bold mb-2">Access Denied</h2>
                    <p className="text-[var(--text-muted)] mb-4">
                        You need <span className="text-[var(--accent-primary)] font-medium">{requiredRole.replace('_', ' ')}</span> role to access this page.
                    </p>
                    <p className="text-sm text-[var(--text-muted)] mb-6">
                        Current role: <span className="capitalize">{user?.role.replace('_', ' ') || 'unknown'}</span>
                    </p>
                    <Link
                        href="/admin/dashboard"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--accent-primary)] text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                        <Shield className="w-4 h-4" />
                        Go to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
