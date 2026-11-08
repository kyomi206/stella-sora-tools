import potentialsDb from '../data/potentials-db.json' with { type: 'json' };
import type { SSPotentialFull } from '../types/index.ts';

const db = potentialsDb as Record<string, SSPotentialFull[]>;

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

  // Strip XML color tags and vertical tab \u000b
  return desc
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
  kind: 'text' | 'percent' | 'mark';
}

const POTENTIAL_MARK_REGEX =
  /(?:(?:Ignis|Aqua|Ventus|Terra|Lux|Umbra)\s+Mark(?::\s*(?:Sacred\s+Flame|Torrent\/Chill\/Freeze|Torrent\/Chill|Torrent|Breeze|Earth\s+Vein|Radiance|Gloom))?|(?:Butterfly|Bubble|Cat\s+Eye|Sweep|Dark|bite|claw)\s+Marks?|\bmarks?\b)/i;

const POTENTIAL_PERCENT_REGEX = /[+\-]?\d+(?:\.\d+)?%/;

const POTENTIAL_TOKEN_REGEX = new RegExp(
  `(${POTENTIAL_MARK_REGEX.source}|${POTENTIAL_PERCENT_REGEX.source})`,
  'gi'
);

export function formatPotentialSegments(
  descTemplate: string,
  params: (string | number)[],
  level: number = 1
): PotentialSegment[] {
  const plain = formatPotentialDesc(descTemplate, params, level);
  if (!plain) return [];

  const parts = plain.split(POTENTIAL_TOKEN_REGEX);
  const segments: PotentialSegment[] = [];

  for (const part of parts) {
    if (!part) continue;
    if (POTENTIAL_PERCENT_REGEX.test(part)) {
      segments.push({ text: part, kind: 'percent' });
    } else if (POTENTIAL_MARK_REGEX.test(part)) {
      segments.push({ text: part, kind: 'mark' });
    } else {
      segments.push({ text: part, kind: 'text' });
    }
  }

  return segments;
}

