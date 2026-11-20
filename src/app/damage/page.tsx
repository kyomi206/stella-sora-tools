import type { Metadata } from 'next';
import { DamageClient } from './damage-client';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Damage Calculator',
  description:
    'In-development theoretical damage calculator for Stella Sora team compositions on KiyoStella.',
  path: '/damage',
  noIndex: true,
});

export default function DamageCalculatorPage() {
  return <DamageClient />;
}
