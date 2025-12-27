import type { Metadata } from 'next';
import { TroubleshootingPage } from '@/app/docs/guides/troubleshooting/TroubleshootingPage';

export const metadata: Metadata = {
    title: 'Troubleshooting - DownAria Docs',
    description: 'Common issues and solutions when using DownAria. Fix download errors, cookie problems, and more.',
    keywords: ['troubleshooting', 'fix errors', 'common issues', 'DownAria help'],
    openGraph: {
        title: 'Troubleshooting - DownAria',
        description: 'Solutions for common issues',
    },
};

export default function Page() {
    return <TroubleshootingPage />;
}
