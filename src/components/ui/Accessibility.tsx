'use client';

import { useEffect, useRef, KeyboardEvent } from 'react';

// Skip to main content link (for keyboard users)
export function SkipToContent() {
    return (
        <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[var(--accent-primary)] focus:text-white focus:rounded-lg focus:outline-none"
        >
            Skip to main content
        </a>
    );
}

// Focus trap for modals
interface FocusTrapProps {
    children: React.ReactNode;
    active?: boolean;
    onEscape?: () => void;
}

export function FocusTrap({ children, active = true, onEscape }: FocusTrapProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!active) return;

        const container = containerRef.current;
        if (!container) return;

        // Get all focusable elements
        const focusableElements = container.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Focus first element on mount
        firstElement?.focus();

        const handleKeyDown = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape' && onEscape) {
                onEscape();
                return;
            }

            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement?.focus();
                }
            } else {
                if (document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement?.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [active, onEscape]);

    return <div ref={containerRef}>{children}</div>;
}

// Visually hidden but accessible to screen readers
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
    return <span className="sr-only">{children}</span>;
}

// Announce to screen readers
export function LiveRegion({ 
    message, 
    politeness = 'polite' 
}: { 
    message: string; 
    politeness?: 'polite' | 'assertive' 
}) {
    return (
        <div
            role="status"
            aria-live={politeness}
            aria-atomic="true"
            className="sr-only"
        >
            {message}
        </div>
    );
}

// Keyboard-only focus styles hook
export function useKeyboardFocus() {
    useEffect(() => {
        const handleFirstTab = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Tab') {
                document.body.classList.add('keyboard-user');
                window.removeEventListener('keydown', handleFirstTab);
            }
        };

        const handleMouseDown = () => {
            document.body.classList.remove('keyboard-user');
            window.addEventListener('keydown', handleFirstTab);
        };

        window.addEventListener('keydown', handleFirstTab);
        window.addEventListener('mousedown', handleMouseDown);

        return () => {
            window.removeEventListener('keydown', handleFirstTab);
            window.removeEventListener('mousedown', handleMouseDown);
        };
    }, []);
}

// Accessible button with loading state
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    loading?: boolean;
    loadingText?: string;
}

export function AccessibleButton({ 
    children, 
    loading, 
    loadingText = 'Loading...', 
    disabled,
    ...props 
}: AccessibleButtonProps) {
    return (
        <button
            disabled={disabled || loading}
            aria-busy={loading}
            aria-disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <>
                    <span className="sr-only">{loadingText}</span>
                    <span aria-hidden="true">{children}</span>
                </>
            ) : (
                children
            )}
        </button>
    );
}
