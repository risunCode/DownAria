import { Metadata } from 'next';
import Home from '@/app/page';
import { PlatformId } from '@/lib/types';

type Props = {
    params: Promise<{
        platform: string;
        type: string;
    }>;
};

// Helper to format text (e.g., "tiktok" -> "TikTok")
function formatPlatformName(p: string): string {
    const map: Record<string, string> = {
        tiktok: 'TikTok',
        facebook: 'Facebook',
        instagram: 'Instagram',
        twitter: 'Twitter/X',
        weibo: 'Weibo',
        youtube: 'YouTube'
    };
    return map[p.toLowerCase()] || p.charAt(0).toUpperCase() + p.slice(1);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { platform, type } = await params;
    const pName = formatPlatformName(platform);
    const tName = type.charAt(0).toUpperCase() + type.slice(1);
    const currentYear = new Date().getFullYear();

    return {
        title: `Download ${pName} ${tName} - No Watermark & Free ${currentYear} | DownAria`,
        description: `Best online ${pName} ${tName} downloader. Save ${pName} videos in HD/4K without watermark. Fast, free, and no login required.`,
        keywords: [
            `${platform} downloader`,
            `download ${platform} ${type}`,
            `${platform} ${type} saver`,
            `${platform} to mp4`,
            `save ${platform} ${type}`,
            `download ${platform} no watermark`,
            'online video downloader',
            'free downloader',
            'risuncode',
            'surfmanager'
        ],
        openGraph: {
            title: `Download ${pName} ${tName} - Fast & Free`,
            description: `Save ${pName} videos without watermark in highest quality.`,
            type: 'website',
        }
    };
}

export default async function Page({ params }: Props) {
    const { platform } = await params;

    // Validate platform
    const validPlatforms: PlatformId[] = ['tiktok', 'facebook', 'instagram', 'twitter', 'weibo', 'youtube'];
    const normalizedPlatform = validPlatforms.includes(platform as PlatformId)
        ? (platform as PlatformId)
        : 'facebook'; // Default fallback

    // We reuse the main Home component logic but effectively pre-select the platform
    // Note: The Home component controls its own state, so we might need to modify it 
    // to accept an initialPlatform prop if we want it to auto-switch tabs.
    // For now, let's render it as is - the Metadata is the main SEO gain.
    // Ideally, we'd refactor Home to accept props.

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "HowTo",
                        "name": `How to Download ${formatPlatformName(platform)} ${platform === 'instagram' ? 'Reels' : 'Videos'}`,
                        "description": `Step-by-step guide to download ${platform} content.`,
                        "step": [
                            {
                                "@type": "HowToStep",
                                "name": "Copy Link",
                                "text": `Copy the link of the ${platform} video you want to download.`
                            },
                            {
                                "@type": "HowToStep",
                                "name": "Paste Link",
                                "text": "Paste the link into the input box on DownAria."
                            },
                            {
                                "@type": "HowToStep",
                                "name": "Download",
                                "text": "Click the Download button and choose your preferred quality."
                            }
                        ]
                    })
                }}
            />
            <Home />
        </>
    );
}
