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

const THEME_KEY = 'th_v1_y7u';
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

const SETTINGS_KEY = 'stg_v1_r5t';

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
// PLATFORM COOKIES (User-provided)
// ═══════════════════════════════════════════════════════════════

import { parseCookie, type CookiePlatform } from '@/lib/cookies';

export type { CookiePlatform };

const COOKIE_KEY_PREFIX = 'ck_v1_pre_';

export function getPlatformCookie(platform: CookiePlatform): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const data = localStorage.getItem(COOKIE_KEY_PREFIX + platform);
    if (!data) return null;

    // Support old format (with expires) - migrate
    try {
      const parsed = JSON.parse(data);
      if (parsed.cookie) {
        localStorage.setItem(COOKIE_KEY_PREFIX + platform, parsed.cookie);
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
  const parsed = parseCookie(cookie, platform);
  localStorage.setItem(COOKIE_KEY_PREFIX + platform, parsed || cookie);
}

export function clearPlatformCookie(platform: CookiePlatform): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(COOKIE_KEY_PREFIX + platform);
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

const SKIP_CACHE_KEY = 'sc_v1_x2c';

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

