# Changelog

All notable changes to XTFetch will be documented in this file.

## [1.4.0] - December 23, 2025

### ✨ AI Chat Multi-Model Support
- **New Models** - Added GPT-5 and Copilot Smart via Magma API
  - `gemini-2.5-flash` - Gemini Flash 2.5 (image, web search, session)
  - `gemini-flash-latest` - Gemini Flash Latest (image, web search, session)
  - `gpt5` - GPT-5 (text only, no session)
  - `copilot-smart` - Copilot Smart (text only, no session)
- **Dynamic UI** - Header subtitle changes based on selected model
- **Feature Gating** - Image upload & web search disabled for non-Gemini models
- **Session Warning** - Banner for GPT-5/Copilot: "tidak mendukung session"
- **AI Disclaimer** - Footer: "AI dapat membuat kesalahan, periksa kembali responsenya"

### 🔧 UI Improvements
- **Dropdown Auto-Position** - Model & Session dropdowns auto-adjust based on viewport
- **Dropdown Single-Open** - Opening one dropdown closes the other
- **Responsive AI Chat** - Fixed container width issues on mobile

---

## [December 2025] - Code Cleanup & API Routing

### Added
- Type sync documentation (TYPES-CONTRACT.md)
- Consolidated changelog system with archives
- Improved cross-project type consistency

### Changed
- Migrated all API endpoints to v1 routing (`/api/v1/*`)
- Updated `useStatus` hook to use v1 endpoint
- Updated push notifications to use v1 endpoint
- Improved console logging with centralized logger
- Enhanced type consistency between frontend/backend

### Removed
- Legacy API route references in documentation
- Duplicate code and outdated endpoint references
- Nested project folder structure

### Fixed
- API endpoint consistency across projects
- Type mismatches between frontend and backend
- Documentation outdated references

### Documentation
- See `Proposal/archives/` for detailed migration logs
- Updated README files with current architecture
- Consolidated individual changelogs into main CHANGELOG.md

---

## [1.3.0_v0] - December 23, 2025

### ✨ What's New
- **Hashtag Search** - Click any #hashtag in captions to search across platforms
  - Dropdown with platform options (X, Instagram, Facebook, TikTok, YouTube)
  - Auto-detect position (up/down) for mobile sheet compatibility
  - Auto-close on scroll
- **Ad Banner System** - Advertising card on homepage
  - Auto-rotate every 8 seconds with pagination dots
  - Platform badges (Shopee, Tokped, etc.) with custom colors
  - Click & impression tracking
  - Admin API for managing ads (`/api/admin/ads`)
- **File Size Detection** - Size displayed on quality buttons (HD/SD/Original)
  - Fetched via HEAD request to proxy
  - Works for all platforms except YouTube (streaming)
- **Video Auto-Stop** - Videos auto-pause after 8 loops (battery saver 😴)
- **Smart Discord Send** - Per-item tracking for carousel posts
  - Download All: sends Discord only for first item
  - Individual downloads: can send if not already sent for that item

### 🔧 What's Improved
- **MediaGallery** - Image carousel now renders full resolution (not thumbnail)

### 🐛 What's Fixed
- Playground rate limit not syncing with Admin Console settings
- File size not showing on quality buttons (missing CORS header)
- Image carousel in MediaGallery always showing index 1
- Single item thumbnail not displaying in DownloadPreview

---

## [1.2.0] - December 21, 2025

### ✨ What's New
- **MediaGallery Component** - New global media preview component with:
  - Thumbnail strip for carousel navigation
  - Video autoplay, loop, no mute
  - Download progress with speed indicator
  - Discord webhook integration
  - Responsive modal (desktop) / fullscreen (mobile)
- **YouTube Support** - Added to sidebar supported platforms
- **Redis Cache Strategy** - URL hash-based cache keys for consistent caching

### 🔧 What's Improved
- **Admin Playground** - Now uses global MediaGallery component
- **Guest Playground** - Integrated MediaGallery with "Preview & Download" button
- **Admin Sidebar** - Removed animation, fixed header link, added sections to mobile menu
- **IndexedDB Optimization** - Removed media_cache store (Redis handles caching), title truncated to 200 chars
- **Cache Key Generation** - Tracking params cleanup (igsh, rdid, share_url, mibextid, etc.)

### 🐛 What's Fixed
- Admin header link pointing to invalid `/admin/dashboard` → now `/admin`
- Modal exit animation not smooth → fixed AnimatePresence wrapper
- Cache miss on same content with different URL params

### 📁 Files Changed
- `src/components/media/MediaGallery.tsx` - New global component
- `src/app/admin/playground/page.tsx` - Integrated MediaGallery
- `src/app/advanced/page.tsx` - Integrated MediaGallery
- `src/app/admin/layout.tsx` - Fixed sidebar & header
- `src/components/Sidebar.tsx` - Added YouTube platform
- `src/lib/storage/indexed-db.ts` - Optimized, removed media_cache
- `src/lib/url/pipeline.ts` - URL hash cache key generation
- `src/lib/redis.ts` - Added logger.redis() for cache logs

---

## [1.0.8] - December 21, 2025

### ✨ What's New
- **LocalStorage Encryption** - Sensitive data now encrypted at rest
  - XOR cipher with browser fingerprint as key
  - HMAC integrity check to detect tampering
  - Auto-migration for existing unencrypted data

### 🔧 What's Improved
- **Platform Cookies** - Now encrypted in localStorage (`xtf_cookie_*`)
- **Discord Webhook Settings** - Now encrypted (`xtf_discord`)
- **Admin Key Storage** - Now encrypted (`xtf_admin_key`)
- **Crypto Module** - New `@/lib/storage/crypto` with `setEncrypted`, `getEncrypted`, `migrateToEncrypted`

### 📁 Files Changed
- `src/lib/storage/crypto.ts` - New encryption module
- `src/lib/storage/settings.ts` - Platform cookies now encrypted
- `src/lib/utils/discord-webhook.ts` - Discord settings now encrypted
- `src/lib/utils/admin-fetch.ts` - Admin key now encrypted
- `src/lib/storage/index.ts` - Export crypto functions

---

## [1.0.7] - December 21, 2025

### ✨ What's New
- **Clear IndexedDB** - New button in Storage settings to delete all IndexedDB data
- **Install PWA Section** - Dedicated section with manual install instructions for Chrome/Safari/Edge
- **Auto SW Cache Version** - Build script auto-updates service worker cache version on each deploy

### 🔧 What's Improved
- **Settings Reorganized** - Basic tab now has "App & Features" section combining Install PWA, Notifications, Discord, Hide Docs
- **Hide Documentation Toggle** - Now auto-refreshes page when toggled
- **Language Selector** - Made compact (horizontal pills instead of large cards)
- **Service Worker Updates** - Check interval reduced from 30 min to 5 min
- **Cache Headers** - Added explicit no-cache for sw.js in Vercel config
- **Storage Grid** - Now 2x2 grid (Cookies, LocalStorage, IndexedDB, History & Cache) + Reset All below

### 🔐 Security Patches
- **SSRF Protection** - Added IPv6, DNS rebinding, cloud metadata endpoint blocking
- **Cookie CRLF Injection** - Added `sanitizeCookie()` function with CRLF check
- **Encryption Key Validation** - Strict 32 char minimum in production
- **IP Format Validation** - Added validation in middleware `getClientIP()`
- **Error Message Sanitization** - POST handler returns generic messages

### 🐛 What's Fixed
- Cache invalidation issues on deploy (BUILD_TIME now auto-generated)

---

## [1.0.6] - December 21, 2025

### ✨ What's New
- **API Origin Protection** - Main `/api` endpoint now blocked for direct access, must use from website or with API key
- **Demo API Key** - `demo_caf079daf479ceb1` for testing (3 req/min limit)
- **DocsNavbar** - Easy navigation between docs pages with breadcrumbs and pills
- **Legacy API Rate Limiting** - All legacy endpoints now rate limited to 5 req/5 min

### 🔧 What's Improved
- **Documentation Redesign** - Now uses app styling (glass cards, gradients)
- **Cookie Guide** - Updated to use Cookie Editor extension with JSON export
- **LocalStorage Keys** - Renamed all keys to `xtf_*` format for clarity
- **Dev Server Port** - Changed from 3000 to 3001

### 📁 Files Changed
- `src/app/api/route.ts` - Added origin whitelist protection
- `src/app/docs/*` - All docs pages redesigned
- `src/lib/storage/settings.ts` - New key names
- `package.json` - Port 3001 for dev/start

---

## [1.0.5] - December 20, 2025

### ✨ What's New
- **Documentation Page** - New `/docs` with API reference, guides, changelog
- **i18n Support** - Multi-language support (English + Bahasa Indonesia)
  - Language selector in Settings → Basic
  - Auto-detect from browser locale
  - All public pages translated
- **Cache Migration** - Moved from Supabase to Redis (Upstash)
  - Faster cache operations
  - Auto-TTL expiration (no manual cleanup)
  - Platform-specific TTL (1-12 hours)
- **Full Backup System** - Export/Import as ZIP
  - Contains history.json + settings.json
  - Merge on import (skip duplicates)

### 🔧 What's Improved
- **Skip Cache Setting** - Now works for all platforms
- **Filename Format** - Fixed `[XTFetch]` position (before extension, not after)
- **Memory Optimization** - Fixed multiple memory leaks:
  - Rate limit store cleanup in middleware (every 5 min)
  - Discord webhook cache with proper TTL
  - Platform failures map auto-cleanup (30 min TTL)
  - Chat messages limited to 100 max
- Better error messages with localization
- Performance optimizations

---

## [1.0.4] - December 15, 2025

### ✨ What's New
- **Cookie Pool System** - Multi-cookie rotation with health tracking
  - Automatic rotation (least recently used)
  - Health status: healthy/cooldown/expired
  - Stats per cookie (uses, success, errors)
  - Encrypted at rest (AES-256-GCM)
- **Admin Alerts & Announcements** - Site-wide notifications
- **Push Notifications** - VAPID-based web push from admin panel

### 🔧 What's Improved
- Redis cache migration (Upstash)
- Improved rate limiting per-IP and per-API-key

---

## [1.0.3] - December 10, 2025

### ✨ What's New
- **IndexedDB History** - Unlimited local storage for download history
- **Playground API** - `/api/playground` for testing without API key
- **Storage Viewer Modal** - View and manage IndexedDB data

### 🐛 What's Fixed
- Instagram embed fallback for private posts
- Twitter GraphQL authentication

---

## [1.0.2] - December 8, 2025

### ✨ What's New
- Facebook scraper v3 - improved image extraction accuracy
- Smart target block detection using `comet_sections` markers

### 🐛 What's Fixed
- Fixed profile picture being extracted as post image
- Fixed image URLs missing query params (403 errors)
- Fixed wrong images from related posts

---

## [1.0.1] - December 5, 2025

### ✨ What's New
- Changelog section in About page
- Consolidated test suite for all platforms

### 🐛 What's Fixed
- Merged redundant test files into single test suite

---

## [1.0.0] - November 25, 2025 (Initial Release)

### ✨ Features
- **Multi-Platform Downloader** - Download videos/images from 5 social media platforms
  - Facebook (Posts, Reels, Stories, Groups)
  - Instagram (Posts, Reels, Stories)
  - Twitter/X (Tweets, Videos)
  - TikTok (Videos, No Watermark via TikWM)
  - Weibo (Videos, Images - cookie required)

- **Smart Extraction**
  - Auto-detect platform from URL
  - Multi-quality options (HD, SD)
  - Thumbnail extraction
  - Engagement stats (likes, comments, shares, views)
  - Author & caption extraction

- **User Features**
  - Download history (IndexedDB)
  - 3 Themes (Dark, Light, Solarized)
  - Cookie support for private content
  - Discord webhook notifications
  - PWA with offline support

- **Admin Panel** (`/admin`)
  - Overview dashboard with analytics
  - API Keys management + Playground
  - Platform services + Cookie Pool
  - User management
  - Announcements + Push notifications
  - Global settings + Security

- **Security**
  - Supabase JWT authentication
  - Rate limiting (middleware + API level)
  - Input validation (XSS/SQLi protection)
  - SSRF protection (proxy whitelist)
  - Data encryption (AES-256-GCM)
  - Security headers (CSP, HSTS, etc.)

### Tech Stack
- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4
- Supabase (PostgreSQL)
- Redis (Upstash) for caching
