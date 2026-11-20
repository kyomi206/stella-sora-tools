import type { Metadata } from 'next';
import { AdvancedBuilderClient } from './advanced-builder-client';
import { JsonLd } from '@/components/seo/json-ld';
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  buildWebApplicationJsonLd,
} from '@/lib/seo';

const DESCRIPTION =
  'Configure complete Stella Sora squad presets with 3 Trekkers, Potentials, 3 Main and 3 Support Runic Discs, Musical Notes harmony matching, SST1 advanced preset codes, and high-resolution build cards.';

export const metadata: Metadata = buildPageMetadata({
  title: 'Advanced Preset Visualizer',
  description: DESCRIPTION,
  path: '/builder/advanced',
  keywords: [
    'Stella Sora advanced builder',
    'Stella Sora team presets',
    'Stella Sora runic disc setup',
    'Stella Sora musical notes',
    'SST1 preset code',
  ],
});

export default function AdvancedBuilderPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      buildWebApplicationJsonLd(
        {
          name: 'KiyoStella Advanced Preset Visualizer',
          description: DESCRIPTION,
          path: '/builder/advanced',
          featureList: [
            'Full 3-Trekker squad and Potential configuration',
            '3 Main and 3 Support Runic Disc slot configuration with Crescendo and Phase controls',
            'Automatic Musical Notes harmony requirement calculator',
            'In-game and SST1 extended preset code import/export',
            'Local saved preset library and PNG card export',
          ],
        },
        { includeContext: false }
      ),
      buildBreadcrumbJsonLd(
        [
          { name: 'Home', path: '/' },
          { name: 'Preset Visualizer', path: '/builder' },
          { name: 'Advanced Preset Visualizer', path: '/builder/advanced' },
        ],
        { includeContext: false }
      ),
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <AdvancedBuilderClient />
    </>
  );
}
