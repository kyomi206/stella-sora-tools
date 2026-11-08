import { ToolsGrid } from '@/components/home/tools-grid';
import { TrekkerSpotlight } from '@/components/home/trekker-spotlight';
import { ResetTimer } from '@/components/home/reset-timer';

export default function HomePage() {
  return (
    <article className="flex flex-col gap-8 max-w-5xl mx-auto px-4 py-6">
      {/* Header Welcome Section */}
      <section className="flex flex-col gap-2.5 pb-5 border-b border-border-subtle">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Stella Sora Tools
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
          A minimal web companion for Stella Sora. Squad builder with potentials, heartlink affinity optimizer, and event timelines.
        </p>
      </section>

      {/* Tools & Resources Grid */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
            Tools & Calculators
          </h2>
        </div>
        <ToolsGrid />
      </section>

      {/* Daily Status & Trekker of the Day */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TrekkerSpotlight />
        <ResetTimer />
      </section>
    </article>
  );
}
