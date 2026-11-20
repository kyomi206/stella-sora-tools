import type { Metadata } from 'next';
import { RoadmapTimeline } from '@/components/roadmap/roadmap-timeline';
import { JsonLd } from '@/components/seo/json-ld';
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  buildWebApplicationJsonLd,
} from '@/lib/seo';

const DESCRIPTION =
  'Track ongoing and upcoming Stella Sora recruitment banners, Runic Disc banners, Boss Blitz raids, main story events, and Cataclysm Survivor seasons on an interactive timeline.';

export const metadata: Metadata = buildPageMetadata({
  title: 'Events Roadmap & Banner Schedule',
  description: DESCRIPTION,
  path: '/roadmap',
  keywords: [
    'Stella Sora events roadmap',
    'Stella Sora banner schedule',
    'Stella Sora Boss Blitz',
    'Stella Sora upcoming banners',
  ],
});

export default function EventsRoadmapPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      buildWebApplicationJsonLd(
        {
          name: 'KiyoStella Events Roadmap & Banner Schedule',
          description: DESCRIPTION,
          path: '/roadmap',
          featureList: [
            'Interactive Gantt timeline for Stella Sora character and Runic Disc banners',
            'Boss Blitz raid schedules and Cataclysm Survivor seasonal tracking',
            'Unreleased Trekker previews and banner duration countdowns',
          ],
        },
        { includeContext: false }
      ),
      buildBreadcrumbJsonLd(
        [
          { name: 'Home', path: '/' },
          { name: 'Events Roadmap', path: '/roadmap' },
        ],
        { includeContext: false }
      ),
    ],
  };

  return (
    <div className="flex flex-col gap-6 w-full px-4 sm:px-6 md:px-8 py-6">
      <JsonLd data={jsonLd} />
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border-subtle pb-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Events Roadmap
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-3xl">
            Track ongoing and upcoming Stella Sora character recruitment pools, companion Runic Discs, Boss Blitz raids, main story releases, and Cataclysm Survivor seasons powered by datamined game client schedules.
          </p>
        </div>
      </div>

      {/* Main Interactive Roadmap Timeline */}
      <RoadmapTimeline />

    </div>
  );
}
