import type { Metadata } from 'next';
import { CookieGuidePage } from '@/app/docs/guides/cookies/CookieGuidePage';

export const metadata: Metadata = {
    title: 'Cookie Setup Guide - DownAria Docs',
    description: 'How to get and use cookies for downloading private content from Instagram, Facebook, and other platforms.',
    keywords: ['cookie setup', 'private content', 'Instagram cookie', 'Facebook cookie', 'browser cookie'],
    openGraph: {
        title: 'Cookie Setup Guide - DownAria',
        description: 'Download private content with cookie authentication',
    },
};

export default function Page() {
    return <CookieGuidePage />;
}
