import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "History | XTFetch - View Your Download History",
    description: "View and manage your past social media downloads. All data stored locally on your device for maximum privacy. No tracking, no server storage.",
    openGraph: {
        title: "Download History | XTFetch",
        description: "View and manage your past social media downloads.",
    },
};

export default function HistoryLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
