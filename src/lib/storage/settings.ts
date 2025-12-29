/**
 * Unified Settings Storage (LocalStorage)
 * ========================================
 * 5 Storage Keys:
 * 
 * 1. downaria_settings - All user preferences
 * 2. downaria_cookies - All platform cookies (encrypted)
 * 3. downaria_seasonal - Seasonal effects
 * 4. downaria_queue - Pending downloads queue
 * 5. downaria_ai - AI chat sessions
 */

import { type Locale, locales, defaultLocale } from '@/i18n/config';

// ═══════════════════════════════════════════════════════════════
// STORAGE KEYS
// ═══════════════════════════════════════════════════════════════

export const STORAGE_KEYS = {
  SETTINGS: 'downaria_settings',
  COOKIES: 'downaria_cookies',
  SEASONAL: 'downaria_seasonal',
  QUEUE: 'downaria_queue',
  AI: 'downaria_ai',
} as const;

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type ThemeType = 'auto' | 'light' | 'solarized' | 'dark';
export type ResolvedTheme = 'light' | 'solarized' | 'dark';
export type LanguagePreference = 'auto' | Locale;
export type CookiePlatform = 'facebook' | 'instagram' | 'twitter' | 'weibo';

export interface DiscordSettings {
  webhookUrl: string;
  autoSend: boolean;
  embedEnabled: boolean;
  embedColor: string;
  footerText: string;
  sendMethod: 'smart' | 'single' | 'double';
  mention: string;
  sendAllOnBatch: boolean;
  batchDelay: number;
}

export interface DownAriaSettings {
  // Theme & Display
  theme: ThemeType;
  language: LanguagePreference;
  adaptText: boolean;
  highlightLevel: number;
  
  // Download Preferences
  preferredQuality: 'highest' | 'hd' | 'sd';
  autoDownload: boolean;
  showEngagement: boolean;
  videoSound: boolean;
  
  // Background Settings
  wallpaperOpacity: number;
  backgroundBlur: number;
  allowLargeBackground: boolean;
  
  // Cache
  skipCache: boolean;
  
  // Notifications
  notifications: boolean;
  updateDismissed: 'forever' | 'session' | null;
  dismissedAnnouncements: Record<string, number>;
  
  // Discord Integration
  discord: DiscordSettings | null;
}

// ═══════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════

export const DEFAULT_DISCORD: DiscordSettings = {
  webhookUrl: '',
  autoSend: false,
  embedEnabled: true,
  embedColor: '#5865F2',
  footerText: 'via DownAria',
  sendMethod: 'smart',
  mention: '',
  sendAllOnBatch: false,
  batchDelay: 2000,
};

const DEFAULT_SETTINGS: DownAriaSettings = {
  theme: 'auto',
  language: 'auto',
  adaptText: false,
  highlightLevel: 0,
  preferredQuality: 'highest',
  autoDownload: false,
  showEngagement: true,
  videoSound: false,
  wallpaperOpacity: 8,
  backgroundBlur: 0,
  allowLargeBackground: false,
  skipCache: false,
  notifications: false,
  updateDismissed: null,
  dismissedAnnouncements: {},
  discord: null,
};

// ═══════════════════════════════════════════════════════════════
// UNIFIED SETTINGS
// ═══════════════════════════════════════════════════════════════

export function getUnifiedSettings(): DownAriaSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveUnifiedSettings(settings: Partial<DownAriaSettings>): void {
  if (typeof window === 'undefined') return;
  const updated = { ...getUnifiedSettings(), ...settings };
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  window.dispatchEvent(new CustomEvent('settings-changed', { detail: updated }));
}

export function resetUnifiedSettings(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
  window.dispatchEvent(new CustomEvent('settings-changed', { detail: DEFAULT_SETTINGS }));
}

// ═══════════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════════

export function getTimeBasedTheme(): ResolvedTheme {
  const hour = new Date().getHours();
  return (hour >= 20 || hour < 6) ? 'dark' : 'solarized';
}

export function getTheme(): ThemeType {
  if (typeof window === 'undefined') return 'auto';
  return getUnifiedSettings().theme;
}

export function getResolvedTheme(): ResolvedTheme {
  const theme = getTheme();
  return theme === 'auto' ? getTimeBasedTheme() : theme;
}

export function applyTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('theme-light', 'theme-solarized', 'theme-dark');
  document.documentElement.classList.add(`theme-${theme}`);
}

export function saveTheme(theme: ThemeType): void {
  if (typeof window === 'undefined') return;
  saveUnifiedSettings({ theme });
  applyTheme(theme === 'auto' ? getTimeBasedTheme() : theme);
  window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
}

// Auto theme interval
let autoThemeInterval: NodeJS.Timeout | null = null;
let lastAutoTheme: ResolvedTheme | null = null;

export function initTheme(): ResolvedTheme {
  const theme = getTheme();
  const resolved = theme === 'auto' ? getTimeBasedTheme() : theme;
  applyTheme(resolved);
  
  if (theme === 'auto' && typeof window !== 'undefined') {
    if (!autoThemeInterval) {
      lastAutoTheme = resolved;
      autoThemeInterval = setInterval(() => {
        if (getTheme() !== 'auto') {
          cleanupAutoTheme();
          return;
        }
        const newTheme = getTimeBasedTheme();
        if (newTheme !== lastAutoTheme) {
          lastAutoTheme = newTheme;
          applyTheme(newTheme);
          window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme: 'auto', resolved: newTheme } }));
        }
      }, 60000);
    }
  }
  return resolved;
}

export function cleanupAutoTheme(): void {
  if (autoThemeInterval) {
    clearInterval(autoThemeInterval);
    autoThemeInterval = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// LANGUAGE
// ═══════════════════════════════════════════════════════════════

export function getLanguagePreference(): LanguagePreference {
  if (typeof window === 'undefined') return 'auto';
  return getUnifiedSettings().language;
}

export function setLanguagePreference(lang: LanguagePreference): void {
  saveUnifiedSettings({ language: lang });
}

export function getResolvedLocale(): Locale {
  const pref = getLanguagePreference();
  if (pref !== 'auto') return pref;
  
  if (typeof navigator !== 'undefined') {
    const browserLang = navigator.language?.split('-')[0];
    if (browserLang && locales.includes(browserLang as Locale)) {
      return browserLang as Locale;
    }
  }
  return defaultLocale;
}

// ═══════════════════════════════════════════════════════════════
// SKIP CACHE
// ═══════════════════════════════════════════════════════════════

export function getSkipCache(): boolean {
  if (typeof window === 'undefined') return false;
  return getUnifiedSettings().skipCache;
}

export function setSkipCache(enabled: boolean): void {
  saveUnifiedSettings({ skipCache: enabled });
}

// ═══════════════════════════════════════════════════════════════
// ANNOUNCEMENTS
// ═══════════════════════════════════════════════════════════════

const DISMISS_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours

export function getDismissedAnnouncements(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  return getUnifiedSettings().dismissedAnnouncements;
}

export function dismissAnnouncement(id: string): void {
  const dismissed = { ...getDismissedAnnouncements(), [id]: Date.now() };
  saveUnifiedSettings({ dismissedAnnouncements: dismissed });
}

export function isAnnouncementDismissed(id: string): boolean {
  const dismissedAt = getDismissedAnnouncements()[id];
  return dismissedAt ? Date.now() - dismissedAt < DISMISS_COOLDOWN_MS : false;
}

// ═══════════════════════════════════════════════════════════════
// UPDATE PROMPT
// ═══════════════════════════════════════════════════════════════

export function getUpdateDismissed(): 'forever' | 'session' | null {
  if (typeof window === 'undefined') return null;
  return getUnifiedSettings().updateDismissed;
}

export function setUpdateDismissed(status: 'forever' | 'session' | null): void {
  saveUnifiedSettings({ updateDismissed: status });
}

// ═══════════════════════════════════════════════════════════════
// DISCORD
// ═══════════════════════════════════════════════════════════════

export function getDiscordSettings(): DiscordSettings | null {
  if (typeof window === 'undefined') return null;
  return getUnifiedSettings().discord;
}

export function saveDiscordSettings(settings: DiscordSettings | null): void {
  saveUnifiedSettings({ discord: settings });
}

export function getUserDiscordSettings(): DiscordSettings | null {
  const discord = getDiscordSettings();
  return discord ? { ...DEFAULT_DISCORD, ...discord } : null;
}

export function saveUserDiscordSettings(settings: DiscordSettings): void {
  saveDiscordSettings(settings);
}

// ═══════════════════════════════════════════════════════════════
// PLATFORM COOKIES (Encrypted)
// ═══════════════════════════════════════════════════════════════

import { getEncryptedCookies, setEncryptedCookies } from './crypto';

export function getPlatformCookie(platform: CookiePlatform): string | null {
  if (typeof window === 'undefined') return null;
  return getEncryptedCookies()[platform] || null;
}

export function savePlatformCookie(platform: CookiePlatform, cookie: string): void {
  if (typeof window === 'undefined') return;
  const cookies = getEncryptedCookies();
  cookies[platform] = cookie.trim();
  setEncryptedCookies(cookies);
}

export function clearPlatformCookie(platform: CookiePlatform): void {
  if (typeof window === 'undefined') return;
  const cookies = getEncryptedCookies();
  delete cookies[platform];
  setEncryptedCookies(cookies);
}

export function hasPlatformCookie(platform: CookiePlatform): boolean {
  return getPlatformCookie(platform) !== null;
}

export function getAllCookieStatus(): Record<CookiePlatform, boolean> {
  return {
    facebook: hasPlatformCookie('facebook'),
    instagram: hasPlatformCookie('instagram'),
    twitter: hasPlatformCookie('twitter'),
    weibo: hasPlatformCookie('weibo'),
  };
}
