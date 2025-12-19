/**
 * Central URL Pipeline
 * ====================
 * Single source of truth for URL processing:
 * Input URL → Validate → Normalize → Resolve → Detect → Assess
 */

import { logger } from '@/core';
import { type PlatformId, detectPlatform } from '@/core/config';
import { resolveUrl as resolveUrlAxios, ResolveResult } from '@/lib/http/client';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type ContentType = 'video' | 'reel' | 'story' | 'post' | 'image' | 'unknown';

export interface UrlAssessment {
  isValid: boolean;
  mayRequireCookie: boolean;
  errorCode?: 'INVALID_URL' | 'UNSUPPORTED_PLATFORM' | 'RESOLVE_FAILED' | 'MISSING_CONTENT_ID';
  errorMessage?: string;
}

export interface UrlPipelineResult {
  inputUrl: string;
  normalizedUrl: string;
  resolvedUrl: string;
  platform: PlatformId | null;
  contentType: ContentType;
  contentId: string | null;
  wasResolved: boolean;
  redirectChain: string[];
  assessment: UrlAssessment;
  cacheKey: string | null;
}

export interface UrlPipelineOptions {
  skipResolve?: boolean;
  timeout?: number;
  forceResolve?: boolean;
}

// SHORT URL PATTERNS
const SHORT_URL_PATTERNS: Record<string, RegExp> = {
  facebook: /fb\.watch|fb\.me|l\.facebook\.com|\/share\//i,
  instagram: /instagr\.am|ig\.me/i,
  twitter: /t\.co\//i,
  tiktok: /vm\.tiktok\.com|vt\.tiktok\.com/i,
  weibo: /t\.cn\//i,
};

// CONTENT ID EXTRACTORS
const CONTENT_ID_EXTRACTORS: Record<PlatformId, (url: string) => string | null> = {
  twitter: (url) => url.match(/status(?:es)?\/(\d+)/)?.[1] || null,
  instagram: (url) => url.match(/(?:\/p\/|\/reel\/|\/reels\/|\/tv\/)([A-Za-z0-9_-]+)/)?.[1] || null,
  facebook: (url) => {
    const patterns = [/\/videos\/(\d+)/, /\/reel\/(\d+)/, /\/watch\/?\?v=(\d+)/, /\/v\/(\d+)/, /\/share\/[vr]\/(\d+)/, /story_fbid=(\d+)/, /\/posts\/([a-zA-Z0-9]+)/];
    for (const p of patterns) { const m = url.match(p); if (m?.[1]) return m[1]; }
    return null;
  },
  tiktok: (url) => url.match(/\/video\/(\d+)/)?.[1] || null,
  weibo: (url) => {
    const patterns = [/\/status\/([A-Za-z0-9]+)/, /\/detail\/([A-Za-z0-9]+)/, /weibo\.com\/\d+\/([A-Za-z0-9]+)/, /m\.weibo\.cn\/status\/([A-Za-z0-9]+)/];
    for (const p of patterns) { const m = url.match(p); if (m?.[1]) return m[1]; }
    return null;
  },
};

// CONTENT TYPE DETECTORS
const CONTENT_TYPE_DETECTORS: Record<PlatformId, (url: string) => ContentType> = {
  twitter: () => 'post',
  instagram: (url) => /\/stories\//.test(url) ? 'story' : /\/reel/.test(url) ? 'reel' : /\/tv\//.test(url) ? 'video' : 'post',
  facebook: (url) => /\/stories\//.test(url) ? 'story' : /\/reel/.test(url) ? 'reel' : /\/videos\/|\/watch\//.test(url) ? 'video' : /\/photos\//.test(url) ? 'image' : 'post',
  tiktok: () => 'video',
  weibo: () => 'post',
};

// COOKIE REQUIREMENT PATTERNS
const COOKIE_REQUIRED_PATTERNS: Record<PlatformId, RegExp | null> = {
  twitter: null,
  instagram: /\/stories\//i,
  facebook: /\/stories\/|\/groups\//i,
  tiktok: null,
  weibo: /./,
};

// HELPER FUNCTIONS
export function needsResolve(url: string, platform?: PlatformId): boolean {
  if (platform && SHORT_URL_PATTERNS[platform]) return SHORT_URL_PATTERNS[platform].test(url);
  return Object.values(SHORT_URL_PATTERNS).some(re => re.test(url));
}

export function normalizeUrl(url: string): string {
  let n = url.trim();
  if (!/^https?:\/\//i.test(n)) n = 'https://' + n;
  n = n.replace(/^(https?:\/\/)m\.(facebook\.com)/i, '$1www.$2')
       .replace(/^(https?:\/\/)mbasic\.(facebook\.com)/i, '$1www.$2')
       .replace(/^(https?:\/\/)web\.(facebook\.com)/i, '$1www.$2')
       .replace(/^(https?:\/\/)mobile\.(twitter\.com)/i, '$1$2')
       .replace(/^(https?:\/\/)mobile\.(x\.com)/i, '$1$2');
  return cleanTrackingParams(n);
}

export function cleanTrackingParams(url: string): string {
  try {
    const u = new URL(url);
    ['fbclid','igshid','utm_source','utm_medium','utm_campaign','utm_term','utm_content','s','t','ref','ref_src','ref_url','__cft__','__tn__','wtsid','_rdr','rdid','share_url','app'].forEach(p => u.searchParams.delete(p));
    [...u.searchParams.keys()].filter(k => k.startsWith('__cft__')).forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch { return url.replace(/[&?](fbclid|igshid|utm_\w+|__cft__\[[^\]]*\]|__tn__|wtsid|_rdr|rdid|share_url|app)=[^&]*/gi, '').replace(/&&+/g, '&').replace(/\?&/g, '?').replace(/[&?]$/g, ''); }
}

export function extractContentId(platform: PlatformId, url: string): string | null {
  return CONTENT_ID_EXTRACTORS[platform]?.(url) || null;
}

export function detectContentType(platform: PlatformId, url: string): ContentType {
  return CONTENT_TYPE_DETECTORS[platform]?.(url) || 'unknown';
}

export function mayRequireCookie(platform: PlatformId, url: string): boolean {
  const p = COOKIE_REQUIRED_PATTERNS[platform];
  return p ? p.test(url) : false;
}

export function generateCacheKey(platform: PlatformId, contentId: string): string {
  return `${platform}:${contentId}`;
}

export function isValidUrl(url: string): boolean {
  try { new URL(url.startsWith('http') ? url : 'https://' + url); return true; } catch { return false; }
}

// MAIN PIPELINE
export async function prepareUrl(rawUrl: string, options?: UrlPipelineOptions): Promise<UrlPipelineResult> {
  const { skipResolve = false, timeout = 5000, forceResolve = false } = options || {};
  const inputUrl = rawUrl.trim();
  if (!inputUrl || !isValidUrl(inputUrl)) return createErrorResult(inputUrl, 'INVALID_URL', 'Invalid URL format');

  const normalizedUrl = normalizeUrl(inputUrl);
  let platform = detectPlatform(normalizedUrl);
  let resolvedUrl = normalizedUrl;
  let wasResolved = false;
  let redirectChain: string[] = [normalizedUrl];

  if (!skipResolve && (forceResolve || needsResolve(normalizedUrl, platform || undefined))) {
    logger.debug('url-pipeline', `Resolving: ${normalizedUrl}`);
    const r: ResolveResult = await resolveUrlAxios(normalizedUrl, { timeout });
    if (!r.error) { resolvedUrl = r.resolved; wasResolved = r.changed; redirectChain = r.redirectChain; }
  }

  if (wasResolved) { const np = detectPlatform(resolvedUrl); if (np) platform = np; }
  if (!platform) return createErrorResult(inputUrl, 'UNSUPPORTED_PLATFORM', 'Platform not supported', { normalizedUrl, resolvedUrl, wasResolved, redirectChain });

  const contentId = extractContentId(platform, resolvedUrl);
  const contentType = detectContentType(platform, resolvedUrl);
  const cacheKey = contentId ? generateCacheKey(platform, contentId) : null;

  return { inputUrl, normalizedUrl, resolvedUrl, platform, contentType, contentId, wasResolved, redirectChain, assessment: { isValid: true, mayRequireCookie: mayRequireCookie(platform, resolvedUrl) }, cacheKey };
}

export function prepareUrlSync(rawUrl: string): UrlPipelineResult {
  const inputUrl = rawUrl.trim();
  if (!inputUrl || !isValidUrl(inputUrl)) return { ...createErrorResult(inputUrl, 'INVALID_URL', 'Invalid URL format'), wasResolved: false, redirectChain: [] };
  const normalizedUrl = normalizeUrl(inputUrl);
  const platform = detectPlatform(normalizedUrl);
  if (!platform) return { ...createErrorResult(inputUrl, 'UNSUPPORTED_PLATFORM', 'Platform not supported', { normalizedUrl }), wasResolved: false, redirectChain: [normalizedUrl] };
  const contentId = extractContentId(platform, normalizedUrl);
  const cacheKey = contentId ? generateCacheKey(platform, contentId) : null;
  return { inputUrl, normalizedUrl, resolvedUrl: normalizedUrl, platform, contentType: detectContentType(platform, normalizedUrl), contentId, wasResolved: false, redirectChain: [normalizedUrl], assessment: { isValid: true, mayRequireCookie: mayRequireCookie(platform, normalizedUrl) }, cacheKey };
}

function createErrorResult(inputUrl: string, errorCode: UrlAssessment['errorCode'], errorMessage: string, partial?: Partial<UrlPipelineResult>): UrlPipelineResult {
  return { inputUrl, normalizedUrl: partial?.normalizedUrl || inputUrl, resolvedUrl: partial?.resolvedUrl || inputUrl, platform: null, contentType: 'unknown', contentId: null, wasResolved: partial?.wasResolved || false, redirectChain: partial?.redirectChain || [], assessment: { isValid: false, mayRequireCookie: false, errorCode, errorMessage }, cacheKey: null };
}
