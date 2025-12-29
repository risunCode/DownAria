/**
 * Seasonal Theme Storage
 * ================================
 * Manages seasonal effects (particles) and custom backgrounds
 * 
 * Seasons:
 * - Winter (Dec-Feb): ❄️ Snow particles
 * - Spring (Mar-May): 🌸 Cherry blossoms
 * - Summer (Jun-Aug): ✨ Fireflies/sparkles
 * - Autumn (Sep-Nov): 🍂 Falling leaves
 * 
 * Background Storage:
 * - IndexedDB for large files (up to 25MB)
 * - Supports images and videos
 */

export type SeasonType = 'winter' | 'spring' | 'autumn' | 'off';

// All active seasons (excluding 'off')
export const ACTIVE_SEASONS: SeasonType[] = ['winter', 'spring', 'autumn'];

export type BackgroundType = 'image' | 'video';

export interface BackgroundPosition {
  x: number; // 0-100 (percentage)
  y: number; // 0-100 (percentage)
  scale: number; // 0.5-2 (zoom level)
}

export interface CustomBackground {
  type: BackgroundType;
  data: string; // blob URL or data URL
  mimeType: string;
  size: number; // bytes
  position: BackgroundPosition;
}

export interface SeasonalSettings {
  /** Current season mode: auto, random, specific season, or off */
  mode: 'auto' | 'random' | SeasonType;
  /** Resolved season (computed from mode) */
  season: SeasonType;
  /** Custom background metadata (actual data in IndexedDB) */
  customBackground: CustomBackground | null;
  /** Enable particles with custom background */
  particlesWithBackground: boolean;
  /** Particle intensity: 0-100 */
  intensity: number;
  /** Background opacity: 0-100 */
  backgroundOpacity: number;
  /** Card opacity: 0-100 */
  cardOpacity: number;
  /** Background blur: 0-20 */
  backgroundBlur: number;
  /** Random mode rotation interval in seconds (default: 30) */
  randomInterval: number;
}

const SEASONAL_KEY = 'downaria_seasonal';
const SEASONAL_DB_NAME = 'downaria_seasonal_db';
const SEASONAL_STORE_NAME = 'backgrounds';
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

const DEFAULT_POSITION: BackgroundPosition = { x: 50, y: 50, scale: 1 };

const DEFAULT_SETTINGS: SeasonalSettings = {
  mode: 'auto',
  season: 'off',
  customBackground: null,
  particlesWithBackground: true,
  intensity: 50,
  backgroundOpacity: 20,
  cardOpacity: 85,
  backgroundBlur: 0,
  randomInterval: 30, // 30 seconds default
};

// ═══════════════════════════════════════════════════════════════
// INDEXEDDB FOR LARGE BACKGROUNDS
// ═══════════════════════════════════════════════════════════════

let dbInstance: IDBDatabase | null = null;

async function openSeasonalDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SEASONAL_DB_NAME, 1);
    
    request.onerror = () => reject(new Error('Failed to open seasonal database'));
    
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(SEASONAL_STORE_NAME)) {
        db.createObjectStore(SEASONAL_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Save background blob to IndexedDB
 */
export async function saveBackgroundBlob(blob: Blob): Promise<void> {
  const db = await openSeasonalDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SEASONAL_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(SEASONAL_STORE_NAME);
    
    const request = store.put({ id: 'background', blob });
    request.onsuccess = () => {
      // Notify components that background changed
      window.dispatchEvent(new CustomEvent('seasonal-settings-changed'));
      resolve();
    };
    request.onerror = () => reject(new Error('Failed to save background'));
  });
}

/**
 * Get background blob from IndexedDB
 */
export async function getBackgroundBlob(): Promise<Blob | null> {
  try {
    const db = await openSeasonalDB();
    
    return new Promise((resolve) => {
      const transaction = db.transaction([SEASONAL_STORE_NAME], 'readonly');
      const store = transaction.objectStore(SEASONAL_STORE_NAME);
      
      const request = store.get('background');
      request.onsuccess = () => {
        const result = request.result;
        resolve(result?.blob || null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Delete background blob from IndexedDB
 */
export async function deleteBackgroundBlob(): Promise<void> {
  try {
    const db = await openSeasonalDB();
    
    return new Promise((resolve) => {
      const transaction = db.transaction([SEASONAL_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(SEASONAL_STORE_NAME);
      
      const request = store.delete('background');
      request.onsuccess = () => {
        // Notify components that background changed
        window.dispatchEvent(new CustomEvent('seasonal-settings-changed'));
        resolve();
      };
      request.onerror = () => resolve();
    });
  } catch {
    // Ignore errors
  }
}

// ═══════════════════════════════════════════════════════════════
// SEASON DETECTION
// ═══════════════════════════════════════════════════════════════

/**
 * Get current season based on month (Northern Hemisphere)
 * Note: Summer removed - maps to spring instead
 */
export function getCurrentSeason(): SeasonType {
  const month = new Date().getMonth(); // 0-11
  
  // Winter: December (11), January (0), February (1)
  if (month === 11 || month === 0 || month === 1) return 'winter';
  
  // Spring: March (2), April (3), May (4), June (5), July (6), August (7)
  if (month >= 2 && month <= 7) return 'spring';
  
  // Autumn: September (8), October (9), November (10)
  return 'autumn';
}

/**
 * Get a random season from active seasons
 */
export function getRandomSeason(): SeasonType {
  const randomIndex = Math.floor(Math.random() * ACTIVE_SEASONS.length);
  return ACTIVE_SEASONS[randomIndex];
}

// Random mode state
let randomModeInterval: ReturnType<typeof setInterval> | null = null;
let currentRandomSeason: SeasonType = getRandomSeason();

/**
 * Start random season rotation
 */
export function startRandomRotation(intervalSeconds: number = 30): void {
  stopRandomRotation();
  
  // Set initial random season
  currentRandomSeason = getRandomSeason();
  
  // Start rotation interval
  randomModeInterval = setInterval(() => {
    // Get next season (different from current)
    let nextSeason: SeasonType;
    do {
      nextSeason = getRandomSeason();
    } while (nextSeason === currentRandomSeason && ACTIVE_SEASONS.length > 1);
    
    currentRandomSeason = nextSeason;
    
    // Dispatch event to update UI
    window.dispatchEvent(new CustomEvent('seasonal-random-change', { 
      detail: { season: currentRandomSeason } 
    }));
  }, intervalSeconds * 1000);
}

/**
 * Stop random season rotation
 */
export function stopRandomRotation(): void {
  if (randomModeInterval) {
    clearInterval(randomModeInterval);
    randomModeInterval = null;
  }
}

/**
 * Get current random season (for random mode)
 */
export function getCurrentRandomSeason(): SeasonType {
  return currentRandomSeason;
}

/**
 * Get season emoji for display
 */
export function getSeasonEmoji(season: SeasonType): string {
  switch (season) {
    case 'winter': return '❄️';
    case 'spring': return '🌸';
    case 'autumn': return '🍂';
    default: return '🌙';
  }
}

/**
 * Get season display name
 */
export function getSeasonName(season: SeasonType): string {
  switch (season) {
    case 'winter': return 'Winter';
    case 'spring': return 'Spring';
    case 'autumn': return 'Autumn';
    default: return 'Off';
  }
}

/**
 * Toggle particles with custom background
 */
export function setParticlesWithBackground(enabled: boolean): void {
  saveSeasonalSettings({ particlesWithBackground: enabled });
}

// ═══════════════════════════════════════════════════════════════
// STORAGE FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Get seasonal settings from localStorage
 */
export function getSeasonalSettings(): SeasonalSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_SETTINGS, season: getCurrentSeason() };
  }

  try {
    const saved = localStorage.getItem(SEASONAL_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<SeasonalSettings>;
      const settings = { ...DEFAULT_SETTINGS, ...parsed };
      
      // Resolve season based on mode
      if (settings.mode === 'auto') {
        settings.season = getCurrentSeason();
      } else if (settings.mode === 'random') {
        settings.season = getCurrentRandomSeason();
      } else if (settings.mode === 'off') {
        settings.season = 'off';
      } else {
        settings.season = settings.mode;
      }
      
      return settings;
    }
  } catch {
    // Ignore parse errors
  }

  // Default: auto mode with current season
  return { ...DEFAULT_SETTINGS, season: getCurrentSeason() };
}

/**
 * Save seasonal settings to localStorage
 */
export function saveSeasonalSettings(settings: Partial<SeasonalSettings>): void {
  if (typeof window === 'undefined') return;

  const current = getSeasonalSettings();
  const updated = { ...current, ...settings };
  
  // Handle mode changes
  if (settings.mode !== undefined) {
    // Stop random rotation if switching away from random
    if (current.mode === 'random' && settings.mode !== 'random') {
      stopRandomRotation();
    }
    
    // Start random rotation if switching to random
    if (settings.mode === 'random' && current.mode !== 'random') {
      startRandomRotation(updated.randomInterval);
    }
  }
  
  // Resolve season based on mode
  if (updated.mode === 'auto') {
    updated.season = getCurrentSeason();
  } else if (updated.mode === 'random') {
    updated.season = getCurrentRandomSeason();
  } else if (updated.mode === 'off') {
    updated.season = 'off';
  } else {
    updated.season = updated.mode;
  }
  
  localStorage.setItem(SEASONAL_KEY, JSON.stringify(updated));
  
  // Dispatch storage event for other tabs
  window.dispatchEvent(new StorageEvent('storage', {
    key: SEASONAL_KEY,
    newValue: JSON.stringify(updated),
  }));
  
  // Dispatch custom event for same tab
  window.dispatchEvent(new CustomEvent('seasonal-settings-changed'));
}

/**
 * Set seasonal mode
 */
export function setSeasonalMode(mode: 'auto' | 'random' | SeasonType): void {
  saveSeasonalSettings({ mode });
}

/**
 * Set random rotation interval (in seconds)
 */
export function setRandomInterval(seconds: number): void {
  const clamped = Math.max(5, Math.min(300, seconds)); // 5s to 5min
  saveSeasonalSettings({ randomInterval: clamped });
  
  // Restart rotation if in random mode
  const settings = getSeasonalSettings();
  if (settings.mode === 'random') {
    startRandomRotation(clamped);
  }
}

/**
 * Set custom background image
 * @param imageUrl - Data URL or external URL, null to remove
 */
export function setCustomBackground(background: CustomBackground | null): void {
  saveSeasonalSettings({ customBackground: background });
}

/**
 * Update background position
 */
export function setBackgroundPosition(position: Partial<BackgroundPosition>): void {
  const current = getSeasonalSettings();
  if (current.customBackground) {
    saveSeasonalSettings({
      customBackground: {
        ...current.customBackground,
        position: { ...current.customBackground.position, ...position },
      },
    });
  }
}

/**
 * Set background opacity (0-100)
 */
export function setBackgroundOpacity(opacity: number): void {
  saveSeasonalSettings({ backgroundOpacity: Math.max(0, Math.min(100, opacity)) });
}

/**
 * Set background blur (0-20)
 */
export function setBackgroundBlur(blur: number): void {
  saveSeasonalSettings({ backgroundBlur: Math.max(0, Math.min(20, blur)) });
}

/**
 * Set card opacity (0-100)
 */
export function setCardOpacity(opacity: number): void {
  saveSeasonalSettings({ cardOpacity: Math.max(0, Math.min(100, opacity)) });
}

/**
 * Set particle intensity (0-100)
 */
export function setParticleIntensity(intensity: number): void {
  saveSeasonalSettings({ intensity: Math.max(0, Math.min(100, intensity)) });
}

/**
 * Reset seasonal settings to defaults
 */
export function resetSeasonalSettings(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SEASONAL_KEY);
}

// ═══════════════════════════════════════════════════════════════
// BACKGROUND FILE HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Allowed MIME types for background files (strict whitelist)
 * Prevents potentially dangerous file types like SVG (can contain scripts)
 */
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png', 
  'image/gif',
  'image/webp',
  // Videos
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  'video/x-matroska', // .mkv
  'video/x-m4v', // .m4v
] as const;

/**
 * Magic bytes signatures for file type validation
 * More secure than relying on file.type which can be spoofed
 */
const FILE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], // GIF87a, GIF89a
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF (WebP starts with RIFF)
  'video/mp4': [[0x00, 0x00, 0x00], [0x66, 0x74, 0x79, 0x70]], // ftyp or starts with 00 00 00
  'video/webm': [[0x1A, 0x45, 0xDF, 0xA3]], // EBML
  'video/quicktime': [[0x00, 0x00, 0x00]], // MOV also uses ftyp
  'video/x-msvideo': [[0x52, 0x49, 0x46, 0x46]], // RIFF (AVI)
  'video/x-matroska': [[0x1A, 0x45, 0xDF, 0xA3]], // EBML (same as WebM)
  'video/x-m4v': [[0x00, 0x00, 0x00]], // Similar to MP4
};

/**
 * Validate file by checking magic bytes (first few bytes of file)
 * More secure than trusting file.type
 */
async function validateFileMagicBytes(file: File): Promise<boolean> {
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  // Check against known signatures
  for (const signatures of Object.values(FILE_SIGNATURES)) {
    for (const sig of signatures) {
      let match = true;
      for (let i = 0; i < sig.length && i < bytes.length; i++) {
        if (bytes[i] !== sig[i]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
  }
  
  return false;
}

/**
 * Process and save background file (image, video, or GIF)
 * Stores in IndexedDB for large files (up to 200MB)
 * 
 * Security:
 * - Strict MIME type whitelist (no SVG, no HTML)
 * - Magic bytes validation
 * - Size limits
 */
export async function processBackgroundFile(file: File): Promise<CustomBackground> {
  // 1. Validate MIME type (strict whitelist)
  if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
    throw new Error(`Invalid file type: ${file.type}. Allowed: JPEG, PNG, GIF, WebP, MP4, WebM, MOV, AVI, MKV, M4V`);
  }
  
  // 2. Validate file size (max 200MB)
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  
  // 3. Validate magic bytes (prevent spoofed file types)
  const validMagic = await validateFileMagicBytes(file);
  if (!validMagic) {
    throw new Error('File content does not match its type. File may be corrupted or spoofed.');
  }
  
  // 4. Save blob to IndexedDB
  await saveBackgroundBlob(file);
  
  // 5. Create blob URL for display
  const blobUrl = URL.createObjectURL(file);
  
  // Determine type (GIF treated as video for looping)
  const isVideo = file.type.startsWith('video/');
  const isGif = file.type === 'image/gif';
  
  const background: CustomBackground = {
    type: isVideo || isGif ? 'video' : 'image',
    data: blobUrl,
    mimeType: file.type,
    size: file.size,
    position: { ...DEFAULT_POSITION },
  };
  
  return background;
}

/**
 * Load background from IndexedDB and create blob URL
 */
export async function loadBackgroundFromDB(): Promise<string | null> {
  const blob = await getBackgroundBlob();
  if (!blob) return null;
  return URL.createObjectURL(blob);
}

/**
 * Clear custom background (both settings and IndexedDB)
 */
export async function clearCustomBackground(): Promise<void> {
  await deleteBackgroundBlob();
  setCustomBackground(null);
}

/**
 * Convert File to data URL for storage (legacy, for small files)
 */
export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      reject(new Error('File must be an image'));
      return;
    }
    
    // Validate file size (max 2MB for data URL)
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error('Image must be less than 2MB'));
      return;
    }
    
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validate external image URL
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// REACT HOOK FOR SEASONAL SETTINGS
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

export interface UseSeasonalSettingsReturn {
  settings: SeasonalSettings;
  isLoading: boolean;
  backgroundUrl: string | null;
  updateSettings: (updates: Partial<SeasonalSettings>) => void;
  refreshSettings: () => Promise<void>;
}

/**
 * React hook for managing seasonal settings with proper loading state.
 * Prevents UI blinking by tracking loading state while fetching from
 * localStorage and IndexedDB.
 */
export function useSeasonalSettings(): UseSeasonalSettingsReturn {
  const [settings, setSettings] = useState<SeasonalSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);

  /**
   * Load settings from localStorage and background blob from IndexedDB
   */
  const loadSettings = useCallback(async () => {
    try {
      // Load settings from localStorage
      const loadedSettings = getSeasonalSettings();
      setSettings(loadedSettings);

      // If there's a custom background, load the blob from IndexedDB
      if (loadedSettings.customBackground) {
        const blobUrl = await loadBackgroundFromDB();
        if (blobUrl) {
          // Revoke old URL if exists to prevent memory leaks
          if (backgroundUrl) {
            URL.revokeObjectURL(backgroundUrl);
          }
          setBackgroundUrl(blobUrl);
        } else {
          setBackgroundUrl(null);
        }
      } else {
        // No custom background, clear any existing URL
        if (backgroundUrl) {
          URL.revokeObjectURL(backgroundUrl);
        }
        setBackgroundUrl(null);
      }
    } catch (error) {
      console.error('Failed to load seasonal settings:', error);
      // Fall back to defaults on error
      setSettings(DEFAULT_SETTINGS);
      setBackgroundUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Refresh settings (can be called manually)
   */
  const refreshSettings = useCallback(async () => {
    setIsLoading(true);
    await loadSettings();
  }, [loadSettings]);

  /**
   * Update settings and persist to storage
   */
  const updateSettings = useCallback((updates: Partial<SeasonalSettings>) => {
    saveSeasonalSettings(updates);
    // Settings will be refreshed via the event listener
  }, []);

  // Initial load
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Listen for settings changes (from other tabs or same tab)
  useEffect(() => {
    const handleSettingsChange = () => {
      loadSettings();
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === SEASONAL_KEY) {
        loadSettings();
      }
    };

    const handleRandomChange = (event: CustomEvent<{ season: SeasonType }>) => {
      setSettings(prev => ({
        ...prev,
        season: event.detail.season,
      }));
    };

    // Listen for custom events (same tab)
    window.addEventListener('seasonal-settings-changed', handleSettingsChange);
    // Listen for storage events (other tabs)
    window.addEventListener('storage', handleStorageChange);
    // Listen for random season changes
    window.addEventListener('seasonal-random-change', handleRandomChange as EventListener);

    return () => {
      window.removeEventListener('seasonal-settings-changed', handleSettingsChange);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('seasonal-random-change', handleRandomChange as EventListener);
      
      // Cleanup blob URL on unmount
      if (backgroundUrl) {
        URL.revokeObjectURL(backgroundUrl);
      }
    };
  }, [loadSettings, backgroundUrl]);

  return {
    settings,
    isLoading,
    backgroundUrl,
    updateSettings,
    refreshSettings,
  };
}
