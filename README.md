# 🚀 XTFetch

**Social Media Video Downloader** — Free, fast, and easy-to-use tool for downloading videos from social media. No registration, no limits, no BS.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ecf8e?logo=supabase)
![License](https://img.shields.io/badge/License-GPL--3.0-blue)

---

## 📸 Screenshots

<table>
  <tr>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/6b3ce04f-24b6-486c-9ca8-4a9e278c20b6" alt="Home" />
      <br /><b>Home</b>
    </td>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/aa4f2dc8-a307-457d-8a08-8764529b95fc" alt="History" />
      <br /><b>History</b>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/de544e61-adf8-4e8e-a2c5-1a672db7fdb4" alt="Settings" />
      <br /><b>Settings</b>
    </td>
    <td align="center" width="50%">
      <img src="https://github.com/user-attachments/assets/5c352fc6-66a2-417e-b9e2-8dc94bb109a3" alt="About" />
      <br /><b>About</b>
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <img src="https://github.com/user-attachments/assets/6234cb2d-eac1-43e7-9b6a-156b9e7f051f" alt="Media Preview Gallery" />
      <br /><b>Media Preview Gallery</b>
    </td>
  </tr>
</table>

### 📱 Android (PWA)

<table>
  <tr>
    <td align="center" width="25%">
      <img src="https://github.com/user-attachments/assets/6625a21b-ce96-4dd3-b81f-1438e9b9b660" alt="PWA Install" />
      <br /><b>PWA Install</b>
    </td>
    <td align="center" width="25%">
      <img src="https://github.com/user-attachments/assets/c3730823-4dd3-40e6-b541-60104643d96f" alt="Home Sidebar" />
      <br /><b>Home Sidebar</b>
    </td>
    <td align="center" width="25%">
      <img src="https://github.com/user-attachments/assets/ab01e05d-09fa-4a8d-8fe4-5ca95aecfee1" alt="Home Download" />
      <br /><b>Home Download</b>
    </td>
    <td align="center" width="25%">
      <img src="https://github.com/user-attachments/assets/52b6f98d-4335-469c-a391-1b4a8bc72841" alt="Gallery Preview" />
      <br /><b>Gallery Preview</b>
    </td>
  </tr>
</table>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🌐 **Multi-Platform** | Facebook, Instagram, TikTok, Twitter/X, Weibo, YouTube |
| 🎯 **Auto-Detect** | Paste any URL, platform detected automatically |
| 🎬 **No Watermark** | Clean downloads (when available) |
| 📱 **Quality Options** | HD, SD, or original quality |
| 🔒 **No Registration** | No account needed for basic usage |
| 🌙 **3 Themes** | Dark, Light, Solarized |
| 📜 **History** | Track your downloads locally |
| ⚡ **Fast** | Direct scraping, no middleman |
| 🛡️ **Anti-Ban** | Smart header rotation with 6 browser profiles |
| 💾 **Storage Viewer** | View and manage cached data by platform |
| 🔑 **API Keys** | Rate-limited API access with key management |
| 🛡️ **Admin Panel** | Service control, analytics, cookie management |

---

## 🎯 Supported Platforms

| Platform | Status | Method | Cookie Required |
|----------|--------|--------|-----------------|
| Facebook | ✅ Active | HTML Scraping | Stories, Groups |
| Instagram | ✅ Active | GraphQL API | Private posts |
| Twitter/X | ✅ Active | Syndication + GraphQL | Age-restricted |
| TikTok | ✅ Active | TikWM API | No |
| Weibo | ✅ Active | Mobile API | Always |
| YouTube | ✅ Active (360p) | Innertube API | No |
| Douyin | 🔴 Offline | TikWM | - |

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/niceplugin/xt-fetch.git
cd xt-fetch

# Install
npm install

# Setup environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 📦 Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Animation | Framer Motion |
| Database | Supabase (PostgreSQL) |
| Auth | JWT + Supabase Auth |
| HTML Parsing | Cheerio |
| YouTube | Innertube API |
| Alerts | SweetAlert2 |
| Icons | FontAwesome + Lucide |
| Data Fetching | SWR (stale-while-revalidate) |

---

## ⚡ Performance Optimizations

XTFetch is optimized for minimal API calls and fast response times.

### Client-Side Caching (SWR)
All data fetching uses [SWR](https://swr.vercel.app/) with smart caching:

| Hook | Cache Duration | Purpose |
|------|----------------|---------|
| `useStatus` | 60s | Platform status in sidebar |
| `useAnnouncements` | 2min | Site announcements |
| `useCookieStatus` | 60s | Cookie availability |
| `usePlayground` | 10s | Rate limit status |
| `useUpdatePrompt` | 5min | SW update settings |

### HTTP Cache Headers
API routes include `Cache-Control` headers for CDN/browser caching:
- `/api/v1/status` - 30s cache
- `/api/v1/announcements` - 60s cache
- `/api/v1/playground` - 30s cache

### Smart Polling
- Maintenance page only polls when tab is visible
- Auto-refresh uses SWR's `refreshInterval` (no manual intervals)
- Request deduplication prevents duplicate calls

### Bundle & UI Optimizations
- **Error Boundaries** - Graceful error handling with retry
- **Lazy Loading** - Dynamic imports for heavy components
- **Skeleton Loading** - Smooth loading states
- **Accessibility** - Skip links, focus traps, ARIA labels
- **Reduced Motion** - Respects `prefers-reduced-motion`
- **High Contrast** - Supports `prefers-contrast: high`

### SEO
- **Structured Data** - JSON-LD for WebApplication & FAQ
- **OpenGraph** - Social sharing meta tags
- **Twitter Cards** - Twitter-specific meta tags

---

## 🔐 Security Features

| Feature | Description |
|---------|-------------|
| 🔑 **API Key Auth** | Required by default, per-key rate limiting |
| 🛡️ **Admin Auth** | JWT-based authentication for admin panel |
| ⏱️ **Rate Limiting** | Per-endpoint and per-key limits |
| 🔍 **Input Validation** | XSS/SQLi pattern detection |
| � **SaSRF Protection** | Proxy whitelist for allowed domains |
| 📝 **Audit Logging** | Track admin actions |
| 🔒 **RLS** | Row Level Security on all tables |

---

## �️ Andmin Panel

Access admin panel at `/auth` (requires login).

| Feature | Description |
|---------|-------------|
| 📊 **Dashboard** | Analytics by platform, country, success rate |
| ⚙️ **Services** | Enable/disable platforms, custom messages |
| 🍪 **Cookies** | Global cookie management (Supabase) |
| 🔑 **API Keys** | Generate, manage, rate limit per key |
| 🎮 **Playground** | Test all API endpoints |
| 🔧 **Maintenance** | Global pause with custom message |

---

## 🔧 Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Admin Auth
ADMIN_USER=admin
ADMIN_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret

# Logging
LOG_LEVEL=error  # error | info | debug
```

---

## 🗄️ Database Setup

Run these SQL files in Supabase SQL Editor:

1. `sql-1-reset.sql` - Reset/clean database
2. `sql-2-seed.sql` - Create tables and seed data

---

## � Thtemes

| Theme | Description |
|-------|-------------|
| 🌙 **Dark** | GitHub-style dark |
| ☀️ **Light** | Clean white |
| 🌅 **Solarized** | Warm cream (default) |

---
 

**How to get cookies:**
1. Install "Cookie Editor" browser extension
2. Login to the platform
3. Export cookies (JSON or Header String)
4. Paste in Settings or Admin Panel

---

## 🌐 Deployment

### Vercel (Recommended)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/niceplugin/xt-fetch)

### Manual
See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

---

## ⚠️ Limitations

| Limitation | Description |
|------------|-------------|
| 🔒 **Public Only** | Private posts require valid cookies |
| 🎲 **Platform Changes** | Scrapers may break when platforms update |
| 🍪 **Cookie Expiry** | Cookies expire, need periodic refresh |
| 📹 **YouTube 360p** | HD streams blocked for server-side |

---

## 🚨 Disclaimer

> ⚠️ **For personal use only**

- Using cookies for scraping may violate platform ToS
- Don't spam requests, respect rate limits
- Use alternative accounts for cookie generation
- We are not affiliated with any platform

---

## 📄 License

[GPL-3.0](./LICENSE) — Free to use, modify, and distribute.

---

## 🤝 Contributing

PRs welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/risunCode">risunCode</a>
</p>
