import charactersData from '../data/characters.json' with { type: 'json' };
import communityPresetsData from '../data/community-presets.json' with { type: 'json' };
import discsData from '../data/discs.json' with { type: 'json' };
import {
  packAdvancedPresetCode,
  packPresetCode,
  unpackAdvancedPresetCode,
  unpackPresetCode,
  type AdvancedPresetData,
} from './preset-code.ts';
import type {
  ElementType,
  NoteName,
  SelectedMainDisc,
  SelectedSupportDisc,
} from '../types/index.ts';
import {
  sanitizeBuildRotation,
  type BuildRotation,
} from './calculator/build-rotation.ts';

export const CURRENT_PATCH = '2.0';

export type CommunityPresetMode = 'general' | 'boss-blitz' | 'cataclysm' | 'monolith';
export type CommunityPresetTier = 'f2p' | 'standard' | 'premium';
export type CommunityPresetStatus = 'verified' | 'outdated' | 'archived';

export interface CommunityPresetSubstitution {
  replacesType: 'trekker' | 'mainDisc' | 'supportDisc';
  replacesId: number;
  alternativeIds: number[];
  note: string;
}

export interface CommunityPresetSource {
  label: string;
  author: string;
  url: string;
  kind: 'sheet' | 'video' | 'wiki' | 'guide' | 'community';
}

export interface CommunityPresetEntry {
  id: string;
  title: string;
  /** Full SST1 code (single source of truth when supplied) */
  advCode?: string;
  /** 36-char in-game Potential code (usable when submitting without SST1) */
  inGameCode?: string;
  /** Optional discs/notes paired with an inGameCode-only submission */
  mainDiscs?: SelectedMainDisc[];
  supportDiscs?: SelectedSupportDisc[];
  targetNotes?: Partial<Record<NoteName, number>>;
  element: ElementType;
  archetype: string;
  modes: CommunityPresetMode[];
  tier: CommunityPresetTier;
  blitzIds?: string[];
  summary: string;
  rotation?: string[];
  combatRotation?: BuildRotation;
  potentialNote?: string;
  substitutions?: CommunityPresetSubstitution[];
  sources: CommunityPresetSource[];
  verifiedPatch: string;
  verifiedAt: string;
  status?: CommunityPresetStatus;
}

export interface ResolvedCommunityPreset {
  id: string;
  title: string;
  advCode: string;
  inGameCode: string | null;
  advData: AdvancedPresetData;
  characterIds: number[];
  mainDiscIds: number[];
  supportDiscIds: number[];
  allDiscIds: number[];
  element: ElementType;
  archetype: string;
  modes: CommunityPresetMode[];
  tier: CommunityPresetTier;
  blitzIds: string[];
  summary: string;
  rotation: string[];
  combatRotation: BuildRotation | null;
  potentialNote: string | null;
  substitutions: CommunityPresetSubstitution[];
  sources: CommunityPresetSource[];
  verifiedPatch: string;
  verifiedAt: string;
  status: CommunityPresetStatus;
  isStale: boolean;
}

function parsePatchParts(patch: string): [number, number] | null {
  const match = String(patch || '').trim().match(/^v?(\d+)\.(\d+)/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

/**
 * Returns true if the preset is marked outdated or lags >= 2 minor updates behind CURRENT_PATCH.
 */
export function isCommunityPresetStale(
  verifiedPatch: string,
  status: CommunityPresetStatus = 'verified',
  currentPatch: string = CURRENT_PATCH
): boolean {
  if (status === 'outdated') return true;
  if (status === 'archived') return false;
  const vParts = parsePatchParts(verifiedPatch);
  const cParts = parsePatchParts(currentPatch);
  if (!vParts || !cParts) return false;
  const minorDiff = (cParts[0] - vParts[0]) * 10 + (cParts[1] - vParts[1]);
  return minorDiff >= 2;
}

function normalizeMainDiscs(
  discs: SelectedMainDisc[] | undefined
): [SelectedMainDisc, SelectedMainDisc, SelectedMainDisc] {
  const item = (idx: number): SelectedMainDisc => {
    const d = discs?.[idx];
    return d?.discId
      ? {
          discId: d.discId,
          level: d.level === 1 || d.level === 80 || d.level === 90 ? d.level : 90,
          crescendo: Math.min(Math.max(Math.round(Number(d.crescendo) || 1), 1), 6),
        }
      : { discId: null, level: 90, crescendo: 1 };
  };
  return [item(0), item(1), item(2)];
}

function normalizeSupportDiscs(
  discs: SelectedSupportDisc[] | undefined
): [SelectedSupportDisc, SelectedSupportDisc, SelectedSupportDisc] {
  const item = (idx: number): SelectedSupportDisc => {
    const d = discs?.[idx];
    return d?.discId
      ? {
          discId: d.discId,
          level: d.level === 1 || d.level === 80 || d.level === 90 ? d.level : 80,
          crescendo: Math.min(Math.max(Math.round(Number(d.crescendo) || 1), 1), 6),
          phase: Math.min(Math.max(Math.round(Number(d.phase ?? 8)), 0), 8),
        }
      : { discId: null, level: 80, crescendo: 1, phase: 8 };
  };
  return [item(0), item(1), item(2)];
}

/**
 * Resolves either an SST1 `advCode` or a 36-char `inGameCode` (with optional discs/notes)
 * into a unified `ResolvedCommunityPreset`. Returns null if the preset fails validation.
 */
export function resolveCommunityPreset(
  entry: CommunityPresetEntry,
  customCharacters: Record<string, unknown> = charactersData as Record<string, unknown>,
  customDiscs: Record<string, unknown> = discsData as Record<string, unknown>,
  currentPatch: string = CURRENT_PATCH
): ResolvedCommunityPreset | null {
  if (!entry?.id || !entry?.title) return null;

  let advData: AdvancedPresetData;
  let canonicalAdvCode: string | null = null;
  let derivedInGameCode: string | null = null;

  if (entry.advCode) {
    const unpacked = unpackAdvancedPresetCode(entry.advCode, customCharacters, customDiscs);
    if (!unpacked) return null;
    advData = unpacked;
    canonicalAdvCode = entry.advCode;
    derivedInGameCode = packPresetCode(advData.slots);
  } else if (entry.inGameCode) {
    const slots = unpackPresetCode(entry.inGameCode, customCharacters);
    if (!slots) return null;
    advData = {
      slots,
      mainDiscs: normalizeMainDiscs(entry.mainDiscs),
      supportDiscs: normalizeSupportDiscs(entry.supportDiscs),
      targetNotes: entry.targetNotes ? { ...entry.targetNotes } : {},
    };
    canonicalAdvCode = packAdvancedPresetCode(advData, customCharacters, customDiscs);
    if (!canonicalAdvCode) return null;
    derivedInGameCode = packPresetCode(slots) || entry.inGameCode;
  } else {
    return null;
  }

  const characterIds = (['vanguard', 'versatile', 'support'] as const)
    .map((k) => advData.slots[k]?.characterId)
    .filter((id): id is number => typeof id === 'number' && id > 0);

  const mainDiscIds = (advData.mainDiscs || [])
    .map((d) => d.discId)
    .filter((id): id is number => typeof id === 'number' && id > 0);

  const supportDiscIds = (advData.supportDiscs || [])
    .map((d) => d.discId)
    .filter((id): id is number => typeof id === 'number' && id > 0);

  const allDiscIds = Array.from(new Set([...mainDiscIds, ...supportDiscIds]));
  const status: CommunityPresetStatus = entry.status || 'verified';

  return {
    id: entry.id,
    title: entry.title,
    advCode: canonicalAdvCode,
    inGameCode: derivedInGameCode,
    advData,
    characterIds,
    mainDiscIds,
    supportDiscIds,
    allDiscIds,
    element: entry.element,
    archetype: entry.archetype,
    modes: entry.modes || ['general'],
    tier: entry.tier || 'standard',
    blitzIds: entry.blitzIds || [],
    summary: entry.summary,
    rotation: entry.rotation || [],
    combatRotation: sanitizeBuildRotation(entry.combatRotation) ?? null,
    potentialNote: entry.potentialNote || null,
    substitutions: entry.substitutions || [],
    sources: entry.sources || [],
    verifiedPatch: entry.verifiedPatch,
    verifiedAt: entry.verifiedAt,
    status,
    isStale: isCommunityPresetStale(entry.verifiedPatch, status, currentPatch),
  };
}

export function getResolvedCommunityPresets(
  entries: CommunityPresetEntry[] = communityPresetsData as CommunityPresetEntry[],
  options: {
    includeArchived?: boolean;
    customCharacters?: Record<string, unknown>;
    customDiscs?: Record<string, unknown>;
    currentPatch?: string;
  } = {}
): ResolvedCommunityPreset[] {
  const {
    includeArchived = false,
    customCharacters = charactersData as Record<string, unknown>,
    customDiscs = discsData as Record<string, unknown>,
    currentPatch = CURRENT_PATCH,
  } = options;

  const resolved: ResolvedCommunityPreset[] = [];
  for (const entry of entries) {
    const item = resolveCommunityPreset(entry, customCharacters, customDiscs, currentPatch);
    if (!item) continue;
    if (!includeArchived && item.status === 'archived') continue;
    resolved.push(item);
  }

  // Sort current-patch verified builds ahead of stale/outdated ones, newest verifiedAt first
  return resolved.sort((a, b) => {
    if (a.isStale !== b.isStale) return a.isStale ? 1 : -1;
    return b.verifiedAt.localeCompare(a.verifiedAt);
  });
}

export function getResolvedCommunityPresetById(
  id: string,
  entries: CommunityPresetEntry[] = communityPresetsData as CommunityPresetEntry[]
): ResolvedCommunityPreset | null {
  if (!id) return null;
  const entry = entries.find((e) => e.id === id);
  if (!entry) return null;
  return resolveCommunityPreset(entry);
}

export function getCommunityPresetsForTrekker(
  trekkerId: number,
  entries: CommunityPresetEntry[] = communityPresetsData as CommunityPresetEntry[]
): ResolvedCommunityPreset[] {
  return getResolvedCommunityPresets(entries).filter(
    (p) =>
      p.characterIds.includes(trekkerId) ||
      p.substitutions.some(
        (s) => s.replacesType === 'trekker' && s.alternativeIds.includes(trekkerId)
      )
  );
}

export function getCommunityPresetsForDisc(
  discId: number,
  entries: CommunityPresetEntry[] = communityPresetsData as CommunityPresetEntry[]
): ResolvedCommunityPreset[] {
  return getResolvedCommunityPresets(entries).filter(
    (p) =>
      p.allDiscIds.includes(discId) ||
      p.substitutions.some(
        (s) =>
          (s.replacesType === 'mainDisc' || s.replacesType === 'supportDisc') &&
          s.alternativeIds.includes(discId)
      )
  );
}

/**
 * Matches presets for a Boss Blitz card: prioritizes explicit `blitzIds`, falling back to `weakTo` elements.
 */
export function getCommunityPresetsForBlitz(
  blitzId: string,
  weakToElements: ElementType[],
  entries: CommunityPresetEntry[] = communityPresetsData as CommunityPresetEntry[]
): { presets: ResolvedCommunityPreset[]; matchKind: 'explicit' | 'element' | 'none' } {
  const all = getResolvedCommunityPresets(entries);
  const explicit = all.filter((p) => p.blitzIds.includes(blitzId));
  if (explicit.length > 0) {
    return { presets: explicit, matchKind: 'explicit' };
  }
  const byElement = all.filter((p) => weakToElements.includes(p.element));
  if (byElement.length > 0) {
    return { presets: byElement, matchKind: 'element' };
  }
  return { presets: [], matchKind: 'none' };
}
