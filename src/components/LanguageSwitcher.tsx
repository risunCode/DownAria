'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';
import { getLanguagePreference, setLanguagePreference, type LanguagePreference } from '@/lib/storage';
import { useLocaleRefresh } from './IntlProvider';

interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'buttons';
  showLabel?: boolean;
  className?: string;
}

export function LanguageSwitcher({ 
  variant = 'dropdown', 
  showLabel = true,
  className = '' 
}: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [current, setCurrent] = useState<LanguagePreference>('auto');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const refreshLocale = useLocaleRefresh();

  useEffect(() => {
    setCurrent(getLanguagePreference());
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (lang: LanguagePreference) => {
    setLanguagePreference(lang);
    setCurrent(lang);
    setIsOpen(false);
    // Refresh to apply new locale
    refreshLocale();
  };

  const options: { value: LanguagePreference; label: string; flag?: string }[] = [
    { value: 'auto', label: 'Auto-detect', flag: '🌐' },
    ...locales.map(locale => ({
      value: locale as LanguagePreference,
      label: localeNames[locale],
      flag: localeFlags[locale],
    })),
  ];

  const currentOption = options.find(o => o.value === current) || options[0];

  if (variant === 'buttons') {
    return (
      <div className={`flex gap-2 ${className}`}>
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSelect(option.value)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
              current === option.value
                ? 'bg-[var(--accent-primary)] text-white'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
            }`}
          >
            <span>{option.flag}</span>
            {showLabel && <span>{option.label}</span>}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-card)] transition-colors"
      >
        <Globe className="w-4 h-4" />
        {showLabel && (
          <>
            <span className="text-sm">{currentOption.flag} {currentOption.label}</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 w-48 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-xl z-50"
          >
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  current === option.value
                    ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                }`}
              >
                <span className="text-base">{option.flag}</span>
                <span className="flex-1 text-left">{option.label}</span>
                {current === option.value && (
                  <Check className="w-4 h-4" />
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
