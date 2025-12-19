import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
