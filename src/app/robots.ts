import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: ['/admin', '/api', '/settings', '/share'],
        },
        sitemap: 'https://downaria.vercel.app/sitemap.xml',
    };
}
