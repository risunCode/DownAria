import type { Metadata } from 'next';
import { TroubleshootingPage } from '@/app/docs/guides/troubleshooting/TroubleshootingPage';

export const metadata: Metadata = {
    title: 'Troubleshooting - XTFetch Docs',
    description: 'Common issues and solutions when using XTFetch. Fix download errors, cookie problems, and more.',
    keywords: ['troubleshooting', 'fix errors', 'common issues', 'XTFetch help'],
    openGraph: {
        title: 'Troubleshooting - XTFetch',
        description: 'Solutions for common issues',
    },
};

export default function Page() {
    return <TroubleshootingPage />;
}
