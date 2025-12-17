'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';
import { updatePassword, supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isValidLink, setIsValidLink] = useState(false);

    useEffect(() => {
        // Check if we have a valid recovery session
        if (supabase) {
            supabase.auth.onAuthStateChange((event) => {
                if (event === 'PASSWORD_RECOVERY') {
                    setIsValidLink(true);
                }
            });
        }
        
        // Also check URL hash for recovery token
        if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
            setIsValidLink(true);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            setIsLoading(false);
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            setIsLoading(false);
            return;
        }

        try {
            const result = await updatePassword(password);
            if (result.error) {
                setError(result.error);
            } else {
                setSuccess(true);
                setTimeout(() => router.push('/auth'), 2000);
            }
        } catch {
            setError('Failed to update password');
        } finally {
            setIsLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card p-8 text-center max-w-md"
                >
                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <h1 className="text-xl font-bold mb-2">Password Updated!</h1>
                    <p className="text-[var(--text-muted)] text-sm">Redirecting to login...</p>
                </motion.div>
            </div>
        );
    }

    if (!isValidLink) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-8 text-center max-w-md"
                >
                    <h1 className="text-xl font-bold mb-2">Invalid or Expired Link</h1>
                    <p className="text-[var(--text-muted)] text-sm mb-4">
                        This password reset link is invalid or has expired.
                    </p>
                    <Link href="/auth" className="btn-gradient inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Login
                    </Link>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="glass-card p-8">
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-[var(--accent-primary)]/10">
                            <Lock className="w-6 h-6 text-[var(--accent-primary)]" />
                        </div>
                        <h1 className="text-2xl font-bold">New Password</h1>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm text-[var(--text-secondary)] mb-2">New Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input-url pr-10"
                                    placeholder="••••••••"
                                    required
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-[var(--text-secondary)] mb-2">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="input-url"
                                placeholder="••••••••"
                                required
                                autoComplete="new-password"
                            />
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.p
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="text-red-400 text-sm p-3 rounded-lg bg-red-500/10"
                                >
                                    {error}
                                </motion.p>
                            )}
                        </AnimatePresence>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="btn-gradient w-full flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                'Update Password'
                            )}
                        </button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
