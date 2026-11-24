import crypto from 'node:crypto';
import charactersData from '../../data/characters.json' with { type: 'json' };
import communityPresetsData from '../../data/community-presets.json' with { type: 'json' };
import discsData from '../../data/discs.json' with { type: 'json' };
import { sanitizeBuildRotation, type BuildRotation } from '../calculator/build-rotation.ts';
import { inferSquadElement } from '../calculator/disc-rankings-client.ts';
import type {
  CommunityPresetEntry,
  CommunityPresetMode,
  CommunityPresetTier,
} from '../community-presets.ts';
import {
  packAdvancedPresetCode,
  packPresetCode,
  unpackAdvancedPresetCode,
  type AdvancedPresetData,
} from '../preset-code.ts';
import type { ElementType, SSCharacter, SSDisc } from '../../types/index.ts';

export const VALID_PUBLISH_MODES = new Set<CommunityPresetMode>([
  'general',
  'boss-blitz',
  'cataclysm',
]);

const VALID_MODES = VALID_PUBLISH_MODES;

const VALID_TIERS = new Set<CommunityPresetTier>(['f2p', 'standard', 'premium']);

const VALID_ELEMENTS = new Set<ElementType>([
  'Ignis',
  'Aqua',
  'Terra',
  'Ventus',
  'Umbra',
  'Lux',
]);

const BOT_UA_REGEX =
  /bot|crawl|spider|slurp|facebookexternalhit|lighthouse|headlesschrome|playwright|pingdom|uptime|curl|wget|python-requests|go-http-client|bytespider|ahrefs|semrush/i;

export interface ValidatedPublishBuild {
  title: string;
  authorName: string;
  element: ElementType;
  archetype: string;
  tier: CommunityPresetTier;
  modes: CommunityPresetMode[];
  summary: string;
  rotation: string[];
  combatRotation: BuildRotation | null;
  advCode: string;
  inGameCode: string | null;
  advData: AdvancedPresetData;
  characterIds: number[];
}

export type PublishValidationResult =
  | { ok: true; data: ValidatedPublishBuild }
  | { ok: false; error: string };

function stripControlChars(input: string, preserveNewlines = false): string {
  if (preserveNewlines) {
    return input
      .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
      .replace(/\r\n?/g, '\n');
  }
  return input.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ');
}

export function validatePublishInput(
  raw: unknown,
  characters: Record<string, SSCharacter> = charactersData as Record<string, SSCharacter>,
  discs: Record<string, SSDisc> = discsData as Record<string, SSDisc>
): PublishValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Invalid request body.' };
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.website === 'string' && obj.website.trim().length > 0) {
    return { ok: false, error: 'Invalid submission.' };
  }

  const rawTitle = typeof obj.title === 'string' ? stripControlChars(obj.title).trim() : '';
  if (rawTitle.length < 4 || rawTitle.length > 60) {
    return { ok: false, error: 'Build title must be between 4 and 60 characters.' };
  }

  const rawAuthor =
    typeof obj.authorName === 'string' ? stripControlChars(obj.authorName).trim() : '';
  if (rawAuthor.length > 30) {
    return { ok: false, error: 'Author name must be 30 characters or fewer.' };
  }
  const authorName = rawAuthor || 'Anonymous';

  let tier: CommunityPresetTier = 'standard';
  if (obj.tier !== undefined && obj.tier !== null && obj.tier !== '') {
    if (typeof obj.tier !== 'string' || !VALID_TIERS.has(obj.tier as CommunityPresetTier)) {
      return { ok: false, error: 'Invalid investment tier.' };
    }
    tier = obj.tier as CommunityPresetTier;
  }

  let modes: CommunityPresetMode[] = ['general'];
  if (obj.modes !== undefined && obj.modes !== null) {
    if (!Array.isArray(obj.modes)) {
      return { ok: false, error: 'Modes must be an array.' };
    }
    const deduped: CommunityPresetMode[] = [];
    for (const m of obj.modes) {
      if (typeof m === 'string' && VALID_MODES.has(m as CommunityPresetMode)) {
        if (!deduped.includes(m as CommunityPresetMode)) {
          deduped.push(m as CommunityPresetMode);
        }
      } else {
        return { ok: false, error: 'Invalid game mode selected.' };
      }
    }
    if (deduped.length < 1 || deduped.length > 3) {
      return { ok: false, error: 'Select between 1 and 3 game modes.' };
    }
    modes = deduped;
  }

  const rawArchetype =
    typeof obj.archetype === 'string' ? stripControlChars(obj.archetype).trim() : '';
  if (rawArchetype.length > 40) {
    return { ok: false, error: 'Archetype must be 40 characters or fewer.' };
  }
  const archetype = rawArchetype || 'Community Build';

  const summary =
    typeof obj.summary === 'string' ? stripControlChars(obj.summary, true).trim() : '';
  if (summary.length > 280) {
    return { ok: false, error: 'Summary must be 280 characters or fewer.' };
  }

  const rotation: string[] = [];
  if (obj.rotation !== undefined && obj.rotation !== null) {
    if (!Array.isArray(obj.rotation)) {
      return { ok: false, error: 'Author notes must be a list of lines.' };
    }
    for (const item of obj.rotation) {
      if (typeof item !== 'string') {
        return { ok: false, error: 'Invalid author note.' };
      }
      const clean = stripControlChars(item).trim();
      if (!clean) continue;
      if (clean.length > 160) {
        return { ok: false, error: 'Each author note must be 160 characters or fewer.' };
      }
      rotation.push(clean);
      if (rotation.length > 8) {
        return { ok: false, error: 'Include at most 8 author notes.' };
      }
    }
  }

  const combatRotation = sanitizeBuildRotation(obj.combatRotation) ?? null;

  const rawAdvCode = typeof obj.advCode === 'string' ? obj.advCode.trim() : '';
  if (!rawAdvCode) {
    return { ok: false, error: 'Missing SST1 build code.' };
  }

  const advData = unpackAdvancedPresetCode(rawAdvCode, characters, discs);
  if (!advData) {
    return { ok: false, error: 'Build code is invalid or uses unknown Trekkers/Discs.' };
  }

  const characterIds = (['vanguard', 'versatile', 'support'] as const)
    .map((slot) => advData.slots[slot]?.characterId)
    .filter((id): id is number => typeof id === 'number' && id > 0);

  if (characterIds.length < 1) {
    return { ok: false, error: 'Build must include at least 1 Trekker.' };
  }

  const canonicalAdvCode = packAdvancedPresetCode(advData, characters, discs);
  if (!canonicalAdvCode) {
    return { ok: false, error: 'Unable to canonicalize build code.' };
  }
  const inGameCode = packPresetCode(advData.slots);

  const hasSquadElement =
    advData.mainDiscs.some((md) => {
      const d = md.discId ? discs[String(md.discId)] : undefined;
      return Boolean(d?.element && d.element !== 'None');
    }) ||
    characterIds.some((cid) => {
      const c = characters[String(cid)];
      return Boolean(c?.element && (c.element as string) !== 'None');
    });

  const providedElement =
    typeof obj.element === 'string' && VALID_ELEMENTS.has(obj.element as ElementType)
      ? (obj.element as ElementType)
      : null;

  const element = hasSquadElement
    ? inferSquadElement(advData, characters, discs)
    : providedElement ?? 'Ignis';

  return {
    ok: true,
    data: {
      title: rawTitle,
      authorName,
      element,
      archetype,
      tier,
      modes,
      summary,
      rotation,
      combatRotation,
      advCode: canonicalAdvCode,
      inGameCode,
      advData,
      characterIds,
    },
  };
}

export function generateBuildSlug(
  title: string,
  extraReservedIds?: ReadonlySet<string>
): string {
  const curatedIds = new Set<string>(
    (communityPresetsData as unknown as CommunityPresetEntry[]).map((p) => p.id)
  );
  if (extraReservedIds) {
    for (const id of extraReservedIds) curatedIds.add(id);
  }

  const base = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)
    .replace(/-+$/g, '');

  const prefix = base || 'squad-build';

  for (let attempt = 0; attempt < 16; attempt++) {
    const suffix = crypto.randomBytes(2).toString('hex');
    const candidate = `${prefix}-${suffix}`;
    if (!curatedIds.has(candidate)) {
      return candidate;
    }
  }

  return `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
}

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || !ua.trim()) return false;
  return BOT_UA_REGEX.test(ua);
}
