# Changelog

All notable changes to XTFetch will be documented in this file.

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
