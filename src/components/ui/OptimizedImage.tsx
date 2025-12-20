'use client';

import { useState } from 'react';
import Image, { ImageProps } from 'next/image';

// Simple className merger
function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ');
}

interface OptimizedImageProps extends Omit<ImageProps, 'onError'> {
    fallbackSrc?: string;
    showSkeleton?: boolean;
    aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
}

const aspectRatioClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]',
    auto: '',
};

export function OptimizedImage({
    src,
    alt,
    fallbackSrc = '/icon.png',
    showSkeleton = true,
    aspectRatio = 'auto',
    className,
    ...props
}: OptimizedImageProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);

    const imageSrc = error ? fallbackSrc : src;

    return (
        <div className={cn('relative overflow-hidden', aspectRatioClasses[aspectRatio], className)}>
            {showSkeleton && isLoading && (
                <div className="absolute inset-0 bg-[var(--bg-secondary)] animate-pulse" />
            )}
            <Image
                src={imageSrc}
                alt={alt}
                className={cn(
                    'transition-opacity duration-300',
                    isLoading ? 'opacity-0' : 'opacity-100'
                )}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                    setError(true);
                    setIsLoading(false);
                }}
                {...props}
            />
        </div>
    );
}

// Thumbnail with proxy support for external images
interface ProxiedThumbnailProps {
    src: string | undefined;
    alt: string;
    width?: number;
    height?: number;
    className?: string;
    priority?: boolean;
}

export function ProxiedThumbnail({
    src,
    alt,
    width = 320,
    height = 180,
    className,
    priority = false,
}: ProxiedThumbnailProps) {
    const [error, setError] = useState(false);

    if (!src || error) {
        return (
            <div 
                className={cn(
                    'bg-[var(--bg-secondary)] flex items-center justify-center',
                    className
                )}
                style={{ width, height }}
            >
                <span className="text-4xl">🎬</span>
            </div>
        );
    }

    // Proxy external images that might be blocked by CORS
    const needsProxy = src.includes('fbcdn.net') || 
                       src.includes('cdninstagram.com') || 
                       src.includes('scontent');
    
    const imageSrc = needsProxy 
        ? `/api/proxy?url=${encodeURIComponent(src)}&inline=1`
        : src;

    return (
        <img
            src={imageSrc}
            alt={alt}
            width={width}
            height={height}
            className={cn('object-cover', className)}
            loading={priority ? 'eager' : 'lazy'}
            onError={() => setError(true)}
        />
    );
}

// Avatar with initials fallback
interface AvatarProps {
    src?: string | null;
    name?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
};

export function Avatar({ src, name, size = 'md', className }: AvatarProps) {
    const [error, setError] = useState(false);
    
    const initials = name
        ?.split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2) || '?';

    if (!src || error) {
        return (
            <div 
                className={cn(
                    'rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] flex items-center justify-center font-medium',
                    sizeClasses[size],
                    className
                )}
            >
                {initials}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={name || 'Avatar'}
            className={cn('rounded-full object-cover', sizeClasses[size], className)}
            onError={() => setError(true)}
        />
    );
}
