# XTFetch API Documentation

Base URL: `https://your-domain.com` atau `http://localhost:3000`

---

## Public Endpoints

### POST /api/meta
Extract media dari URL. Auto-detect platform.

**Request:**
```json
{
  "url": "https://www.facebook.com/share/1R3ibmnTpJ",
  "cookie": "optional_cookie_string"
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

**cURL:**
```bash
curl -X POST http://localhost:3000/api/meta \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.facebook.com/share/1R3ibmnTpJ"}'
```

**JavaScript:**
```js
const res = await fetch('/api/meta', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: 'https://www.facebook.com/share/1R3ibmnTpJ' })
});
const data = await res.json();
```

---

### GET /api/status
Get status semua platform (enabled/disabled/maintenance).

**Response:**
```json
{
  "success": true,
  "data": {
    "facebook": { "enabled": true, "maintenance": false, "message": null },
    "instagram": { "enabled": true, "maintenance": false, "message": null },
    "twitter": { "enabled": true, "maintenance": false, "message": null },
    "tiktok": { "enabled": true, "maintenance": false, "message": null },
    "youtube": { "enabled": true, "maintenance": false, "message": null },
    "weibo": { "enabled": true, "maintenance": false, "message": null }
  }
}
```

**cURL:**
```bash
curl http://localhost:3000/api/status
```

---

### GET /api/proxy
Proxy untuk bypass CORS. Load images/videos dari CDN platform.

**Query Params:**
- `url` (required): URL to proxy

**cURL:**
```bash
curl "http://localhost:3000/api/proxy?url=https://scontent.xx.fbcdn.net/image.jpg"
```

---

### GET /api/announcements
Get announcements untuk halaman tertentu.

**Query Params:**
- `page` (optional): Filter by page (home, settings, etc)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "1",
      "title": "Maintenance Notice",
      "message": "Facebook akan maintenance besok",
      "type": "warning",
      "pages": ["home"],
      "enabled": true
    }
  ]
}
```

---

## Platform-Specific Endpoints

Semua endpoint ini menerima request yang sama dengan `/api/meta`.

### POST /api/twitter
Extract Twitter/X content (tweets, videos, GIFs).

### POST /api/tiktok
Extract TikTok videos via TikWM API.

### POST /api/youtube
Extract YouTube videos via Innertube API (360p only).

### POST /api/weibo
Extract Weibo content. Cookie `SUB` required.

### POST /api/douyin
Extract Douyin (currently offline).

### POST /api/facebook/fetch-source
Internal: Fetch raw HTML dari Facebook URL.

---

## Admin Endpoints

Semua admin endpoints require authentication via cookie `xt_admin_session`.

### POST /api/admin/auth
Login admin.

**Request:**
```json
{
  "password": "admin_password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged in"
}
```

---

### GET /api/admin/cookies
List semua admin cookies per platform.

**Response:**
```json
{
  "success": true,
  "data": [
    { "platform": "facebook", "enabled": true, "updatedAt": "2024-01-01" },
    { "platform": "weibo", "enabled": true, "updatedAt": "2024-01-01" }
  ]
}
```

### POST /api/admin/cookies
Save/update admin cookie.

**Request:**
```json
{
  "platform": "facebook",
  "cookie": "c_user=xxx; xs=xxx",
  "enabled": true
}
```

---

### GET /api/admin/services
List semua service config.

**Response:**
```json
{
  "success": true,
  "data": {
    "facebook": { "enabled": true, "maintenance": false, "rateLimit": 10, "message": null },
    "instagram": { "enabled": true, "maintenance": false, "rateLimit": 10, "message": null }
  }
}
```

### POST /api/admin/services
Update service config.

**Request:**
```json
{
  "platform": "facebook",
  "enabled": false,
  "maintenance": true,
  "message": "Under maintenance"
}
```

---

### GET /api/admin/apikeys
List semua API keys.

### POST /api/admin/apikeys
Create/update/delete API key.

**Request (Create):**
```json
{
  "action": "create",
  "name": "My App",
  "rateLimit": 100
}
```

**Request (Delete):**
```json
{
  "action": "delete",
  "id": "key_id"
}
```

---

### GET /api/admin/stats
Get analytics data.

**Query Params:**
- `range`: "7d", "30d", "all"

**Response:**
```json
{
  "success": true,
  "data": {
    "totalDownloads": 1234,
    "byPlatform": { "facebook": 500, "twitter": 300 },
    "byCountry": { "ID": 800, "US": 200 },
    "successRate": 95.5
  }
}
```

---

### GET /api/admin/settings
Get admin settings.

### POST /api/admin/settings
Update admin settings (maintenance mode, etc).

**Request:**
```json
{
  "maintenanceMode": true,
  "maintenanceMessage": "Back soon!"
}
```

---

### GET /api/admin/announcements
List all announcements (admin view).

### POST /api/admin/announcements
Create/update/delete announcement.

**Request (Create):**
```json
{
  "action": "create",
  "title": "New Feature",
  "message": "We added YouTube support!",
  "type": "info",
  "pages": ["home"],
  "enabled": true
}
```

---

## Error Codes

- `400` - Bad Request (invalid URL, missing params)
- `401` - Unauthorized (admin endpoints)
- `403` - Forbidden (rate limited, service disabled)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

- Default: 10 requests per minute per IP
- Configurable per platform via admin panel
- API keys have separate rate limits

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

## Windows CMD Examples

CMD butuh escape `\"` untuk JSON:

```cmd
curl -X POST http://localhost:3000/api/meta -H "Content-Type: application/json" -d "{\"url\":\"https://www.facebook.com/share/1R3ibmnTpJ\"}"
```

Atau pakai file:
```cmd
echo {"url":"https://www.facebook.com/share/1R3ibmnTpJ"} > test.json
curl -X POST http://localhost:3000/api/meta -H "Content-Type: application/json" -d @test.json
```

PowerShell lebih simple:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/meta" -Method POST -ContentType "application/json" -Body '{"url":"https://www.facebook.com/share/1R3ibmnTpJ"}'
```
