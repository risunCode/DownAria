/**
 * Supabase Client - Frontend Only
 * For authentication and client-side operations
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Auth helpers
export async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    return { data, error };
}

export async function signUp(email: string, password: string, username?: string) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username: username || email.split('@')[0],
            },
        },
    });
    return { data, error };
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

export async function resetPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
    });
    return { data, error };
}

export async function updatePassword(password: string) {
    const { data, error } = await supabase.auth.updateUser({
        password,
    });
    return { data, error };
}

export async function getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
}

export async function getUserProfile() {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return { profile: null, error: userError };

    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    return { profile, error: profileError };
}