# Changelog

## [Unreleased] - v1.0.0

### Features
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
  - Response caching (3-day TTL)
  - API key support

### Tech Stack
- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4
- Supabase (Database)
