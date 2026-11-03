'use client';

import { useState } from 'react';
import {
  AdvancedTeamBuild,
  NoteName,
  SSDisc,
  SelectedMainDisc,
  SelectedSupportDisc,
} from '@/types';
import {
  MUSICAL_NOTES,
  NOTE_BY_NAME,
  getDiscOutfitIconUrl,
  getDiscSkillIconUrl,
  getNoteIconUrl,
  formatDiscSkillDesc,
  calculateSupportStartingNotes,
  calculateRequiredHarmonyNotes,
  getHarmonyActivationLevel,
} from '@/data/notes';
import { DiscSlotRef } from './disc-picker-modal';
import { Disc, Plus, Minus, Trash2, Sparkles, RotateCcw, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiscsAndNotesSectionProps {
  build: AdvancedTeamBuild;
  discs: Record<string, SSDisc>;
  onOpenDiscPicker: (slot: DiscSlotRef) => void;
  onUpdateMainDisc: (index: 0 | 1 | 2, patch: Partial<SelectedMainDisc>) => void;
  onUpdateSupportDisc: (index: 0 | 1 | 2, patch: Partial<SelectedSupportDisc>) => void;
  onUpdateNoteCount: (noteName: NoteName, count: number) => void;
  onAutoFillHarmonyNotes: (harmonyTier: number) => void;
  onResetNotesToSupport: () => void;
}

const PHASE_LABELS = [
  'Lv 1',
  'Lv 10+',
  'Lv 20+',
  'Lv 30+',
  'Lv 40+',
  'Lv 50+',
  'Lv 60+',
  'Lv 70+',
  'Lv 80+',
];

interface DiscSkillBubbleProps {
  disc: SSDisc;
  kind: 'main' | 'support';
  crescendo: number;
  effectiveNotes: Partial<Record<NoteName, number>>;
  startingNotes: Record<string, number>;
  phaseLabel?: string;
}

/**
 * Compact speech-bubble that replaced the tall skill listing under each disc.
 * Opens on hover, or on click / keyboard for touch and assistive tech.
 */
function DiscSkillBubble({
  disc,
  kind,
  crescendo,
  effectiveNotes,
  startingNotes,
  phaseLabel,
}: DiscSkillBubbleProps) {
  const [open, setOpen] = useState(false);

  const harmony1Lv = kind === 'main' ? getHarmonyActivationLevel(disc.secondarySkill1, effectiveNotes) : 0;
  const harmony2Lv = kind === 'main' ? getHarmonyActivationLevel(disc.secondarySkill2, effectiveNotes) : 0;

  return (
    <div
      className="group/disc relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
        }}
        aria-expanded={open}
        aria-label={`${
          kind === 'main' ? 'Show Melody & Harmony skills for' : 'Show starting notes for'
        } ${disc.name}`}
        title={kind === 'main' ? 'Show Melody & Harmony skills' : 'Show starting notes'}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer',
          open
            ? 'border-border bg-surface-elevated text-slate-900 dark:text-white'
            : 'border-border bg-surface-card text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white hover:border-slate-400'
        )}
      >
        {kind === 'main' ? <Sparkles className="size-3" /> : <Info className="size-3" />}
        <span>{kind === 'main' ? 'Skills' : 'Notes'}</span>
      </button>

      <div
        role="tooltip"
        className={cn(
          'absolute left-0 top-full z-50 w-80 max-w-[calc(100vw-2rem)] pt-2 transition-[opacity,transform] duration-150',
          'invisible opacity-0 scale-95 origin-top-left pointer-events-none',
          'group-hover/disc:visible group-hover/disc:opacity-100 group-hover/disc:scale-100 group-hover/disc:pointer-events-auto',
          open && 'visible opacity-100 scale-100 pointer-events-auto'
        )}
      >
        <div className="relative">
          {/* Bubble tail stays outside the scrollable card so it is never clipped */}
          <div className="pointer-events-none absolute bottom-full left-[63px] size-0 border-x-[6px] border-b-[6px] border-x-transparent border-b-border" />
          <div className="pointer-events-none absolute bottom-full left-16 size-0 border-x-[5px] border-b-[5px] border-x-transparent border-b-surface-card" />

          <div className="scrollbar-thin max-h-[19rem] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface-card p-2.5 text-left shadow-2xl">

          <div className="mb-2 flex items-center gap-1.5">
            <img
              src={getDiscOutfitIconUrl(disc.id, 'full')}
              alt=""
              className="size-6 shrink-0 rounded border border-border object-cover"
            />
            <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-900 dark:text-white">
              {disc.name}
            </span>
            <span className="shrink-0 rounded bg-surface-subtle px-1 text-[11px] font-bold text-slate-700 dark:text-white/80">
              {disc.star}★
            </span>
          </div>

          {kind === 'main' ? (
            <div className="space-y-1.5">
              {disc.mainSkill && (
                <div className="rounded-lg border border-border bg-surface-subtle p-1.5">
                  <div className="mb-0.5 flex items-center gap-1 font-semibold text-slate-900 dark:text-white">
                    <img
                      src={getDiscSkillIconUrl(disc.mainSkill.icon)}
                      alt=""
                      className="size-3.5 shrink-0 object-contain"
                    />
                    <span className="min-w-0 flex-1 truncate text-[11px]">
                      Melody • {disc.mainSkill.name}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-slate-500 dark:text-white/60">C{crescendo}/6</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-white/90">
                    {formatDiscSkillDesc(
                      disc.mainSkill.desc,
                      disc.mainSkill.params,
                      crescendo
                    )}
                  </p>
                </div>
              )}

              {[
                { skill: disc.secondarySkill1, activeLv: harmony1Lv, idxLabel: 'Harmony 1' },
                { skill: disc.secondarySkill2, activeLv: harmony2Lv, idxLabel: 'Harmony 2' },
              ].map(({ skill, activeLv, idxLabel }) => {
                if (!skill) return null;
                const nextTierIdx = Math.min(
                  (skill.requirements?.length || 1) - 1,
                  Math.max(0, activeLv)
                );
                const reqObj = skill.requirements?.[nextTierIdx] || {};

                return (
                  <div
                    key={skill.id}
                    className={cn(
                      'rounded-lg border p-1.5 transition-colors',
                      activeLv > 0
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'bg-surface-subtle border-border'
                    )}
                  >
                    <div className="mb-0.5 flex items-center gap-1 font-semibold">
                      <img
                        src={getDiscSkillIconUrl(skill.icon)}
                        alt=""
                        className="size-3.5 shrink-0 object-contain"
                      />
                      <span
                        className={cn(
                          'min-w-0 flex-1 truncate text-[11px]',
                          activeLv > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-white'
                        )}
                      >
                        {idxLabel} • {skill.name}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded px-1 text-[11px] font-mono font-bold',
                          activeLv > 0
                            ? 'bg-emerald-500 text-slate-950'
                            : 'border border-border bg-surface-card text-slate-600 dark:text-white/80'
                        )}
                      >
                        {activeLv > 0 ? `Lv ${activeLv}/5` : '0/5'}
                      </span>
                    </div>

                    <p className="mb-1 text-[11px] leading-relaxed text-slate-600 dark:text-white/90">
                      {formatDiscSkillDesc(skill.desc, skill.params, Math.max(1, activeLv))}
                    </p>

                    <div className="flex flex-wrap items-center gap-1">
                      {Object.entries(reqObj).map(([noteName, reqVal]) => {
                        const meta = NOTE_BY_NAME[noteName as NoteName];
                        const currentCount = effectiveNotes[noteName as NoteName] || 0;
                        const met = currentCount >= reqVal;
                        return (
                          <span
                            key={noteName}
                            className={cn(
                              'inline-flex items-center gap-0.5 rounded border px-1 py-px text-[11px] font-mono',
                              met
                                ? 'border-emerald-500/40 bg-emerald-500/15 font-bold text-emerald-700 dark:text-emerald-300'
                                : 'border-border bg-surface-card text-slate-600 dark:text-white/80'
                            )}
                          >
                            {meta && (
                              <img
                                src={getNoteIconUrl(meta.id)}
                                alt=""
                                className="size-3 object-contain"
                              />
                            )}
                            <span>
                              {meta?.shortName || noteName}: {currentCount}/{reqVal}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-800 dark:text-white">
                Starting Notes • {phaseLabel}
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {Object.entries(startingNotes).length === 0 && (
                  <span className="text-[11px] text-slate-600 dark:text-white/70">No notes at this phase.</span>
                )}
                {Object.entries(startingNotes).map(([noteName, count]) => {
                  const meta = NOTE_BY_NAME[noteName as NoteName];
                  return (
                    <span
                      key={noteName}
                      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface-elevated px-1.5 py-0.5 text-[11px] font-mono font-semibold text-slate-800 dark:text-white"
                    >
                      {meta && (
                        <img
                          src={getNoteIconUrl(meta.id)}
                          alt=""
                          className="size-3 object-contain"
                        />
                      )}
                      <span>
                        {meta?.shortName || noteName} +{count}
                      </span>
                    </span>
                  );
                })}
              </div>
              <p className="border-t border-border pt-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-white/80">
                Support Discs supply starting Musical Notes and base stats. Their Melody &amp;
                Harmony skills stay inactive in battle.
              </p>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface EmptyDiscSlotProps {
  kind: 'main' | 'support';
  index: 0 | 1 | 2;
  onOpen: () => void;
}

function EmptyDiscSlot({ kind, index, onOpen }: EmptyDiscSlotProps) {
  const isMain = kind === 'main';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-[104px] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-surface-subtle/60 p-2 transition-colors cursor-pointer group hover:bg-surface-elevated hover:border-slate-400"
      title={`Equip ${isMain ? 'Main' : 'Support'} Disc #${index + 1}`}
    >
      <span className="flex size-6 items-center justify-center rounded-full border border-border bg-surface-card transition-colors group-hover:border-slate-400">
        <Plus className="size-3.5 text-slate-600 dark:text-white/80 group-hover:text-slate-900 dark:group-hover:text-white" />
      </span>
      <span className="text-[11px] font-semibold text-slate-900 dark:text-white">
        Equip {isMain ? 'Main' : 'Support'} #{index + 1}
      </span>
    </button>
  );
}

interface DiscTileFrameProps {
  disc: SSDisc;
  children?: React.ReactNode;
  bubble?: React.ReactNode;
  controls: React.ReactNode;
  onOpen: () => void;
  onRemove: () => void;
  removeLabel: string;
  accent?: 'amber' | 'indigo';
  title: string;
}

/** Shared compact tile: clean square artwork on the left, name/actions and controls on the right. */
function DiscTileFrame({
  disc,
  children,
  bubble,
  controls,
  onOpen,
  onRemove,
  removeLabel,
  title,
}: DiscTileFrameProps) {
  return (
    <div className="flex gap-2 rounded-lg border border-border bg-surface-subtle p-2">
      {/* Square disc artwork: clean without overlay dropdowns */}
      <div className="relative size-20 shrink-0 overflow-hidden rounded-md border border-border bg-base sm:size-24">
        <button
          type="button"
          onClick={onOpen}
          className="absolute inset-0 cursor-pointer"
          title={title}
          aria-label={title}
        >
          <img
            src={getDiscOutfitIconUrl(disc.id, 'full')}
            alt={disc.name}
            className="size-full object-cover"
          />
        </button>

        {disc.element !== 'None' && (
          <img
            src={`/ss-element/${disc.element}.webp`}
            alt={disc.element}
            className="pointer-events-none absolute left-1 top-1 size-4 drop-shadow"
          />
        )}

        <span className="pointer-events-none absolute left-1 bottom-1 rounded bg-black/80 px-1 text-[11px] font-bold leading-tight text-amber-400">
          {disc.star}★
        </span>
      </div>

      {/* Name, actions and controls */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        {/* Top: Disc Name + Trash button */}
        <div className="flex items-start justify-between gap-1.5">
          <button
            type="button"
            onClick={onOpen}
            className="line-clamp-2 text-left text-[11px] font-bold leading-tight text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer"
            title={disc.name}
          >
            {disc.name}
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeLabel}
            title={removeLabel}
            className="shrink-0 rounded p-1 text-slate-400 dark:text-white/60 hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>

        {/* Bottom: Left has status, Right stacks the Skills/Notes bubble above the dropboxes */}
        <div className="flex items-end justify-between gap-1.5 pt-1 flex-wrap sm:flex-nowrap">
          <div className="min-w-0 flex items-center gap-1.5">{children}</div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {bubble}
            <div className="flex items-center gap-1">{controls}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MainDiscTileProps {
  disc: SSDisc;
  index: 0 | 1 | 2;
  slot: SelectedMainDisc;
  effectiveNotes: Record<NoteName, number>;
  onOpen: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<SelectedMainDisc>) => void;
}

function MainDiscTile({
  disc,
  index,
  slot,
  effectiveNotes,
  onOpen,
  onRemove,
  onUpdate,
}: MainDiscTileProps) {
  const harmony1Lv = getHarmonyActivationLevel(disc.secondarySkill1, effectiveNotes);
  const harmony2Lv = getHarmonyActivationLevel(disc.secondarySkill2, effectiveNotes);

  return (
    <DiscTileFrame
      disc={disc}
      accent="amber"
      title={`Change Main Disc #${index + 1}`}
      removeLabel={`Remove Main Disc ${index + 1}`}
      onOpen={onOpen}
      onRemove={onRemove}
      controls={
        <>
          <select
            aria-label={`Main Disc ${index + 1} Crescendo`}
            title="Crescendo"
            value={slot.crescendo}
            onChange={(e) => onUpdate({ crescendo: Number(e.target.value) })}
            className="cursor-pointer rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[11px] font-bold font-mono text-slate-800 dark:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
          >
            {[1, 2, 3, 4, 5, 6].map((c) => (
              <option key={c} value={c} className="bg-surface-elevated text-slate-900 dark:text-white">
                C{c}
              </option>
            ))}
          </select>
          <select
            aria-label={`Main Disc ${index + 1} Level`}
            title="Disc Level"
            value={slot.level}
            onChange={(e) => onUpdate({ level: Number(e.target.value) as 1 | 80 | 90 })}
            className="cursor-pointer rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[11px] font-bold font-mono text-slate-800 dark:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
          >
            <option value={90} className="bg-surface-elevated text-slate-900 dark:text-white">
              Lv90
            </option>
            <option value={80} className="bg-surface-elevated text-slate-900 dark:text-white">
              Lv80
            </option>
            <option value={1} className="bg-surface-elevated text-slate-900 dark:text-white">
              Lv1
            </option>
          </select>
        </>
      }
      bubble={
        <DiscSkillBubble
          disc={disc}
          kind="main"
          crescendo={slot.crescendo}
          effectiveNotes={effectiveNotes}
          startingNotes={{}}
        />
      }
    >
      <span
        className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-600 dark:text-white/80"
        title={`Harmony skill levels (first / second, out of 5): ${harmony1Lv} / ${harmony2Lv}`}
      >
        <span
          className={cn(
            'size-1.5 rounded-full',
            harmony1Lv > 0 || harmony2Lv > 0 ? 'bg-emerald-500' : 'bg-slate-400'
          )}
        />
        H {harmony1Lv}/{harmony2Lv}
      </span>
    </DiscTileFrame>
  );
}

interface SupportDiscTileProps {
  disc: SSDisc;
  index: 0 | 1 | 2;
  slot: SelectedSupportDisc;
  startingNotes: Record<string, number>;
  onOpen: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<SelectedSupportDisc>) => void;
}

function SupportDiscTile({
  disc,
  index,
  slot,
  startingNotes,
  onOpen,
  onRemove,
  onUpdate,
}: SupportDiscTileProps) {
  const phaseIdx = Math.max(0, Math.min((disc.supportNote?.length || 1) - 1, slot.phase));

  return (
    <DiscTileFrame
      disc={disc}
      accent="indigo"
      title={`Change Support Disc #${index + 1}`}
      removeLabel={`Remove Support Disc ${index + 1}`}
      onOpen={onOpen}
      onRemove={onRemove}
      controls={
        <>
          <select
            aria-label={`Support Disc ${index + 1} Crescendo`}
            title="Crescendo (Increases ATK)"
            value={slot.crescendo ?? 1}
            onChange={(e) => onUpdate({ crescendo: Number(e.target.value) })}
            className="cursor-pointer rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[11px] font-bold font-mono text-slate-800 dark:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
          >
            {[1, 2, 3, 4, 5, 6].map((c) => (
              <option key={c} value={c} className="bg-surface-elevated text-slate-900 dark:text-white">
                C{c}
              </option>
            ))}
          </select>
          <select
            aria-label={`Support Disc ${index + 1} Promotion Phase`}
            title="Promotion Phase"
            value={slot.phase}
            onChange={(e) => onUpdate({ phase: Number(e.target.value) })}
            className="cursor-pointer rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[11px] font-bold font-mono text-slate-800 dark:text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400"
          >
            {PHASE_LABELS.map((lbl, pIdx) => (
              <option key={lbl} value={pIdx} className="bg-surface-elevated text-slate-900 dark:text-white">
                {lbl}
              </option>
            ))}
          </select>
        </>
      }
      bubble={
        <DiscSkillBubble
          disc={disc}
          kind="support"
          crescendo={slot.crescendo ?? 1}
          effectiveNotes={{}}
          startingNotes={startingNotes}
          phaseLabel={PHASE_LABELS[phaseIdx]}
        />
      }
    >
      <div className="flex items-center gap-1">
        {/* Starting notes, inline as tiny chips */}
        <div className="flex items-center gap-1">
          {Object.entries(startingNotes).slice(0, 1).map(([noteName, count]) => {
            const meta = NOTE_BY_NAME[noteName as NoteName];
            return (
              <span
                key={noteName}
                className="inline-flex items-center gap-0.5 rounded border border-border bg-surface-elevated px-1 py-0.5 text-[11px] font-mono font-semibold text-slate-800 dark:text-white"
                title={`${meta?.name || noteName} +${count}`}
              >
                {meta && (
                  <img
                    src={getNoteIconUrl(meta.id)}
                    alt=""
                    className="size-3 object-contain"
                  />
                )}
                +{count}
              </span>
            );
          })}
          {Object.keys(startingNotes).length > 1 && (
            <span className="text-[11px] font-mono text-slate-500 dark:text-white/70">
              +{Object.keys(startingNotes).length - 1}
            </span>
          )}
        </div>
      </div>
    </DiscTileFrame>
  );
}

export function DiscsAndNotesSection({
  build,
  discs,
  onOpenDiscPicker,
  onUpdateMainDisc,
  onUpdateSupportDisc,
  onUpdateNoteCount,
  onAutoFillHarmonyNotes,
  onResetNotesToSupport,
}: DiscsAndNotesSectionProps) {
  const supportStartingNotes = calculateSupportStartingNotes(build.supportDiscs, discs);
  const maxRequiredNotes = calculateRequiredHarmonyNotes(build.mainDiscs, discs, 5);

  // Effective total notes: user's targetNotes override, or at least the starting support notes
  const effectiveNotes: Record<NoteName, number> = Object.fromEntries(
    MUSICAL_NOTES.map((n) => {
      const start = supportStartingNotes[n.name] || 0;
      const custom = build.targetNotes[n.name];
      return [n.name, custom !== undefined ? Math.max(0, custom) : start];
    })
  ) as Record<NoteName, number>;

  return (
    <div className="grid w-full grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)] xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)]">
      {/* 1. Runic Discs Loadout — Main on the left, Support on the right */}
      <section className="flex flex-col justify-between space-y-3 rounded-xl border border-border bg-surface-card p-3 sm:p-4 h-full">
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <h2 className="truncate text-sm font-bold text-slate-900 dark:text-white sm:text-base">
            Runic Discs Loadout
          </h2>
          <span
            className="ml-auto shrink-0 text-[11px] text-slate-500 dark:text-white/60"
            title="Main Discs activate Melody & Harmony skills. Support Discs supply starting Musical Notes."
          >
            Main L • Support R
          </span>
        </div>

        <div className="grid grid-cols-2 items-start gap-2 sm:gap-3 flex-1">
          {/* Main Discs */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                Main Discs
              </span>
              <span className="text-[11px] text-slate-500 dark:text-white/60">3 slots</span>
            </div>

            <div className="flex flex-col gap-1.5">
              {([0, 1, 2] as const).map((idx) => {
                const slot = build.mainDiscs[idx];
                const disc = slot.discId ? discs[String(slot.discId)] : null;

                if (!disc) {
                  return (
                    <EmptyDiscSlot
                      key={`main-${idx}`}
                      kind="main"
                      index={idx}
                      onOpen={() => onOpenDiscPicker({ kind: 'main', index: idx })}
                    />
                  );
                }

                return (
                  <MainDiscTile
                    key={`main-${idx}`}
                    disc={disc}
                    index={idx}
                    slot={slot}
                    effectiveNotes={effectiveNotes}
                    onOpen={() => onOpenDiscPicker({ kind: 'main', index: idx })}
                    onRemove={() => onUpdateMainDisc(idx, { discId: null })}
                    onUpdate={(patch) => onUpdateMainDisc(idx, patch)}
                  />
                );
              })}
            </div>
          </div>

          {/* Support Discs */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                Support Discs
              </span>
              <span className="text-[11px] text-slate-500 dark:text-white/60">3 slots</span>
            </div>

            <div className="flex flex-col gap-1.5">
              {([0, 1, 2] as const).map((idx) => {
                const slot = build.supportDiscs[idx];
                const disc = slot.discId ? discs[String(slot.discId)] : null;

                if (!disc) {
                  return (
                    <EmptyDiscSlot
                      key={`support-${idx}`}
                      kind="support"
                      index={idx}
                      onOpen={() => onOpenDiscPicker({ kind: 'support', index: idx })}
                    />
                  );
                }

                const phaseIdx = Math.max(
                  0,
                  Math.min((disc.supportNote?.length || 1) - 1, slot.phase)
                );

                return (
                  <SupportDiscTile
                    key={`support-${idx}`}
                    disc={disc}
                    index={idx}
                    slot={slot}
                    startingNotes={disc.supportNote?.[phaseIdx] || {}}
                    onOpen={() => onOpenDiscPicker({ kind: 'support', index: idx })}
                    onRemove={() => onUpdateSupportDisc(idx, { discId: null })}
                    onUpdate={(patch) => onUpdateSupportDisc(idx, patch)}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Musical Notes Planner — compact name/icon matrix with note and number closer */}
      <section className="flex flex-col justify-between space-y-3 rounded-xl border border-border bg-surface-card p-3 sm:p-4 h-full">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-bold text-slate-900 dark:text-white sm:text-base">
              Musical Notes Planner
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onAutoFillHarmonyNotes(1)}
              className="inline-flex items-center gap-0.5 rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-white/80 transition-colors cursor-pointer hover:bg-border hover:text-slate-900 dark:hover:text-white"
              title="Auto-fill notes for Harmony Lv 1"
            >
              <span>Lv1</span>
            </button>
            <button
              type="button"
              onClick={() => onAutoFillHarmonyNotes(3)}
              className="inline-flex items-center gap-0.5 rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-white/80 transition-colors cursor-pointer hover:bg-border hover:text-slate-900 dark:hover:text-white"
              title="Auto-fill notes for Harmony Lv 3"
            >
              <span>Lv3</span>
            </button>
            <button
              type="button"
              onClick={() => onAutoFillHarmonyNotes(5)}
              className="inline-flex items-center gap-0.5 rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:text-white/80 transition-colors cursor-pointer hover:bg-border hover:text-slate-900 dark:hover:text-white"
              title="Auto-fill notes for max Harmony (Lv 5)"
            >
              <span>Max</span>
            </button>
            <button
              type="button"
              onClick={onResetNotesToSupport}
              className="inline-flex items-center gap-0.5 rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-white/80 transition-colors cursor-pointer hover:bg-border hover:text-slate-900 dark:hover:text-white"
              title="Reset all notes to Support Disc starting values"
              aria-label="Reset notes to Support Disc starting values"
            >
              <RotateCcw className="size-3" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 flex-1 content-between">
          {MUSICAL_NOTES.map((note) => {
            const startVal = supportStartingNotes[note.name] || 0;
            const reqMaxVal = maxRequiredNotes[note.name] || 0;
            const totalVal = effectiveNotes[note.name] || 0;
            const totalStatBonus = +(totalVal * note.perLevelPct).toFixed(2);
            const isMet = reqMaxVal > 0 && totalVal >= reqMaxVal;
            const isActive = totalVal > 0;

            return (
              <div
                key={note.id}
                className="group/note relative flex items-center justify-between gap-1.5 rounded-lg border border-border bg-surface-subtle px-2 py-1.5 transition-colors hover:border-slate-400"
              >
                {/* Hover Message Bubble for Note Description */}
                <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50 w-56 opacity-0 invisible group-hover/note:opacity-100 group-hover/note:visible transition-[opacity,transform] duration-150 transform scale-95 group-hover/note:scale-100">
                  <div className="relative rounded-xl border border-border bg-surface-elevated/95 p-2.5 shadow-xl backdrop-blur-md text-left select-none text-slate-900 dark:text-white">
                    <div className="flex items-center gap-1.5 pb-1.5 border-b border-border/60">
                      <img
                        src={getNoteIconUrl(note.id)}
                        alt=""
                        className="size-5 object-contain shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate text-slate-900 dark:text-white">
                          {note.name}
                        </div>
                        <div className="text-[11px] text-slate-600 dark:text-white/80 font-semibold font-mono">
                          {note.statLabel}
                        </div>
                      </div>
                    </div>
                    <div className="mt-1.5 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-slate-600 dark:text-white/80">
                        <span>Current Total:</span>
                        <span className="font-mono font-bold text-slate-900 dark:text-white">
                          Lv {totalVal}
                          {totalStatBonus > 0 && (
                            <span className="text-slate-600 dark:text-white/80 ml-1">
                              (+{totalStatBonus}%)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 dark:text-white/80">
                        <span>Support Starting:</span>
                        <span className="font-mono font-bold text-slate-700 dark:text-white/90">
                          +{startVal}
                        </span>
                      </div>
                      {reqMaxVal > 0 && (
                        <div className="flex items-center justify-between text-slate-600 dark:text-white/80">
                          <span>Max Harmony Req:</span>
                          <span
                            className={cn(
                              'font-mono font-bold',
                              isMet
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-700 dark:text-white/90'
                            )}
                          >
                            {totalVal}/{reqMaxVal} {isMet ? '✓ Active' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    {/* Tail pointer pointing down to note */}
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 size-3 rotate-45 border-r border-b border-border bg-surface-elevated" />
                  </div>
                </div>

                {/* Note icon + compact name (close to each other) */}
                <div className="flex min-w-0 items-center gap-1.5">
                  <img
                    src={getNoteIconUrl(note.id)}
                    alt={note.shortName}
                    className="size-6 shrink-0 object-contain drop-shadow-xs"
                  />
                  <span className="truncate text-[11px] font-semibold leading-tight text-slate-900 dark:text-white">
                    {note.shortName || note.name}
                  </span>
                  {isMet && (
                    <span
                      className="size-1.5 rounded-full bg-emerald-500 shrink-0"
                      title="Harmony requirement met"
                      aria-label="Harmony requirement met"
                    />
                  )}
                </div>

                {/* Count controls immediately next to note */}
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`Decrease ${note.name}`}
                    onClick={() => onUpdateNoteCount(note.name, Math.max(0, totalVal - 5))}
                    className="flex size-5 items-center justify-center rounded border border-border bg-surface-card text-slate-700 dark:text-white transition-colors cursor-pointer hover:bg-surface-hover"
                    title="-5"
                  >
                    <Minus className="size-2.5" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    aria-label={`${note.name} total count`}
                    value={totalVal}
                    onChange={(e) =>
                      onUpdateNoteCount(
                        note.name,
                        Math.max(0, Math.min(99, Number(e.target.value) || 0))
                      )
                    }
                    className={cn(
                      'w-8 rounded border border-border bg-base py-0.5 text-center font-mono text-[11px] tabular-nums focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-400',
                      isMet
                        ? 'font-bold text-emerald-600 dark:text-emerald-400'
                        : isActive
                          ? 'font-semibold text-slate-900 dark:text-white'
                          : 'font-normal text-slate-400 dark:text-white/40'
                    )}
                  />
                  <button
                    type="button"
                    aria-label={`Increase ${note.name}`}
                    onClick={() => onUpdateNoteCount(note.name, Math.min(99, totalVal + 5))}
                    className="flex size-5 items-center justify-center rounded border border-border bg-surface-card text-slate-700 dark:text-white transition-colors cursor-pointer hover:bg-surface-hover"
                    title="+5"
                  >
                    <Plus className="size-2.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
