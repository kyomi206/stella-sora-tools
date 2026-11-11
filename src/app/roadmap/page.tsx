import { Metadata } from 'next';
import { RoadmapTimeline } from '@/components/roadmap/roadmap-timeline';

export const metadata: Metadata = {
  title: 'Events Roadmap | Stella Sora Tools',
  description:
    'Comprehensive events and datamined recruitment banner schedule timeline for Stella Sora. Track upcoming character banners, runic discs, boss blitz raids, and unreleased trekker leaks.',
};

export default function EventsRoadmapPage() {
  return (
    <div className="flex flex-col gap-6 w-full px-4 sm:px-6 md:px-8 py-6">
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
