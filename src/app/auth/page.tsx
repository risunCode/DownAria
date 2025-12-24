'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, LogIn, UserPlus, Mail, ArrowLeft, Eye, EyeOff, CheckCircle, Gift, User, ShieldCheck, Crown } from 'lucide-react';
import { signIn, signUp, resetPassword, getSession, supabase } from '@/lib/supabase';

type AuthMode = 'login' | 'register' | 'forgot';
type RegisterStep = 'referral' | 'details';

export default function AuthPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]"><div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" /></div>}>
            <AuthContent />
        </Suspense>
    );
}

interface Star {
    id: number;
    left: number;
    top: number;
    opacity: number;
    duration: number;
    delay: number;
}

function AuthContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [mode, setMode] = useState<AuthMode>('login');
    const [registerStep, setRegisterStep] = useState<RegisterStep>('referral');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    // Form fields
    const [identifier, setIdentifier] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [referralCode, setReferralCode] = useState('');
    
    // Verified referral info
    const [verifiedRole, setVerifiedRole] = useState<string | null>(null);
    const [referrerName, setReferrerName] = useState<string | null>(null);
    
    // Stars
    const [stars, setStars] = useState<Star[]>([]);
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
        setMounted(true);
        const generatedStars: Star[] = Array.from({ length: 50 }, (_, i) => ({
            id: i,
            left: Math.random() * 100,
            top: Math.random() * 100,
            opacity: Math.random() * 0.7 + 0.3,
            duration: Math.random() * 2 + 1,
            delay: Math.random() * 2,
        }));
        setStars(generatedStars);
    }, []);

    useEffect(() => {
        getSession().then(({ session }) => {
            if (session) router.push('/admin');
        });
        
        const ref = searchParams.get('ref');
        if (ref) {
            setReferralCode(ref);
            setMode('register');
        }
    }, [router, searchParams]);

    // Verify referral code
    const verifyReferral = async () => {
        if (!referralCode.trim()) {
            setError('Please enter a referral code');
            return;
        }
        
        setIsLoading(true);
        setError('');
        
        try {
            if (!supabase) {
                setError('Database not connected');
                return;
            }
            
            // Check special referral codes first (admin codes)
            const { data: specialRef } = await supabase
                .from('special_referrals')
                .select('code, role, max_uses, current_uses, is_active, expires_at')
                .eq('code', referralCode)
                .eq('is_active', true)
                .single();
            
            if (specialRef) {
                // Check if not expired
                if (specialRef.expires_at && new Date(specialRef.expires_at) < new Date()) {
                    setError('Referral code has expired');
                    return;
                }
                // Check if not exhausted
                if (specialRef.max_uses && specialRef.current_uses >= specialRef.max_uses) {
                    setError('Referral code has reached max uses');
                    return;
                }
                setVerifiedRole(specialRef.role);
                setReferrerName(null);
                setRegisterStep('details');
                return;
            }
            
            // Check normal user referral codes
            const { data: userRef } = await supabase
                .from('users')
                .select('username, email, referral_code')
                .eq('referral_code', referralCode)
                .single();
            
            if (userRef) {
                setVerifiedRole('user');
                setReferrerName(userRef.username || userRef.email);
                setRegisterStep('details');
                return;
            }
            
            setError('Invalid or already used referral code');
        } catch {
            setError('Failed to verify referral code');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            if (mode === 'login') {
                let email = identifier;
                if (!identifier.includes('@') && supabase) {
                    const { data } = await supabase
                        .from('users')
                        .select('email')
                        .eq('username', identifier.toLowerCase())
                        .single();
                    if (data?.email) {
                        email = data.email;
                    } else {
                        setError('Username not found');
                        setIsLoading(false);
                        return;
                    }
                }
                
                const result = await signIn(email, password);
                if (result.error) {
                    setError(result.error.message || 'Login failed');
                } else {
                    router.push('/admin');
                }
            } else if (mode === 'register') {
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
                if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
                    setError('Username: 3-20 chars, letters/numbers/underscore only');
                    setIsLoading(false);
                    return;
                }
                
                if (username && supabase) {
                    const { data: existing } = await supabase
                        .from('users')
                        .select('id')
                        .eq('username', username.toLowerCase())
                        .single();
                    if (existing) {
                        setError('Username already taken');
                        setIsLoading(false);
                        return;
                    }
                }
                
                const result = await signUp(identifier, password, username || undefined);
                if (result.error) {
                    setError(result.error.message || 'Registration failed');
                } else if (result.data?.user && supabase) {
                    // Process referral - increment usage for special referrals
                    if (referralCode) {
                        try {
                            // Check if it's a special referral and increment usage
                            const { data: specialRef } = await supabase
                                .from('special_referrals')
                                .select('id, role')
                                .eq('code', referralCode)
                                .eq('is_active', true)
                                .single();
                            
                            if (specialRef) {
                                // Increment current_uses using RPC
                                await supabase.rpc('increment_referral_uses', { referral_id: specialRef.id });
                                
                                // Update user role if admin
                                if (specialRef.role === 'admin') {
                                    await supabase
                                        .from('users')
                                        .update({ role: 'admin' })
                                        .eq('id', result.data.user.id);
                                }
                            } else {
                                // Normal user referral - increment referrer's total_referrals
                                await supabase
                                    .from('users')
                                    .update({ referred_by: referralCode })
                                    .eq('id', result.data.user.id);
                            }
                        } catch {
                            // Referral processing failed silently
                        }
                    }
                    setSuccess('Account created! You can now sign in.');
                    setMode('login');
                    setRegisterStep('referral');
                    setVerifiedRole(null);
                    setIdentifier(identifier);
                }
            } else if (mode === 'forgot') {
                const result = await resetPassword(identifier);
                if (result.error) {
                    setError(result.error.message || 'Password reset failed');
                } else {
                    setSuccess('Password reset link sent to your email!');
                }
            }
        } catch {
            setError('Connection error');
        } finally {
            setIsLoading(false);
        }
    };

    const switchMode = (newMode: AuthMode) => {
        setMode(newMode);
        setRegisterStep('referral');
        setVerifiedRole(null);
        setReferrerName(null);
        setError('');
        setSuccess('');
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)] relative overflow-hidden">
            {/* Space Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {mounted && stars.map((star) => (
                    <motion.div
                        key={`star-${star.id}`}
                        className="absolute w-1 h-1 bg-white rounded-full"
                        style={{ left: `${star.left}%`, top: `${star.top}%`, opacity: star.opacity }}
                        animate={{ opacity: [0.3, 1, 0.3], scale: [1, 1.2, 1] }}
                        transition={{ duration: star.duration, repeat: Infinity, delay: star.delay }}
                    />
                ))}
                
                <motion.div className="absolute text-4xl" initial={{ x: -100, y: '80vh', rotate: -45 }} animate={{ x: '110vw', y: '-10vh', rotate: -45 }} transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}>🚀</motion.div>
                <motion.div className="absolute text-3xl" initial={{ x: '110vw', y: '60vh', rotate: 135 }} animate={{ x: -100, y: '20vh', rotate: 135 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear', delay: 5 }}>🚀</motion.div>
                <motion.div className="absolute text-5xl" style={{ left: '10%', top: '20%' }} animate={{ y: [0, -20, 0], rotate: [0, 10, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}>👨‍🚀</motion.div>
                <motion.div className="absolute text-4xl" style={{ right: '15%', bottom: '25%' }} animate={{ y: [0, 15, 0], rotate: [0, -15, 15, 0] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 2 }}>🧑‍🚀</motion.div>
                <motion.div className="absolute text-6xl opacity-30" style={{ right: '5%', top: '10%' }} animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}>🪐</motion.div>
                <motion.div className="absolute text-4xl opacity-20" style={{ left: '8%', bottom: '15%' }} animate={{ rotate: -360 }} transition={{ duration: 80, repeat: Infinity, ease: 'linear' }}>🌍</motion.div>
                <motion.div className="absolute w-20 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent" initial={{ x: '100vw', y: '10vh', rotate: -30 }} animate={{ x: '-20vw', y: '30vh' }} transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 7, ease: 'easeOut' }} />
            </div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
                <div className="glass-card p-8 backdrop-blur-xl">
                    {/* Header */}
                    <div className="flex items-center justify-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-[var(--accent-primary)]/10">
                            {mode === 'login' && <Lock className="w-6 h-6 text-[var(--accent-primary)]" />}
                            {mode === 'register' && registerStep === 'referral' && <Gift className="w-6 h-6 text-[var(--accent-primary)]" />}
                            {mode === 'register' && registerStep === 'details' && <UserPlus className="w-6 h-6 text-[var(--accent-primary)]" />}
                            {mode === 'forgot' && <Mail className="w-6 h-6 text-[var(--accent-primary)]" />}
                        </div>
                        <h1 className="text-2xl font-bold">
                            {mode === 'login' && 'Welcome Back'}
                            {mode === 'register' && registerStep === 'referral' && 'Enter Referral'}
                            {mode === 'register' && registerStep === 'details' && 'Create Account'}
                            {mode === 'forgot' && 'Reset Password'}
                        </h1>
                    </div>

                    {mode === 'forgot' && (
                        <button onClick={() => switchMode('login')} className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-4">
                            <ArrowLeft className="w-4 h-4" /> Back to login
                        </button>
                    )}
                    
                    {mode === 'register' && registerStep === 'details' && (
                        <button onClick={() => { setRegisterStep('referral'); setVerifiedRole(null); }} className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-4">
                            <ArrowLeft className="w-4 h-4" /> Change referral code
                        </button>
                    )}

                    {/* REGISTER STEP 1: Referral Code */}
                    {mode === 'register' && registerStep === 'referral' && (
                        <div className="space-y-4">
                            <p className="text-sm text-[var(--text-secondary)] text-center mb-4">
                                You need a referral code to register
                            </p>
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">
                                    <span className="flex items-center gap-1">
                                        <Gift className="w-3 h-3" /> Referral Code <span className="text-red-400">*</span>
                                    </span>
                                </label>
                                <input 
                                    type="text" 
                                    value={referralCode} 
                                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())} 
                                    className="input-url" 
                                    placeholder="XTFXXXXXXXX" 
                                    maxLength={11}
                                    onKeyDown={(e) => e.key === 'Enter' && verifyReferral()}
                                />
                            </div>
                            
                            <AnimatePresence>
                                {error && (
                                    <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 text-sm p-3 rounded-lg bg-red-500/10">
                                        {error}
                                    </motion.p>
                                )}
                            </AnimatePresence>
                            
                            <button onClick={verifyReferral} disabled={isLoading} className="btn-gradient w-full flex items-center justify-center gap-2">
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <><ShieldCheck className="w-4 h-4" /> Verify Code</>
                                )}
                            </button>
                        </div>
                    )}

                    {/* REGISTER STEP 2: Account Details */}
                    {mode === 'register' && registerStep === 'details' && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Verified Badge */}
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }} 
                                animate={{ opacity: 1, scale: 1 }}
                                className={`p-3 rounded-lg border ${verifiedRole === 'admin' ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-green-500/10 border-green-500/30'}`}
                            >
                                <div className="flex items-center gap-2">
                                    {verifiedRole === 'admin' ? (
                                        <Crown className="w-5 h-5 text-yellow-400" />
                                    ) : (
                                        <CheckCircle className="w-5 h-5 text-green-400" />
                                    )}
                                    <div>
                                        <p className={`text-sm font-medium ${verifiedRole === 'admin' ? 'text-yellow-400' : 'text-green-400'}`}>
                                            {verifiedRole === 'admin' ? '👑 Admin Access' : '✓ Code Verified'}
                                        </p>
                                        <p className="text-xs text-[var(--text-muted)]">
                                            {referrerName ? `Referred by: ${referrerName}` : `Role: ${verifiedRole}`}
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                            
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">Email</label>
                                <input type="email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="input-url" placeholder="you@example.com" required autoComplete="email" />
                            </div>
                            
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">
                                    <span className="flex items-center gap-1">
                                        <User className="w-3 h-3" /> Username <span className="text-[var(--text-muted)]">(optional)</span>
                                    </span>
                                </label>
                                <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} className="input-url" placeholder="cooluser123" maxLength={20} autoComplete="username" />
                            </div>
                            
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">Password</label>
                                <div className="relative">
                                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="input-url pr-10" placeholder="••••••••" required autoComplete="new-password" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">Confirm Password</label>
                                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-url" placeholder="••••••••" required autoComplete="new-password" />
                            </div>
                            
                            <AnimatePresence>
                                {error && <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 text-sm p-3 rounded-lg bg-red-500/10">{error}</motion.p>}
                                {success && <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-green-400 text-sm p-3 rounded-lg bg-green-500/10 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {success}</motion.p>}
                            </AnimatePresence>
                            
                            <button type="submit" disabled={isLoading} className="btn-gradient w-full flex items-center justify-center gap-2">
                                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserPlus className="w-4 h-4" />Create Account</>}
                            </button>
                        </form>
                    )}

                    {/* LOGIN FORM */}
                    {mode === 'login' && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">Email or Username</label>
                                <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="input-url" placeholder="email or username" required autoComplete="username" />
                            </div>
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">Password</label>
                                <div className="relative">
                                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="input-url pr-10" placeholder="••••••••" required autoComplete="current-password" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="text-right">
                                <button type="button" onClick={() => switchMode('forgot')} className="text-sm text-[var(--accent-primary)] hover:underline">Forgot password?</button>
                            </div>
                            <AnimatePresence>
                                {error && <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 text-sm p-3 rounded-lg bg-red-500/10">{error}</motion.p>}
                                {success && <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-green-400 text-sm p-3 rounded-lg bg-green-500/10 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {success}</motion.p>}
                            </AnimatePresence>
                            <button type="submit" disabled={isLoading} className="btn-gradient w-full flex items-center justify-center gap-2">
                                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><LogIn className="w-4 h-4" />Sign In</>}
                            </button>
                        </form>
                    )}

                    {/* FORGOT PASSWORD FORM */}
                    {mode === 'forgot' && (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-[var(--text-secondary)] mb-2">Email</label>
                                <input type="email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="input-url" placeholder="you@example.com" required autoComplete="email" />
                            </div>
                            <AnimatePresence>
                                {error && <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-red-400 text-sm p-3 rounded-lg bg-red-500/10">{error}</motion.p>}
                                {success && <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-green-400 text-sm p-3 rounded-lg bg-green-500/10 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> {success}</motion.p>}
                            </AnimatePresence>
                            <button type="submit" disabled={isLoading} className="btn-gradient w-full flex items-center justify-center gap-2">
                                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Mail className="w-4 h-4" />Send Reset Link</>}
                            </button>
                        </form>
                    )}

                    {mode !== 'forgot' && (
                        <p className="text-center text-[var(--text-muted)] text-sm mt-6">
                            {mode === 'login' ? (
                                <>Don&apos;t have an account? <button onClick={() => switchMode('register')} className="text-[var(--accent-primary)] hover:underline">Sign up</button></>
                            ) : (
                                <>Already have an account? <button onClick={() => switchMode('login')} className="text-[var(--accent-primary)] hover:underline">Sign in</button></>
                            )}
                        </p>
                    )}
                </div>
            </motion.div>
            
            <motion.p className="absolute bottom-4 text-center text-xs text-[var(--text-muted)] w-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
                🌌 Explore the universe of social media downloads
            </motion.p>
        </div>
    );
}
