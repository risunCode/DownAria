'use client';

import { NextIntlClientProvider, AbstractIntlMessages } from 'next-intl';
import { useState, useEffect, ReactNode } from 'react';
import { getResolvedLocale } from '@/lib/storage';
import { type Locale, defaultLocale } from '@/i18n/config';

// Import messages statically
import enMessages from '@/i18n/messages/en.json';
import idMessages from '@/i18n/messages/id.json';

const messages: Record<Locale, AbstractIntlMessages> = {
  en: enMessages,
  id: idMessages,
};

interface IntlProviderProps {
  children: ReactNode;
}

export function IntlProvider({ children }: IntlProviderProps) {
  const [locale, setLocale] = useState<Locale>(defaultLocale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Get locale from storage/browser on client
    const resolved = getResolvedLocale();
    setLocale(resolved);
    setMounted(true);

    // Listen for language changes
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'lang_v1_pref') {
        const newLocale = getResolvedLocale();
        setLocale(newLocale);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Use default locale for SSR, then switch on client
  const currentLocale = mounted ? locale : defaultLocale;
  const currentMessages = messages[currentLocale];

  return (
    <NextIntlClientProvider 
      locale={currentLocale} 
      messages={currentMessages}
      timeZone="Asia/Jakarta"
    >
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Hook to trigger locale refresh
 * Call this after setLanguagePreference() to update UI
 */
export function useLocaleRefresh() {
  const refresh = () => {
    // Trigger storage event for other tabs
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'lang_v1_pref',
    }));
    // Reload to apply new locale
    window.location.reload();
  };

  return refresh;
}
