import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getAllDiscs, getDiscBySlugOrId, getDiscSlug } from '@/lib/discs';
import DiscDetailClient from './disc-detail-client';

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
    return { title: 'Runic Disc Not Found | Stella Sora Tools' };
  }

  const elementLabel = disc.element === 'None' ? 'Neutral' : disc.element;
  return {
    title: `${disc.name} — Stella Sora Tools`,
    description: `${disc.star}-star ${elementLabel} Runic Disc — Melody Skill, Harmony Skills, stats, and Starting Support Notes for ${disc.name} in Stella Sora.`,
  };
}

async function DiscPageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DiscDetailClient slug={slug} />;
}

export default function DiscPage(props: DiscPageProps) {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-4 py-8 text-center">
          <div className="game-card celestial-card p-8 inline-block max-w-sm w-full animate-pulse">
            <div className="size-12 rounded-full bg-surface-elevated border border-border-subtle mx-auto mb-3" />
            <div className="h-5 bg-surface-elevated border border-border-subtle rounded w-36 mx-auto mb-2" />
            <div className="h-3 bg-surface-elevated border border-border-subtle rounded w-48 mx-auto" />
          </div>
        </div>
      }
    >
      <DiscPageContent params={props.params} />
    </Suspense>
  );
}
