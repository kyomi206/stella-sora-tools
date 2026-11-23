'use client';

import { useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  Minus,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  buildDefaultRotationEntriesForSlot,
  deriveProfileFromRotation,
  hasActiveRotationEntries,
  sanitizeBuildRotation,
  type BuildRotation,
  type BuildRotationEntry,
} from '@/lib/calculator/build-rotation';
import type { DamageType } from '@/lib/calculator/damage-engine';
import type { DiscRankingContext } from '@/lib/calculator/disc-rankings-client';
import type { SlotKey } from '@/lib/calculator/fighter-calc';
import { cn } from '@/lib/utils';

export interface RotationEditorPanelProps {
  discRankingContext: DiscRankingContext;
  activeRotation: BuildRotation | null;
  rotationOrigin: 'auto' | 'preset' | 'local';
  canEdit: boolean;
  onRotationChange?: (next: BuildRotation | null) => void;
  onSaveAndCustomize?: () => void;
}

const SLOT_LABELS: Record<SlotKey, string> = {
  vanguard: 'Vanguard',
  versatile: 'Versatile',
  support: 'Support',
};

const SLOT_ORDER: readonly SlotKey[] = ['vanguard', 'versatile', 'support'];

const CUSTOM_DAMAGE_TYPES: readonly DamageType[] = [
  'Skill',
  'Ultimate',
  'Auto Attack',
  'Mark',
  'Minion',
];

export function RotationEditorPanel({
  discRankingContext,
  activeRotation,
  rotationOrigin,
  canEdit,
  onRotationChange,
  onSaveAndCustomize,
}: RotationEditorPanelProps) {
  const isCustomActive = hasActiveRotationEntries(activeRotation);
  const [expanded, setExpanded] = useState<boolean>(canEdit && isCustomActive);
  const [selectedAddBySlot, setSelectedAddBySlot] = useState<Partial<Record<SlotKey, string>>>({});
  const [copiedJson, setCopiedJson] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  const buildStarterRotation = (): BuildRotation => {
    const slots: BuildRotation['slots'] = {};
    for (const slot of SLOT_ORDER) {
      const rosterEntry = discRankingContext.roster.find((r) => r.slot === slot);
      if (!rosterEntry?.character) continue;
      const options = discRankingContext.parsedSkillsBySlot?.[slot] ?? [];
      const starter = buildDefaultRotationEntriesForSlot(slot, options);
      if (starter.length > 0) {
        slots[slot] = starter;
      }
    }
    return { version: 1, label: 'Custom Rotation', slots };
  };

  const commitRotation = (next: BuildRotation | null) => {
    if (!onRotationChange) return;
    if (!next) {
      onRotationChange(null);
      return;
    }
    const clean = sanitizeBuildRotation(next);
    onRotationChange(clean ?? null);
  };

  const handleToggleMode = (mode: 'auto' | 'custom') => {
    if (!canEdit) return;
    if (mode === 'auto') {
      commitRotation(null);
      return;
    }
    if (isCustomActive && activeRotation) return;
    commitRotation(buildStarterRotation());
    setExpanded(true);
  };

  const handleUpdateEntry = (
    slot: SlotKey,
    entryId: string,
    patch: Partial<BuildRotationEntry>
  ) => {
    if (!activeRotation || !canEdit) return;
    const nextSlots: BuildRotation['slots'] = { ...activeRotation.slots };
    nextSlots[slot] = (nextSlots[slot] ?? []).map((e) => {
      if (e.id !== entryId) return e;
      return {
        ...e,
        ...patch,
        casts:
          patch.casts !== undefined
            ? Math.max(0, Math.min(999, Math.round(patch.casts)))
            : e.casts,
        hits:
          patch.hits !== undefined
            ? Math.max(1, Math.min(99, Math.round(patch.hits)))
            : e.hits,
        motionValuePct:
          patch.motionValuePct !== undefined
            ? Math.max(1, Math.min(100000, patch.motionValuePct))
            : e.motionValuePct,
      };
    });
    commitRotation({ ...activeRotation, slots: nextSlots });
  };

  const handleRemoveEntry = (slot: SlotKey, entryId: string) => {
    if (!activeRotation || !canEdit) return;
    const nextSlots: BuildRotation['slots'] = { ...activeRotation.slots };
    const remaining = (nextSlots[slot] ?? []).filter((e) => e.id !== entryId);
    if (remaining.length > 0) {
      nextSlots[slot] = remaining;
    } else {
      delete nextSlots[slot];
    }
    commitRotation({ ...activeRotation, slots: nextSlots });
  };

  const handleAddSkill = (slot: SlotKey) => {
    if (!canEdit) return;
    const options = discRankingContext.parsedSkillsBySlot?.[slot] ?? [];
    if (options.length === 0) return;
    const currentList = activeRotation?.slots[slot] ?? [];
    const chosenId =
      selectedAddBySlot[slot] ||
      options.find((o) => !currentList.some((e) => e.id === o.id))?.id ||
      options[0].id;
    const opt = options.find((o) => o.id === chosenId) ?? options[0];
    const newEntry: BuildRotationEntry = {
      id: `${opt.id}-${Date.now().toString(36).slice(-4)}`,
      source: opt.source,
      name: opt.partLabel ? `${opt.name} (${opt.partLabel})` : opt.name,
      damageType: opt.damageType,
      scalingStat: opt.scalingStat,
      motionValuePct: opt.motionValuePct,
      hits: opt.hits,
      casts: 1,
    };
    const baseRotation: BuildRotation = activeRotation ?? buildStarterRotation();
    const nextSlots: BuildRotation['slots'] = {
      ...baseRotation.slots,
      [slot]: [...(baseRotation.slots[slot] ?? []), newEntry],
    };
    commitRotation({ ...baseRotation, slots: nextSlots });
  };

  const handleAddCustomHit = (slot: SlotKey) => {
    if (!canEdit) return;
    const rosterEntry = discRankingContext.roster.find((r) => r.slot === slot);
    const scalingStat = rosterEntry?.combat?.scalingStat ?? 'ATK';
    const baseRotation: BuildRotation = activeRotation ?? buildStarterRotation();
    const existing = baseRotation.slots[slot] ?? [];
    const customEntry: BuildRotationEntry = {
      id: `custom-${slot}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      source: 'custom',
      name: 'Custom Hit',
      damageType: 'Skill',
      scalingStat,
      motionValuePct: 100,
      hits: 1,
      casts: 1,
    };
    commitRotation({
      ...baseRotation,
      slots: {
        ...baseRotation.slots,
        [slot]: [...existing, customEntry],
      },
    });
    setExpanded(true);
  };

  const handleCopyJson = async () => {
    const payload = activeRotation ?? buildStarterRotation();
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopiedJson(true);
      window.setTimeout(() => setCopiedJson(false), 1600);
    } catch {
      // Ignore clipboard failures in restricted environments
    }
  };

  const handleApplyImportJson = () => {
    if (!canEdit) return;
    setImportError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setImportError('Invalid JSON syntax.');
      return;
    }
    const sanitized = sanitizeBuildRotation(parsed);
    if (!sanitized) {
      setImportError(
        'JSON must be a valid BuildRotation (version: 1) with at least one non-zero entry.'
      );
      return;
    }
    commitRotation(sanitized);
    setImportOpen(false);
    setImportText('');
    setExpanded(true);
  };

  const derivedPreview =
    isCustomActive && activeRotation
      ? deriveProfileFromRotation(activeRotation, discRankingContext.roster)
      : null;

  const totalCasts =
    isCustomActive && activeRotation
      ? SLOT_ORDER.reduce(
          (sum, slot) =>
            sum + (activeRotation.slots[slot] ?? []).reduce((s, e) => s + e.casts, 0),
          0
        )
      : 0;

  const originLabel =
    rotationOrigin === 'local' ? 'Local' : rotationOrigin === 'preset' ? 'Creator' : 'Auto';

  return (
    <div className="rounded-xl border border-border bg-surface-subtle/60 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded"
        >
          <span>
            {isCustomActive
              ? `Custom Rotation (${totalCasts} casts · ${originLabel})`
              : 'Rotation Model: Auto-Estimated'}
          </span>
          <ChevronDown
            className={cn(
              'size-3.5 text-slate-500 transition-transform duration-150',
              expanded && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopyJson}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-surface-card hover:bg-surface-hover text-[11px] font-semibold text-slate-700 dark:text-white/85 cursor-pointer"
          >
            {copiedJson ? (
              <>
                <Check className="size-3 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-700 dark:text-emerald-400">Copied JSON</span>
              </>
            ) : (
              <>
                <Copy className="size-3" aria-hidden="true" />
                <span>Copy Rotation JSON</span>
              </>
            )}
          </button>

          {canEdit ? (
            <div
              role="group"
              aria-label="Rotation mode"
              className="inline-flex items-center p-0.5 rounded-lg border border-border bg-surface-card"
            >
              <button
                type="button"
                aria-pressed={!isCustomActive}
                onClick={() => handleToggleMode('auto')}
                className={cn(
                  'px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer',
                  !isCustomActive
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-600 dark:text-white/75 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Auto-Estimated
              </button>
              <button
                type="button"
                aria-pressed={isCustomActive}
                onClick={() => handleToggleMode('custom')}
                className={cn(
                  'px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors cursor-pointer',
                  isCustomActive
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-600 dark:text-white/75 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Custom Rotation
              </button>
            </div>
          ) : (
            onSaveAndCustomize && (
              <button
                type="button"
                onClick={onSaveAndCustomize}
                className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                Save &amp; Customize Rotation
              </button>
            )
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border bg-surface-card/70 px-3.5 py-3 space-y-3">
          {!canEdit && (
            <p className="text-xs text-slate-600 dark:text-white/75">
              Public community builds are read-only. Save a local copy to customize skill cast
              counts and see every Disc, Potential, Emblem, and Talent table update live.
            </p>
          )}

          {canEdit && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {!isCustomActive ? (
                <div className="flex flex-wrap items-center gap-2 text-slate-600 dark:text-white/75">
                  <span>
                    Using signal-fused auto-profile from kit MVs, cooldowns, class priors, and
                    disc buffs.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleMode('custom')}
                    className="px-2.5 py-1 rounded-md border border-border bg-surface-subtle hover:bg-surface-hover font-semibold text-slate-800 dark:text-white cursor-pointer"
                  >
                    Enable Custom Rotation
                  </button>
                </div>
              ) : (
                derivedPreview && (
                  <span className="text-slate-700 dark:text-white/85">
                    Derived Carry:{' '}
                    <strong className="font-bold text-slate-900 dark:text-white">
                      {SLOT_LABELS[derivedPreview.carrySlot]}
                    </strong>{' '}
                    ({derivedPreview.slots[derivedPreview.carrySlot]?.[0]?.type ?? 'Skill'})
                  </span>
                )
              )}

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  aria-expanded={importOpen}
                  onClick={() => {
                    setImportOpen((v) => !v);
                    setImportError(null);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-surface-subtle hover:bg-surface-hover text-[11px] font-semibold text-slate-700 dark:text-white/85 cursor-pointer"
                >
                  <Upload className="size-3" aria-hidden="true" />
                  <span>Import Rotation JSON</span>
                </button>
                {isCustomActive && (
                  <>
                    <button
                      type="button"
                      onClick={() => commitRotation(buildStarterRotation())}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-surface-subtle hover:bg-surface-hover text-[11px] font-semibold text-slate-700 dark:text-white/85 cursor-pointer"
                    >
                      <RotateCcw className="size-3" aria-hidden="true" />
                      <span>Reset to Starter</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => commitRotation(null)}
                      className="px-2 py-1 rounded-md border border-border bg-surface-subtle hover:bg-surface-hover text-[11px] font-semibold text-slate-700 dark:text-white/85 cursor-pointer"
                    >
                      Clear to Auto
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {canEdit && importOpen && (
            <div className="rounded-lg border border-border bg-surface-subtle/80 p-3 space-y-2">
              <label
                htmlFor="import-rotation-json-input"
                className="block text-[11px] font-bold text-slate-800 dark:text-white"
              >
                Paste BuildRotation JSON (version 1)
              </label>
              <textarea
                id="import-rotation-json-input"
                rows={4}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{"version":1,"slots":{"vanguard":[...]}}'
                className="w-full rounded-md border border-border bg-surface-card p-2 font-mono text-[11px] text-slate-900 dark:text-white"
              />
              {importError && (
                <p role="alert" className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  {importError}
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyImportJson}
                  className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-[11px] font-bold text-slate-950 cursor-pointer"
                >
                  Apply JSON
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportOpen(false);
                    setImportError(null);
                  }}
                  className="px-2.5 py-1 rounded-md border border-border bg-surface-card text-[11px] font-semibold text-slate-700 dark:text-white/85 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {isCustomActive && activeRotation && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {SLOT_ORDER.map((slot) => {
                const rosterEntry = discRankingContext.roster.find((r) => r.slot === slot);
                if (!rosterEntry?.character) return null;
                const entries = activeRotation.slots[slot] ?? [];
                const skillOptions = discRankingContext.parsedSkillsBySlot?.[slot] ?? [];

                return (
                  <div
                    key={slot}
                    className="rounded-lg border border-border bg-surface-card p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border-subtle pb-1.5">
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-500 dark:text-white/60">
                          {SLOT_LABELS[slot]}
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {rosterEntry.character.name.EN}
                        </div>
                      </div>
                      <span className="text-xs tabular-nums font-semibold text-slate-600 dark:text-white/75">
                        {entries.reduce((s, e) => s + e.casts, 0)} casts
                      </span>
                    </div>

                    {entries.length === 0 ? (
                      <div className="text-xs text-slate-500 dark:text-white/60 py-1">
                        No casts assigned.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-md border border-border-subtle bg-surface-subtle/60 px-2 py-1.5 text-xs space-y-1.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-slate-900 dark:text-white truncate">
                                  {entry.name}
                                </div>
                                <div className="text-[11px] tabular-nums text-slate-600 dark:text-white/70">
                                  {entry.damageType} · {Math.round(entry.motionValuePct)}%{' '}
                                  {entry.scalingStat} × {entry.hits}
                                </div>
                              </div>

                              {canEdit ? (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    aria-label={`Decrease casts for ${entry.name}`}
                                    onClick={() =>
                                      handleUpdateEntry(slot, entry.id, {
                                        casts: entry.casts - 1,
                                      })
                                    }
                                    className="size-6 rounded border border-border bg-surface-card hover:bg-surface-hover flex items-center justify-center cursor-pointer"
                                  >
                                    <Minus className="size-3" />
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    max={999}
                                    aria-label={`Casts for ${entry.name}`}
                                    value={entry.casts}
                                    onChange={(e) =>
                                      handleUpdateEntry(slot, entry.id, {
                                        casts: Number(e.target.value || 0),
                                      })
                                    }
                                    className="w-11 h-6 text-center tabular-nums font-bold rounded border border-border bg-surface-card text-slate-900 dark:text-white"
                                  />
                                  <button
                                    type="button"
                                    aria-label={`Increase casts for ${entry.name}`}
                                    onClick={() =>
                                      handleUpdateEntry(slot, entry.id, {
                                        casts: entry.casts + 1,
                                      })
                                    }
                                    className="size-6 rounded border border-border bg-surface-card hover:bg-surface-hover flex items-center justify-center cursor-pointer"
                                  >
                                    <Plus className="size-3" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label={`Remove ${entry.name}`}
                                    onClick={() => handleRemoveEntry(slot, entry.id)}
                                    className="size-6 rounded border border-border bg-surface-card hover:bg-rose-500/15 text-slate-500 hover:text-rose-600 flex items-center justify-center cursor-pointer"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </div>
                              ) : (
                                <span className="tabular-nums font-bold text-slate-800 dark:text-white">
                                  ×{entry.casts}
                                </span>
                              )}
                            </div>

                            {canEdit && entry.source === 'custom' && (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border-subtle/70 text-[11px]">
                                <select
                                  aria-label={`Damage type for ${entry.name}`}
                                  value={entry.damageType}
                                  onChange={(e) =>
                                    handleUpdateEntry(slot, entry.id, {
                                      damageType: e.target.value as DamageType,
                                    })
                                  }
                                  className="h-6 rounded border border-border bg-surface-card px-1 text-[11px] text-slate-900 dark:text-white"
                                >
                                  {CUSTOM_DAMAGE_TYPES.map((dt) => (
                                    <option key={dt} value={dt}>
                                      {dt}
                                    </option>
                                  ))}
                                </select>
                                <label className="inline-flex items-center gap-1 text-slate-600 dark:text-white/75">
                                  <span>MV%</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={100000}
                                    aria-label={`MV percent for ${entry.name}`}
                                    value={entry.motionValuePct}
                                    onChange={(e) =>
                                      handleUpdateEntry(slot, entry.id, {
                                        motionValuePct: Number(e.target.value || 1),
                                      })
                                    }
                                    className="w-14 h-6 text-center tabular-nums rounded border border-border bg-surface-card text-slate-900 dark:text-white"
                                  />
                                </label>
                                <label className="inline-flex items-center gap-1 text-slate-600 dark:text-white/75">
                                  <span>Hits</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={99}
                                    aria-label={`Hits for ${entry.name}`}
                                    value={entry.hits}
                                    onChange={(e) =>
                                      handleUpdateEntry(slot, entry.id, {
                                        hits: Number(e.target.value || 1),
                                      })
                                    }
                                    className="w-10 h-6 text-center tabular-nums rounded border border-border bg-surface-card text-slate-900 dark:text-white"
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {canEdit && (
                      <div className="space-y-1.5 pt-1">
                        {skillOptions.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <select
                              aria-label={`Add skill to ${SLOT_LABELS[slot]}`}
                              value={selectedAddBySlot[slot] ?? skillOptions[0].id}
                              onChange={(e) =>
                                setSelectedAddBySlot((prev) => ({
                                  ...prev,
                                  [slot]: e.target.value,
                                }))
                              }
                              className="flex-1 min-w-0 h-7 rounded-md border border-border bg-surface-subtle px-2 text-[11px] text-slate-900 dark:text-white"
                            >
                              {skillOptions.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                  {opt.partLabel ? `${opt.name} (${opt.partLabel})` : opt.name} —{' '}
                                  {Math.round(opt.motionValuePct)}%
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleAddSkill(slot)}
                              className="h-7 px-2 rounded-md border border-border bg-surface-subtle hover:bg-surface-hover text-[11px] font-bold text-slate-800 dark:text-white shrink-0 cursor-pointer"
                            >
                              + Add
                            </button>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => handleAddCustomHit(slot)}
                          className="w-full h-6 rounded-md border border-dashed border-border bg-surface-subtle/50 hover:bg-surface-hover text-[11px] font-semibold text-slate-700 dark:text-white/85 cursor-pointer"
                        >
                          + Custom Hit
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
