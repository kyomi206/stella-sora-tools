import type { Metadata } from 'next';
import { BondClient } from './bond-client';
import { JsonLd } from '@/components/seo/json-ld';
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  buildWebApplicationJsonLd,
} from '@/lib/seo';

const DESCRIPTION =
  'Calculate exact Affinity EXP required to level up Stella Sora Trekkers, prioritize +50% loved gifts over neutral gifts, auto-fill gift allocations, and track days needed under the 10 gifts/day mail limit.';

export const metadata: Metadata = buildPageMetadata({
  title: 'Affinity Calculator',
  description: DESCRIPTION,
  path: '/bond',
  keywords: [
    'Stella Sora affinity calculator',
    'Stella Sora bond calculator',
    'Stella Sora heartlink',
    'Stella Sora gifts',
  ],
});

export default function BondCalculatorPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      buildWebApplicationJsonLd(
        {
          name: 'KiyoStella Affinity Calculator',
          description: DESCRIPTION,
          path: '/bond',
          featureList: [
            'Current-to-target Affinity level EXP calculation',
            'Loved (+50% EXP), Neutral, and Disliked gift preference matching per Trekker',
            'One-click optimal gift allocation auto-fill',
            'Daily 10 gifts/day Heartlink mail days planner',
          ],
        },
        { includeContext: false }
      ),
      buildBreadcrumbJsonLd(
        [
          { name: 'Home', path: '/' },
          { name: 'Affinity Calculator', path: '/bond' },
        ],
        { includeContext: false }
      ),
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <BondClient />
    </>
  );
}
