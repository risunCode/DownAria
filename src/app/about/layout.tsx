import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "About | XTFetch - Free Social Media Downloader Story",
    description: "Learn about XTFetch, the free social media video downloader. Built with love by risunCode. No limits, no watermarks, 100% free. View changelog and supported platforms.",
    openGraph: {
        title: "About XTFetch | Free Social Media Downloader",
        description: "The story behind XTFetch. Download videos from Facebook, Instagram, TikTok, Twitter without limits.",
    },
};

export default function AboutLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
