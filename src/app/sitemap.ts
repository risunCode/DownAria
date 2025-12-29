import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = 'https://downaria.vercel.app';

    // Base routes
    const routes: MetadataRoute.Sitemap = [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: `${baseUrl}/about`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/docs`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.8,
        },
        {
            url: `${baseUrl}/history`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.6,
        },
        {
            url: `${baseUrl}/advanced`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: `${baseUrl}/privacy`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.3,
        },
        {
            url: `${baseUrl}/credits`,
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.4,
        },
    ];

    // Programmatic SEO Routes
    const platforms = ['tiktok', 'facebook', 'instagram', 'twitter', 'weibo', 'youtube'];
    const types = ['video', 'download', 'saver'];

    // Add specific high-value combinations
    const combinations = [
        { p: 'tiktok', t: 'video' },
        { p: 'tiktok', t: 'no-watermark' },
        { p: 'tiktok', t: 'mp3' },
        { p: 'facebook', t: 'video' },
        { p: 'facebook', t: 'reels' },
        { p: 'instagram', t: 'reels' },
        { p: 'instagram', t: 'stories' },
        { p: 'instagram', t: 'photo' },
        { p: 'twitter', t: 'video' },
        { p: 'weibo', t: 'video' },
        { p: 'youtube', t: 'video' },
        { p: 'youtube', t: 'mp3' },
    ];

    combinations.forEach(({ p, t }) => {
        routes.push({
            url: `${baseUrl}/download/${p}/${t}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.9,
        });
    });

    return routes;
}
