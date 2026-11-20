import potentialsDb from '../data/potentials-db.json' with { type: 'json' };
import {
  formatPotentialDesc,
  formatPotentialSegments,
  getCharacterElement,
  getMarkElement,
  getPotentialImageUrl,
} from './potential-utils.ts';
import type { PotentialSegment } from './potential-utils.ts';
import type { SSPotentialFull } from '../types/index.ts';

export {
  formatPotentialDesc,
  formatPotentialSegments,
  getCharacterElement,
  getMarkElement,
  getPotentialImageUrl,
};
export type { PotentialSegment };

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
