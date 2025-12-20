import type { Metadata } from 'next';
import { DocsHomePage } from '@/app/docs/DocsHomePage';

export const metadata: Metadata = {
    title: 'Documentation - XTFetch',
    description: 'Learn how to use XTFetch to download videos from Facebook, Instagram, Twitter, TikTok, YouTube, and Weibo. Complete guide with API reference.',
    keywords: ['XTFetch docs', 'video downloader guide', 'social media downloader tutorial', 'API documentation'],
    openGraph: {
        title: 'XTFetch Documentation',
        description: 'Complete guide to download videos from social media platforms',
        type: 'website',
    },
};

export default function DocsPage() {
    return <DocsHomePage />;
}
