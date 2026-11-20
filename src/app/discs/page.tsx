import type { Metadata } from 'next';
import { getAllDiscs, getDiscSlug } from '@/lib/discs';
import { DiscsClient } from './discs-client';
import { JsonLd } from '@/components/seo/json-ld';
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  toAbsoluteUrl,
} from '@/lib/seo';

const allDiscs = getAllDiscs();

const DESCRIPTION = `Browse all ${allDiscs.length} Stella Sora Runic Discs, filterable by Element, Rarity, Tags, Support Notes, and Harmony Notes, with Melody Skills and Crescendo scaling.`;

export const metadata: Metadata = buildPageMetadata({
  title: 'Runic Discs',
  description: DESCRIPTION,
  path: '/discs',
  keywords: [
    'Stella Sora runic disc database',
    'Stella Sora discs',
    'Stella Sora runic discs',
    'Stella Sora musical notes',
  ],
});

export default function DiscsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Stella Sora Runic Disc Encyclopedia',
        description: DESCRIPTION,
        url: toAbsoluteUrl('/discs'),
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: allDiscs.length,
          itemListElement: allDiscs.map((disc, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: disc.name,
            url: toAbsoluteUrl(`/discs/${getDiscSlug(disc.name)}`),
          })),
        },
      },
      buildBreadcrumbJsonLd(
        [
          { name: 'Home', path: '/' },
          { name: 'Runic Disc Encyclopedia', path: '/discs' },
        ],
        { includeContext: false }
      ),
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <DiscsClient />
    </>
  );
}
