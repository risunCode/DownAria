'use client';

import { InputHTMLAttributes, forwardRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle, Link } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    error?: string;
    success?: boolean;
    label?: string;
    helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ error, success, label, helperText, className = '', onFocus, onBlur, ...props }, ref) => {
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
                <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                        <Link className="w-5 h-5" />
                    </div>
                    <input
                        ref={ref}
                        style={{ borderColor }}
                        onFocus={(e) => { setIsFocused(true); onFocus?.(e); }}
                        onBlur={(e) => { setIsFocused(false); onBlur?.(e); }}
                        className={`
              w-full pl-12 pr-12 py-4
              bg-[var(--bg-secondary)]
              border-2 rounded-xl
              text-[var(--text-primary)] text-base
              placeholder:text-[var(--text-muted)]
              transition-all duration-200
              focus:outline-none
              focus:shadow-[0_0_20px_rgba(99,102,241,0.2)]
              disabled:opacity-50 disabled:cursor-not-allowed
              ${className}
            `}
                        {...props}
                    />
                    {(error || success) && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            {error ? (
                                <AlertCircle className="w-5 h-5 text-[var(--error)]" />
                            ) : (
                                <CheckCircle className="w-5 h-5 text-[var(--success)]" />
                            )}
                        </div>
                    )}
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
            </div>
        );
    }
);

Input.displayName = 'Input';
