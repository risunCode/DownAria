'use client';

import { useEffect, useState } from 'react';
import { getSeasonalSettings } from '@/lib/storage/seasonal';
import { getResolvedTheme } from '@/lib/storage/settings';

const ADAPT_TEXT_KEY = 'downaria_adapt_text';

/**
 * Get adapt text setting
 */
export function getAdaptText(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(ADAPT_TEXT_KEY) === 'true';
}

/**
 * Set adapt text setting
 */
export function setAdaptText(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ADAPT_TEXT_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('adapt-text-changed'));
}

/**
 * AdaptText Component
 * Auto-adapts text color for better visibility when custom background is active
 * - Adds text shadow for contrast
 * - Works with both light and dark backgrounds
 * - Theme-aware: uses appropriate shadow color based on theme
 */
export function AdaptText() {
  const [enabled, setEnabled] = useState(false);
  const [hasBackground, setHasBackground] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  useEffect(() => {
    // Load settings
    const load = () => {
      setEnabled(getAdaptText());
      const settings = getSeasonalSettings();
      setHasBackground(!!settings.customBackground);
      const theme = getResolvedTheme();
      setIsDarkTheme(theme === 'dark');
    };
    
    load();

    // Listen for changes
    const handleChange = () => load();
    window.addEventListener('adapt-text-changed', handleChange);
    window.addEventListener('seasonal-settings-changed', handleChange);
    window.addEventListener('storage', handleChange);
    window.addEventListener('theme-changed', handleChange);
    
    return () => {
      window.removeEventListener('adapt-text-changed', handleChange);
      window.removeEventListener('seasonal-settings-changed', handleChange);
      window.removeEventListener('storage', handleChange);
      window.removeEventListener('theme-changed', handleChange);
    };
  }, []);

  // Only apply when enabled AND has custom background
  if (!enabled || !hasBackground) return null;

  // Shadow color based on theme - dark shadow for dark theme, light shadow for light/solarized
  const shadowColor = isDarkTheme ? '0, 0, 0' : '255, 255, 255';
  const shadowColorStrong = isDarkTheme ? 'rgba(0, 0, 0,' : 'rgba(255, 255, 255,';

  return (
    <style jsx global>{`
      /* Adapt text for custom background visibility */
      /* Strong text shadow/outline for maximum contrast */
      /* Theme-aware: ${isDarkTheme ? 'dark' : 'light'} mode */
      
      body,
      p, span, div,
      h1, h2, h3, h4, h5, h6,
      a, label,
      .text-\\[var\\(--text-primary\\)\\],
      .text-\\[var\\(--text-secondary\\)\\],
      .text-\\[var\\(--text-muted\\)\\] {
        text-shadow: 
          -1px -1px 0 ${shadowColorStrong} 0.8),
          1px -1px 0 ${shadowColorStrong} 0.8),
          -1px 1px 0 ${shadowColorStrong} 0.8),
          1px 1px 0 ${shadowColorStrong} 0.8),
          0 0 8px ${shadowColorStrong} 0.9),
          0 0 16px ${shadowColorStrong} 0.5);
      }

      /* Even stronger for headings and important text */
      h1, h2, h3, h4, h5, h6,
      .font-bold,
      .font-semibold,
      .font-medium {
        text-shadow: 
          -2px -2px 0 ${shadowColorStrong} 0.9),
          2px -2px 0 ${shadowColorStrong} 0.9),
          -2px 2px 0 ${shadowColorStrong} 0.9),
          2px 2px 0 ${shadowColorStrong} 0.9),
          0 0 10px ${shadowColorStrong} 1),
          0 0 20px ${shadowColorStrong} 0.7);
      }

      /* Gradient text - use filter for outline effect */
      .gradient-text {
        filter: drop-shadow(-1px -1px 0 ${shadowColorStrong}0.9)) 
                drop-shadow(1px -1px 0 ${shadowColorStrong}0.9)) 
                drop-shadow(-1px 1px 0 ${shadowColorStrong}0.9)) 
                drop-shadow(1px 1px 0 ${shadowColorStrong}0.9))
                drop-shadow(0 0 8px ${shadowColorStrong}0.8));
      }

      /* Muted text needs extra help */
      .text-\\[var\\(--text-muted\\)\\],
      .text-xs,
      .text-\\[10px\\],
      .text-\\[11px\\] {
        text-shadow: 
          -1px -1px 0 ${shadowColorStrong} 0.9),
          1px -1px 0 ${shadowColorStrong} 0.9),
          -1px 1px 0 ${shadowColorStrong} 0.9),
          1px 1px 0 ${shadowColorStrong} 0.9),
          0 0 6px ${shadowColorStrong} 1);
      }

      /* Buttons */
      button {
        text-shadow: 
          0 1px 2px ${shadowColorStrong} 0.5),
          0 0 4px ${shadowColorStrong} 0.3);
      }

      /* Exclude inputs, code, and elements that shouldn't have shadow */
      input, textarea, code, pre, select,
      input *, textarea *, select * {
        text-shadow: none !important;
        filter: none !important;
      }
    `}</style>
  );
}

export default AdaptText;
