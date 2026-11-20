import type { Metadata } from 'next';
import { BuilderClient } from './builder-client';
import { JsonLd } from '@/components/seo/json-ld';
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  buildWebApplicationJsonLd,
} from '@/lib/seo';

const DESCRIPTION =
  'Build 3-Trekker Stella Sora squads across Vanguard, Versatile, and Support slots, pick Core and Normal Potentials, import/export in-game preset codes, save local bookmarks, and export shareable build cards.';

export const metadata: Metadata = buildPageMetadata({
  title: 'Preset Visualizer & Squad Builder',
  description: DESCRIPTION,
  path: '/builder',
  keywords: [
    'Stella Sora team builder',
    'Stella Sora squad builder',
    'Stella Sora preset visualizer',
    'Stella Sora preset code',
    'Stella Sora potentials',
  ],
});

export default function BuilderPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      buildWebApplicationJsonLd(
        {
          name: 'KiyoStella Preset Visualizer & Squad Builder',
          description: DESCRIPTION,
          path: '/builder',
          featureList: [
            '3-Trekker Vanguard, Versatile, and Support squad planner',
            'Core and Normal Potential picker with priority tags',
            'In-game 36-character preset code import and export',
            'Local squad bookmarks and compressed URL sharing',
            'High-resolution PNG build card export',
          ],
        },
        { includeContext: false }
      ),
      buildBreadcrumbJsonLd(
        [
          { name: 'Home', path: '/' },
          { name: 'Preset Visualizer & Squad Builder', path: '/builder' },
        ],
        { includeContext: false }
      ),
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <BuilderClient />
    </>
  );
}
