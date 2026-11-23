import { Suspense } from 'react';
import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/seo';
import {
  LocalBuildDetailClient,
  LocalBuildDetailSkeleton,
} from './local-build-detail-client';

export const metadata: Metadata = buildPageMetadata({
  title: 'Saved Build Analytics',
  description: 'Customize local squad rotations and live auto-calculated investment math.',
  path: '/builds/local',
  noIndex: true,
});

export default function LocalBuildDetailPage() {
  return (
    <Suspense fallback={<LocalBuildDetailSkeleton />}>
      <LocalBuildDetailClient />
    </Suspense>
  );
}
