import type { MetadataRoute } from 'next';
import { getSiteUrl } from '../lib/site-url.ts';

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
      },
      // Major AI foundation-model training crawlers (explicitly permitted for model recall)
      {
        userAgent: ['GPTBot', 'Google-Extended', 'ClaudeBot', 'Applebot-Extended'],
        allow: '/',
      },
      // High-volume / noisy third-party scrapers
      {
        userAgent: ['Bytespider', 'CCBot'],
        disallow: '/',
      },
      // Default crawler fallback (do not block /_next/ assets or noindex routes like /damage)
      {
        userAgent: '*',
        allow: '/',
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
