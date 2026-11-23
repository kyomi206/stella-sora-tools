import type { BuffStatKey, DamageType, ScalingStat } from './damage-engine.ts';
import type { RotationAbility, SlotKey } from './fighter-calc.ts';
import type {
  BuildCombatProfile,
  DiscRankingRosterEntry,
  SkillLevelSource,
  SlotDamageSlice,
} from './disc-rankings-client.ts';

export interface BuildRotationEntry {
  id: string;
  source: RotationAbility['source'];
  name: string;
  damageType: DamageType;
  scalingStat: ScalingStat;
  motionValuePct: number;
  hits: number;
  casts: number;
}

export interface BuildRotation {
  version: 1;
  label?: string;
  durationSec?: number;
  slots: Partial<Record<SlotKey, BuildRotationEntry[]>>;
}

export interface ParsedRotationSkillOption {
  id: string;
  source: SkillLevelSource;
  name: string;
  partLabel: string;
  damageType: DamageType;
  scalingStat: ScalingStat;
  motionValuePct: number;
  hits: number;
  cooldownSec: number | null;
}

const VALID_SLOTS: readonly SlotKey[] = ['vanguard', 'versatile', 'support'];
const VALID_SOURCES = new Set<RotationAbility['source']>([
  'normalAtk',
  'skill',
  'supportSkill',
  'ultimate',
  'custom',
]);
const VALID_DAMAGE_TYPES = new Set<DamageType>([
  'Auto Attack',
  'Skill',
  'Ultimate',
  'Mark',
  'Minion',
]);
const VALID_SCALING_STATS = new Set<ScalingStat>(['ATK', 'HP', 'DEF']);

const DAMAGE_TYPE_TO_BUFF_STAT: Record<DamageType, BuffStatKey> = {
  'Auto Attack': 'aaDmg',
  Skill: 'skillDmg',
  Ultimate: 'ultDmg',
  Mark: 'markDmg',
  Minion: 'minionDmg',
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  return Math.round(clampNumber(value, min, max, fallback));
}

function sanitizeEntry(raw: unknown, fallbackIdx: number): BuildRotationEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.source !== 'string' || !VALID_SOURCES.has(obj.source as RotationAbility['source'])) {
    return null;
  }
  if (typeof obj.damageType !== 'string' || !VALID_DAMAGE_TYPES.has(obj.damageType as DamageType)) {
    return null;
  }
  const scalingStat: ScalingStat =
    typeof obj.scalingStat === 'string' && VALID_SCALING_STATS.has(obj.scalingStat as ScalingStat)
      ? (obj.scalingStat as ScalingStat)
      : 'ATK';

  const id = typeof obj.id === 'string' && obj.id.trim().length > 0 ? obj.id.trim() : `entry-${fallbackIdx}`;
  const name = typeof obj.name === 'string' && obj.name.trim().length > 0 ? obj.name.trim() : obj.damageType;
  const motionValuePct = +clampNumber(obj.motionValuePct, 0, 100000, 0).toFixed(2);
  const hits = clampInt(obj.hits, 1, 99, 1);
  const casts = clampInt(obj.casts, 0, 999, 0);

  return {
    id,
    source: obj.source as RotationAbility['source'],
    name,
    damageType: obj.damageType as DamageType,
    scalingStat,
    motionValuePct,
    hits,
    casts,
  };
}

export function sanitizeBuildRotation(raw: unknown): BuildRotation | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return undefined;
  if (!obj.slots || typeof obj.slots !== 'object') return undefined;

  const rawSlots = obj.slots as Record<string, unknown>;
  const slots: Partial<Record<SlotKey, BuildRotationEntry[]>> = {};
  let hasActive = false;

  for (const slot of VALID_SLOTS) {
    const arr = rawSlots[slot];
    if (!Array.isArray(arr)) continue;
    const cleaned: BuildRotationEntry[] = [];
    for (let i = 0; i < arr.length; i++) {
      const entry = sanitizeEntry(arr[i], i);
      if (entry) {
        cleaned.push(entry);
        if (entry.motionValuePct > 0 && entry.casts > 0) {
          hasActive = true;
        }
      }
    }
    if (cleaned.length > 0) {
      slots[slot] = cleaned;
    }
  }

  if (!hasActive) return undefined;

  const result: BuildRotation = {
    version: 1,
    slots,
  };

  if (typeof obj.label === 'string' && obj.label.trim().length > 0) {
    result.label = obj.label.trim().slice(0, 80);
  }
  if (typeof obj.durationSec === 'number' && Number.isFinite(obj.durationSec) && obj.durationSec > 0) {
    result.durationSec = +clampNumber(obj.durationSec, 1, 600, 20).toFixed(1);
  }

  return result;
}

export function hasActiveRotationEntries(rotation: BuildRotation | null | undefined): boolean {
  if (!rotation || rotation.version !== 1 || !rotation.slots) return false;
  for (const slot of VALID_SLOTS) {
    const entries = rotation.slots[slot];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry && entry.motionValuePct > 0 && entry.casts > 0) {
        return true;
      }
    }
  }
  return false;
}

export function toSlotRotationAbilities(rotation: BuildRotation, slot: SlotKey): RotationAbility[] {
  const entries = rotation.slots[slot] ?? [];
  return entries
    .filter((entry) => entry.casts > 0 && entry.motionValuePct > 0)
    .map((entry) => ({
      id: entry.id,
      source: entry.source,
      name: entry.name,
      damageType: entry.damageType,
      scalingStat: entry.scalingStat,
      motionValuePct: entry.motionValuePct,
      hits: entry.hits,
      casts: entry.casts,
    }));
}

const HP_SCALE_NORM = 0.16;

function toNormalizedEntryWeight(entry: BuildRotationEntry): number {
  if (entry.casts <= 0 || entry.motionValuePct <= 0) return 0;
  const rawMv = entry.motionValuePct * Math.max(1, entry.hits) * entry.casts;
  return entry.scalingStat === 'HP' ? rawMv / HP_SCALE_NORM : rawMv;
}

export function deriveProfileFromRotation(
  rotation: BuildRotation,
  roster: DiscRankingRosterEntry[],
): BuildCombatProfile {
  const slotTotals: Record<SlotKey, number> = {
    vanguard: 0,
    versatile: 0,
    support: 0,
  };
  const slotTypeTotals: Record<SlotKey, Partial<Record<DamageType, number>>> = {
    vanguard: {},
    versatile: {},
    support: {},
  };
  const slots: Partial<Record<SlotKey, SlotDamageSlice[]>> = {};

  let grandTotal = 0;

  for (const slot of VALID_SLOTS) {
    const entries = rotation.slots[slot] ?? [];
    const grouped = new Map<
      string,
      { type: DamageType; skillSource?: SkillLevelSource; weight: number }
    >();

    for (const entry of entries) {
      const w = toNormalizedEntryWeight(entry);
      if (w <= 0) continue;
      slotTotals[slot] += w;
      grandTotal += w;
      slotTypeTotals[slot][entry.damageType] = (slotTypeTotals[slot][entry.damageType] ?? 0) + w;

      const skillSource: SkillLevelSource | undefined =
        entry.source !== 'custom' ? entry.source : undefined;
      const key = `${entry.damageType}::${skillSource ?? ''}`;
      const prev = grouped.get(key);
      if (prev) {
        prev.weight += w;
      } else {
        grouped.set(key, { type: entry.damageType, skillSource, weight: w });
      }
    }

    if (grouped.size > 0) {
      slots[slot] = [...grouped.values()]
        .sort((a, b) => b.weight - a.weight)
        .map((item) => ({
          type: item.type,
          weight: +item.weight.toFixed(2),
          ...(item.skillSource ? { skillSource: item.skillSource } : {}),
        }));
    }
  }

  // Keep slice weights in actual unscaled normalized-MV units matching buildFighters; handle all-zero cleanly
  if (grandTotal <= 0) {
    const firstOccupied = roster.find((r) => r.character !== null)?.slot ?? 'vanguard';
    const firstEntry = rotation.slots[firstOccupied]?.[0];
    const fallbackType: DamageType = firstEntry?.damageType ?? 'Skill';
    slots[firstOccupied] = [{ type: fallbackType, weight: 0 }];
    return {
      carrySlot: firstOccupied,
      carryTypeStat: DAMAGE_TYPE_TO_BUFF_STAT[fallbackType],
      slots,
    };
  }

  let carrySlot: SlotKey = roster.find((r) => r.character !== null)?.slot ?? 'vanguard';
  let bestSlotTotal = -1;
  for (const slot of VALID_SLOTS) {
    if (slotTotals[slot] > bestSlotTotal) {
      bestSlotTotal = slotTotals[slot];
      carrySlot = slot;
    }
  }

  let topType: DamageType = 'Skill';
  let bestTypeTotal = -1;
  const carryTypes = slotTypeTotals[carrySlot];
  for (const [dtype, total] of Object.entries(carryTypes) as Array<[DamageType, number]>) {
    if (total > bestTypeTotal) {
      bestTypeTotal = total;
      topType = dtype;
    }
  }

  return {
    carrySlot,
    carryTypeStat: DAMAGE_TYPE_TO_BUFF_STAT[topType],
    slots,
  };
}

export function buildDefaultRotationEntriesForSlot(
  slot: SlotKey,
  skillOptions: ParsedRotationSkillOption[],
): BuildRotationEntry[] {
  return skillOptions.map((opt) => {
    let casts = 2;
    if (opt.damageType === 'Mark') {
      casts = 2;
    } else if (opt.source === 'normalAtk') {
      casts = 4;
    } else if (opt.source === 'ultimate') {
      casts = 1;
    } else if (opt.source === 'skill' || opt.source === 'supportSkill') {
      casts = 2;
    }
    return {
      id: opt.id,
      source: opt.source,
      name: opt.partLabel ? `${opt.name} (${opt.partLabel})` : opt.name,
      damageType: opt.damageType,
      scalingStat: opt.scalingStat,
      motionValuePct: opt.motionValuePct,
      hits: Math.max(1, opt.hits),
      casts,
    };
  });
}
