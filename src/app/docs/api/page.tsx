import type { Metadata } from 'next';
import { ApiOverviewPage } from '@/app/docs/api/ApiOverviewPage';

export const metadata: Metadata = {
    title: 'API Overview - XTFetch Docs',
    description: 'XTFetch API overview. Learn how to integrate video downloading into your applications with our simple REST API.',
    keywords: ['XTFetch API', 'video download API', 'social media API', 'REST API'],
    openGraph: {
        title: 'API Overview - XTFetch',
        description: 'Integrate video downloading into your apps with XTFetch API',
    },
};

export default function Page() {
    return <ApiOverviewPage />;
}
