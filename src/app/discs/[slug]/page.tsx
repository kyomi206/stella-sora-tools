import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getAllDiscs,
  getDiscBySlugOrId,
  getDiscSlug,
  getExclusiveBannerByDiscId,
} from '@/lib/discs';
import { JsonLd } from '@/components/seo/json-ld';
import {
  buildBreadcrumbJsonLd,
  buildDiscDescription,
  buildPageMetadata,
  toAbsoluteUrl,
} from '@/lib/seo';
import DiscDetailClient, {
  type DiscNavItem,
  type ExclusiveBannerSummary,
} from './disc-detail-client';

export const ensureStatic = 'navigation';

/**
 * Generate static paths for all 106 Runic Discs in the local dataset.
 * Supports canonical lowercase slugs and numeric IDs.
 */
export function generateStaticParams() {
  const params: { slug: string }[] = [];
  for (const disc of getAllDiscs()) {
    params.push({ slug: getDiscSlug(disc.name) });
    params.push({ slug: String(disc.id) });
  }
  return params;
}

interface DiscPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: DiscPageProps): Promise<Metadata> {
  const { slug } = await params;
  const disc = getDiscBySlugOrId(slug);

  if (!disc) {
    return buildPageMetadata({
      title: 'Runic Disc Not Found',
      description: 'The requested Stella Sora Runic Disc could not be found.',
      path: '/discs',
      noIndex: true,
    });
  }

  const exclusive = getExclusiveBannerByDiscId(disc.id);
  const elementLabel = disc.element === 'None' ? 'Neutral' : disc.element;
  const canonicalPath = `/discs/${getDiscSlug(disc.name)}`;

  return buildPageMetadata({
    title: disc.name,
    description: buildDiscDescription(disc, exclusive?.trekkerName),
    path: canonicalPath,
    type: 'article',
    ogImage: {
      url: `/api/og?type=disc&id=${disc.id}`,
      width: 1200,
      height: 630,
      alt: `${disc.name} — Stella Sora Runic Disc`,
    },
    keywords: [
      disc.name,
      `Stella Sora ${disc.name}`,
      `${disc.name} Runic Disc`,
      `${elementLabel} Runic Disc`,
    ],
  });
}

export default async function DiscPage({ params }: DiscPageProps) {
  const { slug } = await params;
  const disc = getDiscBySlugOrId(slug);

  if (!disc) {
    notFound();
  }

  const allDiscs = getAllDiscs();
  const currentIdx = allDiscs.findIndex((d) => d.id === disc.id);
  const rawPrev =
    currentIdx >= 0
      ? allDiscs[(currentIdx - 1 + allDiscs.length) % allDiscs.length]
      : allDiscs[0];
  const rawNext =
    currentIdx >= 0 ? allDiscs[(currentIdx + 1) % allDiscs.length] : allDiscs[0];

  const prevDisc: DiscNavItem = {
    name: rawPrev.name,
    slug: getDiscSlug(rawPrev.name),
  };
  const nextDisc: DiscNavItem = {
    name: rawNext.name,
    slug: getDiscSlug(rawNext.name),
  };

  const exclusive = getExclusiveBannerByDiscId(disc.id);
  const exclusiveBanner: ExclusiveBannerSummary | null = exclusive
    ? {
        trekkerId: exclusive.trekkerId,
        trekkerName: exclusive.trekkerName,
        bannerName: exclusive.bannerName,
        bannerKind: exclusive.bannerKind,
      }
    : null;

  const canonicalPath = `/discs/${getDiscSlug(disc.name)}`;
  const description = buildDiscDescription(disc, exclusive?.trekkerName);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        name: disc.name,
        url: toAbsoluteUrl(canonicalPath),
        description,
        about: {
          '@type': 'Thing',
          name: disc.name,
          description,
        },
      },
      buildBreadcrumbJsonLd(
        [
          { name: 'Home', path: '/' },
          { name: 'Runic Disc Encyclopedia', path: '/discs' },
          { name: disc.name, path: canonicalPath },
        ],
        { includeContext: false }
      ),
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <DiscDetailClient
        disc={disc}
        prevDisc={prevDisc}
        nextDisc={nextDisc}
        exclusiveBanner={exclusiveBanner}
      />
    </>
  );
}
