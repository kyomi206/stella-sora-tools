'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
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
  calculateDefAmend,
  calculateResAmend,
  computePresetContributions,
} from '@/lib/calculator/damage-engine';
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
  getEmblemStatMeta,
  getEmblemStatOptions,
  getEmblemValue,
} from '@/lib/calculator/talent-emblem';
import type { EmblemLevel, EmblemRarity, EmblemRowState } from '@/lib/calculator/talent-emblem';
import {
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
import {
  Calculator,
  ChartPie,
  Disc3,
  Gem,
  Info,
  Layers,
  Music,
  Plus,
  Save,
  Sparkles,
  Swords,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    text: 'text-orange-700 dark:text-orange-300',
    chip: 'border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300',
    dot: 'bg-orange-500',
    bar: 'bg-orange-500',
    ring: 'ring-orange-500/25',
  },
  Aqua: {
    text: 'text-sky-700 dark:text-sky-300',
    chip: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
    bar: 'bg-sky-500',
    ring: 'ring-sky-500/25',
  },
  Terra: {
    text: 'text-emerald-700 dark:text-emerald-300',
    chip: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    bar: 'bg-emerald-500',
    ring: 'ring-emerald-500/25',
  },
  Ventus: {
    text: 'text-teal-700 dark:text-teal-300',
    chip: 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300',
    dot: 'bg-teal-500',
    bar: 'bg-teal-500',
    ring: 'ring-teal-500/25',
  },
  Lux: {
    text: 'text-amber-700 dark:text-amber-300',
    chip: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-400',
    bar: 'bg-amber-400',
    ring: 'ring-amber-500/25',
  },
  Umbra: {
    text: 'text-purple-700 dark:text-purple-300',
    chip: 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300',
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
  Green: 'text-emerald-600 dark:text-emerald-400',
  Blue: 'text-sky-600 dark:text-sky-400',
  Yellow: 'text-amber-600 dark:text-amber-400',
  Rainbow: 'text-fuchsia-600 dark:text-fuchsia-400',
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

const INPUT_CLASS =
  'w-full rounded-lg border border-border bg-base px-2.5 py-1.5 font-mono text-xs font-semibold tabular-nums text-slate-900 transition-colors placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/15 dark:text-white';

const SMALL_INPUT_CLASS =
  'w-full rounded border border-border bg-surface-card px-1.5 py-1 font-mono text-[10px] font-bold tabular-nums text-slate-900 transition-colors focus:border-amber-500/60 focus:outline-none dark:bg-base dark:text-white';

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

function parseMotionValue(params: string[] | undefined, skillLevel: number): number | null {
  if (!params?.length) return null;
  for (const rawLine of params) {
    const line = String(rawLine);
    if (!line.includes('%')) continue;
    const tiers = line.split('/');
    const index = Math.max(0, Math.min(tiers.length - 1, skillLevel - 1));
    const value = parseFloat(tiers[index]);
    if (Number.isFinite(value)) return value;
  }
  return null;
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

function getCharacterHeadUrl(characterId: number): string {
  return `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/head/head_${characterId}01_XL.webp`;
}

function createDefaultRotation(
  slot: SlotKey,
  combat: CharacterCombatEntry | null
): RotationAbility[] {
  if (!combat) return [];
  const presetKey: AbilityPresetKey | null = combat.ultimate
    ? 'ultimate'
    : combat.skill
      ? 'skill'
      : combat.normalAtk
        ? 'normalAtk'
        : null;
  if (!presetKey) return [];
  const entry = combat[presetKey];
  if (!entry) return [];

  return [
    {
      id: `${slot}-initial`,
      source: presetKey,
      name: entry.name,
      icon: entry.icon,
      motionValuePct: parseMotionValue(entry.params, 10) ?? 0,
      hits: 1,
      casts: 1,
      damageType: ABILITY_PRESET_MAP[presetKey].damageType,
      scalingStat: 'ATK',
    },
  ];
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

function createFighters(build: AdvancedTeamBuild): FighterStateInput[] {
  return SLOT_KEYS.map((slot) => {
    const characterId = build.slots[slot].characterId;
    const combat = characterId ? COMBAT_DB[String(characterId)] ?? null : null;
    return {
      slot,
      level: '90',
      skillLevel: 10,
      affinityLevel: 30,
      talentTier: 5,
      emblems: createEmblemSet(),
      rotation: createDefaultRotation(slot, combat),
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
  icon: Icon,
  title,
  subtitle,
  right,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-border-subtle bg-surface-subtle text-amber-600 dark:text-amber-400">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-white/55">
              {subtitle}
            </p>
          )}
        </div>
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
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[10px] text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  );
}

function HeroMetric({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'default' | 'amber' | 'emerald' | 'sky';
}) {
  const toneClass =
    tone === 'amber'
      ? 'text-amber-600 dark:text-amber-400'
      : tone === 'emerald'
        ? 'text-emerald-600 dark:text-emerald-400'
        : tone === 'sky'
          ? 'text-sky-600 dark:text-sky-400'
          : 'text-slate-900 dark:text-white';

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-subtle p-2.5">
      <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className={cn('mt-1 font-mono text-base font-bold tabular-nums', toneClass)}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{hint}</div>
    </div>
  );
}

function DeltaChip({ value, label = 'vs baseline' }: { value: number; label?: string }) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums',
        positive
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
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
        'grid shrink-0 place-items-center overflow-hidden rounded border border-border-subtle bg-surface-card',
        className
      )}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          className="size-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <Zap className="size-3 text-slate-500 dark:text-slate-400" />
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
      <div className="w-16 shrink-0 text-[8px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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
                  'font-mono text-[11px] font-bold leading-none tabular-nums',
                  count > 0
                    ? 'text-slate-800 dark:text-white'
                    : 'text-slate-400 dark:text-white/40'
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
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-slate-500 dark:text-slate-400">
              %
            </span>
          )}
        </div>
      </Field>

      <button
        type="button"
        onClick={onRemove}
        className="justify-self-end rounded-lg border border-border bg-surface-card p-2 text-slate-500 dark:text-slate-400 transition-colors hover:border-rose-500/40 hover:text-rose-600 dark:hover:text-rose-300"
        aria-label={`Remove stat row${row.label ? `: ${row.label}` : ''}`}
      >
        <Trash2 className="size-3.5" />
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
      <div className="flex items-center justify-between px-0.5 pb-1">
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
          Emblem {level}
        </span>
        <span className="text-[8px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-white/40">
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
                className="w-full rounded-md border border-border bg-base px-1.5 py-1 text-[10px] font-medium text-slate-700 focus:border-amber-500/60 focus:outline-none dark:text-white"
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
                  'w-full rounded-md border border-border bg-base px-1.5 py-1 text-[10px] font-semibold focus:border-amber-500/60 focus:outline-none disabled:opacity-40',
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
              <span className="truncate text-right font-mono text-[10px] font-bold tabular-nums text-slate-600 dark:text-white/70">
                {meta && displayValue > 0
                  ? `${meta.percent ? displayValue.toFixed(1) : displayValue.toFixed(0)}${meta.percent ? '%' : ''}`
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

  const [fighters, setFighters] = useState<FighterStateInput[]>(() => createFighters(build));
  const [buffs, setBuffs] = useState<BuffRowState[]>([]);
  const [recordLevel, setRecordLevel] = useState(31);
  const [enemyDef, setEnemyDef] = useState(500);
  const [enemyRes, setEnemyRes] = useState(250);
  const [resilienceBroken, setResilienceBroken] = useState(false);
  const [baseline, setBaseline] = useState<BaselineSnapshot | null>(null);
  const [sensitivityTab, setSensitivityTab] = useState<SensitivityTab>('talents');
  const [talentSlot, setTalentSlot] = useState<SlotKey>('vanguard');

  useEffect(() => {
    setFighters(createFighters(build));
    setBuffs([]);
    setBaseline(null);
  }, [build]);

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

  const teamInput = useMemo<TeamCalcInput>(() => {
    const roster = fighters.map((state) => {
      const characterId = build.slots[state.slot].characterId;
      const character = characterId ? characters[String(characterId)] ?? null : null;
      const combat = characterId ? COMBAT_DB[String(characterId)] ?? null : null;
      return { state, character, combat };
    });

    return {
      fighters: roster,
      contributions,
      buffs,
      recordLevel,
      enemy: { def: enemyDef, res: enemyRes, resilienceBroken },
    };
  }, [
    fighters,
    build.slots,
    characters,
    contributions,
    buffs,
    recordLevel,
    enemyDef,
    enemyRes,
    resilienceBroken,
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

    const rebuild = (without: DiscSweepEntry | null) => {
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

      return computePresetContributions(mainDiscs, supportDiscs, notes, discs);
    };

    return computeDiscContributions(teamInput, discEntries, rebuild);
  }, [
    teamInput,
    discEntries,
    build.mainDiscs,
    build.supportDiscs,
    effectiveNotes,
    supportStartingNotes,
    discs,
  ]);

  const talentPoints = useMemo(
    () => computeTalentProgression(teamInput, talentSlot),
    [teamInput, talentSlot]
  );

  const penPoints = useMemo(() => computePenCurve(enemyRes), [enemyRes]);

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
      slices: fighter.abilities.map(({ entry, damage }, index) => ({
        label: entry.name,
        value: damage.expectedDamage,
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
    setFighters((previous) =>
      previous.map((fighter) => (fighter.slot === slot ? { ...fighter, ...patch } : fighter))
    );
  };

  const updateEmblem = (
    slot: SlotKey,
    level: EmblemLevel,
    index: number,
    patch: Partial<EmblemRowState>
  ) => {
    setFighters((previous) =>
      previous.map((fighter) => {
        if (fighter.slot !== slot) return fighter;
        const rows = fighter.emblems[level].map((row, rowIndex) =>
          rowIndex === index ? { ...row, ...patch } : row
        );
        return { ...fighter, emblems: { ...fighter.emblems, [level]: rows } };
      })
    );
  };

  const addPresetAbility = (slot: SlotKey, presetKey: AbilityPresetKey) => {
    const characterId = build.slots[slot].characterId;
    const combat = characterId ? COMBAT_DB[String(characterId)] ?? null : null;
    const entry = combat?.[presetKey];
    if (!entry) return;

    const id = nextRotationId();
    setFighters((previous) =>
      previous.map((fighter) => {
        if (fighter.slot !== slot) return fighter;
        return {
          ...fighter,
          rotation: [
            ...fighter.rotation,
            {
              id,
              source: presetKey,
              name: entry.name,
              icon: entry.icon,
              motionValuePct: parseMotionValue(entry.params, fighter.skillLevel) ?? 0,
              hits: 1,
              casts: 1,
              damageType: ABILITY_PRESET_MAP[presetKey].damageType,
              scalingStat: 'ATK',
            },
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
    const next = ABILITY_PRESETS.find(
      (preset) =>
        fighter?.combat?.[preset.key] &&
        !fighter.state.rotation.some((entry) => entry.source === preset.key)
    );
    if (next) {
      addPresetAbility(slot, next.key);
    } else {
      addCustomAbility(slot);
    }
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
        <div className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-amber-500/[0.07] blur-3xl" />
        <div className="relative p-4 sm:p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Calculator className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                  Theoretical damage
                </p>
                <h2 className="mt-0.5 text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl">
                  Team Damage Calculator
                </h2>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-white/55 sm:text-xs">
                  Rotation expected value · DEF / RES amendment · formula by AutumnVN &amp; Soh
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {baseline && (
                <>
                  <span className="hidden text-[10px] text-slate-500 dark:text-slate-400 sm:inline">
                    Baseline{' '}
                    {new Date(baseline.savedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBaseline(null)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:border-rose-500/40 hover:text-rose-600 dark:text-white/60 dark:hover:text-rose-300"
                  >
                    <Trash2 className="size-3.5" />
                    Clear baseline
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={saveBaseline}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-300"
              >
                <Save className="size-3.5" />
                {baseline ? 'Update baseline' : 'Save baseline'}
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.7fr)_minmax(0,0.9fr)] lg:items-start">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                <span className="size-1.5 rounded-full bg-amber-500" />
                Expected team damage
              </div>
              <div className="mt-1 flex flex-wrap items-end gap-2">
                <span className="font-mono text-4xl font-extrabold leading-none tracking-tight text-slate-900 tabular-nums dark:text-white sm:text-5xl">
                  {formatNumber(totalExpected)}
                </span>
                {snapshotDelta !== null && <DeltaChip value={snapshotDelta} />}
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-white/55">
                {activeAbilities} {activeAbilities === 1 ? 'ability' : 'abilities'} ·{' '}
                {formatNumber(totalHits)} hits · {teamSize}{' '}
                {teamSize === 1 ? 'Trekker' : 'Trekkers'}
              </p>

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
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-white/55">
                    No team loaded — open a preset from the Advanced Visualizer to populate the slots.
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
                            className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-white/55"
                          >
                            <span
                              className={cn(
                                'size-1.5 shrink-0 rounded-full',
                                ELEMENT_STYLES[fighter.element].dot
                              )}
                            />
                            <span className="font-semibold text-slate-700 dark:text-white/75">
                              {fighter.character?.name.EN}
                            </span>
                            <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
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
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Team damage
              </div>
              <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <PieChart slices={teamSlices} size={124} label="Team damage share" />
                <PieLegend
                  slices={teamSlices}
                  total={totalExpected}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <HeroMetric
                label="Non-crit floor"
                value={formatCompact(totalNonCrit)}
                hint="All hits · no crits"
              />
              <HeroMetric
                label="Full-crit ceiling"
                value={formatCompact(totalCrit)}
                hint="Every hit crits"
                tone="amber"
              />
              <HeroMetric
                label="Avg crit multiplier"
                value={`×${avgCritMult.toFixed(2)}`}
                hint="Expected ÷ non-crit"
                tone="emerald"
              />
              <HeroMetric
                label="Rotation hits"
                value={formatNumber(totalHits)}
                hint={`${activeAbilities} abilities`}
                tone="sky"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-subtle pt-3">
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Squad progress
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              Affinity Lv is set per Trekker in the cards below.
            </span>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-white/60">
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
                className="w-14 rounded-md border border-border bg-base px-1.5 py-1 font-mono text-[11px] font-bold tabular-nums text-slate-900 focus:border-amber-500/60 focus:outline-none dark:text-white"
                aria-label="Record rating"
              />
            </label>
            <span className="font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
              +{recordAtk} ATK
            </span>
          </div>
        </div>
      </div>

      {/* Target and mitigation */}
      <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeader
            icon={Target}
            title="Target &amp; mitigation"
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
                    'flex flex-col items-start rounded-lg border px-2 py-1 text-left transition-colors',
                    selected
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      : 'border-border bg-surface-subtle text-slate-600 hover:border-amber-500/30 dark:text-white/65'
                  )}
                >
                  <span className="text-[10px] font-bold">{preset.label}</span>
                  <span className="font-mono text-[8px] tabular-nums opacity-65">
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
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Base mitigation
            </div>
            <div className="mt-1 font-mono text-[13px] font-bold tabular-nums text-slate-900 dark:text-white">
              DEF {(baseDefAmend * 100).toFixed(1)}%
            </div>
            <div className="font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
              RES {(baseResAmend * 100).toFixed(1)}%
            </div>
          </div>
          <button
            type="button"
            aria-pressed={resilienceBroken}
            onClick={() => setResilienceBroken((value) => !value)}
            className={cn(
              'flex flex-col justify-between rounded-lg border p-2.5 text-left transition-colors',
              resilienceBroken
                ? 'border-amber-500/50 bg-amber-500/10'
                : 'border-border-subtle bg-surface-subtle hover:border-border-hover'
            )}
          >
            <span className="flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              Resilience break
              <span
                className={cn(
                  'rounded px-1 py-0.5 font-mono text-[8px]',
                  resilienceBroken
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                    : 'bg-surface-card text-slate-500 dark:text-slate-400'
                )}
              >
                {resilienceBroken ? 'ON' : 'OFF'}
              </span>
            </span>
            <span
              className={cn(
                'mt-1 font-mono text-sm font-bold tabular-nums',
                resilienceBroken
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-900 dark:text-white'
              )}
            >
              {resilienceBroken ? '×1.50' : '×1.00'}
            </span>
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
          <span>Effective DEF {Math.round(enemyDef * 10) / 10} → {(baseDefAmend * 100).toFixed(1)}%</span>
          <span className="text-border">|</span>
          <span>Effective RES {enemyRes} → {(baseResAmend * 100).toFixed(1)}%</span>
          <span className="inline-flex items-center gap-1">
            <Info className="size-3" />
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
              <div className={cn('h-1', SLOT_META[state.slot].accent)} />
              <div className="flex flex-1 flex-col gap-4 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div
                      className={cn(
                        'relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-surface-subtle ring-2',
                        elementStyle.ring
                      )}
                    >
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {character ? getCharacterInitials(character.name.EN) : '—'}
                      </span>
                      {character && (
                        <img
                          src={getCharacterHeadUrl(character.id)}
                          alt={character.name.EN}
                          className="absolute inset-0 size-full object-cover object-top"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        <span className={cn('size-1 rounded-full', SLOT_META[state.slot].accent)} />
                        {SLOT_META[state.slot].label}
                      </div>
                      <h3 className="mt-0.5 truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                        {character?.name.EN ?? 'Empty slot'}
                      </h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded border px-1 py-0.5 text-[9px] font-bold',
                            elementStyle.chip
                          )}
                        >
                          <img
                            src={`/ss-element/${element}.webp`}
                            alt=""
                            className="size-2.5 object-contain"
                            onError={(event) => {
                              event.currentTarget.style.display = 'none';
                            }}
                          />
                          {element}
                        </span>
                        {character && (
                          <span className="text-[10px] text-slate-500 dark:text-white/55">
                            {character.class} · {character.star}★
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <label className="flex shrink-0 items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    Lv
                    <select
                      value={state.level}
                      onChange={(event) =>
                        updateFighter(state.slot, {
                          level: event.target.value as TrekkerLevel,
                        })
                      }
                      className="rounded-md border border-border bg-base px-1.5 py-1 font-mono text-[10px] font-bold text-slate-700 focus:border-amber-500/60 focus:outline-none dark:text-white"
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

                <div
                  className="grid grid-cols-3 gap-1.5 rounded-lg border border-border-subtle bg-surface-subtle p-2"
                  title={`Base ATK ${formatNumber(stats.baseAtkParts.character)} + affinity ${formatNumber(stats.baseAtkParts.affinity)} + record ${formatNumber(stats.baseAtkParts.record)} + discs ${formatNumber(stats.baseAtkParts.discs)} + manual ${formatNumber(stats.baseAtkParts.bonus)}`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                      Final ATK
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[13px] font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatNumber(stats.finalAtk)}
                    </div>
                    <div className="truncate font-mono text-[8px] text-slate-500 dark:text-slate-400">
                      +{stats.totalAtkPct.toFixed(1)}%
                    </div>
                  </div>
                  <div className="min-w-0 border-l border-border-subtle pl-1.5">
                    <div className="truncate text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                      Crit rate
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[13px] font-bold tabular-nums text-slate-900 dark:text-white">
                      {stats.critRatePct.toFixed(1)}%
                    </div>
                    <div className="truncate font-mono text-[8px] text-slate-500 dark:text-slate-400">
                      {stats.critDmgPct.toFixed(0)}% DMG
                    </div>
                  </div>
                  <div className="min-w-0 border-l border-border-subtle pl-1.5">
                    <div className="truncate text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                      {element} DMG
                    </div>
                    <div
                      className={cn(
                        'mt-0.5 truncate font-mono text-[13px] font-bold tabular-nums',
                        elementStyle.text
                      )}
                    >
                      +{stats.elementDmgPct.toFixed(1)}%
                    </div>
                    <div className="truncate font-mono text-[8px] text-slate-500 dark:text-slate-400">
                      DEF {fighter.defAmend >= 0 ? (fighter.defAmend * 100).toFixed(0) : '—'}%
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <label className="block min-w-0">
                    <span className="mb-1 block text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                      Talent tier
                    </span>
                    <select
                      value={state.talentTier}
                      onChange={(event) =>
                        updateFighter(state.slot, {
                          talentTier: Math.max(0, Math.min(5, Number(event.target.value) || 0)),
                        })
                      }
                      className="w-full rounded-md border border-border bg-base px-1.5 py-1 font-mono text-[10px] font-bold text-slate-700 focus:border-amber-500/60 focus:outline-none dark:text-white"
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
                    <span className="mb-1 block text-[8px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
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
                      className="w-full rounded-md border border-border bg-base px-1.5 py-1 font-mono text-[10px] font-bold tabular-nums text-slate-700 focus:border-amber-500/60 focus:outline-none dark:text-white"
                      aria-label={`${character?.name.EN ?? 'Trekker'} affinity level`}
                    />
                  </label>
                </div>

              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-subtle px-4 py-2.5">
                <span className="font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                  DEF {(fighter.defAmend * 100).toFixed(1)}% · RES {(fighter.erAmend * 100).toFixed(1)}%
                </span>
                <div className="flex items-center gap-1.5">
                  {cardDelta !== null && <DeltaChip value={cardDelta} label="" />}
                  <span className="font-mono text-sm font-bold tabular-nums text-slate-900 dark:text-white">
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
            icon={Layers}
            title="Equipped discs"
            subtitle="All six disc ATK values feed every Trekker's squad base ATK."
            right={
              <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 font-mono text-[10px] font-bold tabular-nums text-amber-700 dark:text-amber-300">
                +{formatNumber(contributions.discBaseAtk)} ATK
              </span>
            }
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
                      className="size-9 shrink-0 rounded-md border border-border-subtle object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="grid size-9 shrink-0 place-items-center rounded-md border border-dashed border-border text-slate-300">
                      <Disc3 className="size-4" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {slot.kind === 'main' ? 'Main' : 'Support'} #{slot.index + 1}
                    </div>
                    <div className="truncate text-[11px] font-bold text-slate-700 dark:text-white/80">
                      {disc?.name ?? 'Empty slot'}
                    </div>
                    <div className="truncate font-mono text-[9px] tabular-nums text-slate-500 dark:text-slate-400">
                      {disc
                        ? `Lv${slot.level} · ${slot.kind === 'main' ? `C${slot.crescendo - 1}` : `Phase ${slot.phase + 1}`} · +${formatNumber(atk)} ATK${supportNotes > 0 ? ` · +${supportNotes} notes` : ''}`
                        : 'Not equipped'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-3 border-t border-border-subtle pt-3 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
            Main-disc Harmony effects and support-disc starting skills are not auto-applied.
            Add their stats as manual rows in the buff table below.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
          <SectionHeader
            icon={Music}
            title="Musical notes"
            subtitle="Support starting notes, with preset overrides applied."
            right={
              <span className="rounded-md border border-border-subtle bg-surface-subtle px-2 py-1 font-mono text-[10px] font-bold tabular-nums text-slate-500 dark:text-white/60">
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
                className="rounded-md border border-border-subtle bg-surface-subtle px-2 py-1 text-[10px] text-slate-500 dark:text-white/60"
              >
                <span className="font-semibold text-slate-700 dark:text-white/80">{label}</span>{' '}
                <span className="font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  +{Number(value).toFixed(2)}%
                </span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1 px-1 text-[10px] text-slate-500 dark:text-slate-400">
              <Info className="size-3" />
              Applied to every Trekker.
            </span>
          </div>
        </div>
      </div>
      {/* Emblems */}
      <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
        <SectionHeader
          icon={Gem}
          title="Emblems"
          subtitle="Each Trekker has their own emblem sets at level 70, 80, and 90. Stats feed that Trekker's final stats."
        />
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
                  <span className="text-[10px] text-slate-500 dark:text-white/55">
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
      </div>


      {/* Buffs and manual stats */}
      <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
        <SectionHeader
          icon={Sparkles}
          title="Buffs & manual stats"
          subtitle="Potentials and conditional team buffs. Target the whole team or a single Trekker. Talents and emblems are set per Trekker above."
          right={
            <button
              type="button"
              onClick={addBuff}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-2.5 py-1.5 text-[11px] font-bold text-slate-600 transition-colors hover:border-amber-500/40 hover:text-amber-600 dark:text-white/65 dark:hover:text-amber-400"
            >
              <Plus className="size-3.5" />
              Add stat row
            </button>
          }
        />

        {buffs.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-5 text-center">
            <p className="text-[11px] font-semibold text-slate-600 dark:text-white/70">
              No manual stats yet.
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
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
      <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
        <SectionHeader
          icon={Zap}
          title="Rotation"
          subtitle="Ability sequence per Trekker. Pick an ability, tune its multiplier and notes, and the crit values update live."
          right={
            <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 font-mono text-[10px] font-bold tabular-nums text-amber-700 dark:text-amber-300">
              {formatNumber(totalExpected)} total
            </span>
          }
        />

        {fighterCalcs.every((fighter) => !fighter.character) ? (
          <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-5 text-center text-[11px] text-slate-500 dark:text-white/55">
            No team loaded — open a preset from the Advanced Visualizer to populate the rotation.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  <th className="w-32 py-2 pr-2">Trekker</th>
                  <th className="py-2 pr-2">Ability name</th>
                  <th className="w-24 py-2 pr-2 text-right">Multiplier</th>
                  <th className="w-20 py-2 pr-2">Scaling</th>
                  <th className="w-40 py-2 pr-2">Notes</th>
                  <th className="py-2 pr-2 text-right">Crit average</th>
                  <th className="py-2 pr-2 text-right">No crit</th>
                  <th className="py-2 pr-2 text-right">Crit</th>
                  <th className="w-8 py-2" />
                </tr>
              </thead>
              {fighterCalcs
                .filter((fighter) => fighter.character)
                .map((fighter) => (
                  <tbody key={fighter.state.slot} className="border-b border-border">
                    <tr className="bg-surface-subtle">
                      <td colSpan={9} className="px-1 py-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'size-2.5 rounded-full',
                              ELEMENT_STYLES[fighter.element].dot
                            )}
                          />
                          <span className="truncate text-[11px] font-bold text-slate-800 dark:text-white">
                            {fighter.character?.name.EN}
                          </span>
                          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                            {SLOT_META[fighter.state.slot].label}
                          </span>
                          <span className="font-mono text-[9px] tabular-nums text-slate-500 dark:text-slate-400">
                            {fighter.state.rotation.length}{' '}
                            {fighter.state.rotation.length === 1 ? 'ability' : 'abilities'} ·{' '}
                            {formatCompact(fighter.totals.expected)} expected
                          </span>
                          <button
                            type="button"
                            onClick={() => addRotationAbility(fighter.state.slot)}
                            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-surface-card px-1.5 py-0.5 text-[9px] font-bold text-slate-600 transition-colors hover:border-amber-500/40 hover:text-amber-600 dark:text-white/65 dark:hover:text-amber-400"
                          >
                            <Plus className="size-3" />
                            Ability
                          </button>
                        </div>
                      </td>
                    </tr>

                    {fighter.state.rotation.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-2 py-3 text-center text-[11px] text-slate-500 dark:text-white/55"
                        >
                          No abilities yet. Add one to start this Trekker&apos;s rotation.
                        </td>
                      </tr>
                    ) : (
                      fighter.abilities.map(({ entry, damage }) => (
                        <tr
                          key={entry.id}
                          className="border-t border-border-subtle/60 align-middle hover:bg-surface-subtle/60"
                        >
                          <td className="py-1 pr-2">
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              <span
                                className={cn(
                                  'size-1.5 shrink-0 rounded-full',
                                  ELEMENT_STYLES[fighter.element].dot
                                )}
                              />
                              <span className="truncate text-[10px] font-semibold text-slate-700 dark:text-white/75">
                                {fighter.character?.name.EN}
                              </span>
                            </span>
                          </td>
                          <td className="py-1 pr-2">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <AbilityIcon icon={entry.icon} className="size-4 shrink-0" />
                              <select
                                value={entry.source}
                                onChange={(event) => {
                                  const key = event.target.value as AbilityPresetKey | 'custom';
                                  if (key === 'custom') {
                                    updateRotation(fighter.state.slot, entry.id, {
                                      source: 'custom',
                                      name: 'Custom ability',
                                      icon: undefined,
                                      damageType: 'Skill',
                                    });
                                    return;
                                  }
                                  const presetEntry = fighter.combat?.[key];
                                  if (!presetEntry) return;
                                  updateRotation(fighter.state.slot, entry.id, {
                                    source: key,
                                    name: presetEntry.name,
                                    icon: presetEntry.icon,
                                    motionValuePct:
                                      parseMotionValue(
                                        presetEntry.params,
                                        fighter.state.skillLevel
                                      ) ?? 0,
                                    damageType: ABILITY_PRESET_MAP[key].damageType,
                                  });
                                }}
                                className="min-w-0 max-w-[190px] flex-1 truncate rounded border border-border bg-surface-card px-1.5 py-1 text-[11px] font-semibold text-slate-700 focus:border-amber-500/60 focus:outline-none dark:bg-base dark:text-white"
                                aria-label={`Ability for ${fighter.character?.name.EN ?? 'Trekker'}`}
                              >
                                {ABILITY_PRESETS.filter(
                                  (preset) => fighter.combat?.[preset.key]
                                ).map((preset) => (
                                  <option key={preset.key} value={preset.key}>
                                    {fighter.combat?.[preset.key]?.name}
                                  </option>
                                ))}
                                {entry.source !== 'custom' && !fighter.combat?.[entry.source] && (
                                  <option value={entry.source}>{entry.name}</option>
                                )}
                                <option value="custom">Custom ability</option>
                              </select>
                              {entry.source === 'custom' && (
                                <input
                                  value={entry.name}
                                  onChange={(event) =>
                                    updateRotation(fighter.state.slot, entry.id, {
                                      name: event.target.value,
                                    })
                                  }
                                  className="w-24 min-w-0 rounded border border-border bg-surface-card px-1.5 py-1 text-[11px] font-semibold text-slate-700 focus:border-amber-500/60 focus:outline-none dark:bg-base dark:text-white"
                                  aria-label="Custom ability name"
                                />
                              )}
                            </div>
                          </td>
                          <td className="py-1 pr-2">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min={0}
                                step="0.1"
                                value={entry.motionValuePct}
                                onChange={(event) =>
                                  updateRotation(fighter.state.slot, entry.id, {
                                    motionValuePct: Math.max(0, Number(event.target.value) || 0),
                                  })
                                }
                                className="w-16 rounded border border-border bg-surface-card px-1 py-1 text-right font-mono text-[10px] font-bold tabular-nums text-slate-700 focus:border-amber-500/60 focus:outline-none dark:bg-base dark:text-white"
                                aria-label={`${entry.name} multiplier percent`}
                              />
                              <span className="text-[9px] text-slate-400">%</span>
                            </div>
                          </td>
                          <td className="py-1 pr-2">
                            <select
                              value={entry.scalingStat ?? 'ATK'}
                              onChange={(event) =>
                                updateRotation(fighter.state.slot, entry.id, {
                                  scalingStat: event.target.value as 'ATK' | 'HP' | 'DEF',
                                })
                              }
                              className="w-full rounded border border-border bg-surface-card px-1 py-1 text-[10px] font-semibold text-slate-700 focus:border-amber-500/60 focus:outline-none dark:bg-base dark:text-white"
                              aria-label={`${entry.name} scaling stat`}
                            >
                              <option value="ATK">ATK</option>
                              <option value="HP">HP</option>
                              <option value="DEF">DEF</option>
                            </select>
                          </td>
                          <td className="py-1 pr-2">
                            <input
                              value={entry.note ?? ''}
                              onChange={(event) =>
                                updateRotation(fighter.state.slot, entry.id, {
                                  note: event.target.value,
                                })
                              }
                              placeholder="Note"
                              className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-[10px] text-slate-600 placeholder:text-slate-400 focus:border-border focus:bg-surface-card focus:outline-none dark:text-white/70"
                              aria-label={`${entry.name} note`}
                            />
                          </td>
                          <td className="py-1 pr-2 text-right font-mono text-[10px] font-bold tabular-nums text-amber-600 dark:text-amber-400">
                            {formatNumber(damage.expectedDamage)}
                          </td>
                          <td className="py-1 pr-2 text-right font-mono text-[10px] tabular-nums text-slate-500 dark:text-white/60">
                            {formatNumber(damage.nonCritDamage)}
                          </td>
                          <td className="py-1 pr-2 text-right font-mono text-[10px] tabular-nums text-slate-500 dark:text-white/60">
                            {formatNumber(damage.critDamage)}
                          </td>
                          <td className="py-1 text-right">
                            <button
                              type="button"
                              onClick={() => removeRotation(fighter.state.slot, entry.id)}
                              className="rounded p-0.5 text-slate-300 transition-colors hover:text-rose-600 dark:hover:text-rose-300"
                              aria-label={`Remove ${entry.name}`}
                            >
                              <X className="size-3" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                ))}
            </table>
          </div>
        )}
      </div>



      {/* Damage breakdown */}
      <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
        <SectionHeader
          icon={Swords}
          title="Damage breakdown"
          subtitle="Expected damage per rotation entry after crit weighting, DEF / RES amendment, and taken multipliers."
          right={
            <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 font-mono text-[10px] font-bold tabular-nums text-amber-700 dark:text-amber-300">
              {formatNumber(totalExpected)} total
            </span>
          }
        />

        {damageRows.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-border px-4 py-6 text-center">
            <p className="text-[11px] text-slate-500 dark:text-white/55">
              Add an ability to a Trekker to see the damage breakdown.
            </p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[780px] text-xs">
              <thead>
                <tr className="border-b border-border text-[9px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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
                          <span className="font-semibold text-slate-700 dark:text-white/80">
                            {fighter.character?.name.EN ?? SLOT_META[fighter.state.slot].label}
                          </span>
                          <span className="text-[8px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {SLOT_META[fighter.state.slot].shortLabel}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1.5">
                          <AbilityIcon icon={entry.icon} className="size-4" />
                          <span className="text-[11px] font-medium text-slate-700 dark:text-white/80">
                            {entry.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <span className="inline-flex rounded border border-border bg-surface-subtle px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-white/60">
                          {entry.damageType}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[10px] tabular-nums text-slate-500 dark:text-white/60">
                        {entry.motionValuePct.toFixed(1)}%
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[10px] tabular-nums text-slate-500 dark:text-white/60">
                        {entry.hits}×{entry.casts}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[10px] tabular-nums text-slate-500 dark:text-white/60">
                        {fighter.stats.critRatePct.toFixed(1)}% /{' '}
                        {fighter.stats.critDmgPct.toFixed(0)}%
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[10px] tabular-nums text-slate-500 dark:text-white/60">
                        {(damage.defAmend * 100).toFixed(1)}% /{' '}
                        {(damage.erAmend * 100).toFixed(1)}%
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[11px] font-bold tabular-nums text-amber-600 dark:text-amber-400">
                        {formatNumber(damage.expectedDamage)}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[10px] tabular-nums text-slate-500 dark:text-white/60">
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
                    className="px-2 py-2 text-right text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400"
                  >
                    Team total
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-[12px] font-bold tabular-nums text-slate-900 dark:text-white">
                    {formatNumber(totalExpected)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                    100%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="mt-3 rounded-lg border border-border-subtle bg-surface-subtle px-3 py-2">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            <Info className="size-3" />
            Expected-value model
          </div>
          <div className="mt-1 overflow-x-auto whitespace-nowrap font-mono text-[10px] text-slate-500 dark:text-white/55">
            Damage = ATK × MV × Skill Intensity × Slot DMG × Element DMG × Expected Crit × DEF
            Amend × RES Amend × Taken × Break
          </div>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            Expected crit = 1 + min(100%, Crit Rate) × (Crit DMG − 1).
          </p>
        </div>
      </div>

      {/* Optimization & Sensitivity */}
      <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
        <SectionHeader
          icon={TrendingUp}
          title="Optimization &amp; Sensitivity"
          subtitle="What-if sweeps computed from the current team: talent tiers, each equipped disc, and flat RES PEN."
        />

        <div className="mt-3 flex flex-wrap gap-1">
          {SENSITIVITY_TABS.map((tab) => {
            const selected = sensitivityTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={selected}
                onClick={() => setSensitivityTab(tab.key)}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-[10px] font-bold transition-colors',
                  selected
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'border-border bg-surface-subtle text-slate-600 hover:border-amber-500/30 dark:text-white/65'
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {sensitivityTab === 'talents' && (
          <div className="mt-3 space-y-2.5">
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
              <p className="max-w-lg text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                Each tier applies that Trekker&apos;s talent rows while the rest of the team keeps
                its current tiers. Gains are measured against T0.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-xs">
                <thead>
                  <tr className="border-b border-border text-[9px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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
                      <td className="px-2 py-1.5 font-mono text-[10px] font-bold text-slate-700 dark:text-white">
                        T{point.tier}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-[11px] tabular-nums text-slate-700 dark:text-white/80">
                        {formatNumber(point.teamDmg)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-[10px] tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatSignedPct(point.teamGainPct)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-[11px] tabular-nums text-slate-700 dark:text-white/80">
                        {formatNumber(point.personalDmg)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-[10px] tabular-nums text-emerald-600 dark:text-emerald-400">
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
          <div className="mt-3 space-y-2.5">
            {discPoints.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-[11px] text-slate-500 dark:text-white/55">
                No discs equipped — load a preset to measure disc impact.
              </div>
            ) : (
              <>
                <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                  Team damage recomputed with each disc removed. Support discs also drop their
                  starting notes.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-xs">
                    <thead>
                      <tr className="border-b border-border text-[9px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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
                          <td className="px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-white/85">
                            {point.name}
                          </td>
                          <td className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                            {point.slot}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-[11px] tabular-nums text-slate-700 dark:text-white/80">
                            {formatNumber(point.teamDmg)}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-[10px] tabular-nums text-rose-600 dark:text-rose-400">
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
          <div className="mt-3 space-y-2.5">
            <p className="text-[10px] leading-snug text-slate-500 dark:text-slate-400">
              Flat RES PEN against the current target ({enemyRes} RES). Gain is relative to 0 PEN.
            </p>
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[360px] text-xs">
                <thead className="sticky top-0 bg-surface-card">
                  <tr className="border-b border-border text-[9px] uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    <th className="px-2 py-2 text-right font-bold">PEN</th>
                    <th className="px-2 py-2 text-right font-bold">Effective RES</th>
                    <th className="px-2 py-2 text-right font-bold">RES amend</th>
                    <th className="px-2 py-2 text-right font-bold">Gain vs 0</th>
                  </tr>
                </thead>
                <tbody>
                  {penPoints.map((point) => (
                    <tr
                      key={point.pen}
                      className="border-b border-border-subtle last:border-0 hover:bg-surface-subtle/60"
                    >
                      <td className="px-2 py-1 text-right font-mono text-[10px] font-bold tabular-nums text-slate-700 dark:text-white">
                        {point.pen}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-[10px] tabular-nums text-slate-600 dark:text-white/70">
                        {Math.round(point.effectiveRes)}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-[10px] tabular-nums text-slate-600 dark:text-white/70">
                        {(point.erAmend * 100).toFixed(1)}%
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-[10px] tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatSignedPct(point.gainPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Damage type & source */}
      <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
        <SectionHeader
          icon={ChartPie}
          title="Damage type breakdown"
          subtitle="How each Trekker's rotation splits across damage sources and damage types."
        />
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
                  <span className="ml-auto font-mono text-[10px] font-bold tabular-nums text-slate-500 dark:text-slate-400">
                    {formatCompact(fighter.totals.expected)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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
                    <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
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
      </div>
    </section>
  );
}
