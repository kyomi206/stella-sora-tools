'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  ExternalLink,
  Info,
} from 'lucide-react';
import { DiscSkillText } from '@/components/builder/disc-detail-card';
import { PotentialDesc } from '@/components/builder/potential-desc';
import { BuildAnalyticsSection } from '@/components/builds/build-analytics-section';
import { BuildMetricsBar, type BuildMetricValues } from '@/components/builds/build-metrics-bar';
import {
  calculateSupportStartingNotes,
  getDiscOutfitIconUrl,
  getDiscSkillIconUrl,
  getHarmonyActivationLevel,
  getNoteIconUrl,
  MUSICAL_NOTES,
  NOTE_BY_NAME,
} from '@/data/notes';
import type { BuildRotation } from '@/lib/calculator/build-rotation';
import type { DiscRankingContext } from '@/lib/calculator/disc-rankings-client';
import type { CommunityBuildAnalytics } from '@/lib/community-analytics-utils';
import {
  COMMUNITY_MODE_LABELS,
  type ResolvedCommunityPreset,
} from '@/lib/community-presets';
import { getDiscSlug } from '@/lib/disc-utils';
import { getPotentialImageUrl } from '@/lib/potential-utils';
import {
  loadSavedPresetsFromStorage,
  savePresetsToStorage,
  upsertSavedPreset,
} from '@/lib/saved-presets';
import { cn, compressAdvancedBuild } from '@/lib/utils';
import { getTrekkerImageUrl } from '@/lib/wikitide';
import type {
  NoteName,
  SSCharacter,
  SSDisc,
  SelectedMainDisc,
  SelectedSupportDisc,
  SlotType,
} from '@/types';

export interface SlicedPotentialMeta {
  id: number;
  name: string;
  rarity: 'core' | 'rare' | 'common';
  isCore: boolean;
  descTemplate: string;
  params: (string | number)[];
  characterId: number;
}

const TIER_LABELS: Record<string, string> = {
  f2p: 'F2P',
  standard: 'Standard',
  premium: 'Premium',
};

type BuildDetailTabId = 'build' | 'notes' | 'math';

const PRIORITY_DEFINITIONS = [
  {
    key: 'Core',
    label: 'Core',
    headerBg: 'bg-[#0f766e]',
    headerText: 'text-white',
    boxBorder: 'border-[2.5px] border-[#14b8a6] bg-[#14b8a6]/10',
  },
  {
    key: 'High',
    label: 'High',
    headerBg: 'bg-[#0369a1]',
    headerText: 'text-white',
    boxBorder: 'border-[2.5px] border-[#0ea5e9] bg-[#0ea5e9]/10',
  },
  {
    key: 'Medium',
    label: 'Medium',
    headerBg: 'bg-[#4338ca]',
    headerText: 'text-white',
    boxBorder: 'border-[2.5px] border-[#6366f1] bg-[#6366f1]/10',
  },
  {
    key: 'Low',
    label: 'Low',
    headerBg: 'bg-[#f59e0b]',
    headerText: 'text-slate-950',
    boxBorder: 'border-[2.5px] border-[#f59e0b] bg-[#f59e0b]/10',
  },
  {
    key: 'Optional',
    label: 'Optional',
    headerBg: 'bg-[#be123c]',
    headerText: 'text-white',
    boxBorder: 'border-[2.5px] border-dashed border-[#e11d48] bg-[#e11d48]/10',
  },
] as const;

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

interface ReadOnlyDiscSkillBubbleProps {
  disc: SSDisc;
  kind: 'main' | 'support';
  crescendo: number;
  effectiveNotes: Partial<Record<NoteName, number>>;
  startingNotes: Record<string, number>;
  phaseLabel?: string;
  placement?: 'down' | 'up';
}

function ReadOnlyDiscSkillBubble({
  disc,
  kind,
  crescendo,
  effectiveNotes,
  startingNotes,
  phaseLabel,
  placement = 'down',
}: ReadOnlyDiscSkillBubbleProps) {
  const [open, setOpen] = useState(false);

  const harmony1Lv =
    kind === 'main' ? getHarmonyActivationLevel(disc.secondarySkill1, effectiveNotes) : 0;
  const harmony2Lv =
    kind === 'main' ? getHarmonyActivationLevel(disc.secondarySkill2, effectiveNotes) : 0;

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
          'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
          open
            ? 'border-border bg-surface-elevated text-slate-900 dark:text-white'
            : 'border-border bg-surface-card text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white hover:border-slate-400'
        )}
      >
        {kind === 'support' && <Info className="size-3" aria-hidden="true" />}
        <span>{kind === 'main' ? 'Skills' : 'Notes'}</span>
      </button>

      <div
        role="tooltip"
        className={cn(
          'absolute right-0 sm:left-0 sm:right-auto z-40 w-80 max-w-[calc(100vw-2rem)]',
          placement === 'up'
            ? 'bottom-full pb-2 origin-bottom-right sm:origin-bottom-left'
            : 'top-full pt-2 origin-top-right sm:origin-top-left',
          'hidden group-hover/disc:block',
          open && 'block'
        )}
      >
        <div className="relative">
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
              <span className="shrink-0 rounded bg-surface-subtle px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-700 dark:text-white/80">
                {disc.star}-Star
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
                      <span className="shrink-0 font-mono text-[11px] text-slate-500 dark:text-white/60">
                        C{crescendo}/6
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-white/90">
                      <DiscSkillText
                        desc={disc.mainSkill.desc}
                        params={disc.mainSkill.params}
                        level={crescendo}
                        discElement={disc.element}
                      />
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
                            activeLv > 0 ? 'text-emerald-700' : 'text-slate-700 dark:text-white'
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
                        <DiscSkillText
                          desc={skill.desc}
                          params={skill.params}
                          level={Math.max(1, activeLv)}
                          discElement={disc.element}
                        />
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
                                  ? 'border-emerald-500/40 bg-emerald-500/15 font-bold text-emerald-700'
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
                                {currentCount}/{reqVal}
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
                    <span className="text-[11px] text-slate-600 dark:text-white/70">
                      No notes at this phase.
                    </span>
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

interface ReadOnlyDiscTileProps {
  disc: SSDisc;
  badges: React.ReactNode;
  bubble: React.ReactNode;
  leftMeta?: React.ReactNode;
}

function ReadOnlyDiscTile({ disc, badges, bubble, leftMeta }: ReadOnlyDiscTileProps) {
  const discHref = `/discs/${getDiscSlug(disc.name)}`;

  return (
    <div className="flex gap-2.5 rounded-lg border border-border bg-surface-subtle p-2 transition-colors hover:border-border-hover">
      {/* Square disc artwork matching Advanced Preset Visualizer */}
      <Link
        href={discHref}
        aria-label={`View ${disc.name} disc page`}
        className="relative size-20 sm:size-24 shrink-0 overflow-hidden rounded-md border border-border bg-base focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <img
          src={getDiscOutfitIconUrl(disc.id, 'full')}
          alt={disc.name}
          className="size-full object-cover"
        />

        {disc.element !== 'None' && (
          <img
            src={`/ss-element/${disc.element}.webp`}
            alt={disc.element}
            className="pointer-events-none absolute left-1 top-1 size-4 drop-shadow"
          />
        )}

        <span className="pointer-events-none absolute left-1 bottom-1 rounded bg-black/80 px-1 text-[11px] font-bold leading-tight tabular-nums text-amber-400">
          {disc.star}-Star
        </span>
      </Link>

      {/* Name, skill bubble, and read-only stat pills */}
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div className="flex items-start justify-between gap-1.5">
          <Link
            href={discHref}
            className="line-clamp-2 text-left text-xs font-bold leading-tight text-slate-900 dark:text-white hover:text-amber-600 dark:hover:text-amber-400 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            title={disc.name}
          >
            {disc.name}
          </Link>
        </div>

        <div className="flex items-end justify-between gap-1.5 pt-1 flex-wrap sm:flex-nowrap">
          <div className="min-w-0 flex items-center gap-1.5">{leftMeta}</div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {bubble}
            <div className="flex items-center gap-1">{badges}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PotentialPopoverState {
  pot: SlicedPotentialMeta;
  level: number;
  priority: string;
  targetRect: DOMRect;
  pinned: boolean;
}

export interface BuildDetailClientProps {
  preset: ResolvedCommunityPreset;
  characters: Record<string, SSCharacter>;
  discs: Record<string, SSDisc>;
  potentialMeta: Record<string, SlicedPotentialMeta>;
  analytics: CommunityBuildAnalytics | null;
  discRankingContext: DiscRankingContext;
  isLocal?: boolean;
  localRecordId?: string;
  initialTab?: BuildDetailTabId;
  activeRotation?: BuildRotation | null;
  rotationOrigin?: 'auto' | 'preset' | 'local';
  onRotationChange?: (next: BuildRotation | null) => void;
}

export function BuildDetailClient({
  preset,
  characters,
  discs,
  potentialMeta,
  analytics,
  discRankingContext,
  isLocal = false,
  localRecordId,
  initialTab = 'build',
  activeRotation,
  rotationOrigin,
  onRotationChange,
}: BuildDetailClientProps) {
  const router = useRouter();
  const [copiedKind, setCopiedKind] = useState<'ingame' | 'sst1' | null>(null);
  const [liveMetric, setLiveMetric] = useState<BuildMetricValues>({
    views: preset.viewsCount ?? 0,
    upvotes: preset.upvotesCount ?? 0,
    voted: false,
  });

  useEffect(() => {
    if (isLocal || !preset.id) return;
    let cancelled = false;
    fetch(`/api/builds/metrics?ids=${encodeURIComponent(preset.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { metrics?: Record<string, BuildMetricValues> } | null) => {
        const fetched = data?.metrics?.[preset.id];
        if (cancelled || !fetched) return;
        setLiveMetric((prev) => ({
          views: Math.max(prev.views, fetched.views),
          upvotes: fetched.upvotes,
          voted: fetched.voted,
        }));
      })
      .catch(() => {
        // Non-blocking metrics hydration
      });
    return () => {
      cancelled = true;
    };
  }, [isLocal, preset.id]);
  const [savedLocal, setSavedLocal] = useState(false);
  const [activeTab, setActiveTab] = useState<BuildDetailTabId>(initialTab);
  const [potPopover, setPotPopover] = useState<PotentialPopoverState | null>(null);
  const handleInspectPotential = useCallback(
    (potentialId: number, level: number, targetRect: DOMRect) => {
      const pot = potentialMeta[String(potentialId)];
      if (!pot) return;
      let priorityLabel = pot.isCore ? 'Core' : 'Med';
      for (const slotKey of ['vanguard', 'versatile', 'support'] as const) {
        const sel = preset.advData.slots[slotKey]?.potentials.find((p) => p.id === potentialId);
        if (sel) {
          const assigned = sel.priority || (pot.isCore ? 'Core' : 'Medium');
          priorityLabel = PRIORITY_DEFINITIONS.find((d) => d.key === assigned)?.label ?? assigned;
          break;
        }
      }
      setPotPopover((prev) =>
        prev?.pinned &&
        prev.pot.id === pot.id &&
        prev.level === level &&
        Math.abs(prev.targetRect.top - targetRect.top) < 6 &&
        Math.abs(prev.targetRect.left - targetRect.left) < 6
          ? null
          : {
              pot,
              level,
              priority: priorityLabel,
              targetRect,
              pinned: true,
            }
      );
    },
    [potentialMeta, preset.advData.slots]
  );

  const copyTimerRef = useRef<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);

  const externalSources = useMemo(
    () => preset.sources.filter((src) => Boolean(src.url && src.url.trim())),
    [preset.sources]
  );

  const hasNotes =
    Boolean(preset.potentialNote) ||
    preset.rotation.length > 0 ||
    preset.substitutions.length > 0 ||
    externalSources.length > 0;

  const detailTabs = useMemo(() => {
    const items: Array<{ id: BuildDetailTabId; label: string }> = [
      { id: 'build', label: 'Build' },
    ];
    if (hasNotes) {
      items.push({ id: 'notes', label: 'Notes' });
    }
    if (analytics || discRankingContext) {
      items.push({ id: 'math', label: 'Math' });
    }
    return items;
  }, [hasNotes, analytics, discRankingContext]);

  const handleDetailTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const idx = detailTabs.findIndex((t) => t.id === activeTab);
    if (idx < 0) return;
    let nextIdx = -1;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % detailTabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + detailTabs.length) % detailTabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = detailTabs.length - 1;
    if (nextIdx >= 0) {
      e.preventDefault();
      const nextTab = detailTabs[nextIdx];
      setActiveTab(nextTab.id);
      document.getElementById(`build-tab-${nextTab.id}`)?.focus();
    }
  };

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
    };
  }, []);

  // Dismiss pinned Potential popover on Escape or outside click
  useEffect(() => {
    if (!potPopover?.pinned) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPotPopover(null);
    };
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-pot-tile="true"]') || target?.closest('[data-pot-popover="true"]')) {
        return;
      }
      setPotPopover(null);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [potPopover?.pinned]);

  const handleCopy = async (text: string, kind: 'ingame' | 'sst1') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKind(kind);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedKind(null), 1600);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleSaveCopy = () => {
    const result = upsertSavedPreset(loadSavedPresetsFromStorage(), {
      name: preset.title,
      mode: 'advanced',
      slots: preset.advData.slots,
      mainDiscs: preset.advData.mainDiscs,
      supportDiscs: preset.advData.supportDiscs,
      targetNotes: preset.advData.targetNotes,
      combatRotation: preset.combatRotation ?? null,
      sourcePresetId: preset.id,
      forceNew: true,
    });
    if (result && savePresetsToStorage(result.list)) {
      setSavedLocal(true);
      if (savedTimerRef.current !== null) window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = window.setTimeout(() => setSavedLocal(false), 1800);
      return result.record;
    }
    return null;
  };

  const handleSaveAndCustomize = () => {
    const record = handleSaveCopy();
    if (record) {
      router.push(`/builds/local?id=${encodeURIComponent(record.id)}&tab=math`);
    }
  };

  const tierLabel = TIER_LABELS[preset.tier] || 'Standard';
  const primarySource = preset.sources[0];
  const nonGeneralModes = preset.modes.filter((m) => m !== 'general');

  const squadRows: ReadonlyArray<{
    slotKey: SlotType;
    roleBadge: string;
    roleBadgeBg: string;
    char: SSCharacter | null;
    potentials: ResolvedCommunityPreset['advData']['slots'][SlotType]['potentials'];
  }> = [
    {
      slotKey: 'vanguard',
      roleBadge: 'MAIN',
      roleBadgeBg: 'bg-[#ff2a70]',
      char: preset.advData.slots.vanguard.characterId
        ? characters[String(preset.advData.slots.vanguard.characterId)] || null
        : null,
      potentials: preset.advData.slots.vanguard.potentials,
    },
    {
      slotKey: 'versatile',
      roleBadge: 'SUPPORT',
      roleBadgeBg: 'bg-[#6366f1]',
      char: preset.advData.slots.versatile.characterId
        ? characters[String(preset.advData.slots.versatile.characterId)] || null
        : null,
      potentials: preset.advData.slots.versatile.potentials,
    },
    {
      slotKey: 'support',
      roleBadge: 'SUPPORT',
      roleBadgeBg: 'bg-[#6366f1]',
      char: preset.advData.slots.support.characterId
        ? characters[String(preset.advData.slots.support.characterId)] || null
        : null,
      potentials: preset.advData.slots.support.potentials,
    },
  ];

  // Compute effective notes purely for Harmony activation display inside Disc skill popovers
  const supportStartingNotes = useMemo(
    () => calculateSupportStartingNotes(preset.advData.supportDiscs, discs),
    [preset.advData.supportDiscs, discs]
  );

  const effectiveNotes = useMemo(() => {
    return Object.fromEntries(
      MUSICAL_NOTES.map((n) => {
        const start = supportStartingNotes[n.name] || 0;
        const custom = preset.advData.targetNotes[n.name];
        return [n.name, custom !== undefined ? Math.max(0, custom) : start];
      })
    ) as Record<NoteName, number>;
  }, [supportStartingNotes, preset.advData.targetNotes]);

  const hasAnyDiscs =
    preset.advData.mainDiscs.some((s) => Boolean(s.discId)) ||
    preset.advData.supportDiscs.some((s) => Boolean(s.discId));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
      {/* Back link */}
      <div>
        <Link
          href={isLocal ? '/builds?tab=saved' : '/builds'}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-white/75 hover:text-slate-900 dark:hover:text-white transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>{isLocal ? 'My Saved Builds' : 'Community Builds'}</span>
        </Link>
      </div>

      {/* Two-Tier Editorial Header Card */}
      <header className="game-card celestial-card p-4 sm:p-5 space-y-3.5">
        {/* Top Row: Eyebrow + Title on left, Action Buttons on right */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-600 dark:text-slate-400">
              <span>{tierLabel}</span>
              {nonGeneralModes.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {nonGeneralModes.map((m) => COMMUNITY_MODE_LABELS[m] || m).join(', ')}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">v{preset.verifiedPatch}</span>
              {preset.isStale && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                    <AlertTriangle className="size-3.5" aria-hidden="true" />
                    <span>Older Patch</span>
                  </span>
                </>
              )}
              {!isLocal && (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-semibold',
                      (preset.isVerified ?? preset.origin !== 'community')
                        ? 'border-teal-500/35 bg-teal-500/10 text-teal-700'
                        : 'border-border bg-surface-subtle text-slate-600 dark:text-slate-400'
                    )}
                  >
                    {(preset.isVerified ?? preset.origin !== 'community') && (
                      <BadgeCheck className="size-3 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      {(preset.isVerified ?? preset.origin !== 'community')
                        ? 'Verified'
                        : 'Community'}
                    </span>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-start gap-2.5 min-w-0">
              <img
                src={`/ss-element/${preset.element}.webp`}
                alt={preset.element}
                width={24}
                height={24}
                className="size-6 mt-0.5 object-contain shrink-0"
              />
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-tight text-slate-900 dark:text-white line-clamp-2 break-words min-w-0">
                {preset.title}
              </h1>
            </div>
            {preset.summary?.trim() && (
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl pt-0.5 break-words">
                {preset.summary}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href={
                isLocal
                  ? localRecordId
                    ? `/builder/advanced?saved=${encodeURIComponent(localRecordId)}`
                    : `/builder/advanced?adv=${encodeURIComponent(preset.advCode)}`
                  : preset.origin === 'community'
                    ? `/builder/advanced?adv=${encodeURIComponent(preset.advCode)}`
                    : `/builder/advanced?community=${encodeURIComponent(preset.id)}`
              }
              className="inline-flex items-center px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 border border-amber-600 text-xs font-bold text-slate-950 transition-colors press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Open in Builder
            </Link>

            <button
              type="button"
              onClick={handleSaveCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {savedLocal ? (
                <>
                  <Check className="size-3.5 text-emerald-700" aria-hidden="true" />
                  <span className="text-emerald-700">Saved</span>
                </>
              ) : (
                <span>Save</span>
              )}
            </button>

            <Link
              href={
                isLocal || preset.origin === 'community'
                  ? `/damage?b=${encodeURIComponent(
                      compressAdvancedBuild({
                        id: preset.id,
                        name: preset.title,
                        createdAt: 0,
                        slots: preset.advData.slots,
                        mainDiscs: preset.advData.mainDiscs,
                        supportDiscs: preset.advData.supportDiscs,
                        targetNotes: preset.advData.targetNotes,
                        ...(preset.combatRotation ? { rotation: preset.combatRotation } : {}),
                      })
                    )}`
                  : `/damage?preset=${encodeURIComponent(preset.id)}`
              }
              className="inline-flex items-center px-3 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Open in Damage Calc
            </Link>

            {preset.inGameCode && (
              <button
                type="button"
                onClick={() => handleCopy(preset.inGameCode!, 'ingame')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {copiedKind === 'ingame' ? (
                  <>
                    <Check className="size-3.5 text-emerald-700" aria-hidden="true" />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <span>Copy Code</span>
                )}
              </button>
            )}

            {preset.advCode && (
              <button
                type="button"
                onClick={() => handleCopy(preset.advCode, 'sst1')}
                title="Copy Advanced Builder SST1 code"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {copiedKind === 'sst1' ? (
                  <>
                    <Check className="size-3.5 text-emerald-700" aria-hidden="true" />
                    <span className="text-emerald-700">Copied</span>
                  </>
                ) : (
                  <span>SST1</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Bottom Metadata & Telemetry Bar (Views + Date + Author on left, Upvote on right) */}
        {(!isLocal || preset.authorName || primarySource) && (
          <div className="pt-3 border-t border-border-subtle flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400 min-w-0">
              {!isLocal && (
                <BuildMetricsBar
                  buildId={preset.id}
                  views={liveMetric.views}
                  upvotes={liveMetric.upvotes}
                  voted={liveMetric.voted}
                  recordViewOnMount
                  onViewRecorded={(viewsCount) =>
                    setLiveMetric((prev) => ({
                      ...prev,
                      views: Math.max(prev.views, viewsCount),
                    }))
                  }
                  part="views"
                />
              )}

              {(preset.createdAt || preset.verifiedAt) && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <span>Published</span>
                  <span className="font-semibold text-slate-800 dark:text-white/90">
                    {new Intl.DateTimeFormat('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      timeZone: 'UTC',
                    }).format(new Date(preset.createdAt || preset.verifiedAt))}
                  </span>
                </span>
              )}

              {(preset.authorName || primarySource) && (
                <span className="inline-flex items-center gap-1 min-w-0">
                  <span>by</span>
                  {primarySource?.url ? (
                    <a
                      href={primarySource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 truncate"
                    >
                      <span className="truncate">{primarySource.author}</span>
                      <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="font-semibold text-slate-800 dark:text-white/90 truncate">
                      {preset.authorName || primarySource?.author || 'Anonymous'}
                    </span>
                  )}
                </span>
              )}
            </div>

            {!isLocal && (
              <BuildMetricsBar
                buildId={preset.id}
                views={liveMetric.views}
                upvotes={liveMetric.upvotes}
                voted={liveMetric.voted}
                onMetricChange={(next) =>
                  setLiveMetric((prev) => ({
                    views: Math.max(prev.views, next.views),
                    upvotes: next.upvotes,
                    voted: next.voted,
                  }))
                }
                part="upvote"
              />
            )}
          </div>
        )}
      </header>

      {/* Clean View Switcher: Build | Notes | Math */}
      {detailTabs.length > 1 && (
        <div
          role="tablist"
          aria-label="Build views"
          onKeyDown={handleDetailTabKeyDown}
          className="inline-flex items-center gap-1 p-1 rounded-xl border border-border bg-surface-card"
        >
          {detailTabs.map(({ id, label }) => {
            const isSelected = activeTab === id;
            return (
              <button
                key={id}
                id={`build-tab-${id}`}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-controls={`build-panel-${id}`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-700 dark:text-white/80 hover:bg-surface-hover hover:text-slate-900 dark:hover:text-white'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* TAB 1: BUILD (Squad & Potentials + Runic Discs) */}
      <div
        id="build-panel-build"
        role="tabpanel"
        aria-labelledby="build-tab-build"
        hidden={activeTab !== 'build'}
        className={cn(activeTab === 'build' ? 'space-y-4' : 'hidden')}
      >
        {/* 1. Squad & Potentials — Advanced Preset Visualizer style */}
        <section
          id="squad"
          className="isolate game-card celestial-card p-4 sm:p-5 space-y-4"
        >
          <div className="border-b border-border pb-2.5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Squad &amp; Potentials
            </h2>
          </div>

          <div className="flex flex-col gap-4">
          {squadRows.map(({ slotKey, roleBadge, roleBadgeBg, char, potentials }) => {
            const isFiveStar = (char?.star || 4) >= 5;

            return (
              <div
                key={slotKey}
                className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 pb-4 border-b border-border last:border-b-0 last:pb-0"
              >
                {/* Left: Tall Trekker Game Portrait Card */}
                <div className="shrink-0 flex items-center justify-start sm:justify-center">
                  {char ? (
                    <Link
                      href={`/trekkers/${encodeURIComponent(char.name.EN)}`}
                      aria-label={`View ${char.name.EN} Trekker page`}
                      className={cn(
                        'group relative isolate w-24 sm:w-28 aspect-[3.4/4.4] rounded-lg overflow-hidden bg-white select-none shrink-0 transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                        isFiveStar
                          ? 'ring-[1.5px] ring-purple-300/70 shadow-sm'
                          : 'ring-[1.5px] ring-yellow-300/70 shadow-sm'
                      )}
                    >
                      {/* Left vertical rarity bar */}
                      <div
                        className={cn(
                          'absolute inset-y-0 left-0 w-1.5 z-20',
                          isFiveStar
                            ? 'bg-gradient-to-b from-[#e879f9] via-[#a855f7] to-[#38bdf8]'
                            : 'bg-[#fde047]'
                        )}
                      />

                      {/* Top-Left Role Pill */}
                      <div className="absolute top-1 left-1 z-20 flex items-center pointer-events-none">
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded text-[11px] font-bold tracking-tight text-white shadow-xs',
                            roleBadgeBg
                          )}
                        >
                          {roleBadge}
                        </span>
                      </div>

                      {/* Top-Right Element Badge */}
                      <div className="absolute top-1 right-1 z-20 pointer-events-none">
                        <img
                          src={`/ss-element/${char.element}.webp`}
                          alt={char.element}
                          className="size-6 sm:size-7 object-contain drop-shadow"
                        />
                      </div>

                      {/* Character Bust Artwork */}
                      <img
                        src={getTrekkerImageUrl(char.id)}
                        alt={char.name.EN}
                        className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none"
                      />

                      {/* Bottom Soft White Gradient Fade */}
                      <div className="absolute inset-x-0 bottom-1 h-10 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-10" />

                      {/* Character Name */}
                      <div className="absolute bottom-1 inset-x-1.5 z-20 flex items-center justify-between pointer-events-none">
                        <span className="font-extrabold text-[11px] sm:text-xs text-[#1a56db] tracking-tight drop-shadow leading-tight break-words group-hover:underline">
                          {char.name.EN}
                        </span>
                      </div>

                      {/* Bottom Horizontal Rarity Bar */}
                      <div
                        className={cn(
                          'absolute inset-x-0 bottom-0 h-1.5 z-20',
                          isFiveStar
                            ? 'bg-gradient-to-r from-[#c084fc] via-[#818cf8] to-[#38bdf8] border-t border-purple-200/50'
                            : 'bg-gradient-to-r from-[#fde047] via-[#facc15] to-[#eab308] border-t border-yellow-200/50'
                        )}
                      />
                    </Link>
                  ) : (
                    <div className="w-24 sm:w-28 aspect-[3.4/4.4] rounded-lg border border-dashed border-border bg-surface-subtle flex flex-col items-center justify-center p-2 text-center text-slate-600 dark:text-white/75">
                      <span className="text-xs font-semibold">Flexible</span>
                      <span className="text-[11px] capitalize text-slate-500 dark:text-white/60">
                        {slotKey}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Priority-grouped official Potential cards matching Advanced Preset Visualizer */}
                <div className="flex-1 min-w-0 flex flex-wrap items-end gap-y-2 py-1">
                  {char && potentials.length > 0 ? (
                    PRIORITY_DEFINITIONS.filter((prio) =>
                      potentials.some((sel) => {
                        const pot = potentialMeta[String(sel.id)];
                        const assignedPriority = sel.priority || (pot?.isCore ? 'Core' : 'Medium');
                        return assignedPriority === prio.key;
                      })
                    ).flatMap((prio) => {
                      const groupPotentials = potentials.filter((sel) => {
                        const pot = potentialMeta[String(sel.id)];
                        const assignedPriority = sel.priority || (pot?.isCore ? 'Core' : 'Medium');
                        return assignedPriority === prio.key;
                      });

                      return groupPotentials.map((sel, idx) => {
                        const pot = potentialMeta[String(sel.id)];
                        if (!pot) return null;
                        const levelVal = Number(sel.level) || (pot.isCore ? 1 : 6);
                        const isFirst = idx === 0;
                        const isLast = idx === groupPotentials.length - 1;
                        const isPinnedThis =
                          potPopover?.pinned && potPopover.pot.id === pot.id;

                        return (
                          <div
                            key={`${prio.key}-${sel.id}`}
                            className={cn('flex flex-col shrink-0', isLast && 'mr-3')}
                          >
                            {isFirst && (
                              <div className="self-start relative z-10 -mb-[2.5px]">
                                <span
                                  className={cn(
                                    'px-3.5 py-0.5 text-xs font-bold rounded-t-md shadow-xs inline-block tracking-wide',
                                    prio.headerBg,
                                    prio.headerText
                                  )}
                                >
                                  {prio.label}
                                </span>
                              </div>
                            )}

                            <div
                              className={cn(
                                'relative z-0 overflow-hidden shadow-sm',
                                prio.boxBorder,
                                isFirst ? 'rounded-bl-md' : 'border-l-0',
                                isLast ? 'rounded-r-md' : 'border-r-[2px]'
                              )}
                            >
                              <button
                                type="button"
                                data-pot-tile="true"
                                aria-label={`${pot.name}, ${prio.label} priority, level ${levelVal}. Click to inspect description.`}
                                aria-expanded={Boolean(isPinnedThis)}
                                onMouseEnter={(e) => {
                                  if (potPopover?.pinned) return;
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setPotPopover({
                                    pot,
                                    level: levelVal,
                                    priority: prio.label,
                                    targetRect: rect,
                                    pinned: false,
                                  });
                                }}
                                onMouseMove={(e) => {
                                  if (potPopover?.pinned) return;
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setPotPopover((prev) =>
                                    prev && !prev.pinned ? { ...prev, targetRect: rect } : prev
                                  );
                                }}
                                onMouseLeave={() => {
                                  setPotPopover((prev) => (prev?.pinned ? prev : null));
                                }}
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setPotPopover((prev) =>
                                    prev?.pinned && prev.pot.id === pot.id
                                      ? null
                                      : {
                                          pot,
                                          level: levelVal,
                                          priority: prio.label,
                                          targetRect: rect,
                                          pinned: true,
                                        }
                                  );
                                }}
                                className={cn(
                                  'relative block w-[82px] sm:w-[96px] aspect-[87/107] shrink-0 cursor-pointer select-none bg-white transition-transform hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400',
                                  isPinnedThis && 'ring-2 ring-inset ring-amber-400'
                                )}
                              >
                                <img
                                  src={getPotentialImageUrl(pot.id)}
                                  alt={pot.name}
                                  className="w-full h-full object-cover pointer-events-none"
                                />

                                {/* Level number in top-left notch matching Advanced Preset Visualizer */}
                                {!pot.isCore ? (
                                  <div className="absolute left-[13%] top-[7%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center">
                                    <span
                                      style={{ color: '#0f172a' }}
                                      className="text-[11px] sm:text-[12px] font-mono font-extrabold leading-none select-none"
                                    >
                                      {levelVal}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="absolute left-[13%] top-[7%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center">
                                    <span
                                      style={{ color: '#ffffff' }}
                                      className="text-[11px] sm:text-[12px] font-mono font-extrabold drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] leading-none select-none"
                                    >
                                      {levelVal}
                                    </span>
                                  </div>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })
                  ) : (
                    <div className="flex items-center text-xs text-slate-600 dark:text-white/70 italic py-4">
                      No potentials specified for this slot.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        </section>

        {/* 2. Runic Discs — Advanced Preset Visualizer 2-column grid */}
        <section
          id="discs"
          className="game-card celestial-card p-4 sm:p-5 space-y-4"
        >
          <div className="border-b border-border pb-2.5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Runic Discs
            </h2>
          </div>

        {hasAnyDiscs ? (
          <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-4">
            {/* Main Discs Column */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-white/85">
                  Main discs
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {([0, 1, 2] as const).map((idx) => {
                  const slot: SelectedMainDisc | undefined = preset.advData.mainDiscs[idx];
                  const disc = slot?.discId ? discs[String(slot.discId)] : null;

                  if (!disc || !slot) {
                    return (
                      <div
                        key={`main-${idx}`}
                        className="flex h-[104px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface-subtle/60 p-2 text-xs text-slate-500 dark:text-white/60"
                      >
                        Main Disc #{idx + 1} — Flexible
                      </div>
                    );
                  }

                  const harmony1Lv = getHarmonyActivationLevel(
                    disc.secondarySkill1,
                    effectiveNotes
                  );
                  const harmony2Lv = getHarmonyActivationLevel(
                    disc.secondarySkill2,
                    effectiveNotes
                  );

                  return (
                    <ReadOnlyDiscTile
                      key={`main-${idx}`}
                      disc={disc}
                      leftMeta={
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
                      }
                      bubble={
                        <ReadOnlyDiscSkillBubble
                          disc={disc}
                          kind="main"
                          crescendo={slot.crescendo}
                          effectiveNotes={effectiveNotes}
                          startingNotes={{}}
                          placement={idx === 2 ? 'up' : 'down'}
                        />
                      }
                      badges={
                        <>
                          <span className="rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[11px] font-bold font-mono text-slate-800 dark:text-white">
                            C{slot.crescendo}
                          </span>
                          <span className="rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[11px] font-bold font-mono text-slate-800 dark:text-white">
                            Lv{slot.level}
                          </span>
                        </>
                      }
                    />
                  );
                })}
              </div>
            </div>

            {/* Support Discs Column */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-700 dark:text-white/85">
                  Support discs
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {([0, 1, 2] as const).map((idx) => {
                  const slot: SelectedSupportDisc | undefined = preset.advData.supportDiscs[idx];
                  const disc = slot?.discId ? discs[String(slot.discId)] : null;

                  if (!disc || !slot) {
                    return (
                      <div
                        key={`support-${idx}`}
                        className="flex h-[104px] w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-surface-subtle/60 p-2 text-xs text-slate-500 dark:text-white/60"
                      >
                        Support Disc #{idx + 1} — Flexible
                      </div>
                    );
                  }

                  const phaseIdx = Math.max(
                    0,
                    Math.min((disc.supportNote?.length || 1) - 1, slot.phase)
                  );
                  const slotStartingNotes = disc.supportNote?.[phaseIdx] || {};

                  return (
                    <ReadOnlyDiscTile
                      key={`support-${idx}`}
                      disc={disc}
                      leftMeta={
                        <div className="flex flex-wrap items-center gap-1">
                          {Object.entries(slotStartingNotes).map(([noteName, count]) => {
                            const meta = NOTE_BY_NAME[noteName as NoteName];
                            return (
                              <span
                                key={noteName}
                                className="inline-flex items-center gap-0.5 rounded border border-border bg-surface-elevated px-1 py-0.5 text-[11px] font-mono font-semibold text-slate-800 dark:text-white leading-none"
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
                        </div>
                      }
                      bubble={
                        <ReadOnlyDiscSkillBubble
                          disc={disc}
                          kind="support"
                          crescendo={slot.crescendo ?? 1}
                          effectiveNotes={{}}
                          startingNotes={slotStartingNotes}
                          phaseLabel={PHASE_LABELS[phaseIdx]}
                          placement={idx === 2 ? 'up' : 'down'}
                        />
                      }
                      badges={
                        <>
                          <span className="rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[11px] font-bold font-mono text-slate-800 dark:text-white">
                            C{slot.crescendo ?? 1}
                          </span>
                          <span className="rounded border border-border bg-surface-elevated px-1.5 py-0.5 text-[11px] font-bold font-mono text-slate-800 dark:text-white">
                            {PHASE_LABELS[phaseIdx] || `P${slot.phase + 1}`}
                          </span>
                        </>
                      }
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600 dark:text-white/75">
            Potentials-only preset — slot element-matching Discs in the Builder.
          </p>
        )}
        </section>
      </div>

      {/* TAB 2: NOTES (Potential Note, Rotation, Substitutions & Sources) */}
      {hasNotes && (
        <div
          id="build-panel-notes"
          role="tabpanel"
          aria-labelledby="build-tab-notes"
          hidden={activeTab !== 'notes'}
          className={cn(activeTab === 'notes' ? 'space-y-4' : 'hidden')}
        >
          {preset.potentialNote && (
            <section className="game-card celestial-card p-4 text-xs sm:text-sm text-slate-700 dark:text-white/85 leading-relaxed">
              <span className="font-bold text-slate-900 dark:text-white">Potential Priority: </span>
              {preset.potentialNote}
            </section>
          )}

          <div
            className={cn(
              'grid grid-cols-1 gap-4',
              preset.rotation.length > 0 &&
                (preset.substitutions.length > 0 || externalSources.length > 0 || preset.isStale) &&
                'lg:grid-cols-2'
            )}
          >
            {preset.rotation.length > 0 && (
              <section className="game-card celestial-card p-4 sm:p-5 space-y-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Author Notes
                </h2>
                <ul className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-white/85 list-disc pl-5">
                  {preset.rotation.map((step, idx) => (
                    <li key={idx} className="leading-relaxed break-words">
                      {step.replace(/^(?:[•\-*]\s+|\d+[.)]\s+)/, '')}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(preset.substitutions.length > 0 || externalSources.length > 0 || preset.isStale) && (
              <section className="game-card celestial-card p-4 sm:p-5 space-y-4">
                {preset.substitutions.length > 0 && (
                  <div className="space-y-2.5">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Substitutions
                    </h2>
                    <div className="space-y-2">
                      {preset.substitutions.map((sub, idx) => {
                        const replacedName =
                          sub.replacesType === 'trekker'
                            ? characters[String(sub.replacesId)]?.name.EN || `#${sub.replacesId}`
                            : discs[String(sub.replacesId)]?.name || `#${sub.replacesId}`;
                        const altNames = sub.alternativeIds.map((altId) =>
                          sub.replacesType === 'trekker'
                            ? characters[String(altId)]?.name.EN || `#${altId}`
                            : discs[String(altId)]?.name || `#${altId}`
                        );

                        return (
                          <div
                            key={idx}
                            className="rounded-lg border border-border-subtle bg-surface-subtle p-2.5 text-xs text-slate-700 dark:text-white/85 space-y-0.5"
                          >
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {replacedName}{' '}
                              <span className="text-slate-500 dark:text-white/60">→</span>{' '}
                              <span className="text-teal-700 dark:text-teal-400">
                                {altNames.join(' / ')}
                              </span>
                            </div>
                            <p className="text-slate-600 dark:text-white/75 leading-relaxed">
                              {sub.note}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {externalSources.length > 0 && (
                  <div
                    className={cn(
                      'space-y-2',
                      preset.substitutions.length > 0 && 'pt-2 border-t border-border-subtle'
                    )}
                  >
                    <h2 className="text-xs font-semibold text-slate-600 dark:text-white/70">
                      Sources
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {externalSources.map((src, idx) => (
                        <a
                          key={idx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-surface-subtle hover:bg-surface-hover text-xs font-semibold text-sky-700 dark:text-sky-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          <span>
                            {src.label} ({src.author})
                          </span>
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {preset.isStale && (
                  <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-2.5 text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <div>Verified for patch v{preset.verifiedPatch}.</div>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: MATH (Theorycraft Breakdown) */}
      {(analytics || discRankingContext) && (
        <div
          id="build-panel-math"
          role="tabpanel"
          aria-labelledby="build-tab-math"
          hidden={activeTab !== 'math'}
          className={cn(activeTab === 'math' ? 'block' : 'hidden')}
        >
          <BuildAnalyticsSection
            analytics={analytics}
            discRankingContext={discRankingContext}
            activeInspectedPotentialId={potPopover?.pinned ? potPopover.pot.id : null}
            onInspectPotential={handleInspectPotential}
            activeRotation={activeRotation ?? preset.combatRotation ?? null}
            rotationOrigin={
              rotationOrigin ?? (preset.combatRotation ? 'preset' : 'auto')
            }
            canEditRotation={isLocal}
            onRotationChange={onRotationChange}
            onSaveAndCustomize={!isLocal ? handleSaveAndCustomize : undefined}
          />
        </div>
      )}

      {/* Floating Potential Inspection Popover (Hover or Click-pinned) */}
      {potPopover &&
        (() => {
          const rect = potPopover.targetRect;
          const cardCenter = rect.left + rect.width / 2;
          const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
          const halfTooltip = Math.min(160, (vw - 24) / 2);
          const popupLeft = Math.max(halfTooltip + 12, Math.min(vw - halfTooltip - 12, cardCenter));
          const arrowOffset = Math.max(
            -halfTooltip + 20,
            Math.min(halfTooltip - 20, cardCenter - popupLeft)
          );
          const showBelow = rect.top < 150;

          return (
            <div
              data-pot-popover="true"
              role="dialog"
              aria-label={`${potPopover.pot.name} description`}
              className={cn(
                'fixed z-50 transition-opacity duration-100',
                potPopover.pinned ? 'pointer-events-auto' : 'pointer-events-none'
              )}
              style={{
                left: `${popupLeft}px`,
                top: showBelow ? `${rect.bottom + 8}px` : `${rect.top - 8}px`,
                transform: showBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
              }}
            >
              <div className="relative bg-surface-card text-slate-800 dark:text-white/90 text-xs leading-snug rounded-xl px-4 py-2.5 shadow-2xl border border-border max-w-[280px] sm:max-w-[320px] text-left">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {potPopover.pot.name}
                  </span>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-subtle text-slate-600 dark:text-white/75 border border-border-subtle shrink-0">
                    {potPopover.priority} • Lv.{potPopover.level}
                  </span>
                </div>
                <p className="font-normal">
                  <PotentialDesc
                    descTemplate={potPopover.pot.descTemplate}
                    params={potPopover.pot.params}
                    level={potPopover.level}
                    characterId={potPopover.pot.characterId}
                  />
                </p>

                {showBelow ? (
                  <div
                    className="absolute bottom-full -mb-[1px] -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-b-[6px] border-b-surface-card pointer-events-none"
                    style={{ left: `calc(50% + ${arrowOffset}px)` }}
                  />
                ) : (
                  <div
                    className="absolute top-full -mt-[1px] -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-surface-card pointer-events-none"
                    style={{ left: `calc(50% + ${arrowOffset}px)` }}
                  />
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
