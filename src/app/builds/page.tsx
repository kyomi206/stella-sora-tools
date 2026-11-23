import type { Metadata } from 'next';
import charactersData from '@/data/characters.json';
import discsData from '@/data/discs.json';
import { JsonLd } from '@/components/seo/json-ld';
import { getPresetIdsWithAnalytics } from '@/lib/community-analytics';
import { getResolvedCommunityPresets } from '@/lib/community-presets';
import { buildBreadcrumbJsonLd, buildPageMetadata, toAbsoluteUrl } from '@/lib/seo';
import type { SSCharacter, SSDisc } from '@/types';
import { BuildsClient } from './builds-client';

const DESCRIPTION =
  'Browse curated Stella Sora squad builds, potential setups, Runic Disc benchmarks, Musical Note targets, and team rotations across all six elements.';

export const metadata: Metadata = buildPageMetadata({
  title: 'Community Builds & Guides',
  description: DESCRIPTION,
  path: '/builds',
  keywords: [
    'Stella Sora builds',
    'Stella Sora team comps',
    'Stella Sora squad guides',
    'Stella Sora Boss Blitz teams',
    'Stella Sora theorycraft',
  ],
});

export default function BuildsPage() {
  const presets = getResolvedCommunityPresets();
  const analyticsPresetIds = getPresetIdsWithAnalytics();

  const allCharacters = charactersData as Record<string, SSCharacter>;
  const allDiscs = discsData as Record<string, SSDisc>;
  const slicedCharacters: Record<string, SSCharacter> = {};
  const slicedDiscs: Record<string, SSDisc> = {};

  for (const preset of presets) {
    for (const cid of preset.characterIds) {
      if (allCharacters[String(cid)]) {
        slicedCharacters[String(cid)] = allCharacters[String(cid)];
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
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: 'Stella Sora Community Builds & Guides',
        description: DESCRIPTION,
        url: toAbsoluteUrl('/builds'),
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: presets.length,
          itemListElement: presets.map((preset, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: preset.title,
            url: toAbsoluteUrl(`/builds/${preset.id}`),
          })),
        },
      },
      buildBreadcrumbJsonLd(
        [
          { name: 'Home', path: '/' },
          { name: 'Community Builds', path: '/builds' },
        ],
        { includeContext: false }
      ),
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <BuildsClient
        presets={presets}
        characters={allCharacters}
        discs={slicedDiscs}
        analyticsPresetIds={analyticsPresetIds}
      />
    </>
  );
}
