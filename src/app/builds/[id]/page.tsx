import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import characterCombatData from '@/data/character-combat.json';
import charactersData from '@/data/characters.json';
import discsData from '@/data/discs.json';
import potentialsDbData from '@/data/potentials-db.json';
import { JsonLd } from '@/components/seo/json-ld';
import { buildDiscRankingContext } from '@/lib/calculator/disc-rankings';
import type { CharacterCombatEntry } from '@/lib/calculator/fighter-calc';
import { getCommunityBuildAnalytics } from '@/lib/community-analytics';
import { getCachedCommunityBuildById } from '@/lib/community-builds/store';
import { getResolvedCommunityPresets } from '@/lib/community-presets';
import { buildBreadcrumbJsonLd, buildPageMetadata } from '@/lib/seo';
import type { SSCharacter, SSDisc, SSPotentialFull } from '@/types';
import { BuildDetailClient, type SlicedPotentialMeta } from './build-detail-client';

export function generateStaticParams() {
  const presets = getResolvedCommunityPresets(undefined, { includeArchived: true });
  if (presets.length === 0) {
    return [{ id: '_placeholder' }];
  }
  return presets.map((preset) => ({ id: preset.id }));
}

interface BuildPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: BuildPageProps): Promise<Metadata> {
  const { id } = await params;
  const preset = await getCachedCommunityBuildById(id);

  if (!preset) {
    return buildPageMetadata({
      title: 'Build Not Found',
      description: 'The requested Stella Sora community build could not be found.',
      path: '/builds',
      noIndex: true,
    });
  }

  return buildPageMetadata({
    title: preset.title,
    description: preset.summary
      ? `${preset.element} build guide in Stella Sora. ${preset.summary}`
      : `${preset.element} squad build guide in Stella Sora.`,
    path: `/builds/${preset.id}`,
    type: 'article',
    ogImage: {
      url: `/api/og?type=build&id=${encodeURIComponent(preset.id)}`,
      width: 1200,
      height: 630,
      alt: `${preset.title} — Stella Sora Community Build`,
    },
    keywords: [
      preset.title,
      `Stella Sora ${preset.element} team`,
      'Stella Sora build guide',
    ],
  });
}

function BuildDetailSkeleton() {
  return (
    <div
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="h-4 w-32 rounded bg-surface-subtle border border-border-subtle" />
      <div className="game-card celestial-card p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          <div className="space-y-2 min-w-0">
            <div className="h-4 w-36 rounded bg-surface-subtle" />
            <div className="h-7 w-72 max-w-full rounded bg-surface-subtle" />
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="h-8 w-28 rounded-lg bg-surface-subtle border border-border-subtle" />
            <div className="h-8 w-16 rounded-lg bg-surface-subtle border border-border-subtle" />
            <div className="h-8 w-36 rounded-lg bg-surface-subtle border border-border-subtle" />
          </div>
        </div>
        <div className="pt-3 border-t border-border-subtle flex items-center justify-between">
          <div className="h-5 w-48 rounded bg-surface-subtle" />
          <div className="h-7 w-14 rounded-md bg-surface-subtle" />
        </div>
      </div>
      <div className="game-card celestial-card p-4 sm:p-5 space-y-4">
        <div className="h-5 w-40 rounded bg-surface-subtle" />
        <div className="h-36 w-full rounded-lg bg-surface-subtle" />
      </div>
    </div>
  );
}

async function BuildDetailContent({ params }: BuildPageProps) {
  const { id } = await params;
  const preset = await getCachedCommunityBuildById(id);

  if (!preset) {
    notFound();
  }

  const analytics = getCommunityBuildAnalytics(preset.id);

  const allCharacters = charactersData as Record<string, SSCharacter>;
  const allCombat = characterCombatData as unknown as Record<string, CharacterCombatEntry>;
  const allDiscs = discsData as Record<string, SSDisc>;
  const allPotentials = potentialsDbData as Record<string, SSPotentialFull[]>;
  const discRankingContext = buildDiscRankingContext(
    preset,
    allCharacters,
    allCombat,
    allDiscs,
    allPotentials
  );

  const slicedCharacters: Record<string, SSCharacter> = {};
  const slicedDiscs: Record<string, SSDisc> = {};
  const slicedPotentials: Record<string, SlicedPotentialMeta> = {};

  for (const slotKey of ['vanguard', 'versatile', 'support'] as const) {
    const slot = preset.advData.slots[slotKey];
    if (!slot?.characterId) continue;
    const cid = slot.characterId;
    if (allCharacters[String(cid)]) {
      slicedCharacters[String(cid)] = allCharacters[String(cid)];
    }
    const charPots = allPotentials[String(cid)] || [];
    const byId = new Map(charPots.map((p) => [p.id, p]));
    for (const picked of slot.potentials) {
      const full = byId.get(picked.id);
      if (full) {
        slicedPotentials[String(picked.id)] = {
          id: full.id,
          name: full.name,
          rarity: full.rarity,
          isCore: full.isCore,
          descTemplate: full.descTemplate,
          params: full.params,
          characterId: full.characterId ?? cid,
        };
      }
    }
  }

  for (const did of preset.allDiscIds) {
    if (allDiscs[String(did)]) {
      slicedDiscs[String(did)] = allDiscs[String(did)];
    }
  }

  for (const sub of preset.substitutions) {
    for (const altId of [sub.replacesId, ...sub.alternativeIds]) {
      if (sub.replacesType === 'trekker' && allCharacters[String(altId)]) {
        slicedCharacters[String(altId)] = allCharacters[String(altId)];
      } else if (sub.replacesType !== 'trekker' && allDiscs[String(altId)]) {
        slicedDiscs[String(altId)] = allDiscs[String(altId)];
      }
    }
  }

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: 'Home', path: '/' },
    { name: 'Community Builds', path: '/builds' },
    { name: preset.title, path: `/builds/${preset.id}` },
  ]);

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <BuildDetailClient
        preset={preset}
        characters={slicedCharacters}
        discs={slicedDiscs}
        potentialMeta={slicedPotentials}
        analytics={analytics}
        discRankingContext={discRankingContext}
      />
    </>
  );
}

export default function BuildDetailPage({ params }: BuildPageProps) {
  return (
    <Suspense fallback={<BuildDetailSkeleton />}>
      <BuildDetailContent params={params} />
    </Suspense>
  );
}
