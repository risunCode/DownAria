'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { getSeasonalSettings, loadBackgroundFromDB, SeasonType, SeasonalSettings } from '@/lib/storage/seasonal';
import { getSettings } from '@/lib/storage/settings';

// ═══════════════════════════════════════════════════════════════
// PARTICLE CONFIGURATIONS - OPTIMIZED & CHILL
// ═══════════════════════════════════════════════════════════════

interface ParticleConfig {
  count: number;
  emoji: string[];
  duration: { min: number; max: number }; // seconds to fall
  size: { min: number; max: number };
  opacity: { min: number; max: number };
  swing: number;
  rotate: boolean;
}

const PARTICLE_CONFIGS: Record<SeasonType, ParticleConfig> = {
  winter: {
    count: 30,
    emoji: ['❄️', '❄', '✧', '·'],
    duration: { min: 8, max: 15 },
    size: { min: 10, max: 22 },
    opacity: { min: 0.4, max: 0.9 },
    swing: 40,
    rotate: true,
  },
  spring: {
    count: 25,
    emoji: ['🌸', '🌺', '✿', '❀'],
    duration: { min: 10, max: 18 },
    size: { min: 14, max: 26 },
    opacity: { min: 0.5, max: 0.85 },
    swing: 60,
    rotate: true,
  },
  autumn: {
    count: 28,
    emoji: ['🍂', '🍁', '🍃'],
    duration: { min: 8, max: 14 },
    size: { min: 16, max: 30 },
    opacity: { min: 0.6, max: 0.95 },
    swing: 80,
    rotate: true,
  },
  off: {
    count: 0,
    emoji: [],
    duration: { min: 0, max: 0 },
    size: { min: 0, max: 0 },
    opacity: { min: 0, max: 0 },
    swing: 0,
    rotate: false,
  },
};

// ═══════════════════════════════════════════════════════════════
// CSS-ONLY PARTICLES (NO JS ANIMATION LOOP = LOW MEMORY)
// ═══════════════════════════════════════════════════════════════

interface ParticleData {
  id: number;
  emoji: string;
  size: number;
  opacity: number;
  left: number;
  duration: number;
  delay: number;
  swing: number;
  rotate: boolean;
}

function generateParticles(config: ParticleConfig): ParticleData[] {
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;
  
  return Array.from({ length: config.count }, (_, i) => ({
    id: i,
    emoji: config.emoji[Math.floor(Math.random() * config.emoji.length)],
    size: rand(config.size.min, config.size.max),
    opacity: rand(config.opacity.min, config.opacity.max),
    left: Math.random() * 100,
    duration: rand(config.duration.min, config.duration.max),
    delay: Math.random() * -20, // Stagger start times
    swing: rand(-config.swing, config.swing),
    rotate: config.rotate,
  }));
}

// ═══════════════════════════════════════════════════════════════
// BACKGROUND COMPONENT - MEMORY OPTIMIZED
// ═══════════════════════════════════════════════════════════════

/**
 * Memory-optimized background renderer
 * 
 * Optimizations:
 * 1. Single blob URL - reused, not recreated
 * 2. GPU acceleration via will-change and transform
 * 3. Video: preload="none" until visible, low buffer
 * 4. Pause video when tab not visible (Page Visibility API)
 * 5. Use CSS containment for paint isolation
 */
function Background({ settings, backgroundUrl }: { settings: SeasonalSettings; backgroundUrl: string }) {
  const bg = settings.customBackground;
  const [isVisible, setIsVisible] = useState(true);
  const [allowSound, setAllowSound] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Load sound setting
  useEffect(() => {
    const appSettings = getSettings();
    setAllowSound(appSettings.allowVideoSound || false);
    
    // Listen for sound setting changes
    const handleSoundChange = (e: CustomEvent<{ enabled: boolean }>) => {
      setAllowSound(e.detail.enabled);
      if (videoRef.current) {
        videoRef.current.muted = !e.detail.enabled;
      }
    };
    
    window.addEventListener('wallpaper-sound-changed', handleSoundChange as EventListener);
    return () => window.removeEventListener('wallpaper-sound-changed', handleSoundChange as EventListener);
  }, []);
  
  // Pause video when tab is not visible (saves memory & CPU)
  useEffect(() => {
    const handleVisibility = () => {
      setIsVisible(document.visibilityState === 'visible');
    };
    
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
  
  // Handle video play/pause based on visibility
  useEffect(() => {
    if (videoRef.current) {
      if (isVisible) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isVisible]);
  
  if (!bg) return null;

  const opacity = (settings.backgroundOpacity || 20) / 100;
  const blur = settings.backgroundBlur ? `blur(${settings.backgroundBlur}px)` : undefined;
  const isGif = bg.mimeType === 'image/gif';
  
  // Common optimized styles
  const optimizedStyles: React.CSSProperties = {
    zIndex: 0,
    opacity,
    filter: blur,
    objectPosition: `${bg.position.x}% ${bg.position.y}%`,
    // GPU acceleration
    willChange: 'transform',
    transform: 'translateZ(0)',
    // Paint containment - isolates repaints
    contain: 'paint',
  };

  // Video background
  if (bg.type === 'video' && !isGif) {
    return (
      <video
        ref={videoRef}
        src={backgroundUrl}
        autoPlay={isVisible}
        loop
        muted={!allowSound}
        playsInline
        // Memory optimizations
        preload="metadata" // Don't preload full video
        disablePictureInPicture
        disableRemotePlayback
        className="fixed inset-0 w-full h-full object-cover pointer-events-none"
        style={optimizedStyles}
      />
    );
  }
  
  // GIF background (uses img tag, loops automatically)
  if (isGif) {
    return (
      <img
        src={backgroundUrl}
        alt=""
        loading="eager"
        decoding="async"
        className="fixed inset-0 w-full h-full object-cover pointer-events-none"
        style={optimizedStyles}
      />
    );
  }

  // Static image - use CSS background for better caching
  return (
    <div 
      className="fixed inset-0 bg-cover bg-no-repeat pointer-events-none"
      style={{
        ...optimizedStyles,
        backgroundImage: `url(${backgroundUrl})`,
        backgroundPosition: `${bg.position.x}% ${bg.position.y}%`,
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function SeasonalEffects() {
  const [settings, setSettings] = useState<SeasonalSettings | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const previousUrlRef = useRef<string | null>(null);

  // Cleanup blob URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current);
      }
    };
  }, []);

  // Detect modal/sheet open state by watching DOM
  useEffect(() => {
    const checkForModals = () => {
      // Check for common modal indicators
      const hasModal = !!(
        document.querySelector('[role="dialog"]') ||
        document.querySelector('[data-radix-dialog-content]') ||
        document.querySelector('.swal2-container') ||
        document.querySelector('[class*="modal"]') ||
        document.querySelector('[class*="sheet"]') ||
        document.body.style.overflow === 'hidden'
      );
      setIsModalOpen(hasModal);
    };

    // Initial check
    checkForModals();

    // Watch for DOM changes
    const observer = new MutationObserver(checkForModals);
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    return () => observer.disconnect();
  }, []);

  // Generate particles (memoized, doesn't change with modal state)
  const particles = useMemo(() => {
    if (!settings || settings.season === 'off') return [];
    return generateParticles(PARTICLE_CONFIGS[settings.season]);
  }, [settings?.season]);

  // Load settings
  useEffect(() => {
    const load = async () => {
      const s = getSeasonalSettings();
      setSettings(s);
      
      // Always try to load background from IndexedDB
      if (s.customBackground) {
        try {
          const url = await loadBackgroundFromDB();
          if (url) {
            // Revoke previous URL to free memory
            if (previousUrlRef.current && previousUrlRef.current !== url) {
              URL.revokeObjectURL(previousUrlRef.current);
            }
            previousUrlRef.current = url;
            setBackgroundUrl(url);
          } else {
            setBackgroundUrl(null);
          }
        } catch (err) {
          console.error('Failed to load background:', err);
          setBackgroundUrl(null);
        }
      } else {
        // Clear background and revoke URL
        if (previousUrlRef.current) {
          URL.revokeObjectURL(previousUrlRef.current);
          previousUrlRef.current = null;
        }
        setBackgroundUrl(null);
      }
    };
    load();
    
    // Also reload when seasonal settings change (same tab)
    const handleSeasonalChange = () => load();
    window.addEventListener('seasonal-settings-changed', handleSeasonalChange);
    
    return () => {
      window.removeEventListener('seasonal-settings-changed', handleSeasonalChange);
    };
  }, []);

  // Listen for settings changes
  useEffect(() => {
    const handleStorage = async (e: StorageEvent) => {
      if (e.key === 'downaria_seasonal') {
        const s = getSeasonalSettings();
        setSettings(s);
        
        if (s.customBackground) {
          const url = await loadBackgroundFromDB();
          setBackgroundUrl(url);
        } else {
          setBackgroundUrl(null);
        }
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (!settings || (settings.season === 'off' && !settings.customBackground)) return null;

  // Determine if particles should show (hide when modal is open)
  const showParticles = !isModalOpen && 
    settings.season !== 'off' && 
    (!settings.customBackground || settings.particlesWithBackground);

  // Card opacity from settings (default 75% when custom background is set - best for readability)
  const cardOpacity = settings.customBackground ? (settings.cardOpacity ?? 75) / 100 : 1;

  return (
    <>
      {/* Custom Background - behind everything */}
      {settings.customBackground && backgroundUrl && (
        <Background settings={settings} backgroundUrl={backgroundUrl} />
      )}
      
      {/* Card Opacity CSS - applies to glass-card elements when background is set */}
      {settings.customBackground && (
        <style jsx global>{`
          /* Apply card opacity to glass-card elements */
          .glass-card {
            background-color: rgba(var(--bg-card-rgb, 255, 255, 255), ${cardOpacity}) !important;
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
          }
          
          /* Also apply to bg-secondary elements for consistency */
          .bg-\\[var\\(--bg-secondary\\)\\] {
            background-color: rgba(var(--bg-card-rgb, 255, 255, 255), ${cardOpacity * 0.9}) !important;
          }
        `}</style>
      )}
      
      {/* CSS-Only Particles - BEHIND content, slightly transparent */}
      {showParticles && particles.length > 0 && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-50" style={{ zIndex: 1 }}>
          {particles.map((p) => (
            <div
              key={p.id}
              className="absolute animate-fall"
              style={{
                left: `${p.left}%`,
                fontSize: `${p.size}px`,
                opacity: p.opacity,
                animationDuration: `${p.duration}s`,
                animationDelay: `${p.delay}s`,
                '--swing': `${p.swing}px`,
                '--rotate': p.rotate ? '360deg' : '0deg',
              } as React.CSSProperties}
            >
              {p.emoji}
            </div>
          ))}
          
          {/* CSS Animation - runs on GPU, no JS needed */}
          <style jsx global>{`
            @keyframes fall {
              0% {
                transform: translateY(-5vh) translateX(0) rotate(0deg);
              }
              25% {
                transform: translateY(25vh) translateX(var(--swing)) rotate(calc(var(--rotate) * 0.25));
              }
              50% {
                transform: translateY(50vh) translateX(calc(var(--swing) * -0.5)) rotate(calc(var(--rotate) * 0.5));
              }
              75% {
                transform: translateY(75vh) translateX(var(--swing)) rotate(calc(var(--rotate) * 0.75));
              }
              100% {
                transform: translateY(105vh) translateX(0) rotate(var(--rotate));
              }
            }
            
            .animate-fall {
              animation: fall linear infinite;
              will-change: transform;
            }
          `}</style>
        </div>
      )}
    </>
  );
}

export default SeasonalEffects;
