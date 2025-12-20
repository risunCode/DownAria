/**
 * i18n Module
 * ===========
 * Internationalization support for XTFetch.
 * 
 * Usage:
 *   import { useTranslations } from '@/i18n';
 *   const t = useTranslations('common');
 *   t('loading') // "Loading..." or "Memuat..."
 */

export { locales, defaultLocale, localeNames, localeFlags, type Locale } from './config';
export { useTranslations, useLocale } from 'next-intl';
