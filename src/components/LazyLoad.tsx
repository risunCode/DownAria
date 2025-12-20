'use client';

import { Suspense, lazy, ComponentType, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface LazyLoadProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

// Default loading spinner
function DefaultFallback() {
    return (
        <div className="flex items-center justify-center min-h-[200px]">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-primary)]" />
        </div>
    );
}

// Suspense wrapper with default fallback
export function LazyLoad({ children, fallback }: LazyLoadProps) {
    return (
        <Suspense fallback={fallback || <DefaultFallback />}>
            {children}
        </Suspense>
    );
}

// HOC for lazy loading components with proper typing
export function lazyLoad<P extends object>(
    importFn: () => Promise<{ default: ComponentType<P> }>,
    fallback?: ReactNode
): ComponentType<P> {
    const LazyComponent = lazy(importFn);
    
    return function LazyWrapper(props: P) {
        return (
            <Suspense fallback={fallback || <DefaultFallback />}>
                <LazyComponent {...props} />
            </Suspense>
        );
    };
}

// Page loading skeleton
export function PageLoadingSkeleton() {
    return (
        <div className="p-6 lg:p-8 space-y-6 animate-pulse">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <div className="h-8 w-48 bg-[var(--bg-secondary)] rounded-lg" />
                    <div className="h-4 w-64 bg-[var(--bg-secondary)] rounded" />
                </div>
                <div className="h-10 w-32 bg-[var(--bg-secondary)] rounded-lg" />
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-24 bg-[var(--bg-secondary)] rounded-xl" />
                ))}
            </div>
            
            {/* Content */}
            <div className="h-96 bg-[var(--bg-secondary)] rounded-xl" />
        </div>
    );
}

// Admin page loading
export function AdminPageSkeleton() {
    return (
        <div className="p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="h-7 w-40 bg-[var(--bg-secondary)] rounded animate-pulse" />
                        <div className="h-4 w-56 bg-[var(--bg-secondary)] rounded animate-pulse" />
                    </div>
                </div>
                
                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="glass-card p-4 animate-pulse">
                            <div className="h-4 w-20 bg-[var(--bg-secondary)] rounded mb-2" />
                            <div className="h-8 w-16 bg-[var(--bg-secondary)] rounded" />
                        </div>
                    ))}
                </div>
                
                {/* Main Content */}
                <div className="glass-card p-6 animate-pulse">
                    <div className="h-6 w-48 bg-[var(--bg-secondary)] rounded mb-4" />
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="h-12 bg-[var(--bg-secondary)] rounded" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
