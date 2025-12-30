'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Snowflake, Flower2, Sun, Leaf, Image, Trash2, Loader2, Video, Move, ZoomIn, ZoomOut, X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  SeasonType,
  SeasonalSettings as SeasonalSettingsType,
  BackgroundPosition,
  getSeasonalSettings,
  saveSeasonalSettings,
  setCustomBackground,
  setBackgroundOpacity,
  setBackgroundBlur,
  setParticlesWithBackground,
  setRandomInterval,
  processBackgroundFile,
  loadBackgroundFromDB,
  clearCustomBackground,
  getCurrentSeason,
  getSeasonEmoji,
  getSeasonName,
  formatFileSize,
  startRandomRotation,
  stopRandomRotation,
} from '@/lib/storage';
import { getUnifiedSettings } from '@/lib/storage';
import Swal from 'sweetalert2';

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const SEASON_OPTIONS: { id: SeasonType | 'auto' | 'random'; label: string; icon: typeof Snowflake; emoji: string }[] = [
  { id: 'auto', label: 'Auto', icon: Sun, emoji: '🔄' },
  { id: 'random', label: 'Random', icon: Sun, emoji: '🎲' },
  { id: 'winter', label: 'Winter', icon: Snowflake, emoji: '❄️' },
  { id: 'spring', label: 'Spring', icon: Flower2, emoji: '🌸' },
  { id: 'autumn', label: 'Autumn', icon: Leaf, emoji: '🍂' },
  { id: 'off', label: 'Off', icon: Sun, emoji: '🌙' },
];

// ═══════════════════════════════════════════════════════════════
// BACKGROUND PREVIEW - RESPONSIVE MODAL/SHEET
// ═══════════════════════════════════════════════════════════════

interface BackgroundPreviewProps {
  file: File;
  onConfirm: (position: BackgroundPosition, wallpaperOpacity: number) => void;
  onCancel: () => void;
}

function BackgroundPreview({ file, onConfirm, onCancel }: BackgroundPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [position, setPosition] = useState<BackgroundPosition>({ x: 50, y: 50, scale: 1 });
  const [wallpaperOpacity, setWallpaperOpacity] = useState(8);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  const isVideo = file.type.startsWith('video/');
  const isGif = file.type === 'image/gif';
  const fileExt = file.name.split('.').pop()?.toUpperCase() || 'FILE';

  // Detect mobile and window size for preview
  useEffect(() => {
    const updateSize = () => {
      setIsMobile(window.innerWidth < 768);
      // Full viewport - background covers entire screen including sidebar
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Unified position update
  const updatePosition = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setPosition(prev => ({ ...prev, x, y }));
  };

  const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); updatePosition(e.clientX, e.clientY); };
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => { if (isDragging) updatePosition(e.clientX, e.clientY); };
  const handleTouchStart = (e: React.TouchEvent) => { setIsDragging(true); updatePosition(e.touches[0].clientX, e.touches[0].clientY); };
  const handleTouchEnd = () => setIsDragging(false);
  const handleTouchMove = (e: React.TouchEvent) => { if (isDragging) { updatePosition(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); } };

  if (!previewUrl) return null;

  // Shared content component
  const PreviewContent = () => (
    <>
      {/* Header - macOS style traffic lights */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors" title="Close" />
          <div className="w-3 h-3 rounded-full bg-yellow-500 opacity-50 cursor-not-allowed" />
          <div className="w-3 h-3 rounded-full bg-green-500 opacity-50 cursor-not-allowed" />
        </div>
        <button onClick={onCancel} className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] text-xs">
          <X className="w-3 h-3" />
          Hide
        </button>
      </div>

      {/* Title */}
      <div className="p-4 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center">
            {isVideo ? <Video className="w-5 h-5 text-purple-400" /> : <Image className="w-5 h-5 text-blue-400" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">{file.name}</p>
            <p className="text-xs text-[var(--text-muted)]">{fileExt} • {formatFileSize(file.size)}</p>
          </div>
        </div>
      </div>

      {/* Preview Area - Taller preview for better visibility */}
      <div className="px-4 py-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-[var(--text-muted)] font-medium">Preview (drag to set focus point)</p>
          {isMobile && (
            <button 
              onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
              className="text-[10px] text-[var(--accent-primary)] flex items-center gap-1"
            >
              {isPreviewExpanded ? '▼ Collapse' : '▶ Expand'}
            </button>
          )}
        </div>
        <div
          ref={containerRef}
          className={`relative w-full rounded-xl overflow-hidden bg-[var(--bg-primary)] cursor-move touch-none border border-[var(--border-color)] transition-all duration-200 ${
            isMobile && !isPreviewExpanded ? 'h-32' : 'h-48 md:h-56'
          }`}
          onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove}
        >
          {/* Background Media - Full cover like actual display */}
          {(isVideo && !isGif) ? (
            <video src={previewUrl} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: `${position.x}% ${position.y}%`, transform: `scale(${position.scale})`, opacity: wallpaperOpacity / 100 }} />
          ) : (
            <img src={previewUrl} alt="Preview" className="absolute inset-0 w-full h-full object-cover" draggable={false}
              style={{ objectPosition: `${position.x}% ${position.y}%`, transform: `scale(${position.scale})`, opacity: wallpaperOpacity / 100 }} />
          )}
          
          {/* Drag hint - top left */}
          <div className="absolute top-2 left-2 bg-black/60 px-2.5 py-1 rounded-full text-[10px] text-white flex items-center gap-1.5">
            <Move className="w-3 h-3" />Drag to focus point
          </div>
          
          {/* Position dot */}
          <div className="absolute w-3 h-3 bg-white rounded-full border-2 border-[var(--accent-primary)] shadow-lg pointer-events-none"
            style={{ left: `${position.x}%`, top: `${position.y}%`, transform: 'translate(-50%, -50%)' }} />
        </div>
      </div>

      {/* Customization */}
      <div className="px-4 pb-3 space-y-3">
        <p className="text-xs text-[var(--text-muted)] font-medium">Customization</p>
        
        {/* Zoom */}
        <div className="flex items-center gap-3">
          <ZoomOut className="w-4 h-4 text-[var(--text-muted)]" />
          <input type="range" min="50" max="200" value={position.scale * 100} onChange={e => setPosition(prev => ({ ...prev, scale: Number(e.target.value) / 100 }))} className="flex-1 accent-[var(--accent-primary)] h-1" />
          <ZoomIn className="w-4 h-4 text-[var(--text-muted)]" />
          <span className="text-xs text-[var(--text-muted)] w-10 text-right">{(position.scale * 100).toFixed(0)}%</span>
        </div>

        {/* Wallpaper Opacity - Default 8%, max 20% for modal */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--text-secondary)]">Wallpaper Opacity</span>
            <span className="text-xs text-[var(--text-muted)]">{wallpaperOpacity}%</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setWallpaperOpacity(8)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                wallpaperOpacity === 8
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]/80'
              }`}
            >
              8% ⭐
            </button>
            <button
              onClick={() => setWallpaperOpacity(prev => prev === 8 ? 12 : prev)}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                wallpaperOpacity !== 8
                  ? 'bg-[var(--accent-primary)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]/80'
              }`}
            >
              Custom
            </button>
          </div>
          {/* Slider only shows when Custom is selected - max 20% */}
          {wallpaperOpacity !== 8 && (
            <input 
              type="range" 
              min="5" 
              max="20" 
              value={wallpaperOpacity} 
              onChange={e => setWallpaperOpacity(Number(e.target.value))} 
              className="w-full accent-[var(--accent-primary)] h-1 mt-2" 
            />
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 p-4 border-t border-[var(--border-color)]">
        <Button variant="secondary" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button variant="primary" className="flex-1" onClick={() => onConfirm(position, wallpaperOpacity)}>Apply</Button>
      </div>
    </>
  );

  // Mobile: Bottom Sheet
  if (isMobile) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/60" onClick={onCancel}>
        <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="absolute bottom-0 left-0 right-0 bg-[var(--bg-card)] rounded-t-3xl max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-[var(--border-color)]" /></div>
          <PreviewContent />
        </motion.div>
      </motion.div>
    );
  }

  // Desktop: Centered Modal
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--bg-card)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <PreviewContent />
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function SeasonalSettings() {
  const [settings, setSettings] = useState<SeasonalSettingsType | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load settings and background
  useEffect(() => {
    const loadSettings = async () => {
      const s = getSeasonalSettings();
      setSettings(s);
      
      if (s.customBackground) {
        const url = await loadBackgroundFromDB();
        setBackgroundUrl(url);
      }
    };
    loadSettings();
  }, []);

  const handleModeChange = (mode: 'auto' | 'random' | SeasonType) => {
    saveSeasonalSettings({ mode });
    setSettings(getSeasonalSettings());
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate - accept images, videos, and GIFs
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const isGif = file.type === 'image/gif';
    
    if (!isImage && !isVideo) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid File',
        text: 'Please select an image, video, or GIF file',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        confirmButtonText: 'OK',
      });
      return;
    }
    
    // Check file size - 400MB if allowLargeBackground enabled, otherwise 200MB
    const settings = getUnifiedSettings();
    const maxSize = settings.allowLargeBackground ? 400 : 200;
    const maxSizeBytes = maxSize * 1024 * 1024;
    
    if (file.size > maxSizeBytes) {
      Swal.fire({
        icon: 'error',
        title: 'File Too Large',
        text: `Maximum file size is ${maxSize}MB${!settings.allowLargeBackground ? ' (enable Large Files in settings for 400MB)' : ''}`,
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        confirmButtonText: 'OK',
      });
      return;
    }
    
    // Warning for large files
    if (file.size > 50 * 1024 * 1024) {
      Swal.fire({
        icon: 'warning',
        title: 'Large File Warning',
        html: `<p>This file is <strong>${formatFileSize(file.size)}</strong></p><p class="text-sm mt-2 text-amber-400">Large files may cause lag on slower devices.</p>`,
        showCancelButton: true,
        confirmButtonText: 'Continue Anyway',
        cancelButtonText: 'Cancel',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
      }).then((result) => {
        if (result.isConfirmed) {
          setPreviewFile(file);
        }
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    
    // GIF is treated as video for looping purposes
    if (isGif) {
      // GIFs work as images but loop automatically
    }
    
    // Show preview
    setPreviewFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmBackground = async (position: BackgroundPosition, wallpaperOpacity: number) => {
    if (!previewFile) return;
    
    setIsUploading(true);
    setPreviewFile(null);
    
    try {
      const background = await processBackgroundFile(previewFile);
      background.position = position;
      
      setCustomBackground(background);
      setBackgroundOpacity(wallpaperOpacity);
      // Blur is set to 0 by default, can be adjusted in settings page
      setBackgroundBlur(0);
      
      const url = await loadBackgroundFromDB();
      setBackgroundUrl(url);
      setSettings(getSeasonalSettings());
      
      Swal.fire({
        icon: 'success',
        title: 'Background Set!',
        confirmButtonText: 'OK',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Upload Failed',
        text: err instanceof Error ? err.message : 'Could not process file',
        background: 'var(--bg-card)',
        color: 'var(--text-primary)',
        confirmButtonText: 'OK',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveBackground = async () => {
    await clearCustomBackground();
    setBackgroundUrl(null);
    setSettings(getSeasonalSettings());
  };

  if (!settings) return null;

  const currentSeason = getCurrentSeason();
  const activeSeason = settings.mode === 'auto' ? currentSeason : 
                       settings.mode === 'random' ? settings.season : 
                       settings.mode;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Seasonal Effects {settings.mode === 'random' ? '🎲' : getSeasonEmoji(activeSeason === 'off' ? 'off' : activeSeason)}
        </h3>
        <p className="text-xs text-[var(--text-muted)]">
          Particle animations & custom backgrounds
        </p>
      </div>

      {/* Season Selector */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {SEASON_OPTIONS.map((option) => {
          const isActive = settings.mode === option.id;
          return (
            <button
              key={option.id}
              onClick={() => handleModeChange(option.id)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                isActive
                  ? 'bg-[var(--accent-primary)]/20 border-[var(--accent-primary)] text-[var(--accent-primary)]'
                  : 'bg-[var(--bg-secondary)] border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50'
              }`}
            >
              <span className="text-xl">{option.emoji}</span>
              <span className="text-xs font-medium">{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* Preview */}
      {activeSeason !== 'off' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]"
        >
          <div className="flex items-center gap-2 text-sm">
            <span className="text-2xl">{settings.mode === 'random' ? '🎲' : getSeasonEmoji(activeSeason)}</span>
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                {settings.mode === 'random' ? 'Random Mode Active' : `${getSeasonName(activeSeason)} Mode Active`}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {settings.mode === 'random' && `Currently: ${getSeasonName(settings.season)} - rotates every ${settings.randomInterval}s`}
                {activeSeason === 'winter' && settings.mode !== 'random' && 'Snowflakes falling ❄️'}
                {activeSeason === 'spring' && settings.mode !== 'random' && 'Cherry blossoms floating 🌸'}
                {activeSeason === 'autumn' && settings.mode !== 'random' && 'Leaves falling 🍂'}
              </p>
            </div>
          </div>
          
          {/* Show Particles Toggle - inside seasonal card */}
          {settings.customBackground && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-color)]/50">
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Show Particles</p>
                <p className="text-xs text-[var(--text-muted)]">Display over background</p>
              </div>
              <button
                onClick={() => {
                  setParticlesWithBackground(!settings.particlesWithBackground);
                  setSettings(getSeasonalSettings());
                }}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  settings.particlesWithBackground 
                    ? 'bg-[var(--accent-primary)]' 
                    : 'bg-[var(--bg-card)] border border-[var(--border-color)]'
                }`}
              >
                <div 
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    settings.particlesWithBackground ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Custom Background */}
      <div className="pt-2 border-t border-[var(--border-color)]">
        {(() => {
          const s = getUnifiedSettings();
          const maxSize = s.allowLargeBackground ? 400 : 200;
          return (
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-medium text-[var(--text-primary)]">Custom Background</h4>
                <p className="text-xs text-[var(--text-muted)]">Image/Video/GIF (max {maxSize}MB)* • Silenced</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,.gif,.mp4,.mov,.webm,.avi,.mkv,.m4v"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          );
        })()}
        
        {/* Warning note */}
        <p className="text-[10px] text-amber-500/80 mb-3 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Large files (&gt;50MB) may cause lag on slower devices
        </p>

        {settings.customBackground && backgroundUrl ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-color)]">
            {/* Info */}
            <div className="flex items-center gap-2">
              {settings.customBackground.type === 'video' ? (
                <Video className="w-5 h-5 text-purple-400" />
              ) : (
                <Image className="w-5 h-5 text-blue-400" />
              )}
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {settings.customBackground.type === 'video' ? 'Video' : 'Image'} Background
                </p>
                <p className="text-xs text-[var(--text-muted)]">{formatFileSize(settings.customBackground.size)}</p>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Change'}
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleRemoveBackground}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : null}
        
        {/* Info text */}
        {settings.customBackground && (
          <p className="text-[10px] text-[var(--text-muted)] mt-2">
            💾 Video is saved on your browser, IndexedDB.
          </p>
        )}
        
        {!settings.customBackground && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <>
                <Image className="w-4 h-4 mr-2" />
                <Video className="w-4 h-4 mr-2" />
              </>
            )}
            Upload Background (Image/Video)
          </Button>
        )}
      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <BackgroundPreview
            file={previewFile}
            onConfirm={handleConfirmBackground}
            onCancel={() => setPreviewFile(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default SeasonalSettings;
