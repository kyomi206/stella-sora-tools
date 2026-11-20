import type { Metadata } from 'next';
import { getSiteUrl } from './site-url.ts';

export const SITE_NAME = 'KiyoStella';
export const SITE_ALTERNATE_NAMES = ['Stella Sora Tools', 'SSTT'] as const;
export const DEFAULT_OG_IMAGE = '/kiyostella.png';
export const DEFAULT_OG_WIDTH = 1200;
export const DEFAULT_OG_HEIGHT = 630;
export const DEFAULT_OG_ALT = 'KiyoStella — a Stella Sora utility web';
export const SITE_REPO_URL = 'https://github.com/kyomi206/stella-sora-tools';
export const CONTENT_LAST_MODIFIED = '2026-11-20';

export function normalizeCanonicalPath(path: string): string {
  if (!path || path === '/') return '/';
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
}

export function toAbsoluteUrl(path: string): string {
  const siteUrl = getSiteUrl();
  const normalized = normalizeCanonicalPath(path);
  return normalized === '/' ? `${siteUrl}/` : `${siteUrl}${normalized}`;
}

export interface PageMetadataOptions {
  title: string;
  absoluteTitle?: boolean;
  description: string;
  path: string;
  noIndex?: boolean;
  type?: 'website' | 'article';
  keywords?: string[];
}

export function buildPageMetadata(opts: PageMetadataOptions): Metadata {
  const canonicalPath = normalizeCanonicalPath(opts.path);
  const fullTitle = opts.absoluteTitle ? opts.title : `${opts.title} | kiyostella`;

  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    ...(opts.keywords ? { keywords: opts.keywords } : {}),
    alternates: {
      canonical: canonicalPath,
    },
    robots: opts.noIndex
      ? {
          index: false,
          follow: true,
          googleBot: {
            index: false,
            follow: true,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
    openGraph: {
      type: opts.type ?? 'website',
      siteName: SITE_NAME,
      locale: 'en_US',
      url: canonicalPath,
      title: fullTitle,
      description: opts.description,
      images: [
        {
          url: DEFAULT_OG_IMAGE,
          width: DEFAULT_OG_WIDTH,
          height: DEFAULT_OG_HEIGHT,
          alt: DEFAULT_OG_ALT,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: opts.description,
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
  options: { includeContext?: boolean } = {}
) {
  const includeContext = options.includeContext ?? true;
  return {
    ...(includeContext ? { '@context': 'https://schema.org' } : {}),
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: toAbsoluteUrl(item.path),
    })),
  };
}

export function buildWebApplicationJsonLd(
  opts: {
    name: string;
    description: string;
    path: string;
    featureList: string[];
  },
  options: { includeContext?: boolean } = {}
) {
  const includeContext = options.includeContext ?? true;
  return {
    ...(includeContext ? { '@context': 'https://schema.org' } : {}),
    '@type': 'WebApplication',
    name: opts.name,
    description: opts.description,
    url: toAbsoluteUrl(opts.path),
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any (Web Browser)',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: opts.featureList,
    about: {
      '@type': 'VideoGame',
      name: 'Stella Sora',
      publisher: {
        '@type': 'Organization',
        name: 'Yostar',
      },
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: toAbsoluteUrl('/'),
    },
  };
}
