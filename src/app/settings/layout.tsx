import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Settings | XTFetch - Customize Your Experience",
    description: "Configure XTFetch settings - themes, cookies, storage, and integrations. Personalize your social media downloader experience.",
    openGraph: {
        title: "Settings | XTFetch",
        description: "Configure your XTFetch settings and preferences.",
    },
};

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
