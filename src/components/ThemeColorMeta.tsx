'use client';

import { useEffect } from 'react';
import { getResolvedTheme, type ResolvedTheme } from '@/lib/storage/settings';

const THEME_COLORS: Record<ResolvedTheme, string> = {
  dark: '#0d1117',
  light: '#ffffff',
  solarized: '#fdf6e3',
};

function updateThemeColorMeta(theme: ResolvedTheme): void {
  const color = THEME_COLORS[theme];
  let meta = document.querySelector('meta[name="theme-color"]');
  
  if (meta) {
    meta.setAttribute('content', color);
  } else {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', color);
    document.head.appendChild(meta);
  }
}

export function ThemeColorMeta() {
  useEffect(() => {
    // Set initial theme color based on resolved theme
    const initialTheme = getResolvedTheme();
    updateThemeColorMeta(initialTheme);

    // Listen for theme changes
    const handleThemeChange = (event: CustomEvent<{ theme: string; resolved?: ResolvedTheme }>) => {
      const resolved = event.detail.resolved ?? getResolvedTheme();
      updateThemeColorMeta(resolved);
    };

    window.addEventListener('theme-changed', handleThemeChange as EventListener);

    return () => {
      window.removeEventListener('theme-changed', handleThemeChange as EventListener);
    };
  }, []);

  return null;
}
