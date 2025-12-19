import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Shared Content | XTFetch - Social Media Downloader',
    description: 'Download shared social media content instantly. Fast and easy video downloader for Facebook, Instagram, TikTok, and more.',
};

export default function ShareLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
