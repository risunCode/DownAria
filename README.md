# 🎵 DownAria

**Social Media Video Downloader** — Free, fast, and easy-to-use tool for downloading videos from social media. No registration, no limits, no BS.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![Supabase](https://img.shields.io/badge/Supabase-Database-3ecf8e?logo=supabase)
![License](https://img.shields.io/badge/License-GPL--3.0-blue)

---

## 📸 Screenshots

### Desktop

| Home | Playground | Documentation |
|:----:|:----------:|:-------------:|
| <img width="400" alt="home" src="https://github.com/user-attachments/assets/c8d6d40d-bf09-4128-8426-d45f0ad43411" /> | <img width="400" alt="playground" src="https://github.com/user-attachments/assets/eb1a6f8a-b87c-4c7d-a929-bcd045e4a764" /> | <img width="400" alt="documentation" src="https://github.com/user-attachments/assets/ade7b2e7-a9e4-4355-9eef-7bc7f6f1e704" /> |

| Settings | About |
|:--------:|:-----:|
| <img width="400" alt="settings" src="https://github.com/user-attachments/assets/82701057-ecdc-4597-835d-01808e6226c4" /> | <img width="400" alt="about" src="https://github.com/user-attachments/assets/526a8541-06d3-4f3c-ada7-c4e2f1252e2c" /> |

### Mobile

| Home | Playground | Documentation | Settings | About |
|:----:|:----------:|:-------------:|:--------:|:-----:|
| <img width="180" alt="home-mobile" src="https://github.com/user-attachments/assets/c24be2c5-caf6-43c4-b6cc-468251a50d87" /> | <img width="180" alt="playground-mobile" src="https://github.com/user-attachments/assets/a44704e6-27c5-4609-9d29-016348ed7c47" /> | <img width="180" alt="documentation-mobile" src="https://github.com/user-attachments/assets/108c8086-51ea-41e3-bade-66bb85b42336" /> | <img width="180" alt="settings-mobile" src="https://github.com/user-attachments/assets/d35b03b4-5c39-4577-a467-52c1f14322b7" /> | <img width="180" alt="about-mobile" src="https://github.com/user-attachments/assets/d96707d5-2235-416e-bb1b-6dbbe2c97e0e" /> |

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🌐 **Multi-Platform** | Facebook, Instagram, TikTok, Twitter/X, Weibo, YouTube |
| 🎯 **Auto-Detect** | Paste any URL, platform detected automatically |
| 🎬 **No Watermark** | Clean downloads (when available) |
| 📱 **Quality Options** | HD, SD, or original quality |
| 🔒 **No Registration** | No account needed for basic usage |
| 🌙 **3 Themes** | Dark, Light, Solarized (auto by time) |
| 📜 **History** | Track downloads locally (IndexedDB) |
| ⚡ **Fast** | Direct scraping, no middleman |
| 🎨 **Seasonal Effects** | Custom backgrounds, particles |
| 🔔 **Discord Webhook** | Auto-send downloads to Discord |
| 🤖 **AI Chat** | Built-in AI assistant (Gemini/GPT) |
| 📦 **PWA** | Install as app on mobile/desktop |

---

## 🎯 Supported Platforms

| Platform | Status | Method | Cookie Required |
|----------|--------|--------|-----------------|
| Facebook | ✅ Active | HTML Scraping | Stories, Groups |
| Instagram | ✅ Active | GraphQL API | Private posts |
| Twitter/X | ✅ Active | Syndication + GraphQL | Age-restricted |
| TikTok | ✅ Active | TikWM API | No |
| Weibo | ✅ Active | Mobile API | Always |
| YouTube | ✅ Active | yt-dlp | No |

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/user/DownAria.git
cd DownAria

# Install
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Run
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) 🎉

---

## 📦 Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Animation | Framer Motion |
| Database | Supabase (PostgreSQL) |
| Cache | Redis (Upstash) |
| Storage | IndexedDB + LocalStorage |
| Icons | Lucide + FontAwesome |
| Alerts | SweetAlert2 |

---

## 💾 Storage Architecture

DownAria uses a unified storage system with 5 keys:

| Key | Type | Purpose |
|-----|------|---------|
| `downaria_settings` | LocalStorage | All user preferences |
| `downaria_cookies` | LocalStorage (Encrypted) | Platform cookies |
| `downaria_seasonal` | LocalStorage | Seasonal theme settings |
| `downaria_queue` | LocalStorage | Pending download queue |
| `downaria_ai` | LocalStorage | AI chat sessions |

Plus IndexedDB for:
- `downaria_db` → Download history (unlimited)
- `downaria_seasonal_db` → Custom background files

---

## 🎨 Themes

| Theme | Description |
|-------|-------------|
| 🌙 **Dark** | GitHub-style dark |
| ☀️ **Light** | Clean white |
| 🌅 **Solarized** | Warm cream |
| 🔄 **Auto** | Dark at night, Solarized at day |

---

## 🔐 Security

- Encrypted cookie storage (XOR + HMAC)
- Browser fingerprint as encryption key
- No sensitive data in production logs
- CORS protection on API routes

---

## 🌐 Deployment

### Vercel (Recommended)
```bash
npm run build
vercel deploy
```

### Docker
```bash
docker build -t downaria .
docker run -p 3001:3001 downaria
```

---

## ⚠️ Limitations

| Limitation | Description |
|------------|-------------|
| 🔒 **Public Only** | Private posts require valid cookies |
| 🎲 **Platform Changes** | Scrapers may break when platforms update |
| 🍪 **Cookie Expiry** | Cookies expire, need periodic refresh |

---

## 🚨 Disclaimer

> ⚠️ **For personal use only**

- Using cookies for scraping may violate platform ToS
- Don't spam requests, respect rate limits
- We are not affiliated with any platform

---

## 📄 License

[GPL-3.0](./LICENSE) — Free to use, modify, and distribute.

---

<p align="center">
  Made with ❤️
</p>
