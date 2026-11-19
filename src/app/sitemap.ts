import type { MetadataRoute } from 'next';
import charactersData from '@/data/characters.json';
import { getAllDiscs, getDiscSlug } from '@/lib/discs';
import { getSiteUrl } from '@/lib/site-url';

const STATIC_ROUTES = [
  '/',
  '/trekkers',
  '/discs',
  '/builder',
  '/builder/advanced',
  '/damage',
  '/calculator',
  '/bond',
  '/roadmap',
  '/credits',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route}`,
    changeFrequency: route === '/' || route === '/roadmap' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1.0 : 0.8,
  }));

  const trekkerEntries: MetadataRoute.Sitemap = Object.values(charactersData).map((char) => ({
    url: `${siteUrl}/trekkers/${encodeURIComponent(char.name.EN)}`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const discEntries: MetadataRoute.Sitemap = getAllDiscs().map((disc) => ({
    url: `${siteUrl}/discs/${getDiscSlug(disc.name)}`,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...staticEntries, ...trekkerEntries, ...discEntries];
}
