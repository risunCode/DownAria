import type { Metadata } from 'next';
import { FAQPage } from '@/app/docs/faq/FAQPage';

export const metadata: Metadata = {
    title: 'FAQ - XTFetch Docs',
    description: 'Frequently asked questions about XTFetch. Is it free? Is it legal? What platforms are supported?',
    keywords: ['FAQ', 'frequently asked questions', 'XTFetch help', 'video downloader FAQ'],
    openGraph: {
        title: 'FAQ - XTFetch',
        description: 'Answers to common questions',
    },
};

export default function Page() {
    return <FAQPage />;
}
