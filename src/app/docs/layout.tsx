import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Documentation - DownAria',
    description: 'Learn how to use DownAria API to download videos from social media platforms.',
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
    // No separate layout - use main app layout with SidebarLayout
    return children;
}
