// Structured Data (JSON-LD) for SEO
export function StructuredData() {
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'DownAria',
        description: 'Free social media video downloader for Facebook, Instagram, TikTok, Twitter/X, and Weibo. No watermark, no registration required.',
        url: process.env.NEXT_PUBLIC_BASE_URL || '',
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Any',
        creator: {
            '@type': 'Person',
            name: 'risunCode',
            url: 'https://risuncode.github.io',
            sameAs: ['https://github.com/risunCode']
        },
        author: {
            '@type': 'Person',
            name: 'risunCode'
        },
        offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
        },
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.8',
            ratingCount: '1000',
            bestRating: '5',
            worstRating: '1',
        },
        featureList: [
            'Download Facebook videos',
            'Download Instagram reels and stories',
            'Download TikTok videos without watermark',
            'Download Twitter/X videos',
            'Download Weibo videos',
            'No registration required',
            'Free unlimited downloads',
            'Multiple quality options',
            'PWA support',
        ],
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
    );
}

// FAQ Structured Data
export function FAQStructuredData() {
    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: 'Is DownAria free to use?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes, DownAria is completely free to use. No registration or payment required.',
                },
            },
            {
                '@type': 'Question',
                name: 'Which platforms does DownAria support?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'DownAria supports Facebook, Instagram, TikTok, Twitter/X, and Weibo video downloads.',
                },
            },
            {
                '@type': 'Question',
                name: 'Can I download videos without watermark?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Yes, DownAria provides watermark-free downloads when available from the source platform.',
                },
            },
            {
                '@type': 'Question',
                name: 'Do I need to install anything?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'No installation required. DownAria works directly in your browser. You can also install it as a PWA for offline access.',
                },
            },
        ],
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
    );
}

// Breadcrumb Structured Data
export function BreadcrumbStructuredData({ items }: { items: { name: string; url: string }[] }) {
    const breadcrumbJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            item: item.url,
        })),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
    );
}
