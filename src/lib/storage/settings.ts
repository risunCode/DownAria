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

export type ThemeType = 'light' | 'solarized' | 'dark';

const THEME_KEY = 'downaria_theme';
const DEFAULT_THEME: ThemeType = 'solarized';

export function getTheme(): ThemeType {
  if (typeof window === 'undefined') return DEFAULT_THEME;

  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && ['light', 'solarized', 'dark'].includes(saved)) {
      return saved as ThemeType;
    }
    return DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme: ThemeType): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: ThemeType): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('theme-light', 'theme-solarized', 'theme-dark');
  document.documentElement.classList.add(`theme-${theme}`);
}

export function initTheme(): ThemeType {
  const theme = getTheme();
  applyTheme(theme);
  return theme;
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
}

const SETTINGS_KEY = 'downaria_settings';

const DEFAULT_SETTINGS: AppSettings = {
  pushNotifications: false,
  autoDownload: false,
  preferredQuality: 'highest',
  showEngagement: true,
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
