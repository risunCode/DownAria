import type { Metadata } from 'next';
import { FAQPage } from '@/app/docs/faq/FAQPage';

export const metadata: Metadata = {
    title: 'FAQ - DownAria Docs',
    description: 'Frequently asked questions about DownAria. Is it free? Is it legal? What platforms are supported?',
    keywords: ['FAQ', 'frequently asked questions', 'DownAria help', 'video downloader FAQ'],
    openGraph: {
        title: 'FAQ - DownAria',
        description: 'Answers to common questions',
    },
};

export default function Page() {
    return <FAQPage />;
}
