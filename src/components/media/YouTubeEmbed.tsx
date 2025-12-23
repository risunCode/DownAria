/**
 * YouTube Embed Player Component
 * Replaces native video player for YouTube content
 * 
 * Features:
 * - No autoplay (respects user interaction)
 * - Sound enabled by default
 * - No loop
 * - Minimal YouTube branding
 */

'use client';

import { useMemo } from 'react';

interface YouTubeEmbedProps {
  url: string;
  className?: string;
  title?: string;
}

/**
 * Extract YouTube video ID from various URL formats
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/|youtube\.com\/e\/)([a-zA-Z0-9_-]{11})/,
    /(?:music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Check if URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be|music\.youtube\.com)/i.test(url);
}

export function YouTubeEmbed({ url, className = '', title = 'YouTube Video' }: YouTubeEmbedProps) {
  const videoId = useMemo(() => extractYouTubeId(url), [url]);

  if (!videoId) {
    return (
      <div className={`flex items-center justify-center bg-black/50 rounded-lg ${className}`}>
        <p className="text-white/60 text-sm">Invalid YouTube URL</p>
      </div>
    );
  }

  // Embed parameters:
  // autoplay=0: Don't auto-play (user must click)
  // loop=0: Don't loop the video
  // mute=0: Sound enabled (user can hear audio)
  // controls=1: Show player controls
  // modestbranding=1: Minimal YouTube branding
  // rel=0: Don't show related videos at the end
  // playsinline=1: Play inline on mobile (not fullscreen)
  const embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&loop=0&mute=0&controls=1&modestbranding=1&rel=0&playsinline=1`;

  return (
    <div className={`relative w-full aspect-video bg-black rounded-lg overflow-hidden ${className}`}>
      <iframe
        src={embedUrl}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
        loading="lazy"
      />
    </div>
  );
}

export default YouTubeEmbed;
