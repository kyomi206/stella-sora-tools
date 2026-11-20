import type { Metadata } from 'next';
import { ToolsGrid } from '@/components/home/tools-grid';
import { TrekkerSpotlight } from '@/components/home/trekker-spotlight';
import { ResetTimer } from '@/components/home/reset-timer';
import { BastelinaLive2D } from '@/components/home/bastelina-live2d';
import { JsonLd } from '@/components/seo/json-ld';
import {
  buildPageMetadata,
  SITE_ALTERNATE_NAMES,
  SITE_NAME,
  SITE_REPO_URL,
  toAbsoluteUrl,
} from '@/lib/seo';

const HOME_DESCRIPTION =
  'KiyoStella is a Stella Sora web companion with a Squad & Preset Visualizer, Affinity Gift Calculator, Resource Calculator, Events Roadmap, Trekker Encyclopedia, and Runic Disc Encyclopedia.';

export const metadata: Metadata = buildPageMetadata({
  title: 'Stella Sora Tools',
  description: HOME_DESCRIPTION,
  path: '/',
  keywords: [
    'Stella Sora',
    'KiyoStella',
    'Stella Sora Tools',
    'Stella Sora team builder',
    'Stella Sora affinity calculator',
    'Stella Sora resource calculator',
    'Stella Sora trekker database',
    'Stella Sora runic disc database',
    'Stella Sora events roadmap',
  ],
});

export default function HomePage() {
  const homeUrl = toAbsoluteUrl('/');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: SITE_NAME,
        alternateName: [...SITE_ALTERNATE_NAMES],
        url: homeUrl,
        description: HOME_DESCRIPTION,
        inLanguage: 'en',
      },
      {
        '@type': 'Organization',
        name: SITE_NAME,
        alternateName: [...SITE_ALTERNATE_NAMES],
        url: homeUrl,
        logo: toAbsoluteUrl('/bastelina.png'),
        sameAs: [SITE_REPO_URL],
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
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

      <BastelinaLive2D />
    </>
  );
}
