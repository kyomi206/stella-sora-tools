'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Disc,
  ExternalLink,
} from 'lucide-react';
import {
  NOTE_BY_NAME,
  getDiscOutfitIconUrl,
  getDiscSkillIconUrl,
  getNoteIconUrl,
} from '@/data/notes';
import {
  getDiscStatSummary,
  getDiscSupportNotesAtPhase,
} from '@/lib/disc-utils';
import { getTrekkerImageUrl } from '@/lib/wikitide';
import { DiscSkillText } from '@/components/builder/disc-detail-card';
import { RarityStars } from '@/components/ui/rarity-stars';
import { cn } from '@/lib/utils';
import type { ElementType, NoteName, SSDisc, SSDiscSecondarySkill } from '@/types';

const INK = 'text-[var(--dc-ink)]';
const BODY = 'text-[var(--dc-body)]';
const PLATE = 'rounded-lg border border-[var(--dc-plate-border)] bg-[var(--dc-plate)]';

function DiscSectionBanner({ label }: { label: string }) {
  return (
    <div
      className="mb-2 flex h-7 w-full items-center bg-[var(--dc-ribbon)] pl-3 pr-5"
      style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)' }}
    >
      <span className="text-xs font-bold tracking-wide text-white uppercase">{label}</span>
    </div>
  );
}

function DiscTierPager({
  value,
  max,
  displayText,
  label,
  onChange,
}: {
  value: number;
  max: number;
  displayText: string;
  label: string;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-[var(--dc-pager)] p-0.5">
      <button
        type="button"
        aria-label={`${label}: previous`}
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
        className="flex size-6 items-center justify-center rounded-full text-[var(--dc-pager-ink)] transition-colors hover:bg-[var(--dc-pager-hover)] disabled:cursor-default disabled:opacity-40 cursor-pointer"
      >
        <ChevronLeft className="size-3.5" aria-hidden="true" />
      </button>
      <span className={cn('min-w-8 px-1 text-center text-xs font-bold tabular-nums', INK)}>
        {displayText}
      </span>
      <button
        type="button"
        aria-label={`${label}: next`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex size-6 items-center justify-center rounded-full text-[var(--dc-pager-strong)] transition-colors hover:bg-[var(--dc-pager-hover)] disabled:cursor-default disabled:opacity-30 cursor-pointer"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function DiscSkillPlateHeader({
  icon,
  name,
  children,
}: {
  icon: string;
  name: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="disc-icon-tile flex size-9 shrink-0 items-center justify-center rounded-md">
        <img
          src={icon}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-7 object-contain"
        />
      </span>
      <span className={cn('min-w-0 flex-1 text-base font-bold leading-tight', INK)}>
        {name}
      </span>
      {children}
    </div>
  );
}

function HarmonySkillBlock({
  skill,
  label,
  discElement,
}: {
  skill: SSDiscSecondarySkill;
  label: string;
  discElement: ElementType | 'None';
}) {
  const maxTier = Math.max(1, Math.min(5, skill.requirements?.length || 5));
  const [tier, setTier] = useState(1);
  const requirement = skill.requirements?.[tier - 1] || {};
  const reqRows = Object.entries(requirement);

  return (
    <div className={cn(PLATE, 'p-3 space-y-2')}>
      <DiscSkillPlateHeader icon={getDiscSkillIconUrl(skill.icon)} name={skill.name}>
        <DiscTierPager
          value={tier}
          max={maxTier}
          displayText={`Lv.${tier}`}
          label={`${label} tier`}
          onChange={setTier}
        />
      </DiscSkillPlateHeader>

      <p className={cn('whitespace-pre-line text-[13px] leading-[1.55]', BODY)}>
        <DiscSkillText
          desc={skill.desc}
          params={skill.params}
          level={tier}
          discElement={discElement}
        />
      </p>

      {reqRows.length > 0 && (
        <div className="pt-0.5 space-y-1">
          <div className={cn('text-xs font-bold', INK)}>Activation Requirements:</div>
          <div className="space-y-1">
            {reqRows.map(([noteName, need]) => {
              const meta = NOTE_BY_NAME[noteName as NoteName];
              return (
                <div
                  key={noteName}
                  className="flex items-center gap-2 rounded-md bg-[var(--dc-row)] px-2.5 py-1.5"
                >
                  {meta && (
                    <img
                      src={getNoteIconUrl(meta.id)}
                      alt=""
                      className="size-5 shrink-0 object-contain"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--dc-row-ink)]">
                    {meta?.name || noteName}
                  </span>
                  <span className={cn('shrink-0 text-xs font-bold tabular-nums', INK)}>
                    ≥{need}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export interface DiscNavItem {
  name: string;
  slug: string;
}

export interface ExclusiveBannerSummary {
  trekkerId: number;
  trekkerName: string;
  bannerName: string;
  bannerKind: 'Limited' | 'Rate-Up';
}

interface DiscDetailClientProps {
  disc: SSDisc;
  prevDisc: DiscNavItem;
  nextDisc: DiscNavItem;
  exclusiveBanner: ExclusiveBannerSummary | null;
}

export default function DiscDetailClient({
  disc,
  prevDisc,
  nextDisc,
  exclusiveBanner,
}: DiscDetailClientProps) {
  const [discLevel, setDiscLevel] = useState<number>(90);
  const [crescendo, setCrescendo] = useState(1);
  const [supportPhase, setSupportPhase] = useState(9);

  useEffect(() => {
    setDiscLevel(90);
    setCrescendo(1);
    setSupportPhase(9);
  }, [disc.id]);

  const isFiveStar = disc.star >= 5;
  const isFourStar = disc.star === 4;
  const elementLabel = disc.element === 'None' ? 'Neutral' : disc.element;
  const fullArtUrl = getDiscOutfitIconUrl(disc.id, 'full');
  const statSummary = getDiscStatSummary(disc, discLevel, crescendo);
  const supportNotes = getDiscSupportNotesAtPhase(disc, supportPhase);
  const supportNoteEntries = Object.entries(supportNotes);
  const maxPhase = Math.max(1, disc.supportNote?.length || 9);
  const hasHarmony = Boolean(disc.secondarySkill1 || disc.secondarySkill2);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      {/* Top Breadcrumb / Prev-Next Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/discs"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>Back to Runic Discs</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={`/discs/${prevDisc.slug}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            <span className="max-w-[140px] truncate">{prevDisc.name}</span>
          </Link>
          <Link
            href={`/discs/${nextDisc.slug}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border-subtle bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span className="max-w-[140px] truncate">{nextDisc.name}</span>
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Two-Column Single-Scroll Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Sticky Left Column: Full Disc Cover Art + Tags & Exclusive Featured Trekker */}
        <aside className="lg:col-span-5 lg:sticky lg:top-16 space-y-4">
          <div
            className={cn(
              'relative rounded-2xl overflow-hidden bg-surface-card shadow-md',
              isFiveStar
                ? 'border-2 border-purple-400/50 shadow-purple-500/10'
                : isFourStar
                ? 'border-2 border-amber-400/50'
                : 'border-2 border-sky-400/45'
            )}
          >
            {/* Top Rarity Bar */}
            <div
              className={cn(
                'absolute inset-x-0 top-0 h-1 z-20',
                isFiveStar
                  ? 'bg-gradient-to-r from-[#c084fc] via-[#818cf8] to-[#38bdf8]'
                  : isFourStar
                  ? 'bg-[#fde047]'
                  : 'bg-[#7dd3fc]'
              )}
            />

            <img
              src={fullArtUrl}
              alt={disc.name}
              className="block w-full h-auto"
            />

            {/* Top-left Element Pill */}
            <div className="absolute top-3 left-3 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/75 text-xs font-bold text-white border border-white/15">
              {disc.element !== 'None' ? (
                <img
                  src={`/ss-element/${disc.element}.webp`}
                  alt={disc.element}
                  className="size-4 object-contain"
                />
              ) : (
                <Disc className="size-3.5 text-slate-200" aria-hidden="true" />
              )}
              <span>{elementLabel}</span>
            </div>

            {/* Bottom-left Rarity Pill */}
            <div className="absolute bottom-3.5 left-3 z-20 px-2.5 py-1 rounded-full bg-black/75 border border-white/15">
              <RarityStars count={disc.star} size="md" />
            </div>

            {/* Bottom-right Open Full Artwork */}
            <a
              href={fullArtUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open full artwork in new tab"
              className="absolute bottom-3.5 right-3 z-20 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/75 hover:bg-black/90 text-xs font-semibold text-white border border-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <span>Full Art</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>

            {/* Bottom Rarity Bar */}
            <div
              className={cn(
                'absolute inset-x-0 bottom-0 h-1.5 z-20',
                isFiveStar
                  ? 'bg-gradient-to-r from-[#c084fc] via-[#818cf8] to-[#38bdf8] border-t border-purple-200/50'
                  : isFourStar
                  ? 'bg-gradient-to-r from-[#fde047] via-[#facc15] to-[#eab308] border-t border-yellow-200/50'
                  : 'bg-gradient-to-r from-[#7dd3fc] via-[#38bdf8] to-[#0ea5e9] border-t border-sky-200/50'
              )}
            />
          </div>

          {/* Metadata Card: Tags & Exclusive Featured Trekker */}
          {((disc.tag && disc.tag.length > 0) || exclusiveBanner) && (
            <div className="rounded-xl border border-border bg-surface-card p-3.5 space-y-3">
              {disc.tag && disc.tag.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-600 dark:text-white/75">
                    Tags
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {disc.tag.map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-lg bg-base border border-border-subtle text-xs font-semibold text-slate-800 dark:text-white/90"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {exclusiveBanner && (
                <div
                  className={cn(
                    'space-y-2',
                    disc.tag && disc.tag.length > 0 && 'pt-2 border-t border-border-subtle'
                  )}
                >
                  <div className="text-xs font-semibold text-slate-600 dark:text-white/75">
                    Featured trekker
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/trekkers/${encodeURIComponent(exclusiveBanner.trekkerName)}`}
                      className="inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl border border-border-subtle bg-surface-elevated hover:border-border-hover hover:bg-surface-hover text-xs font-bold text-sky-700 dark:text-sky-300 transition-colors press-feedback"
                    >
                      <img
                        src={getTrekkerImageUrl(exclusiveBanner.trekkerId)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-6 rounded-lg object-cover object-top border border-border-subtle"
                      />
                      <span>{exclusiveBanner.trekkerName}</span>
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Right Single-Scroll Column: Full In-Game .disc-card Aesthetic */}
        <div className="lg:col-span-7">
          <div className="disc-card rounded-2xl border border-[var(--dc-panel-border)] bg-[var(--dc-panel)] text-[var(--dc-ink)] shadow-[var(--dc-shadow)] overflow-hidden">
            {/* In-Game Disc Header */}
            <div className="px-4 sm:px-5 pt-4 pb-3.5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {disc.element !== 'None' && (
                    <img
                      src={`/ss-element/${disc.element}.webp`}
                      alt={disc.element}
                      className="size-8 shrink-0 object-contain"
                    />
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <RarityStars count={disc.star} size="sm" />
                      <span className="text-xs font-semibold text-[var(--dc-muted)]">
                        {elementLabel} Disc
                      </span>
                    </div>
                    <h1 className={cn('text-xl sm:text-2xl font-extrabold leading-tight tracking-tight', INK)}>
                      {disc.name}
                    </h1>
                  </div>
                </div>

                {/* Level Slider + Crest C1-C6 Stepper */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--dc-plate-border)] bg-[var(--dc-plate)] px-2.5 py-1">
                    <span className="min-w-[3.1rem] text-xs font-bold tabular-nums text-[var(--dc-value)]">
                      Lv. {discLevel}
                    </span>
                    <input
                      type="range"
                      aria-label="Disc level"
                      min={1}
                      max={90}
                      step={1}
                      value={discLevel}
                      onChange={(e) => setDiscLevel(Number(e.target.value))}
                      className="w-24 sm:w-28 h-1.5 bg-slate-200 dark:bg-slate-700/60 rounded-lg appearance-none cursor-pointer accent-teal-600 dark:accent-teal-400"
                    />
                  </div>

                  <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--dc-plate-border)] bg-[var(--dc-plate)] px-1.5 py-0.5">
                    <button
                      type="button"
                      aria-label="Decrease crescendo"
                      disabled={crescendo <= 1}
                      onClick={() => setCrescendo((c) => Math.max(1, c - 1))}
                      className="px-1.5 py-0.5 text-xs font-bold text-[var(--dc-ink)] disabled:opacity-35 cursor-pointer disabled:cursor-default"
                    >
                      −
                    </button>
                    <span className="px-1.5 text-xs font-bold tabular-nums text-[var(--dc-value)]">
                      C{crescendo}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase crescendo"
                      disabled={crescendo >= 6}
                      onClick={() => setCrescendo((c) => Math.min(6, c + 1))}
                      className="px-1.5 py-0.5 text-xs font-bold text-[var(--dc-ink)] disabled:opacity-35 cursor-pointer disabled:cursor-default"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Base Stat Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-[var(--dc-plate-border)] rounded-lg border border-[var(--dc-plate-border)] bg-[var(--dc-plate)]">
                <div className="flex items-center justify-between gap-2 px-3.5 py-2">
                  <span className={cn('text-xs font-semibold text-[var(--dc-muted)]')}>Base ATK</span>
                  <span className={cn('text-sm font-bold tabular-nums', INK)}>
                    {statSummary.totalAtk.toLocaleString('en-US')}
                    {statSummary.bonusAtk > 0 && (
                      <span className="text-xs font-semibold text-[var(--dc-value)]">
                        {' '}
                        (+{statSummary.bonusAtk.toLocaleString('en-US')})
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 px-3.5 py-2">
                  <span className={cn('text-xs font-semibold text-[var(--dc-muted)]')}>
                    {statSummary.secondaryLabel}
                  </span>
                  <span className={cn('text-sm font-bold tabular-nums', INK)}>
                    {statSummary.secondaryValue}
                  </span>
                </div>
              </div>
            </div>

            {/* Single-Scroll Body */}
            <div className="border-t border-[var(--dc-divider)] px-4 sm:px-5 py-4 space-y-5">
              {/* 1. Melody Skill */}
              {disc.mainSkill && (
                <section>
                  <DiscSectionBanner label={`Melody Skill · C${crescendo}/6`} />
                  <div className={cn(PLATE, 'p-3 space-y-2')}>
                    <DiscSkillPlateHeader
                      icon={getDiscSkillIconUrl(disc.mainSkill.icon)}
                      name={disc.mainSkill.name}
                    >
                      <span
                        className="inline-flex shrink-0 items-center px-2 py-0.5 rounded-md border border-border bg-surface-elevated text-xs font-bold tabular-nums text-[var(--dc-ink)]"
                        title="Melody Skill Level"
                      >
                        C{crescendo}
                      </span>
                    </DiscSkillPlateHeader>
                    <p className={cn('whitespace-pre-line text-[13px] leading-[1.55]', BODY)}>
                      <DiscSkillText
                        desc={disc.mainSkill.desc}
                        params={disc.mainSkill.params}
                        level={crescendo}
                        discElement={disc.element}
                      />
                    </p>
                  </div>
                </section>
              )}

              {/* 2. Harmony Skills */}
              <section>
                <DiscSectionBanner label="Harmony Skills" />
                {hasHarmony ? (
                  <div className="space-y-2.5">
                    {disc.secondarySkill1 && (
                      <HarmonySkillBlock
                        key={`${disc.id}-h1-${disc.secondarySkill1.id}`}
                        skill={disc.secondarySkill1}
                        label="Harmony Skill 1"
                        discElement={disc.element}
                      />
                    )}
                    {disc.secondarySkill2 && (
                      <HarmonySkillBlock
                        key={`${disc.id}-h2-${disc.secondarySkill2.id}`}
                        skill={disc.secondarySkill2}
                        label="Harmony Skill 2"
                        discElement={disc.element}
                      />
                    )}
                  </div>
                ) : (
                  <div className={cn(PLATE, 'p-3 text-xs text-[var(--dc-muted)]')}>
                    3-Star Runic Discs only carry a Melody Skill and Support Notes. Equip them in Support slots to supply starting Musical Notes.
                  </div>
                )}
              </section>

              {/* 3. Starting Support Notes */}
              {supportNoteEntries.length > 0 && (
                <section>
                  <DiscSectionBanner label="Starting Support Notes" />
                  <div className={cn(PLATE, 'p-3 space-y-2.5')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn('text-xs font-semibold', BODY)}>
                        Notes granted when equipped as Support at Phase {supportPhase}
                      </span>
                      <DiscTierPager
                        value={supportPhase}
                        max={maxPhase}
                        displayText={`P${supportPhase}`}
                        label="Support Phase"
                        onChange={setSupportPhase}
                      />
                    </div>

                    <div className="space-y-1.5">
                      {supportNoteEntries.map(([noteName, count]) => {
                        const meta = NOTE_BY_NAME[noteName as NoteName];
                        return (
                          <div
                            key={noteName}
                            className="flex items-center gap-2.5 rounded-md bg-[var(--dc-row)] px-2.5 py-2"
                          >
                            {meta && (
                              <img
                                src={getNoteIconUrl(meta.id)}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="size-5 shrink-0 object-contain"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-[var(--dc-row-ink)] truncate">
                                {meta?.name || noteName}
                              </div>
                              {meta?.statLabel && (
                                <div className="text-xs text-[var(--dc-muted)]">
                                  {meta.statLabel}
                                </div>
                              )}
                            </div>
                            <span className={cn('shrink-0 text-sm font-bold tabular-nums', INK)}>
                              +{count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
