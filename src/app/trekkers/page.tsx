import type { Metadata } from 'next';
import charactersData from '@/data/characters.json';
import { TrekkersClient } from './trekkers-client';
import { JsonLd } from '@/components/seo/json-ld';
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  toAbsoluteUrl,
} from '@/lib/seo';

const characters = Object.values(charactersData).sort((a, b) =>
  a.name.EN.localeCompare(b.name.EN)
);

const DESCRIPTION = `Browse all ${characters.length} playable Stella Sora Trekkers, filterable by Element, Style, Class, Rarity, Combat Type, and Faction, with skills, potentials, talents, and loved gifts.`;

export const metadata: Metadata = buildPageMetadata({
  title: 'Trekker Encyclopedia',
  description: DESCRIPTION,
  path: '/trekkers',
  keywords: [
    'Stella Sora trekker database',
    'Stella Sora characters',
    'Stella Sora character builds',
    'Stella Sora trekker encyclopedia',
  ],
});

export default function TrekkersPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Stella Sora Trekker Encyclopedia',
        description: DESCRIPTION,
        url: toAbsoluteUrl('/trekkers'),
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: characters.length,
          itemListElement: characters.map((char, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: char.name.EN,
            url: toAbsoluteUrl(`/trekkers/${encodeURIComponent(char.name.EN)}`),
          })),
        },
      },
      buildBreadcrumbJsonLd(
        [
          { name: 'Home', path: '/' },
          { name: 'Trekker Encyclopedia', path: '/trekkers' },
        ],
        { includeContext: false }
      ),
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <TrekkersClient />
    </>
  );
}
