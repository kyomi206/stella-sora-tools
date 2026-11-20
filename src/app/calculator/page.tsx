import type { Metadata } from 'next';
import { CalculatorClient } from './calculator-client';
import { JsonLd } from '@/components/seo/json-ld';
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  buildWebApplicationJsonLd,
} from '@/lib/seo';

const DESCRIPTION =
  'Calculate exact Dorra, EXP, class breakthrough materials, and skill cartridge costs to raise any Stella Sora Trekker from level 1–90 and skill ranks 1–10.';

export const metadata: Metadata = buildPageMetadata({
  title: 'Resource Calculator',
  description: DESCRIPTION,
  path: '/calculator',
  keywords: [
    'Stella Sora resource calculator',
    'Stella Sora upgrade materials',
    'Stella Sora skill materials',
    'Stella Sora dorra calculator',
  ],
});

export default function ResourceCalculatorPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      buildWebApplicationJsonLd(
        {
          name: 'KiyoStella Resource Calculator',
          description: DESCRIPTION,
          path: '/calculator',
          featureList: [
            'Level 1–90 EXP and breakthrough material tally',
            'Normal, Combat, Support, and Ultimate skill rank 1–10 costs',
            'Exact Dorra and class-specific cartridge breakdown per Trekker',
          ],
        },
        { includeContext: false }
      ),
      buildBreadcrumbJsonLd(
        [
          { name: 'Home', path: '/' },
          { name: 'Resource Calculator', path: '/calculator' },
        ],
        { includeContext: false }
      ),
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <CalculatorClient />
    </>
  );
}
