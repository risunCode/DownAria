import type { Metadata } from 'next';
import { EndpointsPage } from '@/app/docs/api/endpoints/EndpointsPage';

export const metadata: Metadata = {
    title: 'API Endpoints - DownAria Docs',
    description: 'Complete API endpoint reference for DownAria. POST /api, GET /api/status, proxy endpoints and more.',
    keywords: ['API endpoints', 'DownAria API reference', 'REST endpoints', 'video download endpoint'],
    openGraph: {
        title: 'API Endpoints - DownAria',
        description: 'Complete API endpoint reference with examples',
    },
};

export default function Page() {
    return <EndpointsPage />;
}
