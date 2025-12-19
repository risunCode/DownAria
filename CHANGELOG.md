# Changelog

All notable changes to XTFetch will be documented in this file.

## [1.0.3] - December 20, 2025

### ✨ What's New
- **Anti-Ban System** - Smart header rotation with 6 browser profiles (Chrome 143, Firefox 134, Safari 18.2, Edge 143)
- **Storage Viewer Modal** - View and manage IndexedDB data with platform filtering
- **Centralized Error UI** - User-friendly error messages with icons, colors, and actions
- **Retry Logic** - Smart retry with exponential backoff and cookie fallback

### 🔧 What's Improved
- Updated browser profiles to December 2025 versions
- Added 3 new error codes: `COOKIE_BANNED`, `CONTENT_REMOVED`, `GEO_BLOCKED`
- Facebook latency reduced: Reels ~1.9s, Posts ~3.2s, Stories ~2.6s (from ~3-8s)
- All 14 Facebook test cases pass (100%)

### 📁 New Files
- `src/lib/http/anti-ban.ts` - Anti-ban system with UA rotation
- `src/lib/utils/error-ui.ts` - Error display with icons/colors
- `src/lib/utils/retry.ts` - Smart retry utility
- `src/components/StorageViewerModal.tsx` - IndexedDB viewer UI

---

## [1.0.2] - December 18, 2025

### ✨ What's New
- Facebook scraper v3 - improved image extraction accuracy
- Smart target block detection using `comet_sections` markers
- New `photo_image` extraction method for single/dual image posts
- Expandable changelog section in About page

### 🔧 What's Fixed
- Fixed profile picture being extracted as post image (t39.30808-1 filter)
- Fixed image URLs missing query params (403 errors)
- Fixed wrong images from related posts (improved findTargetBlock)
- All 16 Facebook test cases now pass (100%)

### ⚠️ Known Limitations
- **Facebook carousels 6+ images** - Only first 5 images extracted (Facebook lazy-loads remaining images via JavaScript)
- **YouTube quality** - Limited to 360p (Innertube API restriction)
- **Douyin** - Currently offline (TikWM API not working)

---

## [1.0.1] - December 17, 2025

### ✨ What's New
- Changelog section in About page
- Consolidated test suite for all platforms
- All-in-one Facebook debug tool

### 🔧 What's Fixed
- Merged redundant test files into single test suite
- Cleaned up Facebook debug tools (5 files → 1)

---

## [1.0.0] - December 2025 (Initial Release)

### ✨ Features
- **Multi-Platform Downloader** - Download videos/images from 6+ social media platforms
  - Facebook (Posts, Reels, Stories, Groups)
  - Instagram (Posts, Reels, Stories)
  - Twitter/X (Tweets, Videos)
  - TikTok (Videos, No Watermark)
  - YouTube/Music (360p - Innertube API)
  - Weibo (Videos, Images)

- **Smart Extraction**
  - Auto-detect platform from URL
  - Multi-quality options (HD, SD)
  - Thumbnail extraction
  - Engagement stats (likes, comments, shares, views)
  - Author & caption extraction

- **User Features**
  - Download history (localStorage)
  - Batch download queue
  - 3 Themes (Dark, Light, Solarized)
  - Cookie support for private content
  - Discord webhook notifications

- **Admin Panel**
  - Service control (enable/disable platforms)
  - Global cookie management (Supabase)
  - API key management
  - Analytics dashboard
  - Maintenance mode

- **Security**
  - JWT authentication
  - Rate limiting
  - Input validation (XSS/SQLi protection)
  - SSRF protection
  - Audit logging
  - Data encryption (AES-256-GCM)

- **API**
  - Unified endpoint `/api?url=<any_url>`
  - Per-platform endpoints
  - Response caching (platform-specific TTL)
  - API key support

### Tech Stack
- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4
- Supabase (Database)
