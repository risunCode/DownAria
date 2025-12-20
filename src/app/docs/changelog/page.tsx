import type { Metadata } from 'next';
import { ChangelogPage } from '@/app/docs/changelog/ChangelogPage';

export const metadata: Metadata = {
    title: 'Changelog - XTFetch Docs',
    description: 'XTFetch version history and release notes. See what\'s new in each update.',
    keywords: ['changelog', 'release notes', 'updates', 'version history'],
    openGraph: {
        title: 'Changelog - XTFetch',
        description: 'Version history and release notes',
    },
};

export default function Page() {
    return <ChangelogPage />;
}
