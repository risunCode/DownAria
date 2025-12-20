import type { Metadata } from 'next';
import { EndpointsPage } from '@/app/docs/api/endpoints/EndpointsPage';

export const metadata: Metadata = {
    title: 'API Endpoints - XTFetch Docs',
    description: 'Complete API endpoint reference for XTFetch. POST /api, GET /api/status, proxy endpoints and more.',
    keywords: ['API endpoints', 'XTFetch API reference', 'REST endpoints', 'video download endpoint'],
    openGraph: {
        title: 'API Endpoints - XTFetch',
        description: 'Complete API endpoint reference with examples',
    },
};

export default function Page() {
    return <EndpointsPage />;
}
