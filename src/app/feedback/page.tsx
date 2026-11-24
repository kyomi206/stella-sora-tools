import type { Metadata } from 'next';
import { JsonLd } from '@/components/seo/json-ld';
import { buildBreadcrumbJsonLd, buildPageMetadata } from '@/lib/seo';
import { FeedbackClient } from './feedback-client';

export const metadata: Metadata = buildPageMetadata({
  title: 'Send Feedback',
  description:
    'Send bug reports, math or data corrections, and feature ideas privately to the Stella Sora Tools maintainer.',
  path: '/feedback',
});

export default function FeedbackPage() {
  return (
    <>
      <JsonLd
        data={buildBreadcrumbJsonLd([
          { name: 'Home', path: '/' },
          { name: 'Send Feedback', path: '/feedback' },
        ])}
      />
      <FeedbackClient />
    </>
  );
}
