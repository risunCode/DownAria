import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Settings | DownAria - Customize Your Experience",
    description: "Configure DownAria settings - themes, cookies, storage, and integrations. Personalize your social media downloader experience.",
    openGraph: {
        title: "Settings | DownAria",
        description: "Configure your DownAria settings and preferences.",
    },
};

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
