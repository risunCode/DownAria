import type { Metadata } from 'next';
import { ErrorCodesPage } from '@/app/docs/api/errors/ErrorCodesPage';

export const metadata: Metadata = {
    title: 'Error Codes - XTFetch Docs',
    description: 'XTFetch API error codes and how to handle them. Troubleshoot common errors like rate limits, invalid URLs, and more.',
    keywords: ['API errors', 'error codes', 'troubleshooting', 'XTFetch errors'],
    openGraph: {
        title: 'Error Codes - XTFetch',
        description: 'API error codes reference and solutions',
    },
};

export default function Page() {
    return <ErrorCodesPage />;
}
