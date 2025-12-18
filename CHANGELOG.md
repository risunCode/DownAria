# Changelog

All notable changes to XTFetch will be documented in this file.

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
