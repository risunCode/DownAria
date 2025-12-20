/**
 * Hooks - Barrel Export
 * 
 * Public hooks for client-side data fetching with SWR caching
 */

// Status & Platform
export { useStatus } from './useStatus';

// Announcements
export { useAnnouncements } from './useAnnouncements';

// Cookie Status (for settings page)
export { useCookieStatus } from './useCookieStatus';

// Playground (guest API)
export { usePlayground } from './usePlayground';

// Update Prompt (service worker)
export { useUpdatePrompt } from './useUpdatePrompt';
