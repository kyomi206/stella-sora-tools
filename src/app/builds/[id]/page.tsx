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
import {
  getResolvedCommunityPresetById,
  getResolvedCommunityPresets,
} from '@/lib/community-presets';
import { buildBreadcrumbJsonLd, buildPageMetadata } from '@/lib/seo';
import type { SSCharacter, SSDisc, SSPotentialFull } from '@/types';
import { BuildDetailClient, type SlicedPotentialMeta } from './build-detail-client';

export function generateStaticParams() {
  const presets = getResolvedCommunityPresets(undefined, { includeArchived: true });
  return presets.map((preset) => ({ id: preset.id }));
}

interface BuildPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: BuildPageProps): Promise<Metadata> {
  const { id } = await params;
  const preset = getResolvedCommunityPresetById(id);

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
    description: `${preset.element} ${preset.archetype} build guide in Stella Sora. ${preset.summary}`,
    path: `/builds/${preset.id}`,
    type: 'article',
    keywords: [
      preset.title,
      `Stella Sora ${preset.element} team`,
      `Stella Sora ${preset.archetype} build`,
      'Stella Sora build guide',
    ],
  });
}

export default async function BuildDetailPage({ params }: BuildPageProps) {
  const { id } = await params;
  const preset = getResolvedCommunityPresetById(id);

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
