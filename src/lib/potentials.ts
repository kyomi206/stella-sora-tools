import potentialsDb from '@/data/potentials-db.json';
import { SSPotentialFull } from '@/types';

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
