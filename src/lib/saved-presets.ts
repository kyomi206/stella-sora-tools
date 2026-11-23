import {
  packAdvancedPresetCode,
  packPresetCode,
  unpackAdvancedPresetCode,
  type AdvancedPresetData,
} from './preset-code.ts';
import type {
  NoteName,
  SelectedMainDisc,
  SelectedSupportDisc,
  SlotType,
  TeamBuild,
} from '../types/index.ts';
import { sanitizeBuildRotation, type BuildRotation } from './calculator/build-rotation.ts';

export const SAVED_PRESETS_STORAGE_KEY = 'sstt:saved-presets:v1';
export const ACTIVE_DRAFT_STORAGE_KEY = 'sstt:active-draft:v1';
export const MAX_PRESET_NAME_LENGTH = 80;
export const MAX_SAVED_PRESETS = 250;
export const MAX_BACKUP_JSON_LENGTH = 2 * 1024 * 1024;

export type SavedPresetMode = 'basic' | 'advanced';

export interface SavedPresetRecord {
  id: string;
  name: string;
  mode: SavedPresetMode;
  advCode: string;
  inGameCode: string | null;
  createdAt: number;
  updatedAt: number;
  combatRotation?: BuildRotation;
  sourcePresetId?: string;
}

export interface UpsertSavedPresetInput {
  id?: string;
  name: string;
  mode: SavedPresetMode;
  slots: TeamBuild['slots'];
  mainDiscs?: SelectedMainDisc[];
  supportDiscs?: SelectedSupportDisc[];
  targetNotes?: Partial<Record<NoteName, number>>;
  combatRotation?: BuildRotation | null;
  sourcePresetId?: string | null;
  now?: number;
  forceNew?: boolean;
}

export interface BuildContentInput {
  slots: TeamBuild['slots'];
  mainDiscs?: SelectedMainDisc[];
  supportDiscs?: SelectedSupportDisc[];
  targetNotes?: Partial<Record<NoteName, number>>;
}

interface StoredDraftEntry {
  id: string;
  name: string;
  advCode: string;
  updatedAt: number;
}

type StoredDraftMap = Partial<Record<SavedPresetMode, StoredDraftEntry>>;

const SLOT_ORDER: readonly SlotType[] = ['vanguard', 'versatile', 'support'];
const DEFAULT_BUILD_IDS = new Set(['default', 'advanced-default']);

function sortByUpdatedDesc(list: SavedPresetRecord[]): SavedPresetRecord[] {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

function generatePresetId(now: number): string {
  return `preset-${now}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizePresetNameInput(rawName: string): string {
  if (typeof rawName !== 'string') return '';
  // Collapse control characters while preserving Unicode text, emoji, CJK, and ZWNJ (\u200C).
  const trimmed = rawName.replace(/[\u0000-\u001F\u007F]+/g, ' ').trim();
  if (!trimmed) return '';
  return Array.from(trimmed).slice(0, MAX_PRESET_NAME_LENGTH).join('').trim();
}

function normalizePresetName(rawName: string, mode: SavedPresetMode): string {
  const cleaned = sanitizePresetNameInput(rawName);
  if (cleaned) return cleaned;
  return mode === 'advanced' ? 'Untitled Advanced Preset' : 'Untitled Squad Build';
}

function cloneSlots(slots: TeamBuild['slots']): TeamBuild['slots'] {
  return {
    vanguard: {
      characterId: slots?.vanguard?.characterId ?? null,
      potentials: [...(slots?.vanguard?.potentials || [])],
    },
    versatile: {
      characterId: slots?.versatile?.characterId ?? null,
      potentials: [...(slots?.versatile?.potentials || [])],
    },
    support: {
      characterId: slots?.support?.characterId ?? null,
      potentials: [...(slots?.support?.potentials || [])],
    },
  };
}

export function createEmptyDiscsAndNotes(): Omit<AdvancedPresetData, 'slots'> {
  return {
    mainDiscs: [
      { discId: null, crescendo: 1, level: 90 },
      { discId: null, crescendo: 1, level: 90 },
      { discId: null, crescendo: 1, level: 90 },
    ],
    supportDiscs: [
      { discId: null, phase: 8, level: 80, crescendo: 1 },
      { discId: null, phase: 8, level: 80, crescendo: 1 },
      { discId: null, phase: 8, level: 80, crescendo: 1 },
    ],
    targetNotes: {},
  };
}

function normalizeMainDiscs(
  input?: SelectedMainDisc[]
): [SelectedMainDisc, SelectedMainDisc, SelectedMainDisc] {
  const fallback = createEmptyDiscsAndNotes().mainDiscs;
  return [0, 1, 2].map((i) => {
    const item = input?.[i];
    if (!item) return { ...fallback[i] };
    return {
      discId: item.discId ?? null,
      crescendo: item.crescendo ?? 1,
      level: item.level ?? 90,
    };
  }) as [SelectedMainDisc, SelectedMainDisc, SelectedMainDisc];
}

function normalizeSupportDiscs(
  input?: SelectedSupportDisc[]
): [SelectedSupportDisc, SelectedSupportDisc, SelectedSupportDisc] {
  const fallback = createEmptyDiscsAndNotes().supportDiscs;
  return [0, 1, 2].map((i) => {
    const item = input?.[i];
    if (!item) return { ...fallback[i] };
    return {
      discId: item.discId ?? null,
      phase: item.phase ?? 8,
      level: item.level ?? 80,
      crescendo: item.crescendo ?? 1,
    };
  }) as [SelectedSupportDisc, SelectedSupportDisc, SelectedSupportDisc];
}

export function hasDiscsOrNotesContent(data?: {
  mainDiscs?: SelectedMainDisc[];
  supportDiscs?: SelectedSupportDisc[];
  targetNotes?: Partial<Record<NoteName, number>>;
}): boolean {
  if (!data) return false;
  if ((data.mainDiscs || []).some((d) => d?.discId !== null && d?.discId !== undefined)) {
    return true;
  }
  if ((data.supportDiscs || []).some((d) => d?.discId !== null && d?.discId !== undefined)) {
    return true;
  }
  return Object.values(data.targetNotes || {}).some(
    (count) => typeof count === 'number' && Number.isFinite(count) && count > 0
  );
}

export function hasAnyBuildContent(data: BuildContentInput): boolean {
  if (!data?.slots) return false;
  const hasChar = SLOT_ORDER.some(
    (slotKey) => data.slots[slotKey]?.characterId !== null && data.slots[slotKey]?.characterId !== undefined
  );
  if (hasChar) return true;
  return hasDiscsOrNotesContent(data);
}

export function upsertSavedPreset(
  list: SavedPresetRecord[],
  input: UpsertSavedPresetInput
): { list: SavedPresetRecord[]; record: SavedPresetRecord } | null {
  if (!hasAnyBuildContent(input)) {
    return null;
  }

  const now = typeof input.now === 'number' ? input.now : Date.now();
  const canMatchExisting =
    !input.forceNew &&
    Boolean(input.id) &&
    !DEFAULT_BUILD_IDS.has(input.id as string);

  const existing = canMatchExisting
    ? list.find((item) => item.id === input.id)
    : undefined;

  let discsAndNotes = createEmptyDiscsAndNotes();
  let preservedAdvancedFromExisting = false;

  if (
    existing &&
    input.mode === 'basic' &&
    input.mainDiscs === undefined &&
    input.supportDiscs === undefined
  ) {
    const existingUnpacked = unpackAdvancedPresetCode(existing.advCode);
    if (existingUnpacked && hasDiscsOrNotesContent(existingUnpacked)) {
      discsAndNotes = {
        mainDiscs: existingUnpacked.mainDiscs,
        supportDiscs: existingUnpacked.supportDiscs,
        targetNotes: existingUnpacked.targetNotes,
      };
      preservedAdvancedFromExisting = true;
    }
  } else {
    discsAndNotes = {
      mainDiscs: normalizeMainDiscs(input.mainDiscs),
      supportDiscs: normalizeSupportDiscs(input.supportDiscs),
      targetNotes: { ...(input.targetNotes || {}) },
    };
  }

  const advData: AdvancedPresetData = {
    slots: cloneSlots(input.slots),
    ...discsAndNotes,
  };

  const advCode = packAdvancedPresetCode(advData);
  if (!advCode) {
    return null;
  }

  const inGameCode = packPresetCode(advData.slots);
  const effectiveMode: SavedPresetMode =
    input.mode === 'advanced' ||
    preservedAdvancedFromExisting ||
    hasDiscsOrNotesContent(advData)
      ? 'advanced'
      : 'basic';

  const sanitizedRotation =
    input.combatRotation !== undefined
      ? sanitizeBuildRotation(input.combatRotation)
      : existing?.combatRotation;
  const sourcePresetId =
    input.sourcePresetId !== undefined
      ? typeof input.sourcePresetId === 'string' && input.sourcePresetId.trim()
        ? input.sourcePresetId.trim()
        : undefined
      : existing?.sourcePresetId;

  const record: SavedPresetRecord = {
    id: existing ? existing.id : generatePresetId(now),
    name: normalizePresetName(input.name, effectiveMode),
    mode: effectiveMode,
    advCode,
    inGameCode,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
    ...(sanitizedRotation ? { combatRotation: sanitizedRotation } : {}),
    ...(sourcePresetId ? { sourcePresetId } : {}),
  };

  const nextList = existing
    ? list.map((item) => (item.id === existing.id ? record : item))
    : [record, ...list];

  return {
    list: sortByUpdatedDesc(nextList).slice(0, MAX_SAVED_PRESETS),
    record,
  };
}

export function renameSavedPreset(
  list: SavedPresetRecord[],
  id: string,
  newName: string,
  now = Date.now()
): SavedPresetRecord[] {
  const trimmed = sanitizePresetNameInput(newName);
  if (!trimmed) return list;

  let changed = false;
  const next = list.map((item) => {
    if (item.id !== id) return item;
    changed = true;
    return {
      ...item,
      name: trimmed,
      updatedAt: now,
    };
  });

  return changed ? sortByUpdatedDesc(next) : list;
}

export function duplicateSavedPreset(
  list: SavedPresetRecord[],
  id: string,
  now = Date.now()
): { list: SavedPresetRecord[]; duplicated: SavedPresetRecord | null } {
  const original = list.find((item) => item.id === id);
  if (!original) {
    return { list, duplicated: null };
  }

  const suffix = ' (Copy)';
  const baseLimit = MAX_PRESET_NAME_LENGTH - suffix.length;
  const baseName = Array.from(original.name).slice(0, baseLimit).join('').trimEnd();

  const clonedRotation = original.combatRotation
    ? sanitizeBuildRotation(original.combatRotation)
    : undefined;

  const duplicated: SavedPresetRecord = {
    ...original,
    id: generatePresetId(now),
    name: `${baseName || original.name}${suffix}`,
    createdAt: now,
    updatedAt: now,
    ...(clonedRotation ? { combatRotation: clonedRotation } : {}),
  };

  return {
    list: sortByUpdatedDesc([duplicated, ...list]).slice(0, MAX_SAVED_PRESETS),
    duplicated,
  };
}

export function getSavedPresetById(
  list: SavedPresetRecord[],
  id: string
): SavedPresetRecord | null {
  if (!id) return null;
  return list.find((item) => item.id === id) ?? null;
}

export function updateSavedPresetRotation(
  list: SavedPresetRecord[],
  id: string,
  combatRotation: BuildRotation | null,
  now = Date.now()
): SavedPresetRecord[] {
  const sanitized = combatRotation ? sanitizeBuildRotation(combatRotation) : undefined;
  let changed = false;
  const next = list.map((item) => {
    if (item.id !== id) return item;
    changed = true;
    const { combatRotation: _prev, ...rest } = item;
    return sanitized
      ? { ...rest, combatRotation: sanitized, updatedAt: now }
      : { ...rest, updatedAt: now };
  });
  return changed ? sortByUpdatedDesc(next) : list;
}

export function deleteSavedPreset(
  list: SavedPresetRecord[],
  id: string
): SavedPresetRecord[] {
  return list.filter((item) => item.id !== id);
}

export function serializePresetsBackup(list: SavedPresetRecord[]): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      presets: list,
    },
    null,
    2
  );
}

function validateAndSanitizeRecord(raw: unknown): SavedPresetRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  if (typeof obj.advCode !== 'string' || !obj.advCode.trim()) {
    return null;
  }

  const unpacked = unpackAdvancedPresetCode(obj.advCode);
  if (!unpacked) {
    return null;
  }

  const now = Date.now();
  const createdAt =
    typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt)
      ? obj.createdAt
      : now;
  const updatedAt =
    typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt)
      ? obj.updatedAt
      : createdAt;

  const effectiveMode: SavedPresetMode =
    obj.mode === 'advanced' || hasDiscsOrNotesContent(unpacked) ? 'advanced' : 'basic';

  const id =
    typeof obj.id === 'string' && obj.id.trim() && !DEFAULT_BUILD_IDS.has(obj.id.trim())
      ? obj.id.trim()
      : generatePresetId(updatedAt);

  const name = normalizePresetName(
    typeof obj.name === 'string' ? obj.name : '',
    effectiveMode
  );

  const canonicalAdvCode = packAdvancedPresetCode(unpacked) || obj.advCode.trim();
  const inGameCode = packPresetCode(unpacked.slots);

  const combatRotation = sanitizeBuildRotation(obj.combatRotation);
  const sourcePresetId =
    typeof obj.sourcePresetId === 'string' && obj.sourcePresetId.trim()
      ? obj.sourcePresetId.trim()
      : undefined;

  return {
    id,
    name,
    mode: effectiveMode,
    advCode: canonicalAdvCode,
    inGameCode,
    createdAt,
    updatedAt,
    ...(combatRotation ? { combatRotation } : {}),
    ...(sourcePresetId ? { sourcePresetId } : {}),
  };
}

export function parsePresetsBackup(
  rawJson: string,
  existingList: SavedPresetRecord[] = []
): { list: SavedPresetRecord[]; importedCount: number } | null {
  if (!rawJson || typeof rawJson !== 'string' || rawJson.length > MAX_BACKUP_JSON_LENGTH) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return null;
  }

  let rawArray: unknown[];
  if (Array.isArray(parsed)) {
    rawArray = parsed;
  } else if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as Record<string, unknown>).presets)
  ) {
    rawArray = (parsed as Record<string, unknown>).presets as unknown[];
  } else {
    return null;
  }

  const validIncoming: SavedPresetRecord[] = [];
  for (const entry of rawArray) {
    const clean = validateAndSanitizeRecord(entry);
    if (clean) {
      validIncoming.push(clean);
    }
  }

  if (rawArray.length > 0 && validIncoming.length === 0) {
    return null;
  }

  const mergedById = new Map<string, SavedPresetRecord>();
  for (const item of existingList) {
    mergedById.set(item.id, item);
  }

  let importedCount = 0;
  for (const incoming of validIncoming) {
    const current = mergedById.get(incoming.id);
    if (!current || incoming.updatedAt >= current.updatedAt) {
      mergedById.set(incoming.id, incoming);
    }
    importedCount += 1;
  }

  return {
    list: sortByUpdatedDesc(Array.from(mergedById.values())).slice(0, MAX_SAVED_PRESETS),
    importedCount,
  };
}

function getLocalStorageSafe(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSavedPresetsFromStorage(): SavedPresetRecord[] {
  const storage = getLocalStorageSafe();
  if (!storage) return [];

  try {
    const raw = storage.getItem(SAVED_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = parsePresetsBackup(raw, []);
    return parsed ? parsed.list : [];
  } catch {
    return [];
  }
}

export function savePresetsToStorage(list: SavedPresetRecord[]): boolean {
  const storage = getLocalStorageSafe();
  if (!storage) return false;

  try {
    storage.setItem(SAVED_PRESETS_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

function readDraftMap(storage: Storage): StoredDraftMap {
  try {
    const raw = storage.getItem(ACTIVE_DRAFT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed as StoredDraftMap;
  } catch {
    return {};
  }
}

export function loadDraftBuildFromStorage(
  mode: SavedPresetMode
): { id: string; name: string; data: AdvancedPresetData } | null {
  const storage = getLocalStorageSafe();
  if (!storage) return null;

  const map = readDraftMap(storage);
  const entry = map[mode];
  if (!entry || typeof entry.advCode !== 'string') return null;

  const unpacked = unpackAdvancedPresetCode(entry.advCode);
  if (!unpacked) return null;

  const fallbackId = mode === 'advanced' ? 'advanced-default' : 'default';
  return {
    id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : fallbackId,
    name: normalizePresetName(
      typeof entry.name === 'string' ? entry.name : '',
      mode
    ),
    data: unpacked,
  };
}

export function saveDraftBuildToStorage(
  mode: SavedPresetMode,
  build: BuildContentInput & { id: string; name: string }
): void {
  const storage = getLocalStorageSafe();
  if (!storage) return;

  if (!hasAnyBuildContent(build)) {
    clearDraftBuildFromStorage(mode);
    return;
  }

  const advData: AdvancedPresetData = {
    slots: cloneSlots(build.slots),
    mainDiscs: normalizeMainDiscs(build.mainDiscs),
    supportDiscs: normalizeSupportDiscs(build.supportDiscs),
    targetNotes: { ...(build.targetNotes || {}) },
  };

  const advCode = packAdvancedPresetCode(advData);
  if (!advCode) return;

  const map = readDraftMap(storage);
  map[mode] = {
    id: build.id,
    name: normalizePresetName(build.name, mode),
    advCode,
    updatedAt: Date.now(),
  };

  try {
    storage.setItem(ACTIVE_DRAFT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

export function clearDraftBuildFromStorage(mode: SavedPresetMode): void {
  const storage = getLocalStorageSafe();
  if (!storage) return;

  const map = readDraftMap(storage);
  if (!(mode in map)) return;

  delete map[mode];

  try {
    if (Object.keys(map).length === 0) {
      storage.removeItem(ACTIVE_DRAFT_STORAGE_KEY);
    } else {
      storage.setItem(ACTIVE_DRAFT_STORAGE_KEY, JSON.stringify(map));
    }
  } catch {
    // Ignore storage errors
  }
}
