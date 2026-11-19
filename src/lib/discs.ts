import discsJson from '../data/discs.json' with { type: 'json' };
import bannersJson from '../data/datamined-banners.json' with { type: 'json' };
import charactersJson from '../data/characters.json' with { type: 'json' };
import type { NoteName, SSCharacter, SSDisc } from '../types/index.ts';

interface RawBannerEntry {
  id: number;
  type: string;
  name: string;
  rateUp5Star?: Array<{ id: number; name?: string }>;
}

export interface ExclusiveDiscBannerInfo {
  discId: number;
  disc: SSDisc;
  trekkerId: number;
  trekkerName: string;
  bannerId: number;
  bannerName: string;
  bannerKind: 'Limited' | 'Rate-Up';
}

export interface DiscStatSummary {
  baseAtk: number;
  bonusAtk: number;
  totalAtk: number;
  secondaryLabel: string;
  secondaryValue: string;
}

const discsMap = discsJson as Record<string, SSDisc>;
const bannersMap = bannersJson as Record<string, RawBannerEntry>;
const charactersMap = charactersJson as Record<string, SSCharacter>;

const ALL_DISCS_SORTED: SSDisc[] = Object.values(discsMap).sort((a, b) => {
  if (b.star !== a.star) return b.star - a.star;
  const atkA = Number(a.stats?.lv90?.ATK ?? 0);
  const atkB = Number(b.stats?.lv90?.ATK ?? 0);
  if (atkB !== atkA) return atkB - atkA;
  return a.name.localeCompare(b.name);
});

const CHAR_BY_NAME_LOWER = new Map<string, SSCharacter>(
  Object.values(charactersMap).map((c) => [c.name.EN.trim().toLowerCase(), c])
);

/** Converts a Runic Disc name into a stable lowercase URL slug. */
export function getDiscSlug(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const DISC_BY_SLUG = new Map<string, SSDisc>(
  ALL_DISCS_SORTED.map((d) => [getDiscSlug(d.name), d])
);

const EXCLUSIVE_BY_TREKKER_ID = new Map<number, ExclusiveDiscBannerInfo>();
const EXCLUSIVE_BY_DISC_ID = new Map<number, ExclusiveDiscBannerInfo>();

(() => {
  const charBanners = Object.values(bannersMap)
    .filter((b) => b.type === 'character')
    .sort((a, b) => Number(a.id) - Number(b.id));

  for (const cb of charBanners) {
    const discBanner = bannersMap[String(Number(cb.id) + 10000)];
    if (!discBanner || discBanner.type !== 'disc') continue;

    const trekkerId = cb.rateUp5Star?.[0]?.id;
    const discId = discBanner.rateUp5Star?.[0]?.id;
    if (!trekkerId || !discId) continue;
    if (EXCLUSIVE_BY_TREKKER_ID.has(trekkerId)) continue;

    const char = charactersMap[String(trekkerId)];
    const disc = discsMap[String(discId)];
    if (!char || !disc) continue;

    const info: ExclusiveDiscBannerInfo = {
      discId,
      disc,
      trekkerId,
      trekkerName: char.name.EN,
      bannerId: discBanner.id,
      bannerName: discBanner.name,
      bannerKind: discBanner.name === 'A Heart-Tuned Melody' ? 'Rate-Up' : 'Limited',
    };

    EXCLUSIVE_BY_TREKKER_ID.set(trekkerId, info);
    if (!EXCLUSIVE_BY_DISC_ID.has(discId)) {
      EXCLUSIVE_BY_DISC_ID.set(discId, info);
    }
  }
})();

export function getAllDiscs(): SSDisc[] {
  return ALL_DISCS_SORTED;
}

export function getDiscBySlugOrId(slugOrId: string): SSDisc | undefined {
  let decoded = slugOrId;
  try {
    decoded = decodeURIComponent(slugOrId);
  } catch {
    decoded = slugOrId;
  }
  const norm = decoded.trim().toLowerCase();
  if (!norm) return undefined;

  return (
    DISC_BY_SLUG.get(norm) ??
    discsMap[norm] ??
    ALL_DISCS_SORTED.find((d) => d.name.toLowerCase() === norm)
  );
}

export function getAllDiscTags(): string[] {
  const tags = new Set<string>();
  for (const disc of ALL_DISCS_SORTED) {
    for (const tag of disc.tag || []) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort();
}

export function getDiscRequiredHarmonyNotes(disc: SSDisc): NoteName[] {
  const notes = new Set<NoteName>();
  for (const skill of [disc.secondarySkill1, disc.secondarySkill2]) {
    const req = skill?.requirements?.[0];
    if (!req) continue;
    for (const key of Object.keys(req)) {
      notes.add(key as NoteName);
    }
  }
  return Array.from(notes);
}

export function getDiscSupportNotesAtPhase(
  disc: SSDisc,
  phase: number
): Record<string, number> {
  if (!disc.supportNote || disc.supportNote.length === 0) return {};
  const clamped = Math.max(1, Math.min(disc.supportNote.length, Math.trunc(phase || 1)));
  return disc.supportNote[clamped - 1] || {};
}

export function getDiscStatSummary(
  disc: SSDisc,
  level: 'lv1' | 'lv80' | 'lv90',
  crescendo: number
): DiscStatSummary {
  const levelStats = disc.stats?.[level] || disc.stats?.lv90 || disc.stats?.lv80 || {};
  const clampedCrescendo = Math.max(1, Math.min(6, Math.trunc(crescendo || 1)));
  const baseAtk = Number(levelStats.ATK ?? 0);
  const bonusAtk =
    clampedCrescendo > 1 ? Number(disc.dupeAtk?.[clampedCrescendo - 2] ?? 0) : 0;

  const entries = Object.entries(levelStats);
  const secondaryEntry =
    entries.find(([key]) => key !== 'ATK' && key !== 'HP') ??
    entries.find(([key]) => key === 'HP');

  const rawSecVal = secondaryEntry?.[1];
  const secondaryValue =
    rawSecVal === undefined || rawSecVal === null
      ? '—'
      : typeof rawSecVal === 'number'
      ? rawSecVal.toLocaleString('en-US')
      : String(rawSecVal);

  return {
    baseAtk,
    bonusAtk,
    totalAtk: baseAtk + bonusAtk,
    secondaryLabel: secondaryEntry?.[0] || 'Bonus',
    secondaryValue,
  };
}

export function getExclusiveDiscForTrekker(
  trekkerIdOrName: number | string
): ExclusiveDiscBannerInfo | undefined {
  if (typeof trekkerIdOrName === 'number') {
    return EXCLUSIVE_BY_TREKKER_ID.get(trekkerIdOrName);
  }
  const trimmed = trekkerIdOrName.trim();
  if (/^\d+$/.test(trimmed)) {
    return EXCLUSIVE_BY_TREKKER_ID.get(Number(trimmed));
  }
  const char = CHAR_BY_NAME_LOWER.get(trimmed.toLowerCase());
  return char ? EXCLUSIVE_BY_TREKKER_ID.get(char.id) : undefined;
}

export function getExclusiveBannerByDiscId(
  discId: number
): ExclusiveDiscBannerInfo | undefined {
  return EXCLUSIVE_BY_DISC_ID.get(discId);
}
