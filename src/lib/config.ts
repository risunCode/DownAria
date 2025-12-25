/**
 * Centralized Configuration
 * Single source of truth for environment variables and constants
 */

// API Configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Supabase Configuration  
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// App Constants
export const APP_NAME = 'DownAria';
export const APP_VERSION = '1.2.0';

// Feature Flags
export const FEATURES = {
    AI_CHAT: true,
    YOUTUBE_MERGE: true,
    PUSH_NOTIFICATIONS: true,
} as const;

// Re-export for convenience
export { API_URL as apiUrl };