import type { Metadata } from 'next';
import { ApiKeysGuidePage } from '@/app/docs/guides/api-keys/ApiKeysGuidePage';

export const metadata: Metadata = {
    title: 'API Keys Guide - DownAria Docs',
    description: 'How to create and manage API keys for higher rate limits and usage tracking in DownAria.',
    keywords: ['API key', 'rate limits', 'authentication', 'API access'],
    openGraph: {
        title: 'API Keys Guide - DownAria',
        description: 'Get higher rate limits with API keys',
    },
};

export default function Page() {
    return <ApiKeysGuidePage />;
}
