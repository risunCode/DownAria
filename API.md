# XTFetch API Documentation

Base URL: `https://xt-fetch.vercel.app` atau `http://localhost:3001`

---

## Quick Start

### Main Endpoint (Recommended)
```bash
# With API Key (higher rate limit)
curl -X POST https://xt-fetch.vercel.app/api \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{"url":"https://www.facebook.com/share/p/1G8yBgJaPa/"}'

# Playground (demo, 3 req/min)
curl -X POST https://xt-fetch.vercel.app/api/playground \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.facebook.com/share/p/1G8yBgJaPa/"}'
```

---

## Public Endpoints

### POST /api
Main download endpoint. Auto-detect platform.

**Headers:**
- `Content-Type: application/json` (required)
- `X-API-Key: your_key` (optional, for higher rate limits)

**Request:**
```json
{
  "url": "https://www.facebook.com/share/p/1G8yBgJaPa/",
  "cookie": "optional_cookie_string",
  "skipCache": false
}
```

**Response (Success):**
```json
{
  "success": true,
  "platform": "facebook",
  "data": {
    "title": "Video Title",
    "thumbnail": "https://...",
    "author": "Author Name",
    "isPrivate": false,
    "responseTime": 1234,
    "medias": [
      {
        "url": "https://video-url.mp4",
        "quality": "HD",
        "type": "video"
      }
    ]
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "platform": "facebook",
  "error": "No media found. Post may be private."
}
```

**Note:** Direct access blocked. Must be called from `https://xt-fetch.vercel.app` or include valid `X-API-Key`.

---

### POST /api/playground
Guest API for testing. Rate limited to 3 requests/minute.

**Request:** Same as `/api`

**Demo Key:** `demo_caf079daf479ceb1` (3 req/min)

**Browser Test:**
```
https://xt-fetch.vercel.app/api/playground?url=https://www.facebook.com/share/p/1G8yBgJaPa/
```

---

### GET /api/status
Get status semua platform.

**Response:**
```json
{
  "success": true,
  "platforms": [
    { "id": "facebook", "name": "Facebook", "status": "active" },
    { "id": "instagram", "name": "Instagram", "status": "active" },
    { "id": "twitter", "name": "Twitter/X", "status": "active" },
    { "id": "tiktok", "name": "TikTok", "status": "active" },
    { "id": "weibo", "name": "Weibo", "status": "active" }
  ],
  "cookies": {
    "facebook": { "available": true },
    "instagram": { "available": true }
  }
}
```

---

### GET /api/proxy
Proxy untuk bypass CORS. Load media dari CDN platform.

**Query Params:**
- `url` (required): URL to proxy

**Example:**
```
/api/proxy?url=https://scontent.xx.fbcdn.net/video.mp4
```

---

### GET /api/announcements
Get announcements untuk halaman tertentu.

**Query Params:**
- `page` (optional): home, settings, history, about

---

## Supported Platforms

| Platform | Status | Cookie Required | Notes |
|----------|--------|-----------------|-------|
| Facebook | ✅ Active | Optional | Videos, Reels, Stories |
| Instagram | ✅ Active | Optional | Posts, Reels, Stories |
| Twitter/X | ✅ Active | Optional | Tweets, Videos |
| TikTok | ✅ Active | No | Via TikWM API |
| Weibo | ✅ Active | Yes (SUB) | Mobile API |

---

## API Keys

### Key Formats
- `demo_xxx` - Demo keys (limited)
- `beta_xxx` - Beta tester keys
- `prod_xxx` - Production keys

### Rate Limits
| Type | Limit |
|------|-------|
| No key (playground) | 3 req/min |
| Demo key | 3 req/min |
| Beta key | 30 req/min |
| Production key | 100 req/min |

---

## Legacy Endpoints (Rate Limited)

These endpoints are rate limited to 5 req/5 min:

- `POST /api/tiktok` - TikTok direct
- `POST /api/twitter` - Twitter direct
- `POST /api/weibo` - Weibo direct
- `POST /api/facebook/fetch-source` - FB HTML source
- `POST /api/download` - Legacy download
- `POST /api/download/[platform]` - Platform-specific

**Recommendation:** Use `/api` or `/api/playground` instead.

---

## Cookie Format

Supports 2 formats:

**String format:**
```
c_user=123456; xs=abcdef; datr=xyz
```

**JSON array (Cookie Editor export):**
```json
[
  {"name": "c_user", "value": "123456", "domain": ".facebook.com"},
  {"name": "xs", "value": "abcdef", "domain": ".facebook.com"}
]
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request (invalid URL) |
| 401 | Unauthorized (invalid API key) |
| 403 | Forbidden (origin blocked, rate limited) |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable (maintenance) |

---

## Code Examples

### JavaScript/TypeScript
```typescript
const response = await fetch('https://xt-fetch.vercel.app/api', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key'
  },
  body: JSON.stringify({
    url: 'https://www.facebook.com/share/p/1G8yBgJaPa/'
  })
});

const data = await response.json();
if (data.success) {
  console.log('Media:', data.data.medias);
}
```

### Python
```python
import requests

response = requests.post(
    'https://xt-fetch.vercel.app/api',
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': 'your_api_key'
    },
    json={'url': 'https://www.facebook.com/share/p/1G8yBgJaPa/'}
)

data = response.json()
if data['success']:
    print('Media:', data['data']['medias'])
```

### cURL
```bash
curl -X POST https://xt-fetch.vercel.app/api \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{"url":"https://www.facebook.com/share/p/1G8yBgJaPa/"}'
```

### PowerShell
```powershell
$response = Invoke-RestMethod -Uri "https://xt-fetch.vercel.app/api" `
  -Method POST `
  -ContentType "application/json" `
  -Headers @{"X-API-Key"="your_api_key"} `
  -Body '{"url":"https://www.facebook.com/share/p/1G8yBgJaPa/"}'

$response.data.medias
```

---

## Admin API

Admin endpoints require authentication via Supabase JWT.

See `/admin` panel for management:
- `/admin/access` - API Keys management
- `/admin/services` - Platform settings
- `/admin/cookies/pool` - Cookie pool management

---

## Notes

- All responses are JSON
- CORS enabled for whitelisted origins
- Rate limiting uses Redis (Upstash) with memory fallback
- Cookies are encrypted at rest (AES-256-GCM)
