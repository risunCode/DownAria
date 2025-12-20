/**
 * i18n Request Configuration
 * ==========================
 * Server-side locale detection for next-intl.
 */

import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales, type Locale } from './config';

export default getRequestConfig(async () => {
  // For now, use default locale
  // In production, this would detect from cookies/headers
  const locale: Locale = defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});

/**
 * Get locale from browser or storage preference
 */
export function detectLocale(acceptLanguage?: string): Locale {
  if (!acceptLanguage) return defaultLocale;
  
  // Parse Accept-Language header
  const preferred = acceptLanguage
    .split(',')
    .map(lang => lang.split(';')[0].trim().toLowerCase())
    .find(lang => {
      const short = lang.split('-')[0];
      return locales.includes(short as Locale);
    });
  
  if (preferred) {
    const short = preferred.split('-')[0];
    if (locales.includes(short as Locale)) {
      return short as Locale;
    }
  }
  
  return defaultLocale;
}
