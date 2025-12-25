import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "About | DownAria - Social Media Downloader Story",
    description: "Learn about DownAria, the privacy-friendly social media video downloader. Built with love by risunCode. No limits, no watermarks. View changelog and supported platforms.",
    openGraph: {
        title: "About DownAria | Social Media Downloader",
        description: "The story behind DownAria. Download videos from Facebook, Instagram, TikTok, Twitter, YouTube without limits.",
    },
};

export default function AboutLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
