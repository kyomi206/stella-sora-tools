'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Minus, Plus, StickyNote, X } from 'lucide-react';
import { DAMAGE_TYPES } from '@/lib/calculator/damage-engine';
import type { DamageType } from '@/lib/calculator/damage-engine';
import {
  formatPartOptionLabel,
  type FighterCalc,
  type RotationAbility,
  type SlotKey,
} from '@/lib/calculator/fighter-calc';
import {
  parsePrimarySkillPart,
  parseSkillParts,
} from '@/lib/calculator/motion-value-parser';
import {
  getEmblemSkillLevelBonuses,
  type EmblemLevel,
  type EmblemRowState,
} from '@/lib/calculator/talent-emblem';
import { getSkillIconUrl } from '@/lib/calculator/material-icons';
import { getTrekkerImageUrl } from '@/lib/wikitide';
import { cn } from '@/lib/utils';
import type { AdvancedTeamBuild, ElementType } from '@/types';

type AbilityPresetKey = 'normalAtk' | 'skill' | 'supportSkill' | 'ultimate';

const ABILITY_PRESETS: Array<{
  key: AbilityPresetKey;
  shortTag: string;
  damageType: DamageType;
}> = [
  { key: 'normalAtk', shortTag: 'AA', damageType: 'Auto Attack' },
  { key: 'skill', shortTag: 'Main', damageType: 'Skill' },
  { key: 'supportSkill', shortTag: 'Sup', damageType: 'Skill' },
  { key: 'ultimate', shortTag: 'Ult', damageType: 'Ultimate' },
];

const ABILITY_PRESET_MAP = Object.fromEntries(
  ABILITY_PRESETS.map((preset) => [preset.key, preset])
) as Record<AbilityPresetKey, (typeof ABILITY_PRESETS)[number]>;

const SLOT_LABELS: Record<SlotKey, string> = {
  vanguard: 'Vanguard',
  versatile: 'Versatile',
  support: 'Support',
};

const ELEMENT_DOT: Record<ElementType, string> = {
  Ignis: 'bg-orange-500',
  Aqua: 'bg-sky-500',
  Terra: 'bg-emerald-500',
  Ventus: 'bg-teal-500',
  Lux: 'bg-amber-400',
  Umbra: 'bg-purple-500',
};

const DAMAGE_TYPE_HEX: Record<DamageType, string> = {
  'Auto Attack': '#3b82f6',
  Skill: '#ef4444',
  Ultimate: '#f59e0b',
  Mark: '#a855f7',
  Minion: '#10b981',
};

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70 focus-visible:border-teal-500';

const CONTROL_CLASS =
  'h-8 rounded-md border border-border bg-surface-card text-xs font-semibold text-slate-800 transition-colors focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/35 dark:bg-base dark:text-white';

// Single shared grid template so desktop column headers and row cells align to the pixel
const DESKTOP_GRID =
  'lg:grid lg:grid-cols-[minmax(0,1fr)_118px_86px_58px_94px_68px_130px_60px] lg:items-center lg:gap-x-2.5';

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

function getEffectiveSkillLevel(
  baseSkillLevel: number,
  emblems: Record<EmblemLevel, EmblemRowState[]>,
  source: AbilityPresetKey | 'custom'
): number {
  if (source === 'custom') return baseSkillLevel;
  const bonuses = getEmblemSkillLevelBonuses(emblems);
  return Math.max(1, Math.min(13, baseSkillLevel + (bonuses[source] ?? 0)));
}

function SkillBadgeIcon({ icon }: { icon?: string }) {
  const iconUrl = getSkillIconUrl(icon);
  return (
    <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-md border border-[#1e3a5f]/25 bg-[#2e4b84] p-0.5 text-white dark:border-border-subtle dark:bg-surface-elevated">
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
        <span className="text-[11px] font-bold leading-none text-white/80" aria-hidden="true">
          ✦
        </span>
      )}
    </span>
  );
}

export interface RotationPanelProps {
  build: AdvancedTeamBuild;
  fighterCalcs: FighterCalc[];
  totalExpected: number;
  onAddAbility: (slot: SlotKey) => void;
  onImportDamagingPotentials: (slot: SlotKey) => void;
  onUpdateRotation: (slot: SlotKey, entryId: string, patch: Partial<RotationAbility>) => void;
  onRemoveRotation: (slot: SlotKey, entryId: string) => void;
}

export function RotationPanel({
  build,
  fighterCalcs,
  totalExpected,
  onAddAbility,
  onImportDamagingPotentials,
  onUpdateRotation,
  onRemoveRotation,
}: RotationPanelProps) {
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const occupiedFighters = fighterCalcs.filter((fighter) => fighter.character);

  const toggleNote = (entryId: string, hasText: boolean) => {
    setOpenNotes((previous) => {
      const currentlyOpen = previous[entryId] ?? hasText;
      return { ...previous, [entryId]: !currentlyOpen };
    });
  };

  return (
    <div className="rounded-xl border border-border bg-surface-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
            Rotation
          </h2>
          <p className="mt-0.5 text-xs leading-snug text-slate-600 dark:text-slate-400">
            Ability sequence per Trekker. Tune multipliers, hits, and casts — expected damage updates live.
          </p>
        </div>
        <span className="rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs font-bold tabular-nums text-amber-700">
          {formatNumber(totalExpected)} total
        </span>
      </div>

      {occupiedFighters.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-slate-600 dark:text-slate-400">
          No team loaded —{' '}
          <Link
            href="/builder/advanced"
            className="font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/70"
          >
            open a preset from the Advanced Visualizer
          </Link>{' '}
          to populate the rotation.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {occupiedFighters.map((fighter) => {
            const charName = fighter.character?.name.EN ?? fighter.state.slot;
            const avatarUrl = fighter.character ? getTrekkerImageUrl(fighter.character.id) : '';
            const teamSharePct =
              totalExpected > 0 ? (fighter.totals.expected / totalExpected) * 100 : 0;
            const hasPotentials = (build.slots[fighter.state.slot].potentials?.length ?? 0) > 0;

            return (
              <section
                key={fighter.state.slot}
                aria-label={`${charName} rotation`}
                className="overflow-hidden rounded-xl border border-border-subtle bg-surface-card"
              >
                {/* Trekker group header */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-border-subtle bg-surface-subtle px-3.5 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-surface-card text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      <span aria-hidden="true">{charName.slice(0, 2).toUpperCase()}</span>
                      {avatarUrl && (
                        <img
                          src={avatarUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 size-full object-cover object-top"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <span
                        className={cn(
                          'absolute bottom-0.5 right-0.5 size-2 rounded-full ring-1 ring-surface-card',
                          ELEMENT_DOT[fighter.element]
                        )}
                      />
                    </span>

                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <h3 className="truncate text-xs font-bold text-slate-900 dark:text-white">
                        {charName}
                      </h3>
                      <span className="rounded border border-border bg-surface-card px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                        {SLOT_LABELS[fighter.state.slot]}
                      </span>
                      <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
                        {fighter.state.rotation.length}{' '}
                        {fighter.state.rotation.length === 1 ? 'ability' : 'abilities'} ·{' '}
                        <strong className="font-bold text-slate-800 dark:text-white">
                          {formatCompact(fighter.totals.expected)}
                        </strong>
                        {totalExpected > 0 && (
                          <span className="ml-1 text-[11px] text-slate-600 dark:text-slate-400">
                            ({teamSharePct.toFixed(0)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    {hasPotentials && (
                      <button
                        type="button"
                        onClick={() => onImportDamagingPotentials(fighter.state.slot)}
                        className={cn(
                          'press-feedback inline-flex min-h-8 items-center gap-1 rounded-lg border border-border bg-surface-card px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-teal-500/45 hover:text-teal-700',
                          FOCUS_RING
                        )}
                      >
                        <Plus className="size-3.5" aria-hidden="true" />
                        <span>Damaging potentials</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onAddAbility(fighter.state.slot)}
                      className={cn(
                        'press-feedback inline-flex min-h-8 items-center gap-1 rounded-lg border border-border bg-surface-card px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:border-amber-500/45 hover:text-amber-700',
                        FOCUS_RING
                      )}
                    >
                      <Plus className="size-3.5" aria-hidden="true" />
                      <span>Ability</span>
                    </button>
                  </div>
                </div>

                {fighter.state.rotation.length === 0 ? (
                  <div className="px-4 py-5 text-center text-xs text-slate-600 dark:text-slate-400">
                    No abilities yet. Add one to start {charName}&apos;s rotation.
                  </div>
                ) : (
                  <>
                    {/* Desktop column header strip */}
                    <div
                      aria-hidden="true"
                      className={cn(
                        'hidden border-b border-border-subtle/70 bg-surface-subtle/40 px-3.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-400',
                        DESKTOP_GRID
                      )}
                    >
                      <span>Ability &amp; part</span>
                      <span>Type</span>
                      <span className="text-right">Multiplier</span>
                      <span className="text-right">Hits</span>
                      <span className="text-center">Casts</span>
                      <span>Scaling</span>
                      <span className="text-right">Expected DMG</span>
                      <span className="sr-only">Actions</span>
                    </div>

                    <div className="divide-y divide-border-subtle/60">
                      {fighter.abilities.map(({ entry, damage }) => {
                        const effectiveSkillLevel = getEffectiveSkillLevel(
                          fighter.state.skillLevel,
                          fighter.state.emblems,
                          entry.source
                        );
                        const skillEntry =
                          entry.source !== 'custom' ? fighter.combat?.[entry.source] : undefined;
                        const skillParts =
                          entry.source !== 'custom' && skillEntry
                            ? parseSkillParts(skillEntry, entry.source, effectiveSkillLevel)
                            : [];
                        const activePartId =
                          entry.partId && skillParts.some((part) => part.id === entry.partId)
                            ? entry.partId
                            : skillParts[0]?.id ?? '';
                        const activePart = skillParts.find((part) => part.id === activePartId);
                        const skillTitle = skillEntry?.name ?? entry.name;
                        const hasNoteText = (entry.note?.trim().length ?? 0) > 0;
                        const noteVisible = openNotes[entry.id] ?? hasNoteText;
                        const rowShare =
                          fighter.totals.expected > 0
                            ? Math.min(1, damage.expectedDamage / fighter.totals.expected)
                            : 0;
                        const isInactive = entry.casts <= 0;

                        const stepCasts = (delta: number) => {
                          const next = Math.max(0, +(entry.casts + delta).toFixed(2));
                          onUpdateRotation(fighter.state.slot, entry.id, { casts: next });
                        };

                        return (
                          <div
                            key={entry.id}
                            className="rotation-row px-3.5 py-2.5"
                          >
                            <div className={cn('flex flex-col gap-2.5', DESKTOP_GRID)}>
                              {/* 1. Ability + Part (or Custom Name) */}
                              <div className="flex min-w-0 items-center gap-2">
                                <SkillBadgeIcon icon={entry.icon} />
                                {entry.source === 'custom' ? (
                                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                    <select
                                      value={entry.source}
                                      onChange={(event) => {
                                        const key = event.target.value as AbilityPresetKey | 'custom';
                                        if (key === 'custom') return;
                                        const presetEntry = fighter.combat?.[key];
                                        if (!presetEntry) return;
                                        const nextLevel = getEffectiveSkillLevel(
                                          fighter.state.skillLevel,
                                          fighter.state.emblems,
                                          key
                                        );
                                        const part = parsePrimarySkillPart(presetEntry, key, nextLevel);
                                        onUpdateRotation(fighter.state.slot, entry.id, {
                                          source: key,
                                          partId: part?.id,
                                          name: part?.label ?? presetEntry.name,
                                          icon: presetEntry.icon,
                                          motionValuePct: part?.mvPct ?? 0,
                                          hits: part?.hits ?? 1,
                                          damageType:
                                            part?.damageType ?? ABILITY_PRESET_MAP[key].damageType,
                                          scalingStat: part?.scalingStat ?? 'ATK',
                                        });
                                      }}
                                      aria-label={`Source for ${entry.name}`}
                                      className={cn(CONTROL_CLASS, 'w-[86px] shrink-0 px-1.5')}
                                    >
                                      <option value="custom">Custom</option>
                                      {ABILITY_PRESETS.filter(
                                        (preset) => fighter.combat?.[preset.key]
                                      ).map((preset) => (
                                        <option key={preset.key} value={preset.key}>
                                          {fighter.combat?.[preset.key]?.name} · {preset.shortTag}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      value={entry.name}
                                      onChange={(event) =>
                                        onUpdateRotation(fighter.state.slot, entry.id, {
                                          name: event.target.value,
                                        })
                                      }
                                      placeholder="Ability name"
                                      title={entry.name}
                                      className={cn(CONTROL_CLASS, 'min-w-0 flex-1 px-2')}
                                      aria-label="Custom ability name"
                                    />
                                  </div>
                                ) : (
                                  <div
                                    className={cn(
                                      'grid min-w-0 flex-1 gap-1.5',
                                      skillParts.length > 1
                                        ? 'grid-cols-1 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]'
                                        : 'grid-cols-1'
                                    )}
                                  >
                                    <select
                                      value={entry.source}
                                      title={skillTitle}
                                      onChange={(event) => {
                                        const key = event.target.value as AbilityPresetKey | 'custom';
                                        if (key === 'custom') {
                                          onUpdateRotation(fighter.state.slot, entry.id, {
                                            source: 'custom',
                                            partId: undefined,
                                            name: 'Custom ability',
                                            icon: undefined,
                                            damageType: 'Skill',
                                          });
                                          return;
                                        }
                                        const presetEntry = fighter.combat?.[key];
                                        if (!presetEntry) return;
                                        const nextLevel = getEffectiveSkillLevel(
                                          fighter.state.skillLevel,
                                          fighter.state.emblems,
                                          key
                                        );
                                        const part = parsePrimarySkillPart(presetEntry, key, nextLevel);
                                        onUpdateRotation(fighter.state.slot, entry.id, {
                                          source: key,
                                          partId: part?.id,
                                          name: part?.label ?? presetEntry.name,
                                          icon: presetEntry.icon,
                                          motionValuePct: part?.mvPct ?? 0,
                                          hits: part?.hits ?? 1,
                                          damageType:
                                            part?.damageType ?? ABILITY_PRESET_MAP[key].damageType,
                                          scalingStat: part?.scalingStat ?? 'ATK',
                                        });
                                      }}
                                      className={cn(CONTROL_CLASS, 'w-full min-w-0 truncate px-2')}
                                      aria-label={`Ability for ${charName}`}
                                    >
                                      {ABILITY_PRESETS.filter(
                                        (preset) => fighter.combat?.[preset.key]
                                      ).map((preset) => (
                                        <option key={preset.key} value={preset.key}>
                                          {fighter.combat?.[preset.key]?.name} · {preset.shortTag}
                                        </option>
                                      ))}
                                      {!skillEntry && (
                                        <option value={entry.source}>{entry.name}</option>
                                      )}
                                      <option value="custom">Custom ability</option>
                                    </select>

                                    {skillParts.length > 1 && (
                                      <select
                                        value={activePartId}
                                        title={
                                          activePart
                                            ? `${activePart.label} (${activePart.mvPct}%)`
                                            : entry.name
                                        }
                                        onChange={(event) => {
                                          const part = skillParts.find(
                                            (item) => item.id === event.target.value
                                          );
                                          if (!part) return;
                                          onUpdateRotation(fighter.state.slot, entry.id, {
                                            partId: part.id,
                                            name: part.label,
                                            motionValuePct: part.mvPct,
                                            hits: part.hits,
                                            damageType: part.damageType,
                                            scalingStat: part.scalingStat,
                                          });
                                        }}
                                        className={cn(
                                          CONTROL_CLASS,
                                          'w-full min-w-0 truncate px-2 font-medium text-slate-700'
                                        )}
                                        aria-label={`Part for ${skillTitle}`}
                                      >
                                        {skillParts.map((part) => (
                                          <option key={part.id} value={part.id}>
                                            {formatPartOptionLabel(skillTitle, part)}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* 2–6. Tuning controls (Type, MV%, Hits, Casts, Scaling) — balanced 2-row 6-col grid on mobile, 5-col on sm, direct grid columns on lg */}
                              <div className="grid grid-cols-6 gap-2 sm:grid-cols-5 lg:contents">
                                {/* Type */}
                                <div className="col-span-3 min-w-0 sm:col-span-1">
                                  <span className="mb-1 block text-[10px] font-semibold text-slate-600 dark:text-slate-400 lg:hidden">
                                    Type
                                  </span>
                                  <div className="relative">
                                    <span
                                      aria-hidden="true"
                                      className="pointer-events-none absolute left-2.5 top-1/2 size-2 -translate-y-1/2 rounded-full"
                                      style={{ backgroundColor: DAMAGE_TYPE_HEX[entry.damageType] }}
                                    />
                                    <select
                                      value={entry.damageType}
                                      onChange={(event) =>
                                        onUpdateRotation(fighter.state.slot, entry.id, {
                                          damageType: event.target.value as DamageType,
                                        })
                                      }
                                      className={cn(CONTROL_CLASS, 'w-full pl-6 pr-1.5')}
                                      aria-label={`${entry.name} damage type`}
                                    >
                                      {DAMAGE_TYPES.map((type) => (
                                        <option key={type} value={type}>
                                          {type}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {/* Multiplier */}
                                <div className="col-span-3 min-w-0 sm:col-span-1">
                                  <span className="mb-1 block text-[10px] font-semibold text-slate-600 dark:text-slate-400 lg:hidden">
                                    Multiplier
                                  </span>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.1"
                                      value={entry.motionValuePct}
                                      onChange={(event) =>
                                        onUpdateRotation(fighter.state.slot, entry.id, {
                                          motionValuePct: Math.max(0, Number(event.target.value) || 0),
                                        })
                                      }
                                      className={cn(
                                        CONTROL_CLASS,
                                        'no-spinner w-full pl-2 pr-5 text-right font-bold tabular-nums'
                                      )}
                                      aria-label={`${entry.name} multiplier percent`}
                                    />
                                    <span
                                      aria-hidden="true"
                                      className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-slate-600 dark:text-slate-400"
                                    >
                                      %
                                    </span>
                                  </div>
                                </div>

                                {/* Hits */}
                                <div className="col-span-2 min-w-0 sm:col-span-1">
                                  <span className="mb-1 block text-[10px] font-semibold text-slate-600 dark:text-slate-400 lg:hidden">
                                    Hits
                                  </span>
                                  <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    value={entry.hits}
                                    onChange={(event) =>
                                      onUpdateRotation(fighter.state.slot, entry.id, {
                                        hits: Math.max(1, Math.floor(Number(event.target.value) || 1)),
                                      })
                                    }
                                    className={cn(
                                      CONTROL_CLASS,
                                      'no-spinner w-full px-2 text-right font-bold tabular-nums'
                                    )}
                                    aria-label={`${entry.name} hits`}
                                  />
                                </div>

                                {/* Casts stepper */}
                                <div className="col-span-2 min-w-0 sm:col-span-1">
                                  <span className="mb-1 block text-[10px] font-semibold text-slate-600 dark:text-slate-400 lg:hidden">
                                    Casts
                                  </span>
                                  <div className="flex h-8 w-full items-center overflow-hidden rounded-md border border-border bg-surface-card focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-500/35 dark:bg-base">
                                    <button
                                      type="button"
                                      onClick={() => stepCasts(-1)}
                                      disabled={entry.casts <= 0}
                                      aria-label={`Decrease casts for ${entry.name}`}
                                      className="press-feedback grid h-full w-6 shrink-0 place-items-center text-slate-600 transition-colors hover:bg-surface-subtle hover:text-slate-900 disabled:opacity-35 dark:text-slate-400 dark:hover:text-white"
                                    >
                                      <Minus className="size-3" aria-hidden="true" />
                                    </button>
                                    <input
                                      type="number"
                                      min={0}
                                      step="0.1"
                                      value={entry.casts}
                                      onChange={(event) =>
                                        onUpdateRotation(fighter.state.slot, entry.id, {
                                          casts: Math.max(0, Number(event.target.value) || 0),
                                        })
                                      }
                                      className="no-spinner h-full min-w-0 flex-1 bg-transparent text-center text-xs font-bold tabular-nums text-slate-800 focus:outline-none dark:text-white"
                                      aria-label={`${entry.name} casts`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => stepCasts(1)}
                                      aria-label={`Increase casts for ${entry.name}`}
                                      className="press-feedback grid h-full w-6 shrink-0 place-items-center text-slate-600 transition-colors hover:bg-surface-subtle hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                                    >
                                      <Plus className="size-3" aria-hidden="true" />
                                    </button>
                                  </div>
                                </div>

                                {/* Scaling */}
                                <div className="col-span-2 min-w-0 sm:col-span-1">
                                  <span className="mb-1 block text-[10px] font-semibold text-slate-600 dark:text-slate-400 lg:hidden">
                                    Scaling
                                  </span>
                                  <select
                                    value={entry.scalingStat ?? 'ATK'}
                                    onChange={(event) =>
                                      onUpdateRotation(fighter.state.slot, entry.id, {
                                        scalingStat: event.target.value as 'ATK' | 'HP' | 'DEF',
                                      })
                                    }
                                    className={cn(CONTROL_CLASS, 'w-full px-2')}
                                    aria-label={`${entry.name} scaling stat`}
                                  >
                                    <option value="ATK">ATK</option>
                                    <option value="HP">HP</option>
                                    <option value="DEF">DEF</option>
                                  </select>
                                </div>
                              </div>

                              {/* 7 & 8. Expected DMG readout + Row actions */}
                              <div className="flex items-center justify-between gap-2 border-t border-border-subtle/50 pt-2 lg:contents lg:border-t-0 lg:pt-0">
                                <div
                                  className={cn(
                                    'min-w-0 text-left transition-opacity duration-150 lg:text-right',
                                    isInactive && 'opacity-45'
                                  )}
                                  title={`Crit avg: ${formatNumber(damage.expectedDamage)} · No crit: ${formatNumber(damage.nonCritDamage)} · Full crit: ${formatNumber(damage.critDamage)}`}
                                >
                                  <div className="text-[13px] font-bold leading-tight tabular-nums text-amber-700">
                                    {formatNumber(damage.expectedDamage)}
                                  </div>
                                  <div className="mt-0.5 text-[11px] leading-tight tabular-nums text-slate-600 dark:text-slate-400">
                                    {formatCompact(damage.nonCritDamage)} –{' '}
                                    {formatCompact(damage.critDamage)}
                                  </div>
                                  <div
                                    aria-hidden="true"
                                    className="mt-1 hidden h-[2px] w-full overflow-hidden rounded-full bg-amber-500/15 lg:block"
                                  >
                                    <div
                                      className="h-full w-full origin-right rounded-full bg-amber-500/70 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
                                      style={{ transform: `scaleX(${rowShare.toFixed(4)})` }}
                                    />
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleNote(entry.id, hasNoteText)}
                                    aria-expanded={noteVisible}
                                    aria-label={
                                      noteVisible
                                        ? `Hide note for ${entry.name}`
                                        : `Add or view note for ${entry.name}`
                                    }
                                    title={hasNoteText ? entry.note : 'Add note'}
                                    className={cn(
                                      'press-feedback relative inline-flex size-7 items-center justify-center rounded-md transition-colors',
                                      FOCUS_RING,
                                      noteVisible || hasNoteText
                                        ? 'bg-teal-500/12 text-teal-700'
                                        : 'text-slate-600 hover:bg-surface-subtle hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                    )}
                                  >
                                    <StickyNote className="size-3.5" aria-hidden="true" />
                                    {hasNoteText && (
                                      <span
                                        aria-hidden="true"
                                        className="absolute right-1 top-1 size-1.5 rounded-full bg-teal-500"
                                      />
                                    )}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => onRemoveRotation(fighter.state.slot, entry.id)}
                                    aria-label={`Remove ${entry.name}`}
                                    title={`Remove ${entry.name}`}
                                    className={cn(
                                      'press-feedback inline-flex size-7 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-rose-500/12 hover:text-rose-700 dark:text-slate-400',
                                      FOCUS_RING
                                    )}
                                  >
                                    <X className="size-3.5" aria-hidden="true" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Collapsible inline note strip */}
                            {noteVisible && (
                              <div className="note-reveal mt-2 flex items-center gap-2 pl-9">
                                <span className="shrink-0 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                  Note
                                </span>
                                <input
                                  value={entry.note ?? ''}
                                  onChange={(event) =>
                                    onUpdateRotation(fighter.state.slot, entry.id, {
                                      note: event.target.value,
                                    })
                                  }
                                  placeholder="Buff window, cancel timing, or reminder…"
                                  className="h-7 min-w-0 flex-1 rounded-md border border-border-subtle bg-surface-subtle px-2.5 text-xs text-slate-800 placeholder:text-slate-600 focus:border-teal-500 focus:bg-surface-card focus:outline-none focus:ring-2 focus:ring-teal-500/35 dark:text-white dark:placeholder:text-slate-400"
                                  aria-label={`${entry.name} note`}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
