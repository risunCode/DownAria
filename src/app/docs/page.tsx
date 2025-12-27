import type { Metadata } from 'next';
import { DocsHomePage } from '@/app/docs/DocsHomePage';

export const metadata: Metadata = {
    title: 'Documentation - DownAria',
    description: 'Learn how to use DownAria to download videos from Facebook, Instagram, Twitter, TikTok, YouTube, and Weibo. Complete guide with API reference.',
    keywords: ['DownAria docs', 'video downloader guide', 'social media downloader tutorial', 'API documentation'],
    openGraph: {
        title: 'DownAria Documentation',
        description: 'Complete guide to download videos from social media platforms',
        type: 'website',
    },
};

export default function DocsPage() {
    return <DocsHomePage />;
}
