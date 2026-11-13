import charactersData from '../data/characters.json' with { type: 'json' };
import discsData from '../data/discs.json' with { type: 'json' };
import { MUSICAL_NOTES } from '../data/notes.ts';
import { getCharacterPotentials } from './potentials.ts';
import type {
  AdvancedTeamBuild,
  NoteName,
  PotentialPriority,
  SelectedMainDisc,
  SelectedPotential,
  SelectedSupportDisc,
  SlotType,
  TeamBuild,
} from '../types/index.ts';

const characters = charactersData as Record<string, unknown>;
const discs = discsData as Record<string, unknown>;
const SLOT_KEYS: readonly SlotType[] = ['vanguard', 'versatile', 'support'];
const PRIORITIES: readonly PotentialPriority[] = ['Core', 'Medium', 'Low', 'Optional'];
const VALID_DISC_LEVELS: readonly (1 | 80 | 90)[] = [1, 80, 90];
const NOTE_NAMES_SET = new Set<NoteName>(MUSICAL_NOTES.map((n) => n.name));

// 24-bit magic header [0x49, 0x24, 0xF5] encodes cleanly to "SST1" in Base64.
const ADV_MAGIC_BYTES: readonly [number, number, number] = [0x49, 0x24, 0xf5];

export type AdvancedPresetData = Pick<
  AdvancedTeamBuild,
  'slots' | 'mainDiscs' | 'supportDiscs' | 'targetNotes'
>;

export function normalizePresetCodeInput(rawInput: string): string | null {
  if (!rawInput || typeof rawInput !== 'string') return null;
  let b64 = rawInput.trim();
  const buildUrlMatch = b64.match(/\/build\/([A-Za-z0-9+/_=-]+)/i);
  if (buildUrlMatch) {
    b64 = buildUrlMatch[1];
  }
  b64 = b64.replace(/[\s\u200B-\u200D\uFEFF]+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!b64) return null;

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    const tokenMatch = b64.match(/(?:^|[^A-Za-z0-9+/])([A-Za-z0-9+/]{36})(?:$|[^A-Za-z0-9+/])/);
    if (!tokenMatch) return null;
    b64 = tokenMatch[1];
  }

  if (b64.length % 4 !== 0) {
    b64 += '='.repeat(4 - (b64.length % 4));
  }
  return b64;
}

export function unpackPresetCode(
  rawInput: string,
  customCharacters: Record<string, unknown> = characters
): TeamBuild['slots'] | null {
  const b64 = normalizePresetCodeInput(rawInput);
  if (!b64) return null;

  let binStr: string;
  try {
    binStr = atob(b64);
  } catch {
    return null;
  }
  if (binStr.length !== 27) return null;

  const bits: number[] = [];
  for (let i = 0; i < 27; i++) {
    const byte = binStr.charCodeAt(i);
    for (let j = 7; j >= 0; j--) {
      bits.push((byte >> j) & 1);
    }
  }

  let bitIndex = 0;
  const readBits = (numBits: number): number => {
    let value = 0;
    for (let i = numBits - 1; i >= 0; i--) {
      value += bits[bitIndex++] << i;
    }
    return value >>> 0;
  };

  const charIds = [readBits(32), readBits(32), readBits(32)];
  if (charIds.every((id) => id === 0)) return null;

  for (const id of charIds) {
    if (id !== 0) {
      if (!Object.prototype.hasOwnProperty.call(customCharacters, String(id))) {
        return null;
      }
      if (getCharacterPotentials(id).length === 0) {
        return null;
      }
    }
  }

  const resultSlots = {} as TeamBuild['slots'];

  for (let k = 0; k < 3; k++) {
    const slotKey = SLOT_KEYS[k];
    const charId = charIds[k];
    if (charId === 0) {
      readBits(40);
      resultSlots[slotKey] = { characterId: null, potentials: [] };
      continue;
    }

    const allPots = getCharacterPotentials(charId);
    const roleSlot = k === 0 ? 'vanguard' : 'assist';
    const specPots = allPots.filter((p) => p.slot === roleSlot && p.isCore);
    const normPots = allPots.filter((p) => p.slot === roleSlot && !p.isCore);
    const commPots = allPots.filter((p) => p.slot === 'both');

    if (specPots.length !== 4 || normPots.length !== 9 || commPots.length !== 3) {
      return null;
    }

    const coreSelected: SelectedPotential[] = [];
    for (const p of specPots) {
      const flag = readBits(1);
      if (flag === 1 && coreSelected.length < 2) {
        coreSelected.push({
          id: p.id,
          rarity: 0,
          priority: 'Core',
        });
      }
    }

    const normalSelected: SelectedPotential[] = [];
    for (const p of [...normPots, ...commPots]) {
      const level = readBits(3);
      if (level > 0) {
        normalSelected.push({
          id: p.id,
          rarity: p.rarityNum,
          level,
          priority: 'Medium',
        });
      }
    }

    normalSelected.sort((a, b) => (Number(b.level) || 0) - (Number(a.level) || 0));

    resultSlots[slotKey] = {
      characterId: charId,
      potentials: [...coreSelected, ...normalSelected],
    };
  }

  return resultSlots;
}

export function packPresetCode(slots: TeamBuild['slots']): string | null {
  if (!slots) return null;

  const bits: number[] = [];
  const writeBits = (value: number, numBits: number) => {
    for (let i = numBits - 1; i >= 0; i--) {
      bits.push((value >>> i) & 1);
    }
  };

  for (const key of SLOT_KEYS) {
    const charId = slots[key]?.characterId;
    if (!charId || getCharacterPotentials(charId).length === 0) {
      return null;
    }
    writeBits(charId >>> 0, 32);
  }

  for (let k = 0; k < 3; k++) {
    const slot = slots[SLOT_KEYS[k]];
    const charId = slot.characterId!;
    const allPots = getCharacterPotentials(charId);
    const roleSlot = k === 0 ? 'vanguard' : 'assist';
    const specPots = allPots.filter((p) => p.slot === roleSlot && p.isCore);
    const normPots = allPots.filter((p) => p.slot === roleSlot && !p.isCore);
    const commPots = allPots.filter((p) => p.slot === 'both');

    const selectedMap = new Map<number, SelectedPotential>();
    for (const sel of slot.potentials || []) {
      selectedMap.set(sel.id, sel);
    }

    for (const p of specPots) {
      writeBits(selectedMap.has(p.id) ? 1 : 0, 1);
    }
    for (const p of [...normPots, ...commPots]) {
      const sel = selectedMap.get(p.id);
      if (!sel) {
        writeBits(0, 3);
      } else {
        const lvl = Math.min(Math.max(Math.round(Number(sel.level) || 6), 1), 7);
        writeBits(lvl, 3);
      }
    }
  }

  if (bits.length !== 216) return null;

  let binStr = '';
  for (let i = 0; i < 27; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | (bits[i * 8 + j] || 0);
    }
    binStr += String.fromCharCode(byte & 0xff);
  }

  return btoa(binStr);
}

function encodePriority(priority: PotentialPriority | undefined, isCore: boolean): number {
  const idx = priority ? PRIORITIES.indexOf(priority) : -1;
  if (idx >= 0) return idx;
  return isCore ? 0 : 1; // 'Core' for core, 'Medium' for normal
}

function encodeDiscLevel(level: number | undefined, fallback: 1 | 80 | 90): number {
  const valid = level === 1 || level === 80 || level === 90 ? level : fallback;
  return VALID_DISC_LEVELS.indexOf(valid);
}

export function normalizeAdvancedPresetCodeInput(rawInput: string): string | null {
  if (!rawInput || typeof rawInput !== 'string') return null;
  let text = rawInput.trim();

  const queryMatch = text.match(/[?&](?:adv|code|preset)=([A-Za-z0-9+/%_=-]+)/i);
  if (queryMatch) {
    try {
      text = decodeURIComponent(queryMatch[1]);
    } catch {
      text = queryMatch[1];
    }
  }

  let b64 = text.replace(/[\s\u200B-\u200D\uFEFF]+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!b64) return null;

  if (!b64.startsWith('SST1') || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    const tokenMatch = b64.match(/(SST1[A-Za-z0-9+/]+={0,2})/);
    if (!tokenMatch) return null;
    b64 = tokenMatch[1];
  }

  const remainder = b64.length % 4;
  if (remainder === 1) return null;
  if (remainder > 0) {
    b64 += '='.repeat(4 - remainder);
  }
  return b64.startsWith('SST1') ? b64 : null;
}

/**
 * Encodes a complete Advanced Visualizer setup (3 Trekker slots with potentials/levels/priorities,
 * 3 Main Discs + 3 Support Discs with level/crescendo/phase, and all 13 Musical Notes) into a
 * compact Base64 code prefixed with `SST1`.
 */
export function packAdvancedPresetCode(
  build: AdvancedPresetData,
  customCharacters: Record<string, unknown> = characters,
  customDiscs: Record<string, unknown> = discs
): string | null {
  if (!build?.slots) return null;

  const hasAnyChar = SLOT_KEYS.some((k) => Boolean(build.slots[k]?.characterId));
  const hasAnyMainDisc = (build.mainDiscs || []).some((d) => Boolean(d?.discId));
  const hasAnySupportDisc = (build.supportDiscs || []).some((d) => Boolean(d?.discId));
  const hasAnyNotes = Object.entries(build.targetNotes || {}).some(
    ([name, count]) =>
      NOTE_NAMES_SET.has(name as NoteName) &&
      typeof count === 'number' &&
      Number.isFinite(count) &&
      count >= 0
  );

  if (!hasAnyChar && !hasAnyMainDisc && !hasAnySupportDisc && !hasAnyNotes) {
    return null;
  }

  const bits: number[] = [];
  const writeBits = (value: number, numBits: number) => {
    for (let i = numBits - 1; i >= 0; i--) {
      bits.push((value >>> i) & 1);
    }
  };

  for (const magicByte of ADV_MAGIC_BYTES) {
    writeBits(magicByte, 8);
  }

  // Section 1: 3 Trekker slots
  for (let k = 0; k < 3; k++) {
    const slot = build.slots[SLOT_KEYS[k]];
    const charId = slot?.characterId ?? 0;

    if (!charId) {
      writeBits(0, 32);
      continue;
    }

    if (
      !Object.prototype.hasOwnProperty.call(customCharacters, String(charId)) ||
      getCharacterPotentials(charId).length === 0
    ) {
      return null;
    }

    writeBits(charId >>> 0, 32);

    const allPots = getCharacterPotentials(charId);
    const roleSlot = k === 0 ? 'vanguard' : 'assist';
    const stdCore = allPots.filter((p) => p.slot === roleSlot && p.isCore);
    const stdNormal = [
      ...allPots.filter((p) => p.slot === roleSlot && !p.isCore),
      ...allPots.filter((p) => p.slot === 'both'),
    ];
    const standardIds = new Set([...stdCore, ...stdNormal].map((p) => p.id));

    const selectedMap = new Map<number, SelectedPotential>();
    for (const sel of slot?.potentials || []) {
      selectedMap.set(sel.id, sel);
    }

    const includeOffRole = Array.from(selectedMap.keys()).some((id) => !standardIds.has(id));
    writeBits(includeOffRole ? 1 : 0, 1);

    const corePool = includeOffRole ? allPots.filter((p) => p.isCore) : stdCore;
    const normalPool = includeOffRole ? allPots.filter((p) => !p.isCore) : stdNormal;

    for (const p of corePool) {
      const sel = selectedMap.get(p.id);
      if (!sel) {
        writeBits(0, 1);
      } else {
        writeBits(1, 1);
        writeBits(encodePriority(sel.priority, true), 2);
      }
    }

    for (const p of normalPool) {
      const sel = selectedMap.get(p.id);
      if (!sel) {
        writeBits(0, 4);
      } else {
        const lvl = Math.min(Math.max(Math.round(Number(sel.level) || 6), 1), 9);
        writeBits(lvl, 4);
        writeBits(encodePriority(sel.priority, false), 2);
      }
    }
  }

  // Section 2: 3 Main Discs
  for (let i = 0; i < 3; i++) {
    const disc = build.mainDiscs?.[i];
    if (!disc?.discId) {
      writeBits(0, 1);
      continue;
    }
    if (
      disc.discId <= 0 ||
      disc.discId > 0xffffff ||
      !Object.prototype.hasOwnProperty.call(customDiscs, String(disc.discId))
    ) {
      return null;
    }
    writeBits(1, 1);
    writeBits(disc.discId, 24);
    writeBits(encodeDiscLevel(disc.level, 90), 2);
    writeBits(Math.min(Math.max(Math.round(Number(disc.crescendo) || 1), 1), 6), 3);
  }

  // Section 3: 3 Support Discs
  for (let i = 0; i < 3; i++) {
    const disc = build.supportDiscs?.[i];
    if (!disc?.discId) {
      writeBits(0, 1);
      continue;
    }
    if (
      disc.discId <= 0 ||
      disc.discId > 0xffffff ||
      !Object.prototype.hasOwnProperty.call(customDiscs, String(disc.discId))
    ) {
      return null;
    }
    writeBits(1, 1);
    writeBits(disc.discId, 24);
    writeBits(encodeDiscLevel(disc.level, 80), 2);
    writeBits(Math.min(Math.max(Math.round(Number(disc.crescendo) || 1), 1), 6), 3);
    writeBits(Math.min(Math.max(Math.round(Number(disc.phase ?? 8)), 0), 8), 4);
  }

  // Section 4: 13 Musical Notes (13-bit presence mask + 8-bit count per present note)
  const targetNotes = build.targetNotes || {};
  const presentValues: number[] = [];
  for (const note of MUSICAL_NOTES) {
    const raw = Object.prototype.hasOwnProperty.call(targetNotes, note.name)
      ? targetNotes[note.name]
      : undefined;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
      writeBits(1, 1);
      presentValues.push(Math.min(Math.round(raw), 255));
    } else {
      writeBits(0, 1);
    }
  }
  for (const val of presentValues) {
    writeBits(val, 8);
  }

  // Pad to byte boundary with zero bits
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  let binStr = '';
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | bits[i + j];
    }
    binStr += String.fromCharCode(byte & 0xff);
  }

  return btoa(binStr);
}

/**
 * Decodes an `SST1` Advanced Preset Code back into team slots, discs, and target notes.
 */
export function unpackAdvancedPresetCode(
  rawInput: string,
  customCharacters: Record<string, unknown> = characters,
  customDiscs: Record<string, unknown> = discs
): AdvancedPresetData | null {
  const b64 = normalizeAdvancedPresetCodeInput(rawInput);
  if (!b64) return null;

  let binStr: string;
  try {
    binStr = atob(b64);
  } catch {
    return null;
  }

  if (
    binStr.length < 16 ||
    binStr.charCodeAt(0) !== ADV_MAGIC_BYTES[0] ||
    binStr.charCodeAt(1) !== ADV_MAGIC_BYTES[1] ||
    binStr.charCodeAt(2) !== ADV_MAGIC_BYTES[2]
  ) {
    return null;
  }

  const bits: number[] = [];
  for (let i = 0; i < binStr.length; i++) {
    const byte = binStr.charCodeAt(i);
    for (let j = 7; j >= 0; j--) {
      bits.push((byte >> j) & 1);
    }
  }

  let bitIndex = 24; // Skip verified 3-byte magic header
  let truncated = false;
  const readBits = (numBits: number): number => {
    if (bitIndex + numBits > bits.length) {
      truncated = true;
      return 0;
    }
    let value = 0;
    for (let i = 0; i < numBits; i++) {
      value = value * 2 + bits[bitIndex++];
    }
    return value;
  };

  // Section 1: 3 Trekker slots
  const slots = {} as TeamBuild['slots'];
  let hasAnyContent = false;

  for (let k = 0; k < 3; k++) {
    const slotKey = SLOT_KEYS[k];
    const charId = readBits(32);
    if (truncated) return null;

    if (charId === 0) {
      slots[slotKey] = { characterId: null, potentials: [] };
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(customCharacters, String(charId))) {
      return null;
    }
    const allPots = getCharacterPotentials(charId);
    if (allPots.length === 0) return null;

    hasAnyContent = true;
    const includeOffRole = readBits(1) === 1;
    const roleSlot = k === 0 ? 'vanguard' : 'assist';
    const corePool = includeOffRole
      ? allPots.filter((p) => p.isCore)
      : allPots.filter((p) => p.slot === roleSlot && p.isCore);
    const normalPool = includeOffRole
      ? allPots.filter((p) => !p.isCore)
      : [
          ...allPots.filter((p) => p.slot === roleSlot && !p.isCore),
          ...allPots.filter((p) => p.slot === 'both'),
        ];

    const coreSelected: SelectedPotential[] = [];
    for (const p of corePool) {
      const selected = readBits(1);
      if (truncated) return null;
      if (selected === 1) {
        const prioIdx = readBits(2);
        if (truncated || prioIdx >= PRIORITIES.length) return null;
        coreSelected.push({
          id: p.id,
          rarity: 0,
          priority: PRIORITIES[prioIdx],
        });
      }
    }

    const normalSelected: SelectedPotential[] = [];
    for (const p of normalPool) {
      const level = readBits(4);
      if (truncated || level > 9) return null;
      if (level > 0) {
        const prioIdx = readBits(2);
        if (truncated || prioIdx >= PRIORITIES.length) return null;
        normalSelected.push({
          id: p.id,
          rarity: p.rarityNum,
          level,
          priority: PRIORITIES[prioIdx],
        });
      }
    }

    normalSelected.sort((a, b) => (Number(b.level) || 0) - (Number(a.level) || 0));

    slots[slotKey] = {
      characterId: charId,
      potentials: [...coreSelected, ...normalSelected],
    };
  }

  // Section 2: 3 Main Discs
  const mainDiscs: SelectedMainDisc[] = [];
  for (let i = 0; i < 3; i++) {
    const hasDisc = readBits(1);
    if (truncated) return null;
    if (hasDisc === 0) {
      mainDiscs.push({ discId: null, crescendo: 1, level: 90 });
      continue;
    }
    const discId = readBits(24);
    const levelCode = readBits(2);
    const crescendo = readBits(3);
    if (
      truncated ||
      discId === 0 ||
      !Object.prototype.hasOwnProperty.call(customDiscs, String(discId)) ||
      levelCode >= VALID_DISC_LEVELS.length ||
      crescendo < 1 ||
      crescendo > 6
    ) {
      return null;
    }
    hasAnyContent = true;
    mainDiscs.push({
      discId,
      level: VALID_DISC_LEVELS[levelCode],
      crescendo,
    });
  }

  // Section 3: 3 Support Discs
  const supportDiscs: SelectedSupportDisc[] = [];
  for (let i = 0; i < 3; i++) {
    const hasDisc = readBits(1);
    if (truncated) return null;
    if (hasDisc === 0) {
      supportDiscs.push({ discId: null, phase: 8, level: 80, crescendo: 1 });
      continue;
    }
    const discId = readBits(24);
    const levelCode = readBits(2);
    const crescendo = readBits(3);
    const phase = readBits(4);
    if (
      truncated ||
      discId === 0 ||
      !Object.prototype.hasOwnProperty.call(customDiscs, String(discId)) ||
      levelCode >= VALID_DISC_LEVELS.length ||
      crescendo < 1 ||
      crescendo > 6 ||
      phase > 8
    ) {
      return null;
    }
    hasAnyContent = true;
    supportDiscs.push({
      discId,
      level: VALID_DISC_LEVELS[levelCode],
      crescendo,
      phase,
    });
  }

  // Section 4: 13 Musical Notes
  const presentIndices: number[] = [];
  for (let i = 0; i < MUSICAL_NOTES.length; i++) {
    const present = readBits(1);
    if (truncated) return null;
    if (present === 1) {
      presentIndices.push(i);
    }
  }

  const targetNotes: Partial<Record<NoteName, number>> = {};
  for (const idx of presentIndices) {
    const val = readBits(8);
    if (truncated) return null;
    hasAnyContent = true;
    targetNotes[MUSICAL_NOTES[idx].name] = val;
  }

  // Validate remaining byte-alignment padding (0..7 zero bits only)
  const remaining = bits.length - bitIndex;
  if (!hasAnyContent || remaining < 0 || remaining >= 8) {
    return null;
  }
  for (let i = bitIndex; i < bits.length; i++) {
    if (bits[i] !== 0) return null;
  }

  return {
    slots,
    mainDiscs: mainDiscs as AdvancedTeamBuild['mainDiscs'],
    supportDiscs: supportDiscs as AdvancedTeamBuild['supportDiscs'],
    targetNotes,
  };
}
