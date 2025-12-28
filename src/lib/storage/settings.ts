/**
 * Settings Storage (LocalStorage)
 * ================================
 * Small, sync data that stays in LocalStorage:
 * - Theme preference
 * - App settings (discord, notifications)
 * - Platform cookies (user-provided)
 */

// ═══════════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════════

export type ThemeType = 'auto' | 'light' | 'solarized' | 'dark';
export type ResolvedTheme = 'light' | 'solarized' | 'dark';

const THEME_KEY = 'downaria_theme';
const DEFAULT_THEME: ThemeType = 'auto';

/**
 * Get theme based on time of day
 * - Night (20:00 - 05:59): Dark
 * - Day (06:00 - 19:59): Solarized
 */
export function getTimeBasedTheme(): ResolvedTheme {
  const hour = new Date().getHours();
  
  // Night: 20:00 - 05:59 → Dark
  if (hour >= 20 || hour < 6) return 'dark';
  
  // Day: 06:00 - 19:59 → Solarized
  return 'solarized';
}

/**
 * Get saved theme preference (may be 'auto')
 */
export function getTheme(): ThemeType {
  if (typeof window === 'undefined') return DEFAULT_THEME;

  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && ['auto', 'light', 'solarized', 'dark'].includes(saved)) {
      return saved as ThemeType;
    }
    return DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/**
 * Get resolved theme (auto → actual theme based on time)
 */
export function getResolvedTheme(): ResolvedTheme {
  const theme = getTheme();
  if (theme === 'auto') {
    return getTimeBasedTheme();
  }
  return theme;
}

export function saveTheme(theme: ThemeType): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme === 'auto' ? getTimeBasedTheme() : theme);
  
  // Dispatch event for components to update
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
}

export function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('theme-light', 'theme-solarized', 'theme-dark');
  document.documentElement.classList.add(`theme-${theme}`);
}

export function initTheme(): ResolvedTheme {
  const theme = getTheme();
  const resolved = theme === 'auto' ? getTimeBasedTheme() : theme;
  applyTheme(resolved);
  
  // If auto mode, set up interval to check time changes
  if (theme === 'auto' && typeof window !== 'undefined') {
    setupAutoThemeInterval();
  }
  
  return resolved;
}

// Auto theme interval (checks every minute)
let autoThemeInterval: NodeJS.Timeout | null = null;
let lastAutoTheme: ResolvedTheme | null = null;

function setupAutoThemeInterval(): void {
  if (autoThemeInterval) return; // Already running
  
  lastAutoTheme = getTimeBasedTheme();
  
  autoThemeInterval = setInterval(() => {
    const theme = getTheme();
    if (theme !== 'auto') {
      // User switched away from auto, stop interval
      if (autoThemeInterval) {
        clearInterval(autoThemeInterval);
        autoThemeInterval = null;
      }
      return;
    }
    
    const newTheme = getTimeBasedTheme();
    if (newTheme !== lastAutoTheme) {
      lastAutoTheme = newTheme;
      applyTheme(newTheme);
      window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: 'auto', resolved: newTheme } }));
    }
  }, 60000); // Check every minute
}

export function cleanupAutoTheme(): void {
  if (autoThemeInterval) {
    clearInterval(autoThemeInterval);
    autoThemeInterval = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// APP SETTINGS
// ═══════════════════════════════════════════════════════════════

export interface AppSettings {
  discordWebhook?: string;
  pushNotifications: boolean;
  autoDownload: boolean;
  preferredQuality: 'highest' | 'hd' | 'sd';
  showEngagement: boolean;
  highlightLevel: number; // 0-100, text highlight/glow intensity
  // New settings
  wallpaperOpacity: number; // 5-20, default 8
  backgroundBlur: number; // 0-20, default 0
  allowVideoSound: boolean; // default false - video background sound
  allowLargeBackground: boolean; // default false - allow up to 400MB (experimental)
}

const SETTINGS_KEY = 'downaria_settings';

const DEFAULT_SETTINGS: AppSettings = {
  pushNotifications: false,
  autoDownload: false,
  preferredQuality: 'highest',
  showEngagement: true,
  highlightLevel: 0,
  // New defaults
  wallpaperOpacity: 8,
  backgroundBlur: 0,
  allowVideoSound: false,
  allowLargeBackground: false,
};

export function getSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    }
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<AppSettings>): void {
  if (typeof window === 'undefined') return;

  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
}

export function resetSettings(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SETTINGS_KEY);
}

// ═══════════════════════════════════════════════════════════════
// PLATFORM COOKIES (User-provided) - ENCRYPTED
// ═══════════════════════════════════════════════════════════════

import { getEncrypted, setEncrypted, removeEncrypted, migrateToEncrypted } from './crypto';

export type CookiePlatform = 'facebook' | 'instagram' | 'twitter' | 'weibo';

// Simple cookie parser for frontend (no validation, just format)
function cookieParse(input: unknown): string | null {
  if (!input) return null;
  if (typeof input === 'string') return input.trim();
  if (Array.isArray(input)) {
    return input.map((c: { name?: string; value?: string }) => 
      c.name && c.value ? `${c.name}=${c.value}` : ''
    ).filter(Boolean).join('; ');
  }
  return null;
}

const COOKIE_KEY_PREFIX = 'downaria_cookie_';

export function getPlatformCookie(platform: CookiePlatform): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const key = COOKIE_KEY_PREFIX + platform;
    
    // Auto-migrate unencrypted data
    migrateToEncrypted(key);
    
    const data = getEncrypted(key);
    if (!data) return null;

    // Support old format (with expires) - migrate
    try {
      const parsed = JSON.parse(data);
      if (parsed.cookie) {
        setEncrypted(key, parsed.cookie);
        return parsed.cookie;
      }
    } catch {
      return data;
    }
    return data;
  } catch {
    return null;
  }
}

export function savePlatformCookie(platform: CookiePlatform, cookie: string): void {
  if (typeof window === 'undefined') return;
  const parsed = cookieParse(cookie);
  setEncrypted(COOKIE_KEY_PREFIX + platform, parsed || cookie);
}

export function clearPlatformCookie(platform: CookiePlatform): void {
  if (typeof window === 'undefined') return;
  removeEncrypted(COOKIE_KEY_PREFIX + platform);
}

export function hasPlatformCookie(platform: CookiePlatform): boolean {
  return getPlatformCookie(platform) !== null;
}

export function getAllCookieStatus(): Record<CookiePlatform, boolean> {
  return {
    facebook: hasPlatformCookie('facebook'),
    instagram: hasPlatformCookie('instagram'),
    weibo: hasPlatformCookie('weibo'),
    twitter: hasPlatformCookie('twitter'),

  };
}

// Legacy aliases
export const getWeiboCookie = () => getPlatformCookie('weibo');
export const saveWeiboCookie = (cookie: string) => savePlatformCookie('weibo', cookie);
export const clearWeiboCookie = () => clearPlatformCookie('weibo');
export const hasValidWeiboCookie = () => hasPlatformCookie('weibo');

// ═══════════════════════════════════════════════════════════════
// SKIP CACHE SETTING
// ═══════════════════════════════════════════════════════════════

const SKIP_CACHE_KEY = 'downaria_skip_cache';

/**
 * Get Skip Cache setting (default: false)
 * When enabled, bypasses Redis/Supabase and IndexedDB cache
 */
export function getSkipCache(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    return localStorage.getItem(SKIP_CACHE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Set Skip Cache setting
 */
export function setSkipCache(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SKIP_CACHE_KEY, enabled ? 'true' : 'false');
}


// ═══════════════════════════════════════════════════════════════
// LANGUAGE PREFERENCE
// ═══════════════════════════════════════════════════════════════

import { type Locale, locales, defaultLocale } from '@/i18n/config';

export type LanguagePreference = 'auto' | Locale;

const LANGUAGE_KEY = 'downaria_language';

/**
 * Get language preference
 * Returns 'auto' or specific locale code
 */
export function getLanguagePreference(): LanguagePreference {
  if (typeof window === 'undefined') return 'auto';

  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved === 'auto' || (saved && locales.includes(saved as Locale))) {
      return saved as LanguagePreference;
    }
    return 'auto';
  } catch {
    return 'auto';
  }
}

/**
 * Set language preference
 */
export function setLanguagePreference(lang: LanguagePreference): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LANGUAGE_KEY, lang);
}

/**
 * Get resolved locale (auto-detect if 'auto')
 */
export function getResolvedLocale(): Locale {
  const pref = getLanguagePreference();
  
  if (pref !== 'auto') {
    return pref;
  }
  
  // Auto-detect from browser
  if (typeof navigator !== 'undefined') {
    const browserLang = navigator.language?.split('-')[0];
    if (browserLang && locales.includes(browserLang as Locale)) {
      return browserLang as Locale;
    }
  }
  
  return defaultLocale;
}
