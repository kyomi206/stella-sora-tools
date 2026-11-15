import potentialsDb from '../data/potentials-db.json' with { type: 'json' };
import charactersData from '../data/characters.json' with { type: 'json' };
import type { ElementType, SSPotentialFull } from '../types/index.ts';

const db = potentialsDb as Record<string, SSPotentialFull[]>;
const chars = charactersData as Record<string, { element?: ElementType }>;

export function getCharacterElement(characterId: number | null): ElementType | undefined {
  if (!characterId) return undefined;
  return chars[String(characterId)]?.element;
}

export function getCharacterPotentials(characterId: number | null): SSPotentialFull[] {
  if (!characterId) return [];
  return db[String(characterId)] || [];
}

export function getPotentialById(characterId: number | null, potentialId: number): SSPotentialFull | undefined {
  if (!characterId) return undefined;
  const list = db[String(characterId)] || [];
  return list.find((p) => p.id === potentialId);
}

export function formatPotentialDesc(
  descTemplate: string,
  params: (string | number)[],
  level: number = 1
): string {
  let desc = descTemplate || '';

  (params || []).forEach((paramSet, index) => {
    const parts = String(paramSet).split('/');
    let val = parts[0];
    if (parts.length > 1) {
      const idx = Math.min(Math.max(level, 1), parts.length) - 1;
      val = parts[idx] ?? parts[0];
    }
    desc = desc.replaceAll(new RegExp(`&Param${index + 1}(?:_.*?)?&`, 'g'), val);
  });

  // Strip trailing Param/HiddenParam debug annotations, XML color tags, ##Title#ID# glossary wrappers, and vertical tab \u000b
  return desc
    .replace(/(?:\s|\u000b)*\b(?:Hidden)?Param\d+:\s*(?:&(?:Hidden)?Param\d+&|\S+)\s*\([^)]*\)/gi, '')
    .replace(/##([^#]+)#\d+#/g, '$1')
    .replace(/<color=#([0-9a-fA-F]{6})>(.*?)<\/color>/g, '$2')
    .replace(/<color=#[0-9a-fA-F]{6}>/g, '')
    .replace(/<\/color>/g, '')
    .replace(/\u000b/g, ' ')
    .trim();
}

export function getPotentialImageUrl(id: number): string {
  return `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/potential/${id}.webp`;
}

export interface PotentialSegment {
  text: string;
  kind: 'text' | 'percent' | 'mark' | 'effect';
  element?: ElementType;
}

const POTENTIAL_MARK_REGEX =
  /\b(?:Ignis|Aqua|Ventus|Terra|Lux|Umbra)\s+Marks?(?::\s*(?:Sacred\s+Flame|Torrent\/Chill\/Freeze|Torrent\/Chill|Torrent|Breeze|Earth\s+Vein|Radiance|Gloom))?(?!\s+DMG\b)/i;

// Special/unique effect and skill glossary terms rendered in blue without an underline.
// Ordered longest-first; case-sensitive so common lowercase words (e.g. "burn", "bubble") stay plain text.
const POTENTIAL_EFFECT_PATTERNS = [
  'Current Decibels below 100:',
  'Current Decibels at 100:',
  'Bunny Rapid Fire Mode',
  'Bouncing Kitty Bomb',
  'Bubble Machine mode',
  'Evil Eye Unleashed',
  'Scorched Butterflies',
  'Observation Points',
  'Calibration Mark',
  'Demonic Boomboxes',
  "Demonic Boombox's",
  'Echoing Soundwave',
  'Lanterna Phantoms',
  'Observation Point',
  'Resource Markers',
  'Scorched Butterfly',
  'Tiger of the East',
  'Advertising Doll',
  'Broken Resilience',
  'Bunny Jaws Mode',
  'Clockwork Queen',
  'Colonel Walnuts',
  'Demonic Boombox',
  'Flower Formation',
  'Lanterna Phantom',
  'Multi Sword Aura',
  'Pumpka Phantoms',
  'Resilience Break',
  'Resource Marker',
  'Smiling Sanction',
  'Tactical Energy',
  'Artillery Form',
  'Butterfly Mark',
  'Colonel Walnut',
  'Crimson Dragon',
  'Gentle Warning',
  'Megaphone mode',
  'Pumpka Phantom',
  'Shadow Clones',
  'Shattered Ice',
  'Vortex Energy',
  'Abyssal Wave',
  'Dark Shackles',
  'General Curly',
  'Hunting Energy',
  "Hunter's Mark",
  'Light Curtain',
  'Shadow Clone',
  'Necro Energy',
  'Safety Alert',
  'Bubble Mark',
  'Sweep Marks',
  'Sweep Mark',
  'Popularity',
  'Sword Form',
  'Umbra Burn',
  'Wind Chant',
  'Dark Burn',
  "Sentries'",
  'Dark Ray',
  'Decibels',
  'Sentries',
  'Berserk',
  'Glimmer',
  'Lux PEN',
  'Shatter',
  'Allure',
  'Freeze',
  'Ignite',
  'Lucent',
  'Agile',
  'Charm',
  'Chill',
  'Hold:',
  'Tap:',
  'Burn',
  'Fear',
]
  .map((term) => `\\b${term}(?!\\w)`)
  .concat([
    '(?<=generates\\s)\\bThunderbolt(?!\\w)',
    '\\bAvalanches?(?!:|\\w)',
    '\\bBubble(?!\\s+(?:Bath|Frog|Machine|Pool|Mark)\\b)(?!\\w)',
    '\\bFrozen(?!\\s+Path\\b)(?!\\w)',
    '\\bMeteor(?!\\s+Arrow\\b)(?!\\w)',
    '\\bSentry(?!\\s+Deployment\\b)(?!\\w)',
    '(?<!Billowing\\s)\\bTide(?!\\s+Threader\\b)(?!\\w)',
    '\\bHold(?=\\s+Enters)',
    '\\bTap(?=\\s+Enters)',
  ]);

const POTENTIAL_EFFECT_REGEX = new RegExp(
  `(${POTENTIAL_EFFECT_PATTERNS.join('|')})`,
  'g'
);

const POTENTIAL_PERCENT_REGEX = /[+\-]?\d+(?:\.\d+)?%/;

const POTENTIAL_TOKEN_REGEX = new RegExp(
  `(${POTENTIAL_MARK_REGEX.source}|${POTENTIAL_PERCENT_REGEX.source})`,
  'gi'
);

export function getMarkElement(text: string, fallback?: ElementType): ElementType | undefined {
  if (/Ignis/i.test(text)) return 'Ignis';
  if (/Aqua/i.test(text)) return 'Aqua';
  if (/Ventus/i.test(text)) return 'Ventus';
  if (/Terra/i.test(text)) return 'Terra';
  if (/Lux/i.test(text)) return 'Lux';
  if (/Umbra|Dark/i.test(text)) return 'Umbra';
  return fallback;
}

export function formatPotentialSegments(
  descTemplate: string,
  params: (string | number)[],
  level: number = 1,
  defaultElement?: ElementType,
  characterId?: number | null
): PotentialSegment[] {
  const plain = formatPotentialDesc(descTemplate, params, level);
  if (!plain) return [];

  const resolvedFallback = defaultElement || getCharacterElement(characterId ?? null);

  const parts = plain.split(POTENTIAL_TOKEN_REGEX);
  const segments: PotentialSegment[] = [];

  for (const part of parts) {
    if (!part) continue;
    if (POTENTIAL_PERCENT_REGEX.test(part)) {
      segments.push({ text: part, kind: 'percent' });
    } else if (POTENTIAL_MARK_REGEX.test(part)) {
      segments.push({
        text: part,
        kind: 'mark',
        element: getMarkElement(part, resolvedFallback),
      });
    } else {
      POTENTIAL_EFFECT_REGEX.lastIndex = 0;
      let cursor = 0;
      let match: RegExpExecArray | null;
      while ((match = POTENTIAL_EFFECT_REGEX.exec(part)) !== null) {
        if (match.index > cursor) {
          segments.push({ text: part.slice(cursor, match.index), kind: 'text' });
        }
        segments.push({ text: match[0], kind: 'effect' });
        cursor = match.index + match[0].length;
      }
      if (cursor < part.length) {
        segments.push({ text: part.slice(cursor), kind: 'text' });
      }
    }
  }

  return segments;
}

