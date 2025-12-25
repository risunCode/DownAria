import type { Metadata } from 'next';
import { ApiOverviewPage } from '@/app/docs/api/ApiOverviewPage';

export const metadata: Metadata = {
    title: 'API Overview - DownAria Docs',
    description: 'DownAria API overview. Learn how to integrate video downloading into your applications with our simple REST API.',
    keywords: ['DownAria API', 'video download API', 'social media API', 'REST API'],
    openGraph: {
        title: 'API Overview - DownAria',
        description: 'Integrate video downloading into your apps with DownAria API',
    },
};

export default function Page() {
    return <ApiOverviewPage />;
}
