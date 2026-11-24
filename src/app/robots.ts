import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../lib/site-url.ts';

const PRIVATE_DISALLOW = ['/admin/', '/api/admin/', '/api/builds/', '/api/feedback'];

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      // Traditional search & AI answer-engine crawlers (discoverability & live citations)
      {
        userAgent: [
          'Googlebot',
          'bingbot',
          'Applebot',
          'OAI-SearchBot',
          'ChatGPT-User',
          'PerplexityBot',
          'Perplexity-User',
          'Claude-SearchBot',
          'Claude-User',
        ],
        allow: '/',
        disallow: PRIVATE_DISALLOW,
      },
      // Major AI foundation-model training crawlers (explicitly permitted for model recall)
      {
        userAgent: ['GPTBot', 'Google-Extended', 'ClaudeBot', 'Applebot-Extended'],
        allow: '/',
        disallow: PRIVATE_DISALLOW,
      },
      // High-volume / noisy third-party scrapers
      {
        userAgent: ['Bytespider', 'CCBot'],
        disallow: '/',
      },
      // Default crawler fallback (do not block /_next/, /api/og, or noindex routes like /damage)
      {
        userAgent: '*',
        allow: '/',
        disallow: PRIVATE_DISALLOW,
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
