import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { PendingDownloadProvider } from "@/lib/contexts/PendingDownloadContext";
import { IntlProvider } from "@/components/IntlProvider";
import { StructuredData, FAQStructuredData } from "@/components/StructuredData";
import { SkipToContent } from "@/components/ui/Accessibility";
import { MaintenanceCheck } from "@/components/MaintenanceCheck";
import { SeasonalEffects } from "@/components/SeasonalEffects";
import { AdaptText } from "@/components/AdaptText";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  title: "DownAria - Free Social Media Video Downloader | Facebook, Instagram, TikTok, Twitter",
  description: "Download videos, reels, stories from Facebook, Instagram, TikTok, Twitter/X, Weibo for free. No watermark, no login, unlimited downloads. Fast & easy social media downloader by risunCode.",
  keywords: [
    "downaria", "down aria", "downaria downloader", "social media downloader", "video downloader",
    "facebook downloader", "fb downloader", "facebook video downloader free", "download fb video",
    "instagram downloader", "ig downloader", "instagram reels downloader", "download instagram video",
    "tiktok downloader", "tiktok video downloader", "download tiktok without watermark",
    "twitter downloader", "x downloader", "twitter video downloader", "download twitter video",
    "weibo downloader", "weibo video downloader",
    "no watermark downloader", "free video downloader", "online video downloader",
    "download reels", "download stories", "download shorts",
    "risuncode", "risuncode github", "github risuncode", "github/risuncode"
  ],
  authors: [{ name: "risunCode", url: "https://github.com/risunCode" }],
  creator: "risunCode",
  publisher: "risunCode",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DownAria",
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "DownAria - Free Social Media Video Downloader",
    description: "Download videos from Facebook, Instagram, TikTok, Twitter/X for free. No watermark, unlimited downloads.",
    type: "website",
    images: ["/icon.png"],
    siteName: "DownAria",
  },
  twitter: {
    card: "summary",
    title: "DownAria - Free Social Media Downloader",
    description: "Download videos from Facebook, Instagram, TikTok, Twitter/X for free.",
    images: ["/icon.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0d1117" />
        <meta name="screen-orientation" content="portrait" />
        <StructuredData />
        <FAQStructuredData />
      </head>
      <body
        className={`${jetbrainsMono.variable} font-mono antialiased bg-[var(--bg-primary)] text-[var(--text-primary)]`}
      >
        <SkipToContent />
        <SeasonalEffects />
        <AdaptText />
        <IntlProvider>
          <PendingDownloadProvider>
            <MaintenanceCheck>
              <ServiceWorkerRegister />
              {children}
            </MaintenanceCheck>
          </PendingDownloadProvider>
        </IntlProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
