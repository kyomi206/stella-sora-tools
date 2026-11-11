import LZString from 'lz-string';
import type {
  TeamBuild,
  AdvancedTeamBuild,
  TeamSlotState,
  SelectedPotential,
  SelectedMainDisc,
  SelectedSupportDisc,
  NoteName,
} from '../types/index.ts';
import { MUSICAL_NOTES } from '../data/notes.ts';

export const MAX_ENCODED_LENGTH = 4000;

const DEFAULT_MAIN_DISCS: [SelectedMainDisc, SelectedMainDisc, SelectedMainDisc] = [
  { discId: null, crescendo: 1, level: 90 },
  { discId: null, crescendo: 1, level: 90 },
  { discId: null, crescendo: 1, level: 90 },
];

const DEFAULT_SUPPORT_DISCS: [SelectedSupportDisc, SelectedSupportDisc, SelectedSupportDisc] = [
  { discId: null, phase: 8, level: 80, crescendo: 1 },
  { discId: null, phase: 8, level: 80, crescendo: 1 },
  { discId: null, phase: 8, level: 80, crescendo: 1 },
];

const VALID_NOTE_NAMES = new Set(MUSICAL_NOTES.map((n) => n.name));

function sanitizeSlots(
  rawSlots: Record<string, any>,
  characters: Record<string, unknown>
): TeamBuild['slots'] | null {
  const slotKeys = ['vanguard', 'versatile', 'support'] as const;
  for (const key of slotKeys) {
    const s = rawSlots[key];
    if (!s || typeof s !== 'object' || Array.isArray(s)) return null;
    if (!Array.isArray(s.potentials)) return null;
  }

  const resultSlots = {} as TeamBuild['slots'];

  for (const key of slotKeys) {
    const rawSlot = rawSlots[key];
    const rawCharId = rawSlot.characterId;

    let characterId: number | null = null;
    if (rawCharId === null || rawCharId === undefined) {
      characterId = null;
    } else if (
      (typeof rawCharId === 'number' || typeof rawCharId === 'string') &&
      Object.prototype.hasOwnProperty.call(characters, String(rawCharId))
    ) {
      characterId = Number(rawCharId);
    } else {
      // Unknown characterId empties only that slot
      resultSlots[key] = {
        characterId: null,
        potentials: [],
      };
      continue;
    }

    const sanitizedPotentials: SelectedPotential[] = [];
    let coreCount = 0;

    for (const p of rawSlot.potentials) {
      if (!p || typeof p !== 'object' || Array.isArray(p)) continue;
      const id = p.id;
      const rarity = p.rarity;
      if (typeof id !== 'number' || !Number.isFinite(id)) continue;
      if (rarity !== 0 && rarity !== 1 && rarity !== 2) continue;

      if (rarity === 0) {
        if (coreCount >= 2) continue;
        coreCount++;
      }

      if (sanitizedPotentials.length >= 25) break;

      const pot: SelectedPotential = {
        id,
        rarity,
      };
      if ('level' in p && p.level !== undefined) {
        pot.level = p.level;
      }
      if ('priority' in p && p.priority !== undefined) {
        pot.priority = p.priority;
      }
      sanitizedPotentials.push(pot);
    }

    resultSlots[key] = {
      characterId,
      potentials: sanitizedPotentials,
    };
  }

  return resultSlots;
}

export function decompressBuild(
  encoded: string,
  characters: Record<string, unknown>
): TeamBuild | null {
  if (typeof encoded !== 'string' || encoded.length === 0 || encoded.length > MAX_ENCODED_LENGTH) {
    return null;
  }

  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;

    const raw = JSON.parse(json);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (!raw.slots || typeof raw.slots !== 'object' || Array.isArray(raw.slots)) return null;

    const slots = sanitizeSlots(raw.slots, characters);
    if (!slots) return null;

    return {
      id: raw.id,
      name: raw.name,
      createdAt: raw.createdAt,
      slots,
    };
  } catch {
    return null;
  }
}

export function decompressAdvancedBuild(
  encoded: string,
  characters: Record<string, unknown>,
  discs: Record<string, unknown>
): AdvancedTeamBuild | null {
  if (typeof encoded !== 'string' || encoded.length === 0 || encoded.length > MAX_ENCODED_LENGTH) {
    return null;
  }

  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;

    const raw = JSON.parse(json);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (!raw.slots || typeof raw.slots !== 'object' || Array.isArray(raw.slots)) return null;

    const slots = sanitizeSlots(raw.slots, characters);
    if (!slots) return null;

    // mainDiscs
    let mainDiscs: [SelectedMainDisc, SelectedMainDisc, SelectedMainDisc];
    if (Array.isArray(raw.mainDiscs) && raw.mainDiscs.length === 3) {
      mainDiscs = raw.mainDiscs.map((d: any, i: number) => {
        if (!d || typeof d !== 'object' || Array.isArray(d)) {
          return { ...DEFAULT_MAIN_DISCS[i] };
        }
        let discId: number | null = null;
        if (
          d.discId !== null &&
          d.discId !== undefined &&
          Object.prototype.hasOwnProperty.call(discs, String(d.discId))
        ) {
          discId = Number(d.discId);
        }
        const crescendo =
          typeof d.crescendo === 'number' && Number.isFinite(d.crescendo) && d.crescendo >= 1 && d.crescendo <= 6
            ? d.crescendo
            : DEFAULT_MAIN_DISCS[i].crescendo;
        const level =
          d.level === 1 || d.level === 80 || d.level === 90 ? d.level : DEFAULT_MAIN_DISCS[i].level;

        return { discId, crescendo, level };
      }) as [SelectedMainDisc, SelectedMainDisc, SelectedMainDisc];
    } else {
      mainDiscs = [
        { ...DEFAULT_MAIN_DISCS[0] },
        { ...DEFAULT_MAIN_DISCS[1] },
        { ...DEFAULT_MAIN_DISCS[2] },
      ];
    }

    // supportDiscs
    let supportDiscs: [SelectedSupportDisc, SelectedSupportDisc, SelectedSupportDisc];
    if (Array.isArray(raw.supportDiscs) && raw.supportDiscs.length === 3) {
      supportDiscs = raw.supportDiscs.map((s: any, i: number) => {
        if (!s || typeof s !== 'object' || Array.isArray(s)) {
          return { ...DEFAULT_SUPPORT_DISCS[i] };
        }
        let discId: number | null = null;
        if (
          s.discId !== null &&
          s.discId !== undefined &&
          Object.prototype.hasOwnProperty.call(discs, String(s.discId))
        ) {
          discId = Number(s.discId);
        }
        const phase =
          typeof s.phase === 'number' && Number.isFinite(s.phase) && s.phase >= 0 && s.phase <= 8
            ? s.phase
            : DEFAULT_SUPPORT_DISCS[i].phase;
        const level =
          s.level === 1 || s.level === 80 || s.level === 90 ? s.level : DEFAULT_SUPPORT_DISCS[i].level;
        const crescendo =
          typeof s.crescendo === 'number' && Number.isFinite(s.crescendo) && s.crescendo >= 1 && s.crescendo <= 6
            ? s.crescendo
            : DEFAULT_SUPPORT_DISCS[i].crescendo;

        return { discId, phase, level, crescendo };
      }) as [SelectedSupportDisc, SelectedSupportDisc, SelectedSupportDisc];
    } else {
      supportDiscs = [
        { ...DEFAULT_SUPPORT_DISCS[0] },
        { ...DEFAULT_SUPPORT_DISCS[1] },
        { ...DEFAULT_SUPPORT_DISCS[2] },
      ];
    }

    // targetNotes
    const targetNotes: Partial<Record<NoteName, number>> = {};
    if (raw.targetNotes && typeof raw.targetNotes === 'object' && !Array.isArray(raw.targetNotes)) {
      for (const noteName of VALID_NOTE_NAMES) {
        if (Object.prototype.hasOwnProperty.call(raw.targetNotes, noteName)) {
          const val = raw.targetNotes[noteName];
          if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
            targetNotes[noteName] = val;
          }
        }
      }
    }

    return {
      id: raw.id || 'default',
      name: raw.name || 'New Squad Build',
      createdAt: raw.createdAt || Date.now(),
      slots,
      mainDiscs,
      supportDiscs,
      targetNotes,
    };
  } catch {
    return null;
  }
}
