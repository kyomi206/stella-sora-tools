import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import charactersData from '@/data/characters.json';
import trekkerLoreData from '@/data/trekker-lore.json';
import characterCombatData from '@/data/character-combat.json';
import potentialsDbData from '@/data/potentials-db.json';
import trekkerTalentsData from '@/data/trekker-talents.json';
import trekkerIllustrationsData from '@/data/trekker-illustrations.json';
import { getDiscSlug, getExclusiveDiscForTrekker } from '@/lib/discs';
import { JsonLd } from '@/components/seo/json-ld';
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  toAbsoluteUrl,
} from '@/lib/seo';
import type { SSCharacter, SSPotentialFull } from '@/types';
import TrekkerDetailClient, {
  type ExactTalentTier,
  type SignatureDiscSummary,
} from './trekker-detail-client';

export const ensureStatic = 'navigation';

/**
 * Generate static paths for all Trekkers in the local dataset.
 * Supports canonical English names, URL-encoded names, and numeric IDs.
 */
export function generateStaticParams() {
  const list = Object.values(charactersData);
  const params: { name: string }[] = [];
  for (const c of list) {
    params.push({ name: c.name.EN });
    if (c.name.EN.includes(' ')) {
      params.push({ name: encodeURIComponent(c.name.EN) });
    }
    params.push({ name: String(c.id) });
  }
  return params;
}

interface TrekkerPageProps {
  params: Promise<{ name: string }>;
}

function findCharacterByParam(rawName: string): SSCharacter | null {
  const chars = charactersData as Record<string, SSCharacter>;
  let decoded = rawName;
  try {
    decoded = decodeURIComponent(rawName);
  } catch {
    decoded = rawName;
  }
  const query = decoded.trim();
  if (!query) return null;

  if (chars[query]) return chars[query];
  const normalized = query.replace(/_/g, ' ').toLowerCase();
  return (
    Object.values(chars).find((c) => c.name.EN.toLowerCase() === normalized) ||
    null
  );
}

function getLoreForCharacter(char: SSCharacter): Record<string, any> | null {
  const loreMap = trekkerLoreData as Record<string, any>;
  return loreMap[String(char.id)] || loreMap[char.name.EN] || null;
}

function buildTrekkerDescription(
  char: SSCharacter,
  lore: Record<string, any> | null,
  combat: Record<string, any> | null
): string {
  const factionPart = lore?.faction ? ` Faction: ${lore.faction}.` : '';
  const skillNames = [
    combat?.normalAtk?.name,
    combat?.skill?.name,
    combat?.supportSkill?.name,
    combat?.ultimate?.name,
  ].filter(Boolean);
  const skillsPart =
    skillNames.length > 0 ? ` Skills: ${skillNames.join(', ')}.` : '';

  return `${char.star}★ ${char.element} ${char.class} (${char.attackType}) Trekker in Stella Sora.${factionPart}${skillsPart} Full Lv.1–90 stats, potentials, T1–T5 talents, and loved gifts on KiyoStella.`;
}

export async function generateMetadata({
  params,
}: TrekkerPageProps): Promise<Metadata> {
  const { name } = await params;
  const char = findCharacterByParam(name);

  if (!char) {
    return buildPageMetadata({
      title: 'Trekker Not Found',
      description: 'The requested Stella Sora Trekker could not be found.',
      path: '/trekkers',
      noIndex: true,
    });
  }

  const charIdStr = String(char.id);
  const lore = getLoreForCharacter(char);
  const combat = (characterCombatData as Record<string, any>)[charIdStr] || null;
  const canonicalPath = `/trekkers/${encodeURIComponent(char.name.EN)}`;

  return buildPageMetadata({
    title: char.name.EN,
    description: buildTrekkerDescription(char, lore, combat),
    path: canonicalPath,
    type: 'article',
    keywords: [
      char.name.EN,
      `Stella Sora ${char.name.EN}`,
      `${char.name.EN} build`,
      `${char.name.EN} potentials`,
      `${char.name.EN} gifts`,
    ],
  });
}

export default async function TrekkerPage({ params }: TrekkerPageProps) {
  const { name } = await params;
  const char = findCharacterByParam(name);

  if (!char) {
    notFound();
  }

  const charIdStr = String(char.id);
  const lore = getLoreForCharacter(char);
  const combat = (characterCombatData as Record<string, any>)[charIdStr] || null;
  const rawPotentials: SSPotentialFull[] =
    (potentialsDbData as Record<string, SSPotentialFull[]>)[charIdStr] || [];
  const exactTalents: ExactTalentTier[] =
    (trekkerTalentsData as Record<string, ExactTalentTier[]>)[charIdStr] || [];
  const illustrations: string[] =
    (trekkerIllustrationsData as Record<string, string[]>)[charIdStr] || [];

  const exclusiveDisc = getExclusiveDiscForTrekker(char.id);
  const signatureDiscInfo: SignatureDiscSummary | null = exclusiveDisc
    ? {
        discId: exclusiveDisc.disc.id,
        discName: exclusiveDisc.disc.name,
        discSlug: getDiscSlug(exclusiveDisc.disc.name),
        discStar: exclusiveDisc.disc.star,
        discElement: exclusiveDisc.disc.element,
        maxAtk: Number(
          exclusiveDisc.disc.stats?.lv90?.ATK ??
            exclusiveDisc.disc.stats?.lv80?.ATK ??
            0
        ),
        bannerName: exclusiveDisc.bannerName,
        bannerKind: exclusiveDisc.bannerKind,
      }
    : null;

  const canonicalPath = `/trekkers/${encodeURIComponent(char.name.EN)}`;
  const description = buildTrekkerDescription(char, lore, combat);
  const alternateNames = [char.name.JP, char.name.CN].filter(Boolean);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        name: `${char.name.EN} — Stella Sora Trekker`,
        url: toAbsoluteUrl(canonicalPath),
        description,
        mainEntity: {
          '@type': 'Thing',
          name: char.name.EN,
          ...(alternateNames.length > 0 ? { alternateName: alternateNames } : {}),
          description,
          image: toAbsoluteUrl(`/trekkers/${char.id}.webp`),
          additionalType: 'https://schema.org/GameCharacter',
        },
      },
      buildBreadcrumbJsonLd(
        [
          { name: 'Home', path: '/' },
          { name: 'Trekker Encyclopedia', path: '/trekkers' },
          { name: char.name.EN, path: canonicalPath },
        ],
        { includeContext: false }
      ),
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <TrekkerDetailClient
        character={char}
        lore={lore}
        combat={combat}
        rawPotentials={rawPotentials}
        exactTalents={exactTalents}
        illustrations={illustrations}
        signatureDiscInfo={signatureDiscInfo}
      />
      {/*
        Companion Quick Action Navigation contracts:
        - /builder?char=${char.id}
        - /damage?char=${char.id}
        - /bond?char=${char.id}
        - https://stellasora.miraheze.org/wiki/${name}
        Offline Data Stores:
        - @/data/character-combat.json
        - @/data/potentials-db.json
      */}
    </>
  );
}
