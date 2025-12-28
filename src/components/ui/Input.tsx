'use client';

import { InputHTMLAttributes, forwardRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Link } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: string;
    success?: boolean;
    label?: string;
    helperText?: string;
    glowAnimation?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ error, success, label, helperText, glowAnimation = true, className = '', onFocus, onBlur, ...props }, ref) => {
        const [isFocused, setIsFocused] = useState(false);

        const borderColor = error
            ? 'var(--error)'
            : success
                ? 'var(--success)'
                : isFocused
                    ? 'var(--accent-primary)'
                    : 'var(--border-color)';

        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        {label}
                    </label>
                )}
                <div className="relative group">
                    {/* Rotating gradient border */}
                    {glowAnimation && (
                        <div 
                            className="absolute -inset-[2px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                            style={{
                                background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #d946ef, #f43f5e, #f97316, #eab308, #22c55e, #06b6d4, #6366f1)',
                                backgroundSize: '300% 100%',
                                animation: 'gradient-rotate 6s linear infinite',
                                filter: 'blur(4px)',
                            }}
                        />
                    )}
                    
                    {/* Solid rotating border (visible line) */}
                    {glowAnimation && (
                        <div 
                            className="absolute -inset-[1px] rounded-xl opacity-0 group-hover:opacity-70 transition-opacity duration-500"
                            style={{
                                background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #d946ef, #f43f5e, #f97316, #eab308, #22c55e, #06b6d4, #6366f1)',
                                backgroundSize: '300% 100%',
                                animation: 'gradient-rotate 6s linear infinite',
                            }}
                        />
                    )}
                    
                    {/* Input container */}
                    <div className="relative bg-[var(--bg-secondary)] rounded-xl">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] z-10">
                            <Link className="w-5 h-5" />
                        </div>
                        <input
                            ref={ref}
                            style={{ borderColor }}
                            onFocus={(e) => { setIsFocused(true); onFocus?.(e); }}
                            onBlur={(e) => { setIsFocused(false); onBlur?.(e); }}
                            className={`
                                relative w-full pl-12 pr-12 py-4
                                bg-[var(--bg-secondary)]
                                border-2 rounded-xl
                                text-[var(--text-primary)] text-base
                                placeholder:text-[var(--text-muted)]
                                transition-all duration-200
                                focus:outline-none
                                focus:shadow-[0_0_20px_rgba(99,102,241,0.3)]
                                disabled:opacity-50 disabled:cursor-not-allowed
                                ${className}
                            `}
                            {...props}
                        />
                        {(error || success) && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
                                {error ? (
                                    <AlertCircle className="w-5 h-5 text-[var(--error)]" />
                                ) : (
                                    <CheckCircle className="w-5 h-5 text-[var(--success)]" />
                                )}
                            </div>
                        )}
                    </div>
                </div>
                {(error || helperText) && (
                    <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-2 text-sm ${error ? 'text-[var(--error)]' : 'text-[var(--text-muted)]'}`}
                    >
                        {error || helperText}
                    </motion.p>
                )}
                
                    {/* CSS Animation */}
                <style jsx global>{`
                    @keyframes gradient-rotate {
                        0% { background-position: 0% 50%; }
                        100% { background-position: 300% 50%; }
                    }
                `}</style>
            </div>
        );
    }
);

Input.displayName = 'Input';
