import type { NextConfig } from "next";

// CSP Whitelist for external resources
// API URL from env (supports both local dev and production)
const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  // Next.js requires unsafe-inline for hydration scripts
  'script-src': ["'self'", "'unsafe-inline'", "https://va.vercel-scripts.com"],
  'style-src': ["'self'", "'unsafe-inline'"], // unsafe-inline kept for styles as it's lower risk
  // Restricted img-src: allow http localhost for dev, https for prod
  'img-src': ["'self'", "data:", "blob:", "https:", "http://localhost:*"],
  'font-src': ["'self'", "data:"],
  'connect-src': [
    "'self'",
    "https://*.supabase.co",
    "https://*.railway.app",
    "https://*.vercel.app",
    "https://va.vercel-scripts.com",
    "https://discord.com",
    "wss://*.supabase.co",
    // API URL from environment variable
    ...(apiUrl ? [apiUrl] : []),
  ],
  // Restricted media-src: allow http localhost for dev proxy
  'media-src': ["'self'", "blob:", "https:", "http://localhost:*"],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

const cspString = Object.entries(CSP_DIRECTIVES)
  .map(([key, values]) => `${key} ${values.join(' ')}`)
  .join('; ');

const nextConfig: NextConfig = {
  // Security Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: cspString },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      // Facebook/Instagram
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
      },
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com',
      },
      {
        protocol: 'https',
        hostname: 'scontent.cdninstagram.com',
      },
      // Twitter
      {
        protocol: 'https',
        hostname: 'pbs.twimg.com',
      },
      {
        protocol: 'https',
        hostname: 'video.twimg.com',
      },
      // Weibo
      {
        protocol: 'https',
        hostname: '**.sinaimg.cn',
      },
      {
        protocol: 'http',
        hostname: '**.sinaimg.cn',
      },
      // TikTok
      {
        protocol: 'https',
        hostname: '**.tiktokcdn.com',
      },
      {
        protocol: 'https',
        hostname: '**.tiktokcdn-us.com',
      },
      // Generic - allow all for unoptimized images
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Disable strict mode for development to avoid double renders
  reactStrictMode: true,
};

export default nextConfig;
