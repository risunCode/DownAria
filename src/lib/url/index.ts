/**
 * URL Module
 * ==========
 * Central URL processing pipeline.
 * 
 * Usage:
 *   import { prepareUrl, prepareUrlSync } from '@/lib/url';
 *   
 *   // Async (with resolve)
 *   const result = await prepareUrl('https://t.co/abc123');
 *   console.log(result.resolvedUrl);  // Full Twitter URL
 *   console.log(result.platform);     // 'twitter'
 *   console.log(result.cacheKey);     // 'twitter:1234567890'
 *   
 *   // Sync (no resolve, quick validation)
 *   const quick = prepareUrlSync('https://twitter.com/user/status/123');
 */

export {
  // Main pipeline
  prepareUrl,
  prepareUrlSync,
  
  // Utilities
  needsResolve,
  normalizeUrl,
  cleanTrackingParams,
  extractContentId,
  detectContentType,
  mayRequireCookie,
  generateCacheKey,
  isValidUrl,
  
  // Types
  type ContentType,
  type UrlAssessment,
  type UrlPipelineResult,
  type UrlPipelineOptions,
} from './pipeline';
