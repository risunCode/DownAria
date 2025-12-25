# Deployment Guide

## 🚀 Vercel (Recommended)

The easiest way to deploy DownAria.

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/risunCode/DownAria)

### Manual Deploy

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your repository
4. Click Deploy

No environment variables needed!

## 🐳 Docker

### Build & Run

```bash
# Build image
docker build -t downaria .

# Run container
docker run -p 3000:3000 downaria
```

### Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    restart: unless-stopped
```

```bash
docker-compose up -d
```

## 📦 Node.js (VPS/Server)

### Requirements

- Node.js 18+
- npm or yarn

### Steps

```bash
# Clone repository
git clone https://github.com/risunCode/DownAria.git
cd DownAria

# Install dependencies
npm install

# Build for production
npm run build

# Start production server
npm start
```

### PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start npm --name "downaria" -- start

# Auto-restart on reboot
pm2 startup
pm2 save
```

## ☁️ Other Platforms

### Netlify

1. Connect your GitHub repo
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Add `@netlify/plugin-nextjs` plugin

### Railway

1. Connect GitHub repo
2. Railway auto-detects Next.js
3. Deploy automatically

### Render

1. Create new Web Service
2. Connect GitHub repo
3. Build command: `npm install && npm run build`
4. Start command: `npm start`

## 🔧 Environment Variables

### Required for Production

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `https://xtfetch-api-production.up.railway.app` |
| `NEXT_PUBLIC_BASE_URL` | Frontend URL | `https://downaria.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `eyJhbGci...` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `production` |
| `LOG_LEVEL` | Logging level | `info` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Push notification key | - |

### Vercel Environment Setup

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the required variables:
   - `NEXT_PUBLIC_API_URL` = `https://xtfetch-api-production.up.railway.app`
   - `NEXT_PUBLIC_BASE_URL` = `https://downaria.vercel.app`
   - `NEXT_PUBLIC_SUPABASE_URL` = Your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = Your Supabase anon key
4. Redeploy for changes to take effect

## 🛡️ Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### SSL with Certbot

```bash
sudo certbot --nginx -d yourdomain.com
```

## 📊 Monitoring

### Health Check

The app responds at `/` - use this for health checks.

### Logs

```bash
# PM2 logs
pm2 logs downaria

# Docker logs
docker logs -f container_name
```

## ⚡ Performance Tips

1. **Enable caching** - Facebook responses are cached for 15 minutes
2. **Use CDN** - Put Cloudflare or similar in front
3. **Scale horizontally** - App is stateless, can run multiple instances

## 🔒 Security Notes

- No sensitive data is stored server-side
- Download history is stored in user's browser (localStorage)
- URLs are processed in real-time and not logged
- Use HTTPS in production

## 🆘 Troubleshooting

### Build fails

```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Port already in use

```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>
```

### Memory issues

Increase Node.js memory:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

---

Need help? Open an issue on [GitHub](https://github.com/risunCode/DownAria/issues).
