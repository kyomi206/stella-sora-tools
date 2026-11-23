'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AdvancedTeamBuild,
  ElementType,
  NoteName,
  SSCharacter,
  SSDisc,
} from '@/types';
import {
  MUSICAL_NOTES,
  calculateSupportStartingNotes,
  getDiscOutfitIconUrl,
  getNoteIconUrl,
} from '@/data/notes';
import { getSkillIconUrl } from '@/lib/calculator/material-icons';
import characterCombatData from '@/data/character-combat.json';
import {
  BUFF_STAT_OPTIONS,
  DAMAGE_TYPES,
  RECORD_LEVEL_BASE_ATK,
  RECORD_LEVEL_BASE_HP,
  calculateDefAmend,
  calculateResAmend,
  computePresetContributions,
} from '@/lib/calculator/damage-engine';
import { toSlotRotationAbilities } from '@/lib/calculator/build-rotation';
import { getPotentialById } from '@/lib/potentials';
import type {
  BuffStatKey,
  DamageType,
  DiscAndNoteContributions,
} from '@/lib/calculator/damage-engine';
import {
  EMBLEM_LEVELS,
  EMBLEM_RARITIES,
  EMBLEM_ROW_COUNT,
  getEmblemRarities,
  getEmblemSkillLevelBonuses,
  getEmblemStatMeta,
  getEmblemStatOptions,
  getEmblemValue,
} from '@/lib/calculator/talent-emblem';
import {
  parsePrimarySkillPart,
  parseSkillParts,
  type ParsedAbilityPart,
} from '@/lib/calculator/motion-value-parser';
import type { EmblemLevel, EmblemRarity, EmblemRowState } from '@/lib/calculator/talent-emblem';
import {
  aggregateDamageSources,
  calculateTeam,
  type BuffTarget,
  type CharacterCombatEntry,
  type FighterCalc,
  type FighterStateInput,
  type RotationAbility,
  type SlotKey,
  type TeamCalcInput,
  type TrekkerLevel,
} from '@/lib/calculator/fighter-calc';
import {
  computeDiscContributions,
  computePenCurve,
  computeTalentProgression,
  type DiscSweepEntry,
} from '@/lib/calculator/sensitivity-engine';
import { PieChart, PieLegend } from './damage-charts';
import type { PieSlice } from './damage-charts';
import { RotationPanel } from './rotation-panel';
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  Disc3,
  Info,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  extractDiscPresetBuffs,
  extractPotentialExtraHitSpecs,
  extractPotentialPresetBuffs,
  extractSkillKitPresetBuffs,
  renderPotentialAtLevel,
  type DiscBuffEvaluationContext,
  type PresetBuffItem,
} from '@/lib/calculator/preset-buffs';
import { cn } from '@/lib/utils';
import { getTrekkerImageUrl } from '@/lib/wikitide';

interface TheoreticalDamageCalculatorProps {
  build: AdvancedTeamBuild;
  characters: Record<string, SSCharacter>;
  discs: Record<string, SSDisc>;
}

type AbilityPresetKey = 'normalAtk' | 'skill' | 'supportSkill' | 'ultimate';

interface AbilityPreset {
  key: AbilityPresetKey;
  label: string;
  shortLabel: string;
  damageType: DamageType;
}

interface BuffRowState {
  id: string;
  label: string;
  target: BuffTarget;
  stat: BuffStatKey;
  value: number;
}

interface BaselineSnapshot {
  savedAt: number;
  total: number;
  nonCrit: number;
  crit: number;
  perSlot: Record<SlotKey, number>;
}

type DiscSlotEntry =
  | {
      key: string;
      kind: 'main';
      index: number;
      discId: number | null;
      level: 1 | 80 | 90;
      crescendo: number;
    }
  | {
      key: string;
      kind: 'support';
      index: number;
      discId: number | null;
      level: 1 | 80 | 90;
      crescendo: number;
      phase: number;
    };

const COMBAT_DB = characterCombatData as unknown as Record<string, CharacterCombatEntry>;

const SLOT_KEYS: SlotKey[] = ['vanguard', 'versatile', 'support'];

const SLOT_META: Record<SlotKey, { label: string; shortLabel: string; accent: string }> = {
  vanguard: { label: 'Vanguard', shortLabel: 'VGD', accent: 'bg-amber-500' },
  versatile: { label: 'Versatile', shortLabel: 'VRS', accent: 'bg-sky-500' },
  support: { label: 'Support', shortLabel: 'SUP', accent: 'bg-emerald-500' },
};

const TREKKER_LEVELS: TrekkerLevel[] = ['90', '80', '70', '1'];

const ABILITY_PRESETS: AbilityPreset[] = [
  { key: 'normalAtk', label: 'Normal Attack', shortLabel: 'Normal', damageType: 'Auto Attack' },
  { key: 'skill', label: 'Combat Skill', shortLabel: 'Skill', damageType: 'Skill' },
  { key: 'supportSkill', label: 'Support Skill', shortLabel: 'Support', damageType: 'Skill' },
  { key: 'ultimate', label: 'Ultimate', shortLabel: 'Ultimate', damageType: 'Ultimate' },
];

const ABILITY_PRESET_MAP = Object.fromEntries(
  ABILITY_PRESETS.map((preset) => [preset.key, preset])
) as Record<AbilityPresetKey, AbilityPreset>;

const ENEMY_PRESETS = [
  { label: 'Weak boss', res: 250, def: 500 },
  { label: 'Raid', res: 570, def: 500 },
  { label: 'Neutral', res: 750, def: 500 },
  { label: 'Resistant', res: 2000, def: 500 },
  { label: 'Fragile mob', res: 160, def: 0 },
];

const ELEMENT_STYLES: Record<
  ElementType,
  { text: string; chip: string; dot: string; bar: string; ring: string }
> = {
  Ignis: {
    text: 'text-orange-700',
    chip: 'border-orange-500/30 bg-orange-500/10 text-orange-700',
    dot: 'bg-orange-500',
    bar: 'bg-orange-500',
    ring: 'ring-orange-500/25',
  },
  Aqua: {
    text: 'text-sky-700',
    chip: 'border-sky-500/30 bg-sky-500/10 text-sky-700',
    dot: 'bg-sky-500',
    bar: 'bg-sky-500',
    ring: 'ring-sky-500/25',
  },
  Terra: {
    text: 'text-emerald-700',
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    ring: 'ring-emerald-500/25',
  },
  Ventus: {
    text: 'text-teal-700',
    chip: 'border-teal-500/30 bg-teal-500/10 text-teal-700',
    dot: 'bg-teal-500',
    bar: 'bg-teal-500',
    ring: 'ring-teal-500/25',
  },
  Lux: {
    text: 'text-amber-700',
    chip: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
    dot: 'bg-amber-400',
    bar: 'bg-amber-400',
    ring: 'ring-amber-500/25',
  },
  Umbra: {
    text: 'text-purple-700',
    chip: 'border-purple-500/30 bg-purple-500/10 text-purple-700',
    dot: 'bg-purple-500',
    bar: 'bg-purple-500',
    ring: 'ring-purple-500/25',
  },
};

const ELEMENT_HEX: Record<ElementType, string> = {
  Ignis: '#f97316',
  Aqua: '#0ea5e9',
  Terra: '#10b981',
  Ventus: '#14b8a6',
  Lux: '#f59e0b',
  Umbra: '#a855f7',
};

const SLOT_HEX: Record<SlotKey, string> = {
  vanguard: '#f59e0b',
  versatile: '#0ea5e9',
  support: '#10b981',
};

const DAMAGE_TYPE_HEX: Record<DamageType, string> = {
  'Auto Attack': '#3b82f6',
  Skill: '#ef4444',
  Ultimate: '#f59e0b',
  Mark: '#a855f7',
  Minion: '#10b981',
};

const SOURCE_PALETTE = [
  '#f59e0b',
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#a855f7',
  '#06b6d4',
  '#f97316',
  '#84cc16',
];

const RARITY_STYLES: Record<EmblemRarity, string> = {
  Green: 'text-emerald-700',
  Blue: 'text-sky-700',
  Yellow: 'text-amber-700',
  Rainbow: 'text-fuchsia-700 dark:text-fuchsia-400',
};

const BUFF_STAT_GROUPS = Array.from(new Set(BUFF_STAT_OPTIONS.map((option) => option.group))).map(
  (group) => ({
    group,
    options: BUFF_STAT_OPTIONS.filter((option) => option.group === group),
  })
);

const BUFF_STAT_MAP = Object.fromEntries(
  BUFF_STAT_OPTIONS.map((option) => [option.key, option])
) as Record<BuffStatKey, (typeof BUFF_STAT_OPTIONS)[number]>;

type SensitivityTab = 'talents' | 'discs' | 'pen';

const SENSITIVITY_TABS: Array<{ key: SensitivityTab; label: string }> = [
  { key: 'talents', label: 'Talents' },
  { key: 'discs', label: 'Disc impact' },
  { key: 'pen', label: 'PEN vs RES' },
];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70 focus-visible:border-teal-500';

const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-base px-2.5 py-1.5 text-xs font-semibold tabular-nums text-slate-900 transition-colors placeholder:font-normal placeholder:text-slate-600 dark:placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/35 dark:text-white';

const SMALL_INPUT_CLASS =
  'w-full rounded border border-border bg-surface-card px-1.5 py-1 text-[11px] font-bold tabular-nums text-slate-900 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/35 dark:bg-base dark:text-white';

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Math.round(value).toLocaleString('en-US');
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString('en-US');
}

function formatSignedPct(value: number): string {
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
}

const SKILL_LEVELS = Array.from({ length: 13 }, (_, index) => index + 1);

function getEffectiveSkillLevel(
  baseSkillLevel: number,
  emblems: Record<EmblemLevel, EmblemRowState[]>,
  source: AbilityPresetKey | 'custom'
): number {
  if (source === 'custom') return baseSkillLevel;
  const bonuses = getEmblemSkillLevelBonuses(emblems);
  return Math.max(1, Math.min(13, baseSkillLevel + (bonuses[source] ?? 0)));
}

function buildRotationFromPart(
  id: string,
  source: AbilityPresetKey,
  entry: { name: string; icon?: string },
  part: ParsedAbilityPart | null
): RotationAbility {
  return {
    id,
    source,
    partId: part?.id,
    name: part?.label ?? entry.name,
    icon: entry.icon,
    motionValuePct: part?.mvPct ?? 0,
    hits: part?.hits ?? 1,
    casts: 1,
    damageType: part?.damageType ?? ABILITY_PRESET_MAP[source].damageType,
    scalingStat: part?.scalingStat ?? 'ATK',
  };
}

function resyncPresetRotation(
  rotation: RotationAbility[],
  combat: CharacterCombatEntry | null,
  skillLevel: number,
  emblems: Record<EmblemLevel, EmblemRowState[]>
): RotationAbility[] {
  if (!combat) return rotation;
  return rotation.map((item) => {
    if (item.source === 'custom') return item;
    const skillEntry = combat[item.source];
    if (!skillEntry) return item;
    const effectiveLevel = getEffectiveSkillLevel(skillLevel, emblems, item.source);
    const parts = parseSkillParts(skillEntry, item.source, effectiveLevel);
    const matched =
      (item.partId ? parts.find((part) => part.id === item.partId) : undefined) ?? parts[0];
    if (!matched) return item;
    return {
      ...item,
      motionValuePct: matched.mvPct,
    };
  });
}

function getCharacterInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}


function createDefaultRotation(
  slot: SlotKey,
  combat: CharacterCombatEntry | null
): RotationAbility[] {
  if (!combat) return [];
  const candidateKeys: AbilityPresetKey[] =
    slot === 'vanguard'
      ? ['skill', 'ultimate']
      : ['supportSkill', 'ultimate'];
  const keysToLoad = candidateKeys.filter((k) => Boolean(combat[k]));
  if (keysToLoad.length === 0 && combat.normalAtk) {
    keysToLoad.push('normalAtk');
  }
  const defaultCasts: Record<AbilityPresetKey, number> = {
    normalAtk: 4,
    skill: 3,
    supportSkill: 3,
    ultimate: 1,
  };
  const rows: RotationAbility[] = [];
  for (const presetKey of keysToLoad) {
    const entry = combat[presetKey];
    if (!entry) continue;
    const parts = parseSkillParts(entry, presetKey, 10);
    if (parts.length > 0) {
      parts.forEach((part, idx) => {
        const built = buildRotationFromPart(`${slot}-init-${presetKey}-${idx}`, presetKey, entry, part);
        rows.push({ ...built, casts: defaultCasts[presetKey] });
      });
    } else {
      const part = parsePrimarySkillPart(entry, presetKey, 10);
      const built = buildRotationFromPart(`${slot}-init-${presetKey}`, presetKey, entry, part);
      rows.push({ ...built, casts: defaultCasts[presetKey] });
    }
  }
  return rows;
}

function createEmptyEmblemRows(): EmblemRowState[] {
  return Array.from({ length: EMBLEM_ROW_COUNT }, () => ({ stat: '', rarity: 'Rainbow' }));
}

function createEmblemSet(): Record<EmblemLevel, EmblemRowState[]> {
  return {
    '70': createEmptyEmblemRows(),
    '80': createEmptyEmblemRows(),
    '90': createEmptyEmblemRows(),
  };
}

function createFighters(
  build: AdvancedTeamBuild,
  characters: Record<string, SSCharacter>
): FighterStateInput[] {
  return SLOT_KEYS.map((slot) => {
    const characterId = build.slots[slot].characterId;
    const character = characterId ? characters[String(characterId)] ?? null : null;
    const combat = characterId ? COMBAT_DB[String(characterId)] ?? null : null;
    const star = character?.star ?? combat?.star ?? 5;
    const fromBuild = build.rotation ? toSlotRotationAbilities(build.rotation, slot) : [];
    return {
      slot,
      level: '90',
      skillLevel: 10,
      affinityLevel: 30,
      talentTier: star === 4 ? 5 : 0,
      emblems: createEmblemSet(),
      rotation: fromBuild.length > 0 ? fromBuild : createDefaultRotation(slot, combat),
    };
  });
}

function getDiscAtk(
  discId: number | null,
  level: 1 | 80 | 90,
  crescendo: number,
  discs: Record<string, SSDisc>
): number {
  if (!discId) return 0;
  const disc = discs[String(discId)];
  if (!disc) return 0;
  const statTier = level === 1 ? disc.stats.lv1 : level === 80 ? disc.stats.lv80 : disc.stats.lv90;
  const baseAtk = Number(statTier?.ATK) || 0;
  const dupeBonus = crescendo > 1 ? Number(disc.dupeAtk?.[crescendo - 2]) || 0 : 0;
  return baseAtk + dupeBonus;
}

function getSupportStartingNoteCount(disc: SSDisc | null, phase: number): number {
  if (!disc?.supportNote?.length) return 0;
  const phaseIndex = Math.max(0, Math.min(disc.supportNote.length - 1, phase));
  const tier = disc.supportNote[phaseIndex] || {};
  return Object.values(tier).reduce((total, count) => total + (Number(count) || 0), 0);
}

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2.5">
      <div className="min-w-0">
        <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-xs leading-snug text-slate-600 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">{hint}</span>}
    </label>
  );
}

function HeroMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2.5">
      <div className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-base font-bold tabular-nums text-slate-900 dark:text-white">
        {value}
      </div>
      <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{hint}</div>
    </div>
  );
}

function DeltaChip({ value, label = 'vs baseline' }: { value: number; label?: string }) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-bold tabular-nums',
        positive
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
          : 'border-rose-500/30 bg-rose-500/10 text-rose-700'
      )}
    >
      {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {formatSignedPct(value)} {label}
    </span>
  );
}

function AbilityIcon({ icon, className }: { icon?: string; className?: string }) {
  const iconUrl = getSkillIconUrl(icon);
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded border border-[#1e3a5f]/25 bg-[#2e4b84] p-0.5 text-white dark:border-border-subtle dark:bg-surface-elevated',
        className
      )}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-contain"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <span className="text-[10px] font-bold leading-none text-white/80" aria-hidden="true">
          •
        </span>
      )}
    </span>
  );
}

function NoteGroup({
  label,
  notes,
  counts,
}: {
  label: string;
  notes: typeof MUSICAL_NOTES;
  counts: Record<NoteName, number>;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 shrink-0 text-xs font-medium text-slate-600 dark:text-slate-400">
        {label}
      </div>
      <div className="flex flex-1 flex-wrap items-end gap-x-1 gap-y-2">
        {notes.map((note) => {
          const count = Math.max(0, Number(counts[note.name]) || 0);
          const bonus = +(count * note.perLevelPct).toFixed(2);
          return (
            <div
              key={note.name}
              className="flex min-w-0 flex-1 flex-col items-center gap-1"
              title={`${note.name} · A-${count}${bonus > 0 ? ` · +${bonus}%` : ''} — ${note.statLabel}`}
            >
              <img
                src={getNoteIconUrl(note.name)}
                alt=""
                loading="lazy"
                decoding="async"
                className={cn(
                  'size-10 object-contain sm:size-12',
                  count > 0 ? 'opacity-100' : 'opacity-40'
                )}
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
              <span
                className={cn(
                  'text-xs font-bold leading-none tabular-nums',
                  count > 0
                    ? 'text-slate-800 dark:text-white'
                    : 'text-slate-600 dark:text-slate-400'
                )}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BuffRow({
  row,
  targets,
  onChange,
  onRemove,
}: {
  row: BuffRowState;
  targets: Array<{ value: BuffTarget; label: string }>;
  onChange: (patch: Partial<BuffRowState>) => void;
  onRemove: () => void;
}) {
  const statOption = BUFF_STAT_MAP[row.stat];
  const suffix = statOption?.percent ? '%' : '';

  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-border-subtle bg-surface-subtle p-2.5 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)_minmax(0,1.15fr)_minmax(0,0.7fr)_auto] sm:items-end">
      <Field label="Source / note" className="col-span-2 sm:col-span-1">
        <input
          value={row.label}
          onChange={(event) => onChange({ label: event.target.value })}
          placeholder="e.g. Holiday Time"
          className={INPUT_CLASS}
          aria-label="Buff source or note"
        />
      </Field>

      <Field label="Applies to">
        <select
          value={row.target}
          onChange={(event) => onChange({ target: event.target.value as BuffTarget })}
          className={cn(INPUT_CLASS, 'font-sans')}
          aria-label="Buff target"
        >
          {targets.map((target) => (
            <option key={target.value} value={target.value}>
              {target.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Stat">
        <select
          value={row.stat}
          onChange={(event) => onChange({ stat: event.target.value as BuffStatKey })}
          className={cn(INPUT_CLASS, 'font-sans')}
          aria-label="Buff stat"
        >
          {BUFF_STAT_GROUPS.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <Field label={suffix ? 'Value (%)' : 'Value (flat)'}>
        <div className="relative">
          <input
            type="number"
            step="any"
            value={row.value}
            onChange={(event) => onChange({ value: Number(event.target.value) || 0 })}
            className={cn(INPUT_CLASS, suffix && 'pr-6')}
            aria-label="Buff value"
          />
          {suffix && (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-600 dark:text-slate-400">
              %
            </span>
          )}
        </div>
      </Field>

      <button
        type="button"
        onClick={onRemove}
        className={cn(
          'inline-flex min-h-8 min-w-8 items-center justify-center justify-self-end rounded-lg border border-border bg-surface-card p-2 text-slate-600 transition-colors hover:border-rose-500/40 hover:text-rose-700 dark:text-slate-400',
          FOCUS_RING
        )}
        aria-label={`Remove stat row${row.label ? `: ${row.label}` : ''}`}
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function EmblemLevelBlock({
  level,
  rows,
  onChange,
}: {
  level: EmblemLevel;
  rows: EmblemRowState[];
  onChange: (index: number, patch: Partial<EmblemRowState>) => void;
}) {
  const options = getEmblemStatOptions(level);

  const handleStatChange = (index: number, stat: string) => {
    const rarities = stat ? getEmblemRarities(level, stat) : EMBLEM_RARITIES;
    const row = rows[index];
    const rarity = rarities.includes(row.rarity) ? row.rarity : rarities[rarities.length - 1];
    onChange(index, { stat, rarity });
  };

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2">
      <div className="flex items-center justify-between px-0.5 pb-1.5">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Emblem {level}
        </span>
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Stat / Rarity / Value
        </span>
      </div>
      <div className="space-y-1">
        {rows.map((row, index) => {
          const rarities = row.stat ? getEmblemRarities(level, row.stat) : EMBLEM_RARITIES;
          const meta = row.stat ? getEmblemStatMeta(row.stat) : undefined;
          const rawValue = meta ? getEmblemValue(level, row.stat, row.rarity) : 0;
          const displayValue = meta ? rawValue * (meta.percent ? 100 : 1) : 0;

          return (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.7fr)] items-center gap-1"
            >
              <select
                value={row.stat}
                onChange={(event) => handleStatChange(index, event.target.value)}
                className="w-full rounded-md border border-border bg-base px-1.5 py-1 text-[11px] font-medium text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/35 dark:text-white"
                aria-label={`Emblem ${level} stat ${index + 1}`}
              >
                <option value="">—</option>
                {options.map((option) => (
                  <option key={option.stat} value={option.stat}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={row.rarity}
                disabled={!row.stat}
                onChange={(event) =>
                  onChange(index, { rarity: event.target.value as EmblemRarity })
                }
                className={cn(
                  'w-full rounded-md border border-border bg-base px-1.5 py-1 text-[11px] font-semibold focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/35 disabled:opacity-40',
                  RARITY_STYLES[row.rarity]
                )}
                aria-label={`Emblem ${level} rarity ${index + 1}`}
              >
                {rarities.map((rarity) => (
                  <option key={rarity} value={rarity}>
                    {rarity}
                  </option>
                ))}
              </select>
              <span className="truncate text-right text-xs font-bold tabular-nums text-slate-700">
                {meta && displayValue > 0
                  ? meta.levelBonus
                    ? `+${displayValue.toFixed(0)}`
                    : `${meta.percent ? displayValue.toFixed(1) : displayValue.toFixed(0)}${meta.percent ? '%' : ''}`
                  : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TheoreticalDamageCalculator({
  build,
  characters,
  discs,
}: TheoreticalDamageCalculatorProps) {
  const rotationSeq = useRef(0);
  const buffSeq = useRef(0);

  const [fighters, setFighters] = useState<FighterStateInput[]>(() =>
    createFighters(build, characters)
  );
  const [buffs, setBuffs] = useState<BuffRowState[]>([]);
  const [disabledPresetBuffIds, setDisabledPresetBuffIds] = useState<Record<string, boolean>>({});
  const [potentialBonusLevels, setPotentialBonusLevels] = useState<Record<string, 0 | 1 | 2 | 3>>({});
  const [potentialLevelOverrides, setPotentialLevelOverrides] = useState<Record<string, number>>({});
  const [uptimeMode, setUptimeMode] = useState<'realistic' | 'ideal'>('realistic');
  const [fightMode, setFightMode] = useState<'single' | 'multi'>('single');
  const [recordLevel, setRecordLevel] = useState(31);
  const [enemyDef, setEnemyDef] = useState(500);
  const [enemyRes, setEnemyRes] = useState(250);
  const [resilienceBreakUptimePct, setResilienceBreakUptimePct] = useState(0);
  const [fightDurationSec, setFightDurationSec] = useState(() => build.rotation?.durationSec ?? 90);
  const [baseline, setBaseline] = useState<BaselineSnapshot | null>(null);
  const [sensitivityTab, setSensitivityTab] = useState<SensitivityTab>('talents');
  const [talentSlot, setTalentSlot] = useState<SlotKey>('vanguard');

  useEffect(() => {
    setFighters(createFighters(build, characters));
    setBuffs([]);
    setDisabledPresetBuffIds({});
    setPotentialBonusLevels({});
    setPotentialLevelOverrides({});
    setFightDurationSec(build.rotation?.durationSec ?? 90);
    setBaseline(null);
  }, [build, characters]);

  const supportStartingNotes = useMemo(
    () => calculateSupportStartingNotes(build.supportDiscs, discs),
    [build.supportDiscs, discs]
  );

  const effectiveNotes = useMemo(() => {
    return Object.fromEntries(
      MUSICAL_NOTES.map((note) => {
        const start = supportStartingNotes[note.name] || 0;
        const custom = build.targetNotes[note.name];
        return [note.name, custom !== undefined ? Math.max(0, Number(custom) || 0) : start];
      })
    ) as Record<NoteName, number>;
  }, [supportStartingNotes, build.targetNotes]);

  const contributions = useMemo(
    () =>
      computePresetContributions(
        build.mainDiscs,
        build.supportDiscs,
        effectiveNotes,
        discs
      ),
    [build.mainDiscs, build.supportDiscs, effectiveNotes, discs]
  );

  const rosterSlots = useMemo(
    () =>
      SLOT_KEYS.map((slot) => {
        const characterId = build.slots[slot].characterId;
        return {
          slot,
          character: characterId ? characters[String(characterId)] ?? null : null,
        };
      }),
    [build.slots, characters]
  );

  const discEvalContext = useMemo<DiscBuffEvaluationContext>(
    () => ({
      enforceTriggers: true,
      uptimeMode,
      fightMode,
      destinyCards: 10,
    }),
    [uptimeMode, fightMode]
  );

  const fighterInputs = useMemo(
    () =>
      fighters.map((state) => {
        const characterId = build.slots[state.slot].characterId;
        const character = characterId ? characters[String(characterId)] ?? null : null;
        const combat = characterId ? COMBAT_DB[String(characterId)] ?? null : null;
        return { state, character, combat };
      }),
    [fighters, build.slots, characters]
  );

  const nonDiscImportedBuffs = useMemo<PresetBuffItem[]>(() => {
    const potBuffs = extractPotentialPresetBuffs(build, rosterSlots, {
      bonusLevels: potentialBonusLevels,
      levelOverrides: potentialLevelOverrides,
      disabledIds: disabledPresetBuffIds,
    });
    const skillBuffs = extractSkillKitPresetBuffs(
      fighterInputs,
      rosterSlots,
      disabledPresetBuffIds
    );
    return [...potBuffs, ...skillBuffs];
  }, [
    build,
    rosterSlots,
    disabledPresetBuffIds,
    potentialBonusLevels,
    potentialLevelOverrides,
    fighterInputs,
  ]);

  const importedBuffs = useMemo<PresetBuffItem[]>(() => {
    const discBuffs = extractDiscPresetBuffs(
      build.mainDiscs,
      effectiveNotes,
      discs,
      rosterSlots,
      disabledPresetBuffIds,
      discEvalContext
    );
    return [...discBuffs, ...nonDiscImportedBuffs];
  }, [
    build.mainDiscs,
    effectiveNotes,
    discs,
    rosterSlots,
    disabledPresetBuffIds,
    discEvalContext,
    nonDiscImportedBuffs,
  ]);

  const applyUptimeScale = (item: PresetBuffItem) =>
    uptimeMode === 'realistic' && item.realisticUptime !== undefined
      ? +(item.value * item.realisticUptime).toFixed(4)
      : item.value;

  const combinedBuffs = useMemo(
    () => [
      ...importedBuffs
        .filter((item) => item.enabled)
        .map((item) => ({
          target: item.target,
          stat: item.stat,
          value: applyUptimeScale(item),
        })),
      ...buffs,
    ],
    [importedBuffs, buffs, uptimeMode]
  );

  const teamInput = useMemo<TeamCalcInput>(() => {
    return {
      fighters: fighterInputs,
      contributions,
      buffs: combinedBuffs,
      recordLevel,
      enemy: {
        def: enemyDef,
        res: enemyRes,
        resilienceBroken: resilienceBreakUptimePct >= 100,
        resilienceBreakUptimePct,
      },
    };
  }, [
    fighterInputs,
    contributions,
    combinedBuffs,
    recordLevel,
    enemyDef,
    enemyRes,
    resilienceBreakUptimePct,
  ]);

  const teamCalc = useMemo(() => calculateTeam(teamInput), [teamInput]);

  const discEntries = useMemo<DiscSweepEntry[]>(() => {
    const entries: DiscSweepEntry[] = [];
    build.mainDiscs.forEach((selected, index) => {
      if (!selected.discId) return;
      entries.push({
        slot: 'main',
        index,
        discId: selected.discId,
        name: discs[String(selected.discId)]?.name ?? `Disc ${selected.discId}`,
      });
    });
    build.supportDiscs.forEach((selected, index) => {
      if (!selected.discId) return;
      entries.push({
        slot: 'support',
        index,
        discId: selected.discId,
        name: discs[String(selected.discId)]?.name ?? `Disc ${selected.discId}`,
      });
    });
    return entries;
  }, [build.mainDiscs, build.supportDiscs, discs]);

  const discPoints = useMemo(() => {
    if (discEntries.length === 0) return [];

    const getReducedSetup = (without: DiscSweepEntry | null) => {
      const mainDiscs =
        without?.slot === 'main'
          ? build.mainDiscs.filter((_, index) => index !== without.index)
          : build.mainDiscs;
      const supportDiscs =
        without?.slot === 'support'
          ? build.supportDiscs.filter((_, index) => index !== without.index)
          : build.supportDiscs;

      let notes = effectiveNotes;
      if (without?.slot === 'support') {
        const remainingStart = calculateSupportStartingNotes(supportDiscs, discs);
        notes = Object.fromEntries(
          MUSICAL_NOTES.map((note) => {
            const lost =
              (supportStartingNotes[note.name] || 0) - (remainingStart[note.name] || 0);
            return [note.name, Math.max(0, (effectiveNotes[note.name] || 0) - lost)];
          })
        ) as Record<NoteName, number>;
      }

      return { mainDiscs, supportDiscs, notes };
    };

    const rebuild = (without: DiscSweepEntry | null) => {
      const { mainDiscs, supportDiscs, notes } = getReducedSetup(without);
      return computePresetContributions(mainDiscs, supportDiscs, notes, discs);
    };

    const rebuildBuffs = (without: DiscSweepEntry | null) => {
      const { mainDiscs, notes } = getReducedSetup(without);
      const sweptDiscBuffs = extractDiscPresetBuffs(
        mainDiscs,
        notes,
        discs,
        rosterSlots,
        disabledPresetBuffIds,
        discEvalContext
      );
      return [
        ...sweptDiscBuffs
          .filter((item) => item.enabled)
          .map((item) => ({
            target: item.target,
            stat: item.stat,
            value:
              uptimeMode === 'realistic' && item.realisticUptime !== undefined
                ? +(item.value * item.realisticUptime).toFixed(4)
                : item.value,
          })),
        ...nonDiscImportedBuffs
          .filter((item) => item.enabled)
          .map((item) => ({
            target: item.target,
            stat: item.stat,
            value:
              uptimeMode === 'realistic' && item.realisticUptime !== undefined
                ? +(item.value * item.realisticUptime).toFixed(4)
                : item.value,
          })),
        ...buffs,
      ];
    };

    return computeDiscContributions(teamInput, discEntries, rebuild, rebuildBuffs);
  }, [
    teamInput,
    discEntries,
    build.mainDiscs,
    build.supportDiscs,
    effectiveNotes,
    supportStartingNotes,
    discs,
    rosterSlots,
    disabledPresetBuffIds,
    discEvalContext,
    nonDiscImportedBuffs,
    buffs,
    uptimeMode,
  ]);

  const talentPoints = useMemo(
    () => computeTalentProgression(teamInput, talentSlot),
    [teamInput, talentSlot]
  );

  const penReferenceFighter = useMemo(() => {
    const populated = teamCalc.fighters.filter((fighter) => fighter.character);
    return populated[0] ?? teamCalc.fighters[0];
  }, [teamCalc.fighters]);

  const penPoints = useMemo(
    () =>
      computePenCurve(
        enemyRes,
        penReferenceFighter?.stats.vulPct ?? 0,
        penReferenceFighter?.stats.resIgnorePct ?? 0
      ),
    [enemyRes, penReferenceFighter]
  );

  const fighterCalcs: FighterCalc[] = teamCalc.fighters;
  const totalExpected = teamCalc.totalExpected;
  const totalNonCrit = teamCalc.totalNonCrit;
  const totalCrit = teamCalc.totalCrit;
  const totalHits = teamCalc.totalHits;
  const activeAbilities = fighterCalcs.reduce(
    (sum, fighter) => sum + fighter.abilities.length,
    0
  );
  const teamSize = fighterCalcs.filter((fighter) => fighter.character).length;
  const avgCritMult = totalNonCrit > 0 ? totalExpected / totalNonCrit : 1;
  const snapshotDelta =
    baseline && baseline.total > 0
      ? ((totalExpected - baseline.total) / baseline.total) * 100
      : null;
  const recordAtk = RECORD_LEVEL_BASE_ATK[recordLevel] ?? 0;
  const recordHp = RECORD_LEVEL_BASE_HP[recordLevel] ?? 0;
  const teamDps = totalExpected / Math.max(1, fightDurationSec);
  const baseDefAmend = calculateDefAmend(enemyDef).defAmend;
  const baseResAmend = calculateResAmend(enemyRes).erAmend;

  const teamSlices: PieSlice[] = fighterCalcs
    .filter((fighter) => fighter.character)
    .map((fighter) => ({
      label: fighter.character?.name.EN ?? fighter.state.slot,
      value: fighter.totals.expected,
      color: SLOT_HEX[fighter.state.slot],
    }));

  const typeBreakdown = fighterCalcs
    .filter((fighter) => fighter.character)
    .map((fighter) => ({
      fighter,
      slices: DAMAGE_TYPES.map((type) => ({
        label: type,
        value: fighter.abilities
          .filter(({ entry }) => entry.damageType === type)
          .reduce((sum, { damage }) => sum + damage.expectedDamage, 0),
        color: DAMAGE_TYPE_HEX[type],
      })).filter((slice) => slice.value > 0),
    }));

  const sourceBreakdown = fighterCalcs
    .filter((fighter) => fighter.character)
    .map((fighter) => ({
      fighter,
      slices: aggregateDamageSources(fighter.abilities, fighter.combat).map((item, index) => ({
        label: item.label,
        value: item.value,
        color: SOURCE_PALETTE[index % SOURCE_PALETTE.length],
      })),
    }));

  const damageRows = fighterCalcs.flatMap((fighter) =>
    fighter.abilities.map(({ entry, damage }) => ({ fighter, entry, damage }))
  );

  const discSlotEntries: DiscSlotEntry[] = [
    ...build.mainDiscs.map((slot, index) => ({
      key: `main-${index}`,
      kind: 'main' as const,
      index,
      discId: slot.discId,
      level: slot.level,
      crescendo: slot.crescendo,
    })),
    ...build.supportDiscs.map((slot, index) => ({
      key: `support-${index}`,
      kind: 'support' as const,
      index,
      discId: slot.discId,
      level: slot.level,
      crescendo: slot.crescendo || 1,
      phase: slot.phase,
    })),
  ];

  const buffTargets: Array<{ value: BuffTarget; label: string }> = [
    { value: 'team', label: 'Whole team' },
    ...SLOT_KEYS.map((slot) => {
      const characterId = build.slots[slot].characterId;
      const character = characterId ? characters[String(characterId)] : null;
      return {
        value: slot,
        label: `${SLOT_META[slot].label}${character ? ` · ${character.name.EN}` : ' · empty'}`,
      };
    }),
  ];

  const nextRotationId = () => `rotation-${rotationSeq.current++}`;

  const updateFighter = (slot: SlotKey, patch: Partial<FighterStateInput>) => {
    const characterId = build.slots[slot].characterId;
    const combat = characterId ? COMBAT_DB[String(characterId)] ?? null : null;
    setFighters((previous) =>
      previous.map((fighter) => {
        if (fighter.slot !== slot) return fighter;
        const nextSkillLevel = patch.skillLevel ?? fighter.skillLevel;
        const nextRotation =
          patch.skillLevel !== undefined && patch.skillLevel !== fighter.skillLevel
            ? resyncPresetRotation(fighter.rotation, combat, nextSkillLevel, fighter.emblems)
            : fighter.rotation;
        return { ...fighter, ...patch, rotation: nextRotation };
      })
    );
  };

  const updateEmblem = (
    slot: SlotKey,
    level: EmblemLevel,
    index: number,
    patch: Partial<EmblemRowState>
  ) => {
    const characterId = build.slots[slot].characterId;
    const combat = characterId ? COMBAT_DB[String(characterId)] ?? null : null;
    setFighters((previous) =>
      previous.map((fighter) => {
        if (fighter.slot !== slot) return fighter;
        const rows = fighter.emblems[level].map((row, rowIndex) =>
          rowIndex === index ? { ...row, ...patch } : row
        );
        const nextEmblems = { ...fighter.emblems, [level]: rows };
        const nextRotation = resyncPresetRotation(
          fighter.rotation,
          combat,
          fighter.skillLevel,
          nextEmblems
        );
        return { ...fighter, emblems: nextEmblems, rotation: nextRotation };
      })
    );
  };

  const addPresetAbility = (slot: SlotKey, presetKey: AbilityPresetKey, part?: ParsedAbilityPart | null) => {
    const characterId = build.slots[slot].characterId;
    const combat = characterId ? COMBAT_DB[String(characterId)] ?? null : null;
    const entry = combat?.[presetKey];
    if (!entry) return;

    const id = nextRotationId();
    setFighters((previous) =>
      previous.map((fighter) => {
        if (fighter.slot !== slot) return fighter;
        const effectiveLevel = getEffectiveSkillLevel(
          fighter.skillLevel,
          fighter.emblems,
          presetKey
        );
        const resolvedPart = part ?? parsePrimarySkillPart(entry, presetKey, effectiveLevel);
        return {
          ...fighter,
          rotation: [
            ...fighter.rotation,
            buildRotationFromPart(id, presetKey, entry, resolvedPart),
          ],
        };
      })
    );
  };

  const addCustomAbility = (slot: SlotKey) => {
    const id = nextRotationId();
    setFighters((previous) =>
      previous.map((fighter) =>
        fighter.slot === slot
          ? {
              ...fighter,
              rotation: [
                ...fighter.rotation,
                {
                  id,
                  source: 'custom',
                  name: 'Custom ability',
                  motionValuePct: 100,
                  hits: 1,
                  casts: 1,
                  damageType: 'Skill',
                  scalingStat: 'ATK',
                },
              ],
            }
          : fighter
      )
    );
  };

  const addRotationAbility = (slot: SlotKey) => {
    const fighter = fighterCalcs.find((item) => item.state.slot === slot);
    const nextPreset = ABILITY_PRESETS.find(
      (preset) =>
        fighter?.combat?.[preset.key] &&
        !fighter.state.rotation.some((entry) => entry.source === preset.key)
    );
    if (nextPreset) {
      addPresetAbility(slot, nextPreset.key);
      return;
    }
    if (fighter?.combat) {
      for (const preset of ABILITY_PRESETS) {
        const skillEntry = fighter.combat[preset.key];
        if (!skillEntry) continue;
        const effectiveLevel = getEffectiveSkillLevel(
          fighter.state.skillLevel,
          fighter.state.emblems,
          preset.key
        );
        const parts = parseSkillParts(skillEntry, preset.key, effectiveLevel);
        const unusedPart = parts.find(
          (part) =>
            !fighter.state.rotation.some(
              (entry) => entry.source === preset.key && entry.partId === part.id
            )
        );
        if (unusedPart) {
          addPresetAbility(slot, preset.key, unusedPart);
          return;
        }
      }
    }
    addCustomAbility(slot);
  };

  const updateRotation = (slot: SlotKey, entryId: string, patch: Partial<RotationAbility>) => {
    setFighters((previous) =>
      previous.map((fighter) =>
        fighter.slot === slot
          ? {
              ...fighter,
              rotation: fighter.rotation.map((entry) =>
                entry.id === entryId ? { ...entry, ...patch } : entry
              ),
            }
          : fighter
      )
    );
  };

  const removeRotation = (slot: SlotKey, entryId: string) => {
    setFighters((previous) =>
      previous.map((fighter) =>
        fighter.slot === slot
          ? {
              ...fighter,
              rotation: fighter.rotation.filter((entry) => entry.id !== entryId),
            }
          : fighter
      )
    );
  };

  const importDamagingPotentials = (slot: SlotKey) => {
    const slotData = build.slots[slot];
    if (!slotData?.characterId || !slotData.potentials?.length) return;
    const combat = COMBAT_DB[String(slotData.characterId)] ?? null;
    const defaultScalingStat =
      combat?.id === 162 ||
      /\bof\s+(?:Base\s+|Max\s+)?HP\b/i.test(combat?.skill?.desc ?? '')
        ? 'HP'
        : 'ATK';

    const newRows: RotationAbility[] = [];
    for (const sel of slotData.potentials) {
      const pot = getPotentialById(slotData.characterId, sel.id);
      if (!pot) continue;
      const potKey = `${slot}:${pot.id}`;
      const tierCap = pot.isCore ? 1 : Math.min(9, Math.max(pot.maxLevel || 1, 6));
      const baseLevel = pot.isCore
        ? 1
        : Math.min(tierCap, Math.max(1, Math.round(potentialLevelOverrides[potKey] ?? (Number(sel.level) || 6))));
      const bonus = pot.isCore ? 0 : (potentialBonusLevels[potKey] ?? 0);
      const effectiveLevel = pot.isCore ? 1 : Math.min(tierCap, Math.max(1, baseLevel + bonus));
      const rendered = renderPotentialAtLevel(pot.descTemplate, pot.params, effectiveLevel);
      const specs = extractPotentialExtraHitSpecs(rendered, defaultScalingStat);
      specs.forEach((spec, idx) => {
        const label = specs.length > 1 ? `${pot.name} (#${idx + 1})` : pot.name;
        newRows.push({
          id: nextRotationId(),
          source: 'custom',
          name: label,
          damageType: spec.damageType,
          scalingStat: spec.scalingStat,
          motionValuePct: spec.mvPct,
          hits: spec.hits,
          casts: 1,
        });
      });
    }

    if (newRows.length === 0) return;
    setFighters((previous) =>
      previous.map((fighter) => {
        if (fighter.slot !== slot) return fighter;
        const existingNames = new Set(fighter.rotation.map((r) => r.name));
        const uniqueNew = newRows.filter((r) => !existingNames.has(r.name));
        if (uniqueNew.length === 0) return fighter;
        return { ...fighter, rotation: [...fighter.rotation, ...uniqueNew] };
      })
    );
  };

  const addBuff = () => {
    const id = `buff-${buffSeq.current++}`;
    setBuffs((previous) => [
      ...previous,
      { id, label: '', target: 'team', stat: 'atkPct', value: 0 },
    ]);
  };

  const updateBuff = (id: string, patch: Partial<BuffRowState>) => {
    setBuffs((previous) =>
      previous.map((buff) => (buff.id === id ? { ...buff, ...patch } : buff))
    );
  };

  const removeBuff = (id: string) => {
    setBuffs((previous) => previous.filter((buff) => buff.id !== id));
  };

  const toggleImportedBuff = (id: string) => {
    setDisabledPresetBuffIds((previous) => ({
      ...previous,
      [id]: !previous[id],
    }));
  };

  const setPotentialBonus = (potKey: string, bonus: 0 | 1 | 2 | 3) => {
    setPotentialBonusLevels((previous) => ({
      ...previous,
      [potKey]: bonus,
    }));
  };

  const setPotentialBaseLevel = (potKey: string, level: number) => {
    setPotentialLevelOverrides((previous) => ({
      ...previous,
      [potKey]: level,
    }));
  };

  const resetImportedBuffs = () => {
    setDisabledPresetBuffIds({});
    setPotentialBonusLevels({});
    setPotentialLevelOverrides({});
  };

  const saveBaseline = () => {
    const perSlot = Object.fromEntries(
      fighterCalcs.map((fighter) => [fighter.state.slot, fighter.totals.expected])
    ) as Record<SlotKey, number>;

    setBaseline({
      savedAt: Date.now(),
      total: totalExpected,
      nonCrit: totalNonCrit,
      crit: totalCrit,
      perSlot,
    });
  };

  return (
    <section id="damage-calculator" className="space-y-5">
      {/* Hero summary */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-card">
        <div className="relative p-4 sm:p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="mt-0.5 text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl">
                Team Damage Calculator (Experimental)
              </h1>
              <p className="mt-0.5 text-xs leading-snug text-slate-600 dark:text-slate-400">
                Formula by AutumnVN &amp; Soh
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {baseline && (
                <>
                  <span className="hidden text-[11px] text-slate-600 dark:text-slate-400 sm:inline">
                    Baseline{' '}
                    {new Date(baseline.savedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBaseline(null)}
                    className={cn(
                      'inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:border-rose-500/40 hover:text-rose-700 dark:text-slate-400',
                      FOCUS_RING
                    )}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    Clear baseline
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={saveBaseline}
                className={cn(
                  'inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-500/15',
                  FOCUS_RING
                )}
              >
                <Save className="size-3.5" aria-hidden="true" />
                {baseline ? 'Update baseline' : 'Save baseline'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.7fr)_minmax(0,0.9fr)] lg:items-start">
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Expected team damage
              </div>
              <div className="mt-1 flex flex-wrap items-end gap-2">
                <AnimatedNumber
                  value={totalExpected}
                  format={formatNumber}
                  className="text-3xl font-bold leading-none tracking-tight text-slate-900 tabular-nums dark:text-white"
                />
                {snapshotDelta !== null && <DeltaChip value={snapshotDelta} />}
              </div>
              {teamSize > 0 && (
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                  {activeAbilities} {activeAbilities === 1 ? 'ability' : 'abilities'} ·{' '}
                  {formatNumber(totalHits)} hits · {teamSize}{' '}
                  {teamSize === 1 ? 'Trekker' : 'Trekkers'}
                </p>
              )}

              <div className="mt-4">
                <div className="flex h-2 overflow-hidden rounded-full border border-border-subtle bg-surface-subtle">
                  {fighterCalcs.map((fighter) => {
                    const share = totalExpected > 0 ? (fighter.totals.expected / totalExpected) * 100 : 0;
                    if (share <= 0) return null;
                    return (
                      <div
                        key={fighter.state.slot}
                        className={ELEMENT_STYLES[fighter.element].bar}
                        style={{ width: `${share}%` }}
                        title={`${fighter.character?.name.EN ?? SLOT_META[fighter.state.slot].label}: ${share.toFixed(1)}%`}
                      />
                    );
                  })}
                </div>
                {teamSize === 0 ? (
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                    No team loaded.{' '}
                    <Link
                      href="/builder/advanced"
                      className="font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70"
                    >
                      Select Trekkers in Advanced Visualizer
                    </Link>
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {fighterCalcs
                      .filter((fighter) => fighter.character)
                      .map((fighter) => {
                        const share =
                          totalExpected > 0
                            ? (fighter.totals.expected / totalExpected) * 100
                            : 0;
                        return (
                          <span
                            key={fighter.state.slot}
                            className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400"
                          >
                            <span
                              className={cn(
                                'size-1.5 shrink-0 rounded-full',
                                ELEMENT_STYLES[fighter.element].dot
                              )}
                            />
                            <span className="font-semibold text-slate-700">
                              {fighter.character?.name.EN}
                            </span>
                            <span className="tabular-nums text-slate-600 dark:text-slate-400">
                              {share.toFixed(0)}%
                            </span>
                          </span>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border-subtle bg-surface-subtle p-3">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Team damage
              </div>
              {totalExpected <= 0 ? (
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  No damage calculated yet.
                </p>
              ) : (
                <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row lg:flex-col xl:flex-row">
                  <PieChart slices={teamSlices} size={124} label="Team damage share" />
                  <PieLegend
                    slices={teamSlices}
                    total={totalExpected}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <HeroMetric
                label="Team DPS"
                value={`${formatCompact(teamDps)}/s`}
                hint={`${fightDurationSec}s fight`}
              />
              <HeroMetric
                label="Non-crit floor"
                value={formatCompact(totalNonCrit)}
                hint="All hits · no crits"
              />
              <HeroMetric
                label="Full-crit ceiling"
                value={formatCompact(totalCrit)}
                hint="Every hit crits"
              />
              <HeroMetric
                label="Avg crit multiplier"
                value={`×${avgCritMult.toFixed(2)}`}
                hint={`${formatNumber(totalHits)} hits · ${activeAbilities} abilities`}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-subtle pt-3">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              Record Rating
              <input
                type="number"
                min={0}
                max={40}
                value={recordLevel}
                onChange={(event) =>
                  setRecordLevel(
                    Math.max(0, Math.min(40, Math.floor(Number(event.target.value) || 0)))
                  )
                }
                className="w-16 rounded-md border border-border bg-base px-2 py-1 text-xs font-bold tabular-nums text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/35 dark:text-white"
                aria-label="Record rating"
              />
            </label>
            <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
              +{formatNumber(recordAtk)} ATK · +{formatNumber(recordHp)} HP
            </span>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 sm:ml-auto">
              Fight Duration (s)
              <input
                type="number"
                min={1}
                max={600}
                value={fightDurationSec}
                onChange={(event) =>
                  setFightDurationSec(
                    Math.max(1, Math.min(600, Number(event.target.value) || 90))
                  )
                }
                className="w-16 rounded-md border border-border bg-base px-2 py-1 text-xs font-bold tabular-nums text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/35 dark:text-white"
                aria-label="Fight duration in seconds"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Target and mitigation */}
      <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeader
            title="Target & mitigation"
            subtitle="Enemy DEF / RES, resilience break, and the base amendment for the current target."
          />
          <div className="flex flex-wrap gap-1.5">
            {ENEMY_PRESETS.map((preset) => {
              const selected = enemyDef === preset.def && enemyRes === preset.res;
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setEnemyDef(preset.def);
                    setEnemyRes(preset.res);
                  }}
                  className={cn(
                    'flex min-h-9 flex-col items-start rounded-lg border px-2.5 py-1.5 text-left transition-colors',
                    FOCUS_RING,
                    selected
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-700'
                      : 'border-border bg-surface-subtle text-slate-600 hover:border-amber-500/30 dark:text-slate-400'
                  )}
                >
                  <span className="text-xs font-bold">{preset.label}</span>
                  <span className="text-xs tabular-nums opacity-85">
                    {preset.res} RES · {preset.def} DEF
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)]">
          <Field label="Enemy DEF">
            <input
              type="number"
              min={0}
              value={enemyDef}
              onChange={(event) => setEnemyDef(Math.max(0, Number(event.target.value) || 0))}
              className={INPUT_CLASS}
              aria-label="Enemy defense"
            />
          </Field>
          <Field label="Enemy RES">
            <input
              type="number"
              value={enemyRes}
              onChange={(event) => setEnemyRes(Number(event.target.value) || 0)}
              className={INPUT_CLASS}
              aria-label="Enemy resistance"
            />
          </Field>
          <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2.5">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Base mitigation
            </div>
            <div className="mt-1 text-[13px] font-bold tabular-nums text-slate-900 dark:text-white">
              DEF {(baseDefAmend * 100).toFixed(1)}%
            </div>
            <div className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
              RES {(baseResAmend * 100).toFixed(1)}%
            </div>
          </div>
          <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2.5">
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
              <span>Break Uptime %</span>
              <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                ×{(1 + (Math.max(0, Math.min(100, resilienceBreakUptimePct)) / 100) * 0.5).toFixed(2)}
              </span>
            </div>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={resilienceBreakUptimePct}
              onChange={(event) =>
                setResilienceBreakUptimePct(
                  Math.max(0, Math.min(100, Number(event.target.value) || 0))
                )
              }
              className={cn(INPUT_CLASS, 'mt-1')}
              aria-label="Resilience break uptime percentage"
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {[
                { label: '0% None', value: 0 },
                { label: '27.8% Blitz', value: 27.8 },
                { label: '100% Broken', value: 100 },
              ].map((chip) => {
                const active = Math.abs(resilienceBreakUptimePct - chip.value) < 0.05;
                return (
                  <button
                    key={chip.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setResilienceBreakUptimePct(chip.value)}
                    className={cn(
                      'rounded border px-1.5 py-0.5 text-[11px] font-semibold transition-colors',
                      FOCUS_RING,
                      active
                        ? 'border-amber-500/50 bg-amber-500/15 text-amber-700'
                        : 'border-border bg-surface-card text-slate-600 hover:border-amber-500/30 hover:text-slate-900'
                    )}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-400">
          <span>Effective DEF {Math.round(enemyDef * 10) / 10} → {(baseDefAmend * 100).toFixed(1)}%</span>
          <span aria-hidden="true" className="text-slate-600/40 dark:text-slate-400/40">|</span>
          <span>Effective RES {enemyRes} → {(baseResAmend * 100).toFixed(1)}%</span>
          <span className="inline-flex items-center gap-1">
            <Info className="size-3.5 shrink-0" aria-hidden="true" />
            Buff rows can change DEF / RES mitigation per Trekker.
          </span>
        </div>
      </div>

      {/* Team cards */}
      <div className="grid gap-3 lg:grid-cols-3">
        {fighterCalcs.map((fighter) => {
          const { state, character, element, stats } = fighter;
          const elementStyle = ELEMENT_STYLES[element];
          const cardBaseline = baseline?.perSlot[state.slot];
          const cardDelta =
            baseline && cardBaseline && cardBaseline > 0
              ? ((fighter.totals.expected - cardBaseline) / cardBaseline) * 100
              : null;

          return (
            <article
              key={state.slot}
              className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface-card"
            >
              <div className="flex flex-1 flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div
                      className={cn(
                        'relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-surface-subtle',
                        character && cn('ring-2', elementStyle.ring)
                      )}
                    >
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                        {character ? getCharacterInitials(character.name.EN) : '—'}
                      </span>
                      {character && (
                        <img
                          src={getTrekkerImageUrl(character.id)}
                          alt={character.name.EN}
                          className="absolute inset-0 size-full object-cover object-top"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                        {character?.name.EN ?? 'Empty slot'}
                      </h2>
                      {character ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-bold leading-none',
                              elementStyle.chip
                            )}
                          >
                            {element}
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                            {character.class} · {character.star}-Star
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {SLOT_META[state.slot].label}
                        </div>
                      )}
                    </div>
                  </div>

                  <label className="flex shrink-0 items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                    Lv
                    <select
                      value={state.level}
                      onChange={(event) =>
                        updateFighter(state.slot, {
                          level: event.target.value as TrekkerLevel,
                        })
                      }
                      className="rounded-md border border-border bg-base px-1.5 py-1 text-xs font-bold tabular-nums text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/35 dark:text-white"
                      aria-label={`${character?.name.EN ?? 'Trekker'} level`}
                    >
                      {TREKKER_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {(() => {
                  const isHpScaler =
                    fighter.abilities.some((a) => a.damage.scalingStat === 'HP') ||
                    fighter.combat?.id === 162;
                  const minionAtk =
                    stats.baseAtk * (1 + (stats.atkPctPerma + stats.minionAtkPct) / 100);
                  const showMinionAtk =
                    stats.minionAtkPct > 0 ||
                    fighter.abilities.some((a) => a.entry.damageType === 'Minion');
                  const statTooltip = isHpScaler
                    ? `Base HP ${formatNumber(stats.baseHpParts.character)} + affinity ${formatNumber(stats.baseHpParts.affinity)} + record ${formatNumber(stats.baseHpParts.record)} + discs ${formatNumber(stats.baseHpParts.discs)} + manual ${formatNumber(stats.baseHpParts.bonus)}`
                    : `Base ATK ${formatNumber(stats.baseAtkParts.character)} + affinity ${formatNumber(stats.baseAtkParts.affinity)} + record ${formatNumber(stats.baseAtkParts.record)} + discs ${formatNumber(stats.baseAtkParts.discs)} + manual ${formatNumber(stats.baseAtkParts.bonus)}`;

                  return (
                    <>
                      <div
                        className="grid grid-cols-3 gap-1.5 rounded-lg border border-border-subtle bg-surface-subtle p-2"
                        title={statTooltip}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-slate-600 dark:text-slate-400">
                            {isHpScaler ? 'Final HP' : 'Final ATK'}
                          </div>
                          <div className="mt-0.5 truncate text-[13px] font-bold tabular-nums text-slate-900 dark:text-white">
                            {formatNumber(isHpScaler ? stats.finalHp : stats.finalAtk)}
                          </div>
                          <div className="truncate text-xs tabular-nums text-slate-600 dark:text-slate-400">
                            +{isHpScaler ? stats.hpPct.toFixed(1) : stats.totalAtkPct.toFixed(1)}%
                          </div>
                        </div>
                        <div className="min-w-0 border-l border-border-subtle pl-1.5">
                          <div className="truncate text-xs font-medium text-slate-600 dark:text-slate-400">
                            Crit rate
                          </div>
                          <div className="mt-0.5 truncate text-[13px] font-bold tabular-nums text-slate-900 dark:text-white">
                            {stats.critRatePct.toFixed(1)}%
                          </div>
                          <div className="truncate text-xs tabular-nums text-slate-600 dark:text-slate-400">
                            {stats.critDmgPct.toFixed(0)}% DMG
                          </div>
                        </div>
                        <div className="min-w-0 border-l border-border-subtle pl-1.5">
                          <div className="truncate text-xs font-medium text-slate-600 dark:text-slate-400">
                            {element} DMG
                          </div>
                          <div
                            className={cn(
                              'mt-0.5 truncate text-[13px] font-bold tabular-nums',
                              elementStyle.text
                            )}
                          >
                            +{stats.elementDmgPct.toFixed(1)}%
                          </div>
                          <div className="truncate text-xs tabular-nums text-slate-600 dark:text-slate-400">
                            DEF {fighter.defAmend >= 0 ? (fighter.defAmend * 100).toFixed(0) : '—'}%
                          </div>
                        </div>
                      </div>

                      {(stats.skillIntensityPct > 0 ||
                        showMinionAtk ||
                        stats.dmgTakenPct > 0 ||
                        stats.resPen > 0) && (
                        <div className="flex flex-wrap gap-1.5 text-[11px] tabular-nums">
                          {stats.skillIntensityPct > 0 && (
                            <span className="rounded border border-border-subtle bg-surface-subtle px-1.5 py-0.5 font-semibold text-slate-700">
                              Skill Intensity +{stats.skillIntensityPct.toFixed(1)}%
                            </span>
                          )}
                          {showMinionAtk && (
                            <span className="rounded border border-border-subtle bg-surface-subtle px-1.5 py-0.5 font-semibold text-slate-700">
                              Minion ATK {formatNumber(minionAtk)}
                            </span>
                          )}
                          {stats.dmgTakenPct > 0 && (
                            <span className="rounded border border-border-subtle bg-surface-subtle px-1.5 py-0.5 font-semibold text-slate-700">
                              DMG Taken +{stats.dmgTakenPct.toFixed(1)}%
                            </span>
                          )}
                          {stats.resPen > 0 && (
                            <span className="rounded border border-border-subtle bg-surface-subtle px-1.5 py-0.5 font-semibold text-slate-700">
                              RES PEN {Math.round(stats.resPen)}
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}

                <div className="grid grid-cols-3 gap-1.5">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Talent tier
                    </span>
                    <select
                      value={state.talentTier}
                      onChange={(event) =>
                        updateFighter(state.slot, {
                          talentTier: Math.max(0, Math.min(5, Number(event.target.value) || 0)),
                        })
                      }
                      className="w-full rounded-md border border-border bg-base px-1.5 py-1 text-xs font-bold tabular-nums text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/35 dark:text-white"
                      aria-label={`${character?.name.EN ?? 'Trekker'} talent tier`}
                    >
                      {Array.from({ length: 6 }, (_, index) => index).map((tier) => (
                        <option key={tier} value={tier}>
                          {tier === 0 ? 'T0 (none)' : `T${tier}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Skill Lv
                    </span>
                    <select
                      value={state.skillLevel}
                      onChange={(event) =>
                        updateFighter(state.slot, {
                          skillLevel: Math.max(1, Math.min(13, Number(event.target.value) || 10)),
                        })
                      }
                      className="w-full rounded-md border border-border bg-base px-1.5 py-1 text-xs font-bold tabular-nums text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/35 dark:text-white"
                      aria-label={`${character?.name.EN ?? 'Trekker'} skill level`}
                    >
                      {SKILL_LEVELS.map((lv) => (
                        <option key={lv} value={lv}>
                          Lv.{lv}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block min-w-0">
                    <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      Affinity Lv
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={state.affinityLevel}
                      onChange={(event) =>
                        updateFighter(state.slot, {
                          affinityLevel: Math.max(
                            0,
                            Math.min(50, Math.floor(Number(event.target.value) || 0))
                          ),
                        })
                      }
                      className="w-full rounded-md border border-border bg-base px-1.5 py-1 text-xs font-bold tabular-nums text-slate-700 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/35 dark:text-white"
                      aria-label={`${character?.name.EN ?? 'Trekker'} affinity level`}
                    />
                  </label>
                </div>

              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-subtle px-4 py-2.5">
                <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
                  DEF {(fighter.defAmend * 100).toFixed(1)}% · RES {(fighter.erAmend * 100).toFixed(1)}%
                </span>
                <div className="flex items-center gap-1.5">
                  {cardDelta !== null && <DeltaChip value={cardDelta} label="" />}
                  <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                    {formatCompact(fighter.totals.expected)}
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Discs and notes */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
          <SectionHeader
            title="Equipped discs"
          />

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {discSlotEntries.map((slot) => {
              const disc = slot.discId ? discs[String(slot.discId)] ?? null : null;
              const atk = getDiscAtk(slot.discId, slot.level, slot.crescendo, discs);
              const supportNotes =
                slot.kind === 'support' ? getSupportStartingNoteCount(disc, slot.phase) : 0;

              return (
                <div
                  key={slot.key}
                  className={cn(
                    'flex min-w-0 items-center gap-2 rounded-lg border p-2',
                    disc
                      ? 'border-border-subtle bg-surface-subtle'
                      : 'border-dashed border-border bg-transparent'
                  )}
                >
                  {disc ? (
                    <img
                      src={getDiscOutfitIconUrl(disc.id)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-9 shrink-0 rounded-md border border-border-subtle object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="grid size-9 shrink-0 place-items-center rounded-md border border-dashed border-border text-slate-600 dark:text-slate-400">
                      <Disc3 className="size-4" aria-hidden="true" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {slot.kind === 'main' ? 'Main' : 'Support'} #{slot.index + 1}
                    </div>
                    <div className="truncate text-xs font-bold text-slate-800 dark:text-white">
                      {disc?.name ?? 'Empty slot'}
                    </div>
                    <div className="truncate text-xs tabular-nums text-slate-600 dark:text-slate-400">
                      {disc
                        ? `Lv${slot.level} · ${slot.kind === 'main' ? `C${slot.crescendo - 1}` : `Phase ${slot.phase + 1}`} · +${formatNumber(atk)} ATK${supportNotes > 0 ? ` · +${supportNotes} notes` : ''}`
                        : 'Not equipped'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
          <SectionHeader
            title="Musical notes"
            right={
              <span className="rounded-md border border-border-subtle bg-surface-subtle px-2 py-1 text-xs font-bold tabular-nums text-slate-600 dark:text-slate-400">
                {Object.values(effectiveNotes).reduce((sum, count) => sum + count, 0)} notes
              </span>
            }
          />

          <div className="mt-3 space-y-2">
            <NoteGroup
              label="Combat"
              notes={MUSICAL_NOTES.filter((note) => note.category === 'combat')}
              counts={effectiveNotes}
            />
            <NoteGroup
              label="Elemental"
              notes={MUSICAL_NOTES.filter((note) => note.category === 'elemental')}
              counts={effectiveNotes}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border-subtle pt-3">
            {[
              ['ATK', contributions.noteAtkPct],
              ['Crit Rate', contributions.noteCritRatePct],
              ['Crit DMG', contributions.noteCritDmgPct],
            ].map(([label, value]) => (
              <span
                key={label}
                className="rounded-md border border-border-subtle bg-surface-subtle px-2 py-1 text-xs text-slate-600 dark:text-slate-400"
              >
                <span className="font-semibold text-slate-700">{label}</span>{' '}
                <span className="font-bold tabular-nums text-amber-700">
                  +{Number(value).toFixed(2)}%
                </span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1 px-1 text-xs text-slate-600 dark:text-slate-400">
              <Info className="size-3.5 shrink-0" aria-hidden="true" />
              Applied to every Trekker.
            </span>
          </div>
        </div>
      </div>
      {/* Emblems */}
      <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
        <SectionHeader
          title="Emblems"
          subtitle="Each Trekker has their own emblem sets at level 70, 80, and 90. Stats feed that Trekker's final stats."
        />
        {!fighterCalcs.some((fighter) => fighter.character) ? (
          <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs text-slate-600 dark:text-slate-400">
            Select Trekkers in Advanced Visualizer to configure emblems.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {fighterCalcs
              .filter((fighter) => fighter.character)
              .map((fighter) => (
                <div key={fighter.state.slot}>
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className={cn('size-2.5 rounded-full', ELEMENT_STYLES[fighter.element].dot)}
                    />
                    <span className="truncate text-xs font-bold text-slate-800 dark:text-white">
                      {fighter.character?.name.EN}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">
                      {SLOT_META[fighter.state.slot].label}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {EMBLEM_LEVELS.map((level) => (
                      <EmblemLevelBlock
                        key={level}
                        level={level}
                        rows={fighter.state.emblems[level]}
                        onChange={(index, patch) =>
                          updateEmblem(fighter.state.slot, level, index, patch)
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>


      {/* Auto-imported Disc, Potential & Skill buffs */}
      <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
        <SectionHeader
          title="Auto-imported Disc, Potential & Kit buffs"
          subtitle="Active Melody skills, active Harmony skills from Musical Notes, equipped Potentials, and Trekker kit buffs. Uncheck conditional effects that are inactive."
          right={
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-border bg-surface-subtle p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  aria-pressed={uptimeMode === 'realistic'}
                  onClick={() => setUptimeMode('realistic')}
                  className={cn(
                    'rounded-md px-2 py-1 transition-colors',
                    FOCUS_RING,
                    uptimeMode === 'realistic'
                      ? 'bg-surface-card text-amber-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  )}
                >
                  Realistic
                </button>
                <button
                  type="button"
                  aria-pressed={uptimeMode === 'ideal'}
                  onClick={() => setUptimeMode('ideal')}
                  className={cn(
                    'rounded-md px-2 py-1 transition-colors',
                    FOCUS_RING,
                    uptimeMode === 'ideal'
                      ? 'bg-surface-card text-amber-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  )}
                >
                  Ideal
                </button>
              </div>
              <div className="inline-flex rounded-lg border border-border bg-surface-subtle p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  aria-pressed={fightMode === 'single'}
                  onClick={() => setFightMode('single')}
                  className={cn(
                    'rounded-md px-2 py-1 transition-colors',
                    FOCUS_RING,
                    fightMode === 'single'
                      ? 'bg-surface-card text-teal-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  )}
                >
                  Single
                </button>
                <button
                  type="button"
                  aria-pressed={fightMode === 'multi'}
                  onClick={() => setFightMode('multi')}
                  className={cn(
                    'rounded-md px-2 py-1 transition-colors',
                    FOCUS_RING,
                    fightMode === 'multi'
                      ? 'bg-surface-card text-teal-700 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  )}
                >
                  Multi
                </button>
              </div>
              {importedBuffs.length > 0 && (
                <span className="rounded-md border border-border bg-surface-subtle px-2 py-1 text-xs font-bold tabular-nums text-slate-700">
                  {importedBuffs.filter((item) => item.enabled).length}/{importedBuffs.length} active
                </span>
              )}
              <button
                type="button"
                onClick={resetImportedBuffs}
                className={cn(
                  'inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-2.5 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:border-amber-500/40 hover:text-amber-700',
                  FOCUS_RING
                )}
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reset from preset
              </button>
            </div>
          }
        />

        {importedBuffs.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-4 text-center">
            <p className="text-xs font-semibold text-slate-700">
              No active disc skills or stat potentials in this preset.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Equip Main Discs, meet Harmony requirements via Musical Notes, or assign Trekkers with Potentials in the Advanced Visualizer.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-1.5">
            {importedBuffs.map((item) => {
              const statMeta = BUFF_STAT_MAP[item.stat];
              const statLabel = statMeta?.label ?? item.stat;
              const effectiveValue = applyUptimeScale(item);
              const valueText = statMeta?.percent
                ? `+${Number(effectiveValue.toFixed(2))}%`
                : `+${Math.round(effectiveValue)}`;
              const hasUptimeDiscount =
                uptimeMode === 'realistic' &&
                item.realisticUptime !== undefined &&
                item.realisticUptime < 1;
              const potKey = item.slot && item.potentialId ? `${item.slot}:${item.potentialId}` : '';
              const showPotentialLevels =
                item.origin === 'potential' && !item.isCore && (item.maxLevel ?? 1) > 1 && potKey !== '';
              const originBadge =
                item.origin === 'melody'
                  ? `Melody C${item.crescendo ?? 1}`
                  : item.origin === 'harmony'
                    ? `Harmony Lv.${item.harmonyLevel ?? 1}`
                    : item.origin === 'skill'
                      ? 'Kit Skill'
                      : 'Potential';
              const originClass =
                item.origin === 'melody'
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
                  : item.origin === 'harmony'
                    ? 'border-teal-500/30 bg-teal-500/10 text-teal-700'
                    : item.origin === 'skill'
                      ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700'
                      : 'border-sky-500/30 bg-sky-500/10 text-sky-700';
              const targetLabel =
                item.target === 'team' ? 'Team' : SLOT_META[item.target].shortLabel;

              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex flex-col gap-2.5 rounded-lg border border-border-subtle bg-surface-subtle px-3 py-2.5 transition-opacity sm:flex-row sm:items-center sm:justify-between',
                    !item.enabled && 'opacity-55'
                  )}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => toggleImportedBuff(item.id)}
                      className="mt-0.5 size-[18px] shrink-0 rounded border-border accent-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70 focus-visible:ring-offset-1"
                      aria-label={`Toggle ${item.skillName} (${statLabel})`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-xs font-semibold leading-none',
                            originClass
                          )}
                        >
                          {originBadge}
                        </span>
                        <span className="truncate text-xs font-bold text-slate-800 dark:text-white">
                          {item.sourceName}
                        </span>
                        <span aria-hidden="true" className="text-xs text-slate-600 dark:text-slate-400">·</span>
                        <span className="truncate text-xs font-semibold text-slate-700">
                          {item.skillName}
                        </span>
                        <span className="rounded border border-border bg-surface-card px-1.5 py-0.5 text-xs font-semibold leading-none text-slate-700">
                          {targetLabel}
                        </span>
                      </div>
                      <p
                        className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-600 dark:text-slate-400 sm:line-clamp-1"
                        title={item.description}
                      >
                        {item.description}
                      </p>
                    </div>
                  </label>

                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 sm:justify-end">
                    {showPotentialLevels && (
                      <div className="flex items-center gap-1">
                        <select
                          value={item.level ?? 6}
                          onChange={(event) =>
                            setPotentialBaseLevel(potKey, Number(event.target.value) || 6)
                          }
                          className={cn(SMALL_INPUT_CLASS, 'w-14 font-sans')}
                          aria-label={`Potential level for ${item.skillName}`}
                        >
                          {Array.from({ length: item.maxLevel ?? 9 }, (_, i) => i + 1).map((lv) => (
                            <option key={lv} value={lv}>
                              Lv.{lv}
                            </option>
                          ))}
                        </select>
                        <select
                          value={item.emblemBonusLevel ?? 0}
                          onChange={(event) =>
                            setPotentialBonus(
                              potKey,
                              Number(event.target.value) as 0 | 1 | 2 | 3
                            )
                          }
                          className={cn(SMALL_INPUT_CLASS, 'w-12')}
                          aria-label={`Lv.90 Emblem potential bonus for ${item.skillName}`}
                          title="Lv.90 Emblem +Potential offset"
                        >
                          <option value={0}>+0</option>
                          <option value={1}>+1</option>
                          <option value={2}>+2</option>
                          <option value={3}>+3</option>
                        </select>
                      </div>
                    )}

                    <div className="min-w-[110px] text-left sm:text-right">
                      <div className="text-xs font-semibold text-slate-700">
                        {statLabel}
                      </div>
                      <div className="text-xs font-bold tabular-nums text-amber-700">
                        {valueText}
                        {item.stacks && item.stacks > 1 && (
                          <span className="ml-1 text-[11px] font-normal text-slate-600 dark:text-slate-400">
                            ({item.baseValue}
                            {statMeta?.percent ? '%' : ''}×{item.stacks})
                          </span>
                        )}
                        {hasUptimeDiscount && item.realisticUptime !== undefined && (
                          <span className="ml-1 rounded bg-surface-card px-1 py-0.5 text-[10px] font-semibold text-slate-600">
                            ×{Math.round(item.realisticUptime * 100)}% uptime
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Buffs and manual stats */}
      <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
        <SectionHeader
          title="Buffs & manual stats"
          subtitle="Potentials and conditional team buffs. Target the whole team or a single Trekker. Talents and emblems are set per Trekker above."
          right={
            <button
              type="button"
              onClick={addBuff}
              className={cn(
                'inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition-colors hover:border-amber-500/40 hover:text-amber-700',
                FOCUS_RING
              )}
            >
              <Plus className="size-3.5" aria-hidden="true" />
              Add stat row
            </button>
          }
        />

        {buffs.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-5 text-center">
            <p className="text-xs font-semibold text-slate-700">
              No manual stats yet.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
              Add a row for a talent, emblem, potential, or team buff. Use the target field to
              apply it to the whole squad or one Trekker.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {buffs.map((buff) => (
              <BuffRow
                key={buff.id}
                row={buff}
                targets={buffTargets}
                onChange={(patch) => updateBuff(buff.id, patch)}
                onRemove={() => removeBuff(buff.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rotation */}
      <RotationPanel
        build={build}
        fighterCalcs={fighterCalcs}
        totalExpected={totalExpected}
        onAddAbility={addRotationAbility}
        onImportDamagingPotentials={importDamagingPotentials}
        onUpdateRotation={updateRotation}
        onRemoveRotation={removeRotation}
      />



      {/* Damage breakdown */}
      <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
        <SectionHeader
          title="Damage breakdown"
          subtitle="Expected damage per rotation entry after crit weighting, DEF / RES amendment, and taken multipliers."
          right={
            <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs font-bold tabular-nums text-amber-700">
              {formatNumber(totalExpected)} total
            </span>
          }
        />

        {damageRows.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-6 text-center">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Add an ability to a Trekker to see the damage breakdown.
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[780px] text-xs">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <th className="px-2 py-2 text-left font-bold">Trekker</th>
                  <th className="px-2 py-2 text-left font-bold">Ability</th>
                  <th className="px-2 py-2 text-left font-bold">Type</th>
                  <th className="px-2 py-2 text-right font-bold">MV</th>
                  <th className="px-2 py-2 text-right font-bold">Hits</th>
                  <th className="px-2 py-2 text-right font-bold">Crit</th>
                  <th className="px-2 py-2 text-right font-bold">DEF / RES</th>
                  <th className="px-2 py-2 text-right font-bold">Expected</th>
                  <th className="px-2 py-2 text-right font-bold">Share</th>
                </tr>
              </thead>
              <tbody>
                {damageRows.map(({ fighter, entry, damage }) => {
                  const share =
                    totalExpected > 0 ? (damage.expectedDamage / totalExpected) * 100 : 0;
                  return (
                    <tr
                      key={`${fighter.state.slot}-${entry.id}`}
                      className="border-b border-border-subtle last:border-0 hover:bg-surface-subtle/60"
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'size-1.5 shrink-0 rounded-full',
                              ELEMENT_STYLES[fighter.element].dot
                            )}
                          />
                          <span className="font-semibold text-slate-700">
                            {fighter.character?.name.EN ?? SLOT_META[fighter.state.slot].label}
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {SLOT_META[fighter.state.slot].shortLabel}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <AbilityIcon icon={entry.icon} className="size-5" />
                          <span className="text-xs font-medium text-slate-700">
                            {entry.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <span className="inline-flex rounded border border-border bg-surface-subtle px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                          {entry.damageType}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-xs tabular-nums text-slate-600 dark:text-slate-400">
                        {entry.motionValuePct.toFixed(1)}%
                      </td>
                      <td className="px-2 py-2 text-right text-xs tabular-nums text-slate-600 dark:text-slate-400">
                        {entry.hits}×{entry.casts}
                      </td>
                      <td className="px-2 py-2 text-right text-xs tabular-nums text-slate-600 dark:text-slate-400">
                        {fighter.stats.critRatePct.toFixed(1)}% /{' '}
                        {fighter.stats.critDmgPct.toFixed(0)}%
                      </td>
                      <td className="px-2 py-2 text-right text-xs tabular-nums text-slate-600 dark:text-slate-400">
                        {(damage.defAmend * 100).toFixed(1)}% /{' '}
                        {(damage.erAmend * 100).toFixed(1)}%
                      </td>
                      <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-amber-700">
                        {formatNumber(damage.expectedDamage)}
                      </td>
                      <td className="px-2 py-2 text-right text-xs tabular-nums text-slate-600 dark:text-slate-400">
                        {share.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-subtle">
                  <td
                    colSpan={7}
                    className="px-2 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-400"
                  >
                    Team total
                  </td>
                  <td className="px-2 py-2 text-right text-xs font-bold tabular-nums text-slate-900 dark:text-white">
                    {formatNumber(totalExpected)}
                  </td>
                  <td className="px-2 py-2 text-right text-xs tabular-nums text-slate-600 dark:text-slate-400">
                    100%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="mt-3 rounded-lg border border-border-subtle bg-surface-subtle px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <Info className="size-3.5 shrink-0" aria-hidden="true" />
            Expected-value model
          </div>
          <code className="mt-1 block overflow-x-auto whitespace-nowrap font-mono text-xs text-slate-700">
            Damage = ATK × MV × Skill Intensity × Slot DMG × Element DMG × Expected Crit × DEF
            Amend × RES Amend × Taken × Break
          </code>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Expected crit = 1 + min(100%, Crit Rate) × (Crit DMG − 1).
          </p>
        </div>
      </div>

      {/* Optimization & Sensitivity */}
      <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
        <SectionHeader
          title="Optimization & Sensitivity"
          subtitle="What-if sweeps computed from the current team: talent tiers, each equipped disc, and flat RES PEN."
        />

        <div
          role="tablist"
          aria-label="Optimization and sensitivity sweeps"
          className="mt-3 flex flex-wrap gap-1.5"
          onKeyDown={(event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            event.preventDefault();
            const idx = SENSITIVITY_TABS.findIndex((t) => t.key === sensitivityTab);
            const nextIdx =
              event.key === 'ArrowRight'
                ? (idx + 1) % SENSITIVITY_TABS.length
                : (idx - 1 + SENSITIVITY_TABS.length) % SENSITIVITY_TABS.length;
            const nextTab = SENSITIVITY_TABS[nextIdx];
            setSensitivityTab(nextTab.key);
            document.getElementById(`sensitivity-tab-${nextTab.key}`)?.focus();
          }}
        >
          {SENSITIVITY_TABS.map((tab) => {
            const selected = sensitivityTab === tab.key;
            return (
              <button
                key={tab.key}
                id={`sensitivity-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`sensitivity-panel-${tab.key}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setSensitivityTab(tab.key)}
                className={cn(
                  'min-h-8 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors',
                  FOCUS_RING,
                  selected
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-700'
                    : 'border-border bg-surface-subtle text-slate-600 hover:border-amber-500/30 dark:text-slate-400'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {sensitivityTab === 'talents' && (
          <div
            role="tabpanel"
            id="sensitivity-panel-talents"
            aria-labelledby="sensitivity-tab-talents"
            className="mt-3 space-y-2.5"
          >
            <div className="flex flex-wrap items-end justify-between gap-2.5">
              <Field label="Trekker" className="w-48">
                <select
                  value={talentSlot}
                  onChange={(event) => setTalentSlot(event.target.value as SlotKey)}
                  className={cn(INPUT_CLASS, 'font-sans')}
                  aria-label="Talent sweep Trekker"
                >
                  {fighterCalcs
                    .filter((fighter) => fighter.character)
                    .map((fighter) => (
                      <option key={fighter.state.slot} value={fighter.state.slot}>
                        {fighter.character?.name.EN ?? fighter.state.slot}
                      </option>
                    ))}
                </select>
              </Field>
              <p className="max-w-lg text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                Each tier applies that Trekker&apos;s talent rows while the rest of the team keeps
                its current tiers. Gains are measured against T0.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-xs">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <th className="px-2 py-2 text-left font-bold">Tier</th>
                    <th className="px-2 py-2 text-right font-bold">Team damage</th>
                    <th className="px-2 py-2 text-right font-bold">Team gain</th>
                    <th className="px-2 py-2 text-right font-bold">Personal</th>
                    <th className="px-2 py-2 text-right font-bold">Personal gain</th>
                  </tr>
                </thead>
                <tbody>
                  {talentPoints.map((point) => (
                    <tr
                      key={point.tier}
                      className="border-b border-border-subtle last:border-0 hover:bg-surface-subtle/60"
                    >
                      <td className="px-2 py-1.5 text-xs font-bold tabular-nums text-slate-700 dark:text-white">
                        T{point.tier}
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-700">
                        {formatNumber(point.teamDmg)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs tabular-nums text-emerald-700">
                        {formatSignedPct(point.teamGainPct)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-700">
                        {formatNumber(point.personalDmg)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-xs tabular-nums text-emerald-700">
                        {formatSignedPct(point.personalGainPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {sensitivityTab === 'discs' && (
          <div
            role="tabpanel"
            id="sensitivity-panel-discs"
            aria-labelledby="sensitivity-tab-discs"
            className="mt-3 space-y-2.5"
          >
            {discPoints.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs text-slate-600 dark:text-slate-400">
                No discs equipped — load a preset to measure disc impact.
              </div>
            ) : (
              <>
                <p className="text-xs leading-snug text-slate-600 dark:text-slate-400">
                  Team damage recomputed with each disc removed. Support discs also drop their
                  starting notes.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-xs">
                    <thead>
                      <tr className="border-b border-border text-xs font-semibold text-slate-600 dark:text-slate-400">
                        <th className="px-2 py-2 text-left font-bold">Disc</th>
                        <th className="px-2 py-2 text-left font-bold">Slot</th>
                        <th className="px-2 py-2 text-right font-bold">Team damage</th>
                        <th className="px-2 py-2 text-right font-bold">Loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discPoints.map((point) => (
                        <tr
                          key={`${point.slot}-${point.index}`}
                          className="border-b border-border-subtle last:border-0 hover:bg-surface-subtle/60"
                        >
                          <td className="px-2 py-1.5 text-xs font-semibold text-slate-700">
                            {point.name}
                          </td>
                          <td className="px-2 py-1.5 text-xs font-medium capitalize text-slate-600 dark:text-slate-400">
                            {point.slot}
                          </td>
                          <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-700">
                            {formatNumber(point.teamDmg)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-xs tabular-nums text-rose-700">
                            {formatSignedPct(-point.lossPct)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {sensitivityTab === 'pen' && (
          <div
            role="tabpanel"
            id="sensitivity-panel-pen"
            aria-labelledby="sensitivity-tab-pen"
            className="mt-3 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs leading-snug text-slate-600 dark:text-slate-400">
                Flat RES PEN against {enemyRes} RES
                {penReferenceFighter?.character
                  ? ` for ${penReferenceFighter.character.name.EN} (${penReferenceFighter.stats.vulPct.toFixed(0)}% VUL, ${penReferenceFighter.stats.resIgnorePct.toFixed(0)}% RES ignore)`
                  : ''}
                . Gain is relative to 0 PEN.
              </p>
              {penReferenceFighter && (
                <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-700">
                  Current PEN {Math.round(penReferenceFighter.stats.resPen)}
                </span>
              )}
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[360px] text-xs">
                <thead className="sticky top-0 bg-surface-card">
                  <tr className="border-b border-border text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <th className="px-2 py-2 text-right font-bold">PEN</th>
                    <th className="px-2 py-2 text-right font-bold">Effective RES</th>
                    <th className="px-2 py-2 text-right font-bold">RES amend</th>
                    <th className="px-2 py-2 text-right font-bold">Gain vs 0</th>
                  </tr>
                </thead>
                <tbody>
                  {penPoints.map((point) => {
                    const currentPen = penReferenceFighter?.stats.resPen ?? 0;
                    const isCurrentBracket = Math.abs(point.pen - currentPen) < 5;
                    return (
                      <tr
                        key={point.pen}
                        className={cn(
                          'border-b border-border-subtle last:border-0 hover:bg-surface-subtle/60',
                          isCurrentBracket && 'bg-amber-500/10'
                        )}
                      >
                        <td className="px-2 py-1 text-right text-xs font-bold tabular-nums text-slate-700 dark:text-white">
                          {point.pen}
                        </td>
                        <td className="px-2 py-1 text-right text-xs tabular-nums text-slate-700">
                          {Math.round(point.effectiveRes)}
                        </td>
                        <td className="px-2 py-1 text-right text-xs tabular-nums text-slate-700">
                          {(point.erAmend * 100).toFixed(1)}%
                        </td>
                        <td className="px-2 py-1 text-right text-xs tabular-nums text-emerald-700">
                          {formatSignedPct(point.gainPct)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Damage type & source */}
      <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
        <SectionHeader
          title="Damage type breakdown"
          subtitle="How each Trekker's rotation splits across damage sources and damage types."
        />
        {!fighterCalcs.some((fighter) => fighter.character) ? (
          <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-5 text-center text-xs text-slate-600 dark:text-slate-400">
            Select Trekkers in Advanced Visualizer to view damage breakdown.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {typeBreakdown.map(({ fighter, slices }) => {
              const source = sourceBreakdown.find(
                (item) => item.fighter.state.slot === fighter.state.slot
              );
              return (
                <div key={fighter.state.slot} className="rounded-lg border border-border-subtle bg-surface-subtle p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn('size-2.5 rounded-full', ELEMENT_STYLES[fighter.element].dot)}
                    />
                    <span className="truncate text-xs font-bold text-slate-800 dark:text-white">
                      {fighter.character?.name.EN}
                    </span>
                    <span className="ml-auto text-xs font-bold tabular-nums text-slate-600 dark:text-slate-400">
                      {formatCompact(fighter.totals.expected)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Damage type
                      </div>
                      <div className="mt-2 flex flex-col items-center gap-2">
                        <PieChart slices={slices} size={88} label="Damage type" />
                        <PieLegend
                          slices={slices}
                          total={fighter.totals.expected}
                          className="w-full"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                        Damage source
                      </div>
                      <div className="mt-2 flex flex-col items-center gap-2">
                        <PieChart
                          slices={source?.slices ?? []}
                          size={88}
                          label="Damage source"
                        />
                        <PieLegend
                          slices={source?.slices ?? []}
                          total={fighter.totals.expected}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
