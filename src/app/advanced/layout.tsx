import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Advanced Tools | XTFetch - Social Media Downloader',
    description: 'Advanced media extraction tools and proxies for power users. Extract content from Facebook HTML and direct media URLs.',
};

export default function AdvancedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
