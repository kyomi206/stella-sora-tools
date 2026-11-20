import type { MetadataRoute } from 'next';
import charactersData from '../data/characters.json' with { type: 'json' };
import { getAllDiscs, getDiscSlug } from '../lib/discs.ts';
import { CONTENT_LAST_MODIFIED, toAbsoluteUrl } from '../lib/seo.ts';

const STATIC_ROUTES: ReadonlyArray<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
}> = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/trekkers', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/discs', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/builder', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/builder/advanced', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/bond', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/calculator', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/roadmap', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/credits', changeFrequency: 'monthly', priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const seenUrls = new Set<string>();
  const entries: MetadataRoute.Sitemap = [];

  const pushEntry = (entry: MetadataRoute.Sitemap[number]) => {
    if (seenUrls.has(entry.url)) return;
    seenUrls.add(entry.url);
    entries.push(entry);
  };

  for (const route of STATIC_ROUTES) {
    pushEntry({
      url: toAbsoluteUrl(route.path),
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
    });
  }

  const characters = Object.values(charactersData).sort((a, b) =>
    a.name.EN.localeCompare(b.name.EN)
  );
  for (const char of characters) {
    pushEntry({
      url: toAbsoluteUrl(`/trekkers/${encodeURIComponent(char.name.EN)}`),
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  for (const disc of getAllDiscs()) {
    pushEntry({
      url: toAbsoluteUrl(`/discs/${getDiscSlug(disc.name)}`),
      lastModified: CONTENT_LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  return entries;
}
