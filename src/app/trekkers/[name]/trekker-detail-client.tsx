'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Award,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Disc,
  ExternalLink,
  Gift,
  Layers,
  Swords,
  X,
} from 'lucide-react';

import {
  STELLA_SORA_GIFTS,
  GIFT_FAMILIES,
  isGiftLovedBy,
  getCharacterFavoriteFamilies,
} from '@/data/gifts';
import {
  getTrekkerImageUrl,
  getWikiTideFileUrl,
  formatIllustrationVariantLabel,
} from '@/lib/wikitide';
import { getPotentialImageUrl } from '@/lib/potential-utils';
import { getDiscOutfitIconUrl } from '@/data/notes';
import { PotentialDesc } from '@/components/builder/potential-desc';
import { useOverlayExit } from '@/lib/use-overlay-exit';
import { ElementType, SSCharacter, SSPotentialFull } from '@/types';
import { cn } from '@/lib/utils';
import { RarityStars } from '@/components/ui/rarity-stars';

// ------------------------------------------------------------------------------
// Mathematical Models & Parameter Parsing
// ------------------------------------------------------------------------------

export interface BaseStats {
  atk: number;
  hp: number;
  def?: number;
  vul: number;
}

export function interpolateStats(
  lvl: number,
  stats: Record<string, BaseStats>
): { atk: number; hp: number; def: number; vul: number } {
  const exact = stats[String(lvl)];
  if (exact) {
    return {
      atk: exact.atk,
      hp: exact.hp,
      def: exact.def ?? 0,
      vul: exact.vul ?? 0,
    };
  }

  let lower = 1;
  let upper = 70;
  if (lvl > 80) {
    lower = 80;
    upper = 90;
  } else if (lvl > 70) {
    lower = 70;
    upper = 80;
  }

  const r = (lvl - lower) / (upper - lower);
  const sLow = stats[String(lower)] || stats['1'];
  const sHigh = stats[String(upper)] || stats['90'];

  return {
    atk: Math.round(sLow.atk + r * (sHigh.atk - sLow.atk)),
    hp: Math.round(sLow.hp + r * (sHigh.hp - sLow.hp)),
    def: sHigh.def ?? sLow.def ?? 0,
    vul: sHigh.vul ?? sLow.vul ?? 0,
  };
}

export function formatSkillDesc(
  desc: string,
  params: (string | number)[],
  level: number = 1
): string {
  if (!desc) return '';
  let formatted = desc;

  (params || []).forEach((param, idx) => {
    let val = String(param ?? '');
    if (typeof param === 'string' && param.includes('/')) {
      const parts = param.split('/');
      const safeIdx = Math.min(Math.max(level, 1), parts.length) - 1;
      val = parts[safeIdx] ?? parts[0];
    }
    formatted = formatted.replaceAll(`&Param${idx + 1}&`, val);
  });

  // Strip trailing Param/HiddenParam debug annotations
  formatted = formatted.replace(
    /(?:\s|\u000b)*\b(?:Hidden)?Param\d+:\s*(?:&(?:Hidden)?Param\d+&|\S+)\s*\([^)]*\)/gi,
    ''
  );

  // Convert mark/glossary tags ##Title#ID# -> Title, resolve empty glossary ref ###4033# -> Bunny Jaws Mode, and strip unknown ###ID#
  formatted = formatted
    .replace(/###4033#/g, 'Bunny Jaws Mode')
    .replace(/###\d+#/g, '')
    .replace(/##([^#]+)#\d+#/g, '$1');

  // Convert \u000b to double line break
  formatted = formatted.replace(/\u000b/g, '\n\n');

  // Strip or normalize color tags
  formatted = formatted.replace(/<color=#[0-9a-fA-F]{6}>(.*?)<\/color>/g, '$1');
  formatted = formatted.replace(/<color=#[0-9a-fA-F]{6}>/g, '');
  formatted = formatted.replace(/<\/color>/g, '');

  return formatted.trim();
}

// ------------------------------------------------------------------------------
// Navigation Types & Definitions
// ------------------------------------------------------------------------------
export type DetailTab = 'details' | 'skills' | 'potentials' | 'talents' | 'affinity';

const DOCK_TABS: { key: DetailTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'details', label: 'Details', icon: BookOpen },
  { key: 'skills', label: 'Skills', icon: Swords },
  { key: 'potentials', label: 'Potentials', icon: Layers },
  { key: 'talents', label: 'Talents', icon: Award },
  { key: 'affinity', label: 'Affinity', icon: Gift },
];

// ------------------------------------------------------------------------------
// In-Game Authentic Info Box Component (Mirrors Game Client UI)
// ------------------------------------------------------------------------------

function ProfileBox({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative rounded-lg bg-surface-elevated/70 dark:bg-[#111927] border border-border-subtle dark:border-[#1e3458] overflow-hidden flex flex-col justify-between min-h-[84px] shadow-xs',
        className
      )}
    >
      <div className="flex items-center">
        <div className="bg-[#2e4b84] px-3.5 py-1 text-xs font-bold text-white tracking-wide [clip-path:polygon(0_0,100%_0,calc(100%-12px)_100%,0_100%)] pr-5 select-none">
          {label}
        </div>
      </div>
      <div className="px-3.5 pt-2 pb-3 flex-1 flex flex-col justify-start">
        {children}
      </div>
      <div className="absolute bottom-0 inset-x-0 h-0.5 border-b border-dashed border-[#2e4b84]/50 pointer-events-none" />
      <div className="absolute bottom-0 left-0 h-[3px] w-12 bg-[#2e4b84] [clip-path:polygon(0_0,calc(100%-6px)_0,100%_100%,0_100%)] pointer-events-none" />
    </div>
  );
}

// ------------------------------------------------------------------------------
// Trekker Detail Client Component
// ------------------------------------------------------------------------------

export interface ExactTalentTier {
  tier: number;
  name: string;
  desc: string;
  statBonuses: { stat: string; value: string }[];
}

export interface SignatureDiscSummary {
  discId: number;
  discName: string;
  discSlug: string;
  discStar: number;
  discElement: ElementType | 'None';
  maxAtk: number;
  bannerName: string;
  bannerKind: 'Limited' | 'Rate-Up';
}

interface TrekkerDetailClientProps {
  character: SSCharacter;
  lore: Record<string, any> | null;
  combat: Record<string, any> | null;
  rawPotentials: SSPotentialFull[];
  exactTalents: ExactTalentTier[];
  illustrations: string[];
  signatureDiscInfo: SignatureDiscSummary | null;
}

export default function TrekkerDetailClient({
  character,
  lore,
  combat,
  rawPotentials,
  exactTalents,
  illustrations,
  signatureDiscInfo,
}: TrekkerDetailClientProps) {
  // Interactive slider states
  const [statLevel, setStatLevel] = useState<number>(90);
  const [skillLevel, setSkillLevel] = useState<number>(1);
  const [potentialLevel, setPotentialLevel] = useState<number>(1);
  const [illustrationIndex, setIllustrationIndex] = useState<number>(0);

  // Tab selections
  const [activeTab, setActiveTab] = useState<DetailTab>('details');
  const [activeSkillKey, setActiveSkillKey] = useState<'normalAtk' | 'skill' | 'supportSkill' | 'ultimate'>('normalAtk');
  const [potentialSlotMode, setPotentialSlotMode] = useState<'main' | 'support'>('main');
  const [selectedPotential, setSelectedPotential] = useState<SSPotentialFull | null>(null);
  const [hoveredPotential, setHoveredPotential] = useState<SSPotentialFull | null>(null);

  // Modal inspection dialog
  const [inspectedPotential, setInspectedPotential] = useState<SSPotentialFull | null>(null);
  const modalCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const modalDialogRef = useRef<HTMLDivElement | null>(null);
  const modalTriggerRef = useRef<HTMLElement | null>(null);

  const openPotentialModal = (pot: SSPotentialFull, triggerEl?: HTMLElement | null) => {
    modalTriggerRef.current = triggerEl ?? (document.activeElement as HTMLElement | null);
    setInspectedPotential(pot);
  };

  const { requestClose: requestClosePotentialModal, isClosing: isPotentialModalClosing } =
    useOverlayExit(() => {
      setInspectedPotential(null);
      const trigger = modalTriggerRef.current;
      modalTriggerRef.current = null;
      requestAnimationFrame(() => {
        if (trigger && trigger.isConnected) trigger.focus();
      });
    }, Boolean(inspectedPotential));

  const requestCloseModalRef = useRef(requestClosePotentialModal);
  requestCloseModalRef.current = requestClosePotentialModal;

  // Focus management, Tab trap, and Escape key handling for inspect modal
  useEffect(() => {
    if (!inspectedPotential) return;

    const frame = requestAnimationFrame(() => {
      modalCloseBtnRef.current?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestCloseModalRef.current();
        return;
      }
      if (e.key === 'Tab' && modalDialogRef.current) {
        const focusables = modalDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [inspectedPotential]);

  const isFiveStar = character.star >= 5;

  // Group potentials into canonical builds
  const potentialGroups = useMemo(() => {
    return {
      mainCore: rawPotentials.filter((p) => p.group === 'mainCore'),
      mainNormal: rawPotentials.filter((p) => p.group === 'mainNormal'),
      supportCore: rawPotentials.filter((p) => p.group === 'supportCore'),
      supportNormal: rawPotentials.filter((p) => p.group === 'supportNormal'),
      common: rawPotentials.filter((p) => p.group === 'common'),
    };
  }, [rawPotentials]);

  // Active potential preview for showcase card / speech bubble
  const activePotential = useMemo(() => {
    if (hoveredPotential) return hoveredPotential;
    if (selectedPotential) return selectedPotential;
    if (potentialSlotMode === 'main') {
      return potentialGroups.mainCore[0] || rawPotentials[0] || null;
    }
    return potentialGroups.supportCore[0] || rawPotentials[0] || null;
  }, [hoveredPotential, selectedPotential, potentialSlotMode, potentialGroups, rawPotentials]);

  // Builds organized authentically by in-game grouping
  const currentBuilds = useMemo(() => {
    if (potentialSlotMode === 'main') {
      return [
        {
          id: 'main-1',
          title: `${character.name.EN}: Main Build 1`,
          description:
            character.name.EN === 'Chitose'
              ? 'An Auto Attack build that generates Coiling Serpents and Mirror Images upon skill activation.'
              : '',
          potentials: [
            ...potentialGroups.mainCore.slice(0, 2),
            ...[...potentialGroups.mainNormal.slice(0, 3)].sort((a, b) => a.rarityNum - b.rarityNum),
          ],
        },
        {
          id: 'main-2',
          title: `${character.name.EN}: Main Build 2`,
          description:
            character.name.EN === 'Chitose'
              ? 'A skill build that allows skills to enhance Coiling Serpents and create Mirror Images.'
              : '',
          potentials: [
            ...potentialGroups.mainCore.slice(2, 4),
            ...[...potentialGroups.mainNormal.slice(3, 6)].sort((a, b) => a.rarityNum - b.rarityNum),
          ],
        },
        {
          id: 'generic',
          title: 'Generic',
          description: '',
          potentials: [
            ...potentialGroups.mainNormal.slice(6),
            ...potentialGroups.common,
          ].sort((a, b) => a.rarityNum - b.rarityNum),
        },
      ];
    } else {
      return [
        {
          id: 'support-1',
          title: `${character.name.EN}: Support Build 1`,
          description: '',
          potentials: [
            ...potentialGroups.supportCore.slice(0, 2),
            ...[...potentialGroups.supportNormal.slice(0, 3)].sort((a, b) => a.rarityNum - b.rarityNum),
          ],
        },
        {
          id: 'support-2',
          title: `${character.name.EN}: Support Build 2`,
          description: '',
          potentials: [
            ...potentialGroups.supportCore.slice(2, 4),
            ...[...potentialGroups.supportNormal.slice(3, 6)].sort((a, b) => a.rarityNum - b.rarityNum),
          ],
        },
        {
          id: 'generic',
          title: 'Generic',
          description: '',
          potentials: [
            ...potentialGroups.supportNormal.slice(6),
            ...potentialGroups.common,
          ].sort((a, b) => a.rarityNum - b.rarityNum),
        },
      ];
    }
  }, [potentialSlotMode, character.name.EN, potentialGroups]);

  // Stat interpolation calculation
  const currentStats = useMemo(() => {
    if (!combat?.stats) return { atk: 0, hp: 0, def: 0, vul: 0 };
    return interpolateStats(statLevel, combat.stats);
  }, [statLevel, combat]);

  // Loved gifts calculation
  const lovedGifts = useMemo(() => {
    return STELLA_SORA_GIFTS.filter((gift) => isGiftLovedBy(gift, character.id));
  }, [character.id]);

  const favoriteFamilies = useMemo(() => {
    return getCharacterFavoriteFamilies(character.id);
  }, [character.id]);

  // Reset illustration carousel when switching Trekkers
  useEffect(() => {
    setIllustrationIndex(0);
  }, [character?.id]);

  // Head portrait URL (local self-hosted asset)
  const headUrl = getTrekkerImageUrl(character.id);

  const safeIllustrationIndex =
    illustrations.length > 0 ? illustrationIndex % illustrations.length : 0;
  const activeIllustrationFilename = illustrations[safeIllustrationIndex] ?? null;
  const activeIllustrationUrl = activeIllustrationFilename
    ? getWikiTideFileUrl(activeIllustrationFilename)
    : headUrl;
  const activeIllustrationLabel = activeIllustrationFilename
    ? formatIllustrationVariantLabel(activeIllustrationFilename, character.name.EN)
    : 'Portrait';

  // Dock navigation cycle helper
  const cycleTab = (direction: 'prev' | 'next') => {
    const currentIndex = DOCK_TABS.findIndex((t) => t.key === activeTab);
    if (direction === 'prev') {
      const nextIdx = (currentIndex - 1 + DOCK_TABS.length) % DOCK_TABS.length;
      setActiveTab(DOCK_TABS[nextIdx].key);
    } else {
      const nextIdx = (currentIndex + 1) % DOCK_TABS.length;
      setActiveTab(DOCK_TABS[nextIdx].key);
    }
  };

  const fullIllustrationAside = (
    <aside className="lg:sticky lg:top-16">
      <div className="game-card celestial-card overflow-hidden">
        {/* Top Rarity Accent Strip */}
        <div
          className={cn(
            'h-1.5 w-full',
            isFiveStar
              ? 'bg-gradient-to-r from-[#c084fc] via-[#818cf8] to-[#38bdf8]'
              : 'bg-gradient-to-r from-yellow-400 to-amber-500'
          )}
        />

        {/* Full Illustration Viewport */}
        <div className="relative aspect-[3/4.3] min-h-[480px] bg-surface-subtle dark:bg-[#090d16] flex items-center justify-center p-4 overflow-hidden select-none">
          {/* Top-right floating controls (1/N counter + open full image) */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
            {illustrations.length > 0 && (
              <span className="inline-flex items-center h-7 px-2.5 rounded-full bg-white/90 dark:bg-[#0f172a]/90 border border-slate-200/80 dark:border-white/15 text-[11px] font-bold tabular-nums text-slate-800 dark:text-white shadow-xs backdrop-blur-xs">
                {safeIllustrationIndex + 1}/{illustrations.length}
              </span>
            )}
            <a
              href={activeIllustrationUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open full illustration"
              aria-label="Open full illustration in new tab"
              className="inline-flex items-center justify-center size-7 rounded-full bg-white/90 dark:bg-[#0f172a]/90 border border-slate-200/80 dark:border-white/15 text-slate-700 dark:text-white/90 hover:bg-white dark:hover:bg-[#1e293b] transition-colors shadow-xs backdrop-blur-xs"
            >
              <ExternalLink className="size-3.5" />
            </a>
          </div>

          {/* Previous / Next Variant Arrows */}
          {illustrations.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setIllustrationIndex((prev) =>
                    (prev - 1 + illustrations.length) % illustrations.length
                  )
                }
                aria-label="Previous illustration"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center size-8 rounded-full bg-white/90 dark:bg-[#0f172a]/90 border border-slate-200/80 dark:border-white/15 text-slate-700 dark:text-white hover:bg-white dark:hover:bg-[#1e293b] transition-colors shadow-sm cursor-pointer backdrop-blur-xs"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setIllustrationIndex((prev) => (prev + 1) % illustrations.length)
                }
                aria-label="Next illustration"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center size-8 rounded-full bg-white/90 dark:bg-[#0f172a]/90 border border-slate-200/80 dark:border-white/15 text-slate-700 dark:text-white hover:bg-white dark:hover:bg-[#1e293b] transition-colors shadow-sm cursor-pointer backdrop-blur-xs"
              >
                <ChevronRight className="size-4" />
              </button>
            </>
          )}

          {/* Variant Label Pill */}
          <div className="absolute bottom-3 left-3 z-10">
            <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-white/90 dark:bg-[#0f172a]/90 border border-slate-200/80 dark:border-white/15 text-[11px] font-semibold text-slate-700 dark:text-white/90 shadow-xs backdrop-blur-xs">
              {activeIllustrationLabel}
            </span>
          </div>

          {/* Full Illustration Cutout */}
          <img
            key={activeIllustrationUrl}
            src={activeIllustrationUrl}
            alt={`${character.name.EN} — ${activeIllustrationLabel}`}
            className="max-h-full max-w-full w-auto h-auto object-contain drop-shadow-sm"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (!target.dataset.fallbackApplied) {
                target.dataset.fallbackApplied = '1';
                target.src = headUrl;
              }
            }}
          />
        </div>
      </div>
    </aside>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 flex flex-col justify-between min-h-[700px]">
      <div className="space-y-6 pb-24 scroll-pb-24 [&_a]:scroll-mb-24 [&_button]:scroll-mb-24 [&_input]:scroll-mb-24">
        <h1 className="sr-only">{character.name.EN}</h1>

        {/* ==================================================================== */}
        {/* TAB 1: DETAILS (FULL ILLUSTRATION ON LEFT + HEADER & TELEMETRY RIGHT) */}
        {/* ==================================================================== */}
        <section
          role="tabpanel"
          hidden={activeTab !== 'details'}
          className={cn(
            activeTab === 'details'
              ? 'grid grid-cols-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[410px_1fr] gap-6 items-start'
              : 'hidden'
          )}
        >
          {activeTab === 'details' && fullIllustrationAside}

            {/* Right Column: SchaleDB-Style Identity Header + Profile + Combat Telemetry */}
            <div className="space-y-5">
              {/* Identity Header (image.png layout, open without outer card) */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 px-1">
                {/* Left: Stars + Name + Faction + Badges + Actions */}
                <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Star Rating */}
                      <RarityStars count={character.star} size="md" />

                      {/* Name & Sub-names */}
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                          {character.name.EN}
                        </h2>
                        {(character.name.JP || character.name.CN) && (
                          <span className="text-xs text-slate-500 dark:text-white/60 font-medium">
                            {character.name.JP && `JP: ${character.name.JP}`}
                            {character.name.JP && character.name.CN && ' • '}
                            {character.name.CN && `CN: ${character.name.CN}`}
                          </span>
                        )}
                      </div>

                      {/* Faction */}
                      {lore?.faction && (
                        <p className="text-xs font-semibold text-slate-600 dark:text-white/75">
                          {lore.faction}
                        </p>
                      )}

                      {/* Canonical Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-xs">
                        <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-surface-elevated border border-border-subtle font-semibold text-slate-800 dark:text-white">
                          <img
                            src={`/ss-element/${character.element}.webp`}
                            alt={character.element}
                            className="size-3.5 object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          {character.element}
                        </span>

                        <span className="inline-flex items-center py-1 px-2.5 rounded-full bg-surface-elevated border border-border-subtle font-semibold text-slate-800 dark:text-white">
                          {character.class}
                        </span>

                        <span className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-surface-elevated border border-border-subtle font-semibold text-slate-800 dark:text-white">
                          <img
                            src={`/ss-class/${character.attackType}.png`}
                            alt=""
                            aria-hidden="true"
                            className="size-3.5 object-contain brightness-0 dark:brightness-100"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                          {character.attackType}
                        </span>
                      </div>

                      {/* Quick Action Links */}
                      <div className="flex flex-wrap items-center gap-2 pt-1.5">
                        <Link
                          href={`/builder?char=${character.id}`}
                          className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors press-feedback cursor-pointer"
                        >
                          <Layers className="size-3.5" aria-hidden="true" />
                          <span>Load in Preset Visualizer</span>
                        </Link>

                        <Link
                          href={`/bond?char=${character.id}`}
                          className="inline-flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-lg border border-border-subtle bg-surface-elevated hover:bg-surface-hover text-slate-700 dark:text-white text-xs font-medium transition-colors"
                        >
                          <Gift className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                          <span>Affinity Calc</span>
                        </Link>

                        <a
                          href={`https://stellasora.miraheze.org/wiki/${encodeURIComponent(character.name.EN.replace(/ /g, '_'))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1 h-8 px-2 text-xs text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                          <span>Open Wiki Entry</span>
                          <ExternalLink className="size-3" aria-hidden="true" />
                        </a>
                      </div>
                    </div>

                  {/* Right: Square Portrait Thumbnail (image.png top-right) */}
                  <div className="hidden sm:block shrink-0">
                    <div className="size-24 rounded-xl overflow-hidden border border-border-subtle bg-slate-900">
                      <img
                        src={headUrl}
                        alt={`${character.name.EN} Portrait`}
                        className="w-full h-full object-cover object-top"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.dataset.fallbackApplied) {
                            target.dataset.fallbackApplied = '1';
                            target.src = '/bastelina.png';
                          }
                        }}
                      />
                    </div>
                  </div>
              </div>

              {/* Profile Card Window */}
              <div className="game-card celestial-card p-5 sm:p-6 space-y-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Profile
                </h2>

                {/* Profile Description / Story Box */}
                {lore?.profile && (
                  <div className="rounded-xl bg-surface-elevated/70 dark:bg-[#111927] border border-border-subtle dark:border-[#1e3458] p-4 sm:p-5 text-sm text-slate-800 dark:text-white/90 leading-relaxed space-y-3 font-normal">
                    {lore.profile
                      .replace(/^"+|"+$/g, '')
                      .split(/\n\s*\n/)
                      .map((paragraph: string, idx: number) => (
                        <p key={idx}>{paragraph.trim()}</p>
                      ))}
                  </div>
                )}

                {/* 3-Column Metadata Grid (Experience, Birthday, Faction) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ProfileBox label="Experience">
                    <span className="text-sm sm:text-base font-bold text-[#0e7490] dark:text-[#22d3ee] leading-snug block break-words">
                      {lore?.experience || '—'}
                    </span>
                  </ProfileBox>

                  <ProfileBox label="Birthday">
                    <span className="text-sm sm:text-base font-bold text-[#0e7490] dark:text-[#22d3ee] leading-snug block break-words">
                      {lore?.birthday || '—'}
                    </span>
                  </ProfileBox>

                  <ProfileBox label="Faction">
                    <span className="text-sm sm:text-base font-bold text-[#0e7490] dark:text-[#22d3ee] leading-snug block break-words">
                      {lore?.faction || '—'}
                    </span>
                  </ProfileBox>
                </div>

                {/* Full-Width Hobbies / Specialties Card */}
                {lore?.skillsText && (
                  <ProfileBox label="Hobbies" className="min-h-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-white/90 leading-relaxed">
                      {lore.skillsText}
                    </p>
                  </ProfileBox>
                )}

                {/* Tactical & Lore Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ProfileBox label="Weapon">
                    <span className="text-sm sm:text-base font-bold text-[#0e7490] dark:text-[#22d3ee] leading-snug block break-words">
                      {lore?.weapon || '—'}
                    </span>
                  </ProfileBox>

                  <ProfileBox label="Style">
                    <span className="text-sm sm:text-base font-bold text-[#0e7490] dark:text-[#22d3ee] leading-snug block break-words">
                      {lore?.style || '—'}
                    </span>
                  </ProfileBox>

                  <ProfileBox label="Address">
                    <span className="text-sm sm:text-base font-bold text-[#0e7490] dark:text-[#22d3ee] leading-snug block break-words">
                      {lore?.address || '—'}
                    </span>
                  </ProfileBox>
                </div>

                {/* Voice Actors Grid */}
                {lore?.voiceActor && (lore.voiceActor.jp || lore.voiceActor.cn) && (
                  <div
                    className={cn(
                      'grid gap-3',
                      lore.voiceActor.jp && lore.voiceActor.cn
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1'
                    )}
                  >
                    {lore.voiceActor.jp && (
                      <ProfileBox label="Voice Actor (JP)">
                        <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug block break-words">
                          {lore.voiceActor.jp}
                        </span>
                      </ProfileBox>
                    )}
                    {lore.voiceActor.cn && (
                      <ProfileBox label="Voice Actor (CN)">
                        <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug block break-words">
                          {lore.voiceActor.cn}
                        </span>
                      </ProfileBox>
                    )}
                  </div>
                )}
              </div>

              {/* Base Attributes */}
              <div className="game-card celestial-card p-5 sm:p-6 space-y-5">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                  Base Attributes
                </h2>

                {/* Level Slider Control */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-700 dark:text-white">
                      Selected Level
                    </span>
                    <span className="tabular-nums text-sm font-bold text-amber-700 dark:text-amber-400">
                      Lv. {statLevel} <span className="text-xs text-slate-600 dark:text-white/75 font-normal">/ 90</span>
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Character Level"
                    min={1}
                    max={90}
                    step={1}
                    value={statLevel}
                    onChange={(e) => setStatLevel(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700/60 rounded-lg appearance-none cursor-pointer accent-teal-600 dark:accent-teal-400"
                  />
                </div>

                {/* Clean 4-Cell Divided Stat Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 border border-border-subtle rounded-xl bg-surface-elevated/60 overflow-hidden max-sm:[&>*:not(:first-child)]:border-t sm:[&>*:nth-child(2n)]:border-l sm:[&>*:nth-child(n+3)]:border-t border-border-subtle">
                  <div className="px-4 py-3 flex items-baseline justify-between gap-3 border-border-subtle">
                    <span className="text-xs font-semibold text-slate-700 dark:text-white">
                      HP{' '}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        (Health Points)
                      </span>
                    </span>
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white text-right">
                      {currentStats.hp.toLocaleString()}
                    </span>
                  </div>

                  <div className="px-4 py-3 flex items-baseline justify-between gap-3 border-border-subtle">
                    <span className="text-xs font-semibold text-slate-700 dark:text-white">
                      ATK{' '}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        (Attack Power)
                      </span>
                    </span>
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white text-right">
                      {currentStats.atk.toLocaleString()}
                    </span>
                  </div>

                  <div className="px-4 py-3 flex items-baseline justify-between gap-3 border-border-subtle">
                    <span className="text-xs font-semibold text-slate-700 dark:text-white">
                      DEF{' '}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        (Defense Rating)
                      </span>
                    </span>
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white text-right">
                      {currentStats.def}
                    </span>
                  </div>

                  <div className="px-4 py-3 flex items-baseline justify-between gap-3 border-border-subtle">
                    <span className="text-xs font-semibold text-slate-700 dark:text-white">
                      VUL{' '}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        (Vulnerability)
                      </span>
                    </span>
                    <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white text-right">
                      {currentStats.vul}%
                    </span>
                  </div>
                </div>
              </div>

              {signatureDiscInfo && (() => {
                const {
                  discId,
                  discName,
                  discSlug,
                  discStar,
                  discElement,
                  maxAtk,
                } = signatureDiscInfo;
                const discElementLabel = discElement === 'None' ? 'Neutral' : discElement;

                return (
                  <div className="game-card celestial-card p-5 sm:p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Disc className="size-5 text-[#0e7490] dark:text-[#22d3ee]" aria-hidden="true" />
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                        Featured Runic Disc
                      </h2>
                    </div>

                    <Link
                      href={`/discs/${discSlug}`}
                      className="group w-full rounded-xl bg-surface-elevated/70 border border-border-subtle hover:border-border-hover hover:bg-surface-hover p-3.5 flex items-center gap-4 transition-colors press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <div className="relative size-16 rounded-lg overflow-hidden shrink-0 border border-border-subtle bg-base">
                        <img
                          src={getDiscOutfitIconUrl(discId, 'full')}
                          alt={discName}
                          loading="lazy"
                          decoding="async"
                          className="size-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <RarityStars count={discStar} size="sm" />
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-white/75">
                            {discElement !== 'None' && (
                              <img
                                src={`/ss-element/${discElement}.webp`}
                                alt=""
                                className="size-3.5 object-contain"
                              />
                            )}
                            <span>{discElementLabel}</span>
                          </span>
                        </div>
                        <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:underline truncate">
                          {discName}
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-white/75">
                          <span className="font-mono tabular-nums font-semibold">
                            Lv.90 ATK {maxAtk.toLocaleString('en-US')}
                          </span>
                          <span className="inline-flex items-center gap-1 font-bold text-sky-600 dark:text-sky-400">
                            <span>Inspect</span>
                            <ArrowUpRight className="size-3.5" aria-hidden="true" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })()}
            </div>
          </section>

          {/* ==================================================================== */}
          {/* TAB 2: COMBAT SKILLS (VERTICAL SELECTOR RAIL & CORNER BRACKETS)     */}
          {/* ==================================================================== */}
          <section
            role="tabpanel"
            hidden={activeTab !== 'skills'}
            className={cn(
              activeTab === 'skills'
                ? 'grid grid-cols-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[410px_1fr] gap-6 items-start'
                : 'hidden'
            )}
          >
            {activeTab === 'skills' && fullIllustrationAside}
            <div className="min-w-0 space-y-4">
              <div className="game-card celestial-card p-5 space-y-4">
                {/* Level Controls Header */}
                <div className="border-b border-border-subtle pb-3">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Combat Skills
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-white/80">
                    Select a skill to inspect level scaling.
                  </p>
                </div>

                {/* Skill Level Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 dark:text-white">
                      Skill Level Scaling (Lv 1–13)
                    </span>
                    <span className="tabular-nums text-sm font-bold text-amber-700 dark:text-amber-400">
                      Lv. {skillLevel} <span className="text-xs text-slate-600 dark:text-white/75 font-normal">/ 13</span>
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Skill Level"
                    min={1}
                    max={13}
                    step={1}
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700/60 rounded-lg appearance-none cursor-pointer accent-teal-600 dark:accent-teal-400"
                  />
                </div>

                {/* Vertical Rail + Ability Details Display */}
                <div className="flex flex-col md:flex-row gap-4 pt-2">
                  {/* Left Rail: Vertical Ability Selector with Target Corner Brackets */}
                  <div className="flex flex-row flex-wrap md:flex-nowrap md:flex-col gap-2 shrink-0 md:w-52 pb-1 md:pb-0">
                    {[
                      { key: 'normalAtk', label: 'Normal Attack' },
                      { key: 'skill', label: 'Combat Skill' },
                      { key: 'supportSkill', label: 'Support Skill' },
                      { key: 'ultimate', label: 'Ultimate' },
                    ].map((tab) => {
                      const isActive = activeSkillKey === tab.key;
                      const abilityData = combat ? combat[tab.key] : null;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setActiveSkillKey(tab.key as any)}
                          className={cn(
                            'relative p-2.5 rounded-xl border text-left transition-colors press-feedback cursor-pointer flex items-center gap-2.5 shrink-0 md:w-full',
                            isActive
                              ? 'bg-[#0abec5]/10 border-teal-600 dark:border-teal-400'
                              : 'bg-surface-elevated/80 border-border-subtle hover:bg-surface-hover text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white'
                          )}
                        >
                          {/* Target Corner Brackets on Active Ability */}
                          {isActive && (
                            <>
                              <span className="absolute top-0 left-0 size-2 border-t-2 border-l-2 border-teal-600 dark:border-teal-400 pointer-events-none" />
                              <span className="absolute top-0 right-0 size-2 border-t-2 border-r-2 border-teal-600 dark:border-teal-400 pointer-events-none" />
                              <span className="absolute bottom-0 left-0 size-2 border-b-2 border-l-2 border-teal-600 dark:border-teal-400 pointer-events-none" />
                              <span className="absolute bottom-0 right-0 size-2 border-b-2 border-r-2 border-teal-600 dark:border-teal-400 pointer-events-none" />
                            </>
                          )}

                          <div className={cn(
                            'size-9 rounded-lg border overflow-hidden shrink-0 flex items-center justify-center p-1 transition-colors',
                            isActive
                              ? 'bg-gradient-to-b from-[#1b5b9c] to-[#0f345c] border-cyan-400'
                              : 'bg-gradient-to-b from-[#163a63] to-[#0d223a] border-cyan-500/40'
                          )}>
                            {abilityData?.icon ? (
                              <img
                                src={`https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/skill/${abilityData.icon}.webp`}
                                alt={tab.label}
                                loading="lazy"
                                decoding="async"
                                className="size-full object-contain filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  if (!img.dataset.fallbackApplied) {
                                    img.dataset.fallbackApplied = '1';
                                    img.src = headUrl;
                                  }
                                }}
                              />
                            ) : (
                              <Swords className="size-4 text-cyan-300" />
                            )}
                          </div>

                          <div className="min-w-0">
                            <span className="block text-xs font-bold leading-tight truncate text-slate-900 dark:text-white">
                              {tab.label}
                            </span>
                            <span className="block text-[11px] text-slate-600 dark:text-white/75 truncate">
                              {abilityData?.name || 'Standard'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Detail Pane (all 4 skills rendered in DOM for crawlability; inactive hidden) */}
                  <div className="flex-1 min-w-0 space-y-4">
                    {(['normalAtk', 'skill', 'supportSkill', 'ultimate'] as const).map((skillKey) => {
                      const skillItem = combat ? combat[skillKey] : null;
                      const isActiveSkill = activeSkillKey === skillKey;
                      return (
                        <div
                          key={skillKey}
                          hidden={!isActiveSkill}
                          className={cn(!isActiveSkill && 'hidden')}
                        >
                          {skillItem ? (
                            <div className="p-4 rounded-xl bg-surface-elevated/60 border border-border-subtle space-y-3.5">
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex items-center gap-3">
                                  <div className="size-14 rounded-xl bg-gradient-to-b from-[#1b5b9c] to-[#0f345c] border-2 border-cyan-600 dark:border-cyan-400 overflow-hidden shrink-0 flex items-center justify-center p-1.5">
                                    <img
                                      src={`https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/skill/${skillItem.icon}.webp`}
                                      alt={skillItem.name}
                                      loading="lazy"
                                      decoding="async"
                                      className="size-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                                      onError={(e) => {
                                        const img = e.target as HTMLImageElement;
                                        if (!img.dataset.fallbackApplied) {
                                          img.dataset.fallbackApplied = '1';
                                          img.src = headUrl;
                                        }
                                      }}
                                    />
                                  </div>

                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                        {skillItem.name}
                                      </h3>
                                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-600/30 dark:border-amber-500/30">
                                        {character.element} DMG
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-white/80 mt-0.5">
                                      <span>
                                        Cooldown:{' '}
                                        <strong className={skillItem.cooldown ? 'text-teal-700 dark:text-teal-400 font-bold' : 'text-slate-700 dark:text-white'}>
                                          {skillItem.cooldown || '—'}
                                        </strong>
                                      </span>
                                      <span>•</span>
                                      <span>
                                        Energy:{' '}
                                        <strong className={skillItem.energy ? 'text-amber-700 dark:text-amber-400 font-bold' : 'text-slate-700 dark:text-white'}>
                                          {skillItem.energy ? `${skillItem.energy}` : '—'}
                                        </strong>
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <span className="px-2.5 py-1 rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-600/30 dark:border-teal-500/30 font-mono tabular-nums text-xs font-bold">
                                  Lv.{skillLevel} Scaling
                                </span>
                              </div>

                              {/* Skill Description */}
                              <div className="p-4 rounded-xl bg-surface-elevated border border-border-subtle text-xs sm:text-sm text-slate-700 dark:text-white leading-relaxed whitespace-pre-line font-normal">
                                <div className="max-w-[70ch]">
                                  <PotentialDesc
                                    descTemplate={formatSkillDesc(skillItem.desc, skillItem.params, skillLevel)}
                                    params={[]}
                                    defaultElement={character.element}
                                    characterId={character.id}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-8 text-center text-xs text-slate-600 dark:text-white/80">
                              Combat skill data not available.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ==================================================================== */}
          {/* TAB 3: POTENTIALS (AUTHENTIC WHOLE-IMAGE CARDS & SPEECH BUBBLE)     */}
          {/* ==================================================================== */}
          <section
            role="tabpanel"
            hidden={activeTab !== 'potentials'}
            className={cn(activeTab === 'potentials' ? 'space-y-4' : 'hidden')}
          >
              {/* Top Navigation Bar: Segmented [ Main ] / [ Support ] + Level Slider + Preset Link */}
              <div className="game-card celestial-card p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="inline-flex p-1 rounded-full bg-surface-elevated border border-border-subtle shadow-xs">
                    <button
                      type="button"
                      aria-pressed={potentialSlotMode === 'main'}
                      onClick={() => setPotentialSlotMode('main')}
                      className={cn(
                        'px-6 py-1.5 rounded-full text-xs font-bold transition-colors press-feedback cursor-pointer',
                        potentialSlotMode === 'main'
                          ? 'bg-[#1e325c] text-white shadow-xs'
                          : 'text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white'
                      )}
                    >
                      Main
                    </button>
                    <button
                      type="button"
                      aria-pressed={potentialSlotMode === 'support'}
                      onClick={() => setPotentialSlotMode('support')}
                      className={cn(
                        'px-6 py-1.5 rounded-full text-xs font-bold transition-colors press-feedback cursor-pointer',
                        potentialSlotMode === 'support'
                          ? 'bg-[#1e325c] text-white shadow-xs'
                          : 'text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white'
                      )}
                    >
                      Support
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-auto">
                  {/* Compact Level Scaling Control */}
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-elevated border border-border-subtle text-xs">
                    <span className="text-slate-700 dark:text-white/85 font-medium whitespace-nowrap tabular-nums">
                      Lv. <strong className="font-mono text-amber-700 dark:text-amber-400">{potentialLevel}</strong>/9
                    </span>
                    <input
                      type="range"
                      aria-label="Potential Level"
                      min={1}
                      max={9}
                      step={1}
                      value={potentialLevel}
                      onChange={(e) => setPotentialLevel(Number(e.target.value))}
                      className="w-20 sm:w-24 h-1.5 bg-slate-200 dark:bg-slate-700/60 rounded-lg appearance-none cursor-pointer accent-teal-600 dark:accent-teal-400"
                    />
                  </div>

                  <Link
                    href={`/builder?char=${character.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-surface-elevated hover:bg-surface-hover border border-border text-slate-800 dark:text-white text-xs font-bold transition-colors press-feedback shadow-xs"
                  >
                    <span>System Preset</span>
                  </Link>
                </div>
              </div>

              {/* Two-Column Showcase: Left Tarot Potential Preview + Right In-Game Builds Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-[290px_1fr] xl:grid-cols-[300px_1fr] gap-6 items-start">
                {/* -------------------------------------------------------------- */}
                {/* LEFT: IN-GAME POTENTIAL PREVIEW CARD (MATCHING POTENTIALS.PNG) */}
                {/* -------------------------------------------------------------- */}
                <div className="relative lg:sticky lg:top-20 flex flex-col items-center lg:items-end">
                  <div className="w-[278px] space-y-2">
                    {activePotential ? (() => {
                      const isCore = activePotential.isCore || activePotential.rarityNum === 0;
                      const isRare = !isCore && activePotential.rarityNum === 1;
                      const palette = isCore
                        ? {
                            gradTop: '#ff3399',
                            gradMid: '#ff66ba',
                            gradBot: '#ff94d2',
                            cornerDark: '#ff1e8a',
                            octRay: '#ff52b0',
                            starTop: '#ff70c2',
                            starBot: '#ff389c',
                            archBand: '#ff75c3',
                            cornerStroke: '#f9a8d4',
                            innerStarStroke: '#f472b6',
                            innerStarFill: '#ffe3f3',
                            iconShadow: 'drop-shadow(0 4px 3px rgba(190,18,93,0.35))',
                          }
                        : isRare
                        ? {
                            gradTop: '#6d28d9',
                            gradMid: '#8b5cf6',
                            gradBot: '#60a5fa',
                            cornerDark: '#5b21b6',
                            octRay: '#7c3aed',
                            starTop: '#818cf8',
                            starBot: '#6d28d9',
                            archBand: '#a78bfa',
                            cornerStroke: '#c4b5fd',
                            innerStarStroke: '#8b5cf6',
                            innerStarFill: '#ede9fe',
                            iconShadow: 'drop-shadow(0 4px 3px rgba(76,29,149,0.38))',
                          }
                        : {
                            gradTop: '#d97706',
                            gradMid: '#f59e0b',
                            gradBot: '#fde047',
                            cornerDark: '#b45309',
                            octRay: '#ea580c',
                            starTop: '#fbbf24',
                            starBot: '#d97706',
                            archBand: '#fbbf24',
                            cornerStroke: '#fcd34d',
                            innerStarStroke: '#f59e0b',
                            innerStarFill: '#fef3c7',
                            iconShadow: 'drop-shadow(0 4px 3px rgba(146,64,14,0.38))',
                          };

                      const firstParamParts = String(activePotential.params?.[0] ?? '').split('/');
                      const effectiveLevel =
                        isCore && firstParamParts.length > 9 && potentialLevel === 1
                          ? 8
                          : potentialLevel;

                      const gradId = `pot-bg-grad-${activePotential.rarityNum}`;
                      const starGradId = `pot-star-grad-${activePotential.rarityNum}`;

                      return (
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`Inspect ${activePotential.name} potential details`}
                          onClick={(e) => openPotentialModal(activePotential, e.currentTarget)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openPotentialModal(activePotential, e.currentTarget);
                            }
                          }}
                          className="relative w-[278px] min-h-[422px] rounded-[8px] bg-white p-[5px] border-[1.5px] border-[#6c63b8] shadow-[0_10px_28px_rgba(15,23,42,0.25)] flex flex-col cursor-pointer"
                        >
                          {/* ==================================================== */}
                          {/* TOP VESTIGE STARBURST HEADER (242px)                 */}
                          {/* ==================================================== */}
                          <div className="relative h-[242px] w-full overflow-hidden shrink-0 rounded-t-[4px]">
                            {/* Geometric Starburst + Arch SVG */}
                            <svg
                              className="absolute inset-0 size-full pointer-events-none"
                              viewBox="0 0 268 242"
                              preserveAspectRatio="none"
                            >
                              <defs>
                                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={palette.gradTop} />
                                  <stop offset="55%" stopColor={palette.gradMid} />
                                  <stop offset="100%" stopColor={palette.gradBot} />
                                </linearGradient>
                                <linearGradient id={starGradId} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={palette.starTop} />
                                  <stop offset="100%" stopColor={palette.starBot} />
                                </linearGradient>
                              </defs>

                              {/* Base Radiant Gradient */}
                              <rect width="268" height="242" fill={`url(#${gradId})`} />

                              {/* Top-Left & Top-Right Deep Corner Wedges */}
                              <polygon points="0,0 72,0 54,50 0,80" fill={palette.cornerDark} opacity="0.65" />
                              <polygon points="268,0 196,0 214,50 268,80" fill={palette.cornerDark} opacity="0.65" />

                              {/* Bottom-Left & Bottom-Right Side Facets */}
                              <polygon points="0,148 62,180 78,242 0,242" fill={palette.cornerDark} opacity="0.32" />
                              <polygon points="268,148 206,180 190,242 268,242" fill={palette.cornerDark} opacity="0.32" />

                              {/* Outer Octagonal Starburst Rays */}
                              <polygon
                                points="72,0 196,0 214,50 268,80 268,148 206,180 190,242 78,242 62,180 0,148 0,80 54,50"
                                fill={palette.octRay}
                                opacity="0.45"
                              />

                              {/* Central Large 4-Pointed Star Facet */}
                              <polygon
                                points="134,8 168,86 256,115 168,144 134,206 100,144 12,115 100,86"
                                fill={`url(#${starGradId})`}
                                opacity="0.92"
                              />

                              {/* Top-Left Concave Corner Cutout + Teal 4-Point Star */}
                              <path
                                d="M 0,0 L 19,0 A 19,19 0 0,0 0,19 Z"
                                fill="#ffffff"
                              />
                              <path
                                d="M 19,0 A 19,19 0 0,0 0,19"
                                fill="none"
                                stroke={palette.cornerStroke}
                                strokeWidth="1.2"
                              />
                              <path
                                d="M 7.5,0.5 L 9.3,5.7 L 14.5,7.5 L 9.3,9.3 L 7.5,14.5 L 5.7,9.3 L 0.5,7.5 L 5.7,5.7 Z"
                                fill="#2dd4bf"
                              />

                              {/* Top-Right Concave Corner Cutout + Teal 4-Point Star */}
                              <path
                                d="M 268,0 L 249,0 A 19,19 0 0,1 268,19 Z"
                                fill="#ffffff"
                              />
                              <path
                                d="M 249,0 A 19,19 0 0,1 268,19"
                                fill="none"
                                stroke={palette.cornerStroke}
                                strokeWidth="1.2"
                              />
                              <path
                                d="M 260.5,0.5 L 262.3,5.7 L 267.5,7.5 L 262.3,9.3 L 260.5,14.5 L 258.7,9.3 L 253.5,7.5 L 258.7,5.7 Z"
                                fill="#2dd4bf"
                              />

                              {/* Bottom Upward-Curving Arch Transition */}
                              {/* White fill under the arch */}
                              <path
                                d="M 0,242 L 0,232 Q 134,192 268,232 L 268,242 Z"
                                fill="#ffffff"
                              />
                              {/* Colored Arch Band */}
                              <path
                                d="M 15,234 Q 134,198 253,234 L 244,224 Q 134,189 24,224 Z"
                                fill={palette.archBand}
                              />
                              {/* White Upper Arch Line */}
                              <path
                                d="M 22,224 Q 134,189 246,224"
                                fill="none"
                                stroke="#ffffff"
                                strokeWidth="3.2"
                                strokeLinecap="round"
                              />
                              {/* White Lower Arch Line */}
                              <path
                                d="M 13,235 Q 134,199 255,235"
                                fill="none"
                                stroke="#ffffff"
                                strokeWidth="3.5"
                                strokeLinecap="round"
                              />

                              {/* Center 4-Pointed Star on Arch Apex */}
                              <polygon
                                points="134,185 139.8,198.5 153,204 139.8,209.5 134,223 128.2,209.5 115,204 128.2,198.5"
                                fill="#ffffff"
                              />
                              <polygon
                                points="134,191.5 137.4,200.6 146.5,204 137.4,207.4 134,216.5 130.6,207.4 121.5,204 130.6,200.6"
                                fill={palette.innerStarFill}
                                stroke={palette.innerStarStroke}
                                strokeWidth="1.2"
                              />
                            </svg>

                            {/* Centered White Ability Icon */}
                            <div className="relative z-10 size-[184px] mx-auto -mt-[2px] flex items-center justify-center pointer-events-none">
                              <img
                                src={`https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/potential/${activePotential.icon}_A.webp`}
                                alt={activePotential.name}
                                loading="lazy"
                                decoding="async"
                                className="size-full object-contain"
                                style={{ filter: palette.iconShadow }}
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  if (!img.dataset.fallbackApplied) {
                                    img.dataset.fallbackApplied = '1';
                                    img.src = getPotentialImageUrl(activePotential.id);
                                  }
                                }}
                              />
                            </div>
                          </div>

                          {/* ==================================================== */}
                          {/* BOTTOM WHITE CARD BODY                               */}
                          {/* ==================================================== */}
                          <div className="relative flex-1 bg-white flex flex-col pt-0.5 pb-[12px] px-[20px]">
                            {/* Lavender Inner Border + Bottom-Left & Bottom-Right Purple Corner Stars */}
                            <svg
                              className="absolute inset-0 size-full pointer-events-none z-20"
                              viewBox="0 0 268 170"
                              preserveAspectRatio="none"
                            >
                              {/* Left, Bottom, and Right thin lavender border with concave quarter-circle bottom corners */}
                              <path
                                d="M 2.5,4 L 2.5,151 A 15,15 0 0,1 17.5,166 L 250.5,166 A 15,15 0 0,1 265.5,151 L 265.5,4"
                                fill="none"
                                stroke="#e2bef8"
                                strokeWidth="1.4"
                              />
                              {/* Bottom-Left Purple 4-Point Star */}
                              <path
                                d="M 7.5,155 L 9.3,160.2 L 14.5,162 L 9.3,163.8 L 7.5,169 L 5.7,163.8 L 0.5,162 L 5.7,160.2 Z"
                                fill="#a855f7"
                              />
                              {/* Bottom-Right Purple 4-Point Star */}
                              <path
                                d="M 260.5,155 L 262.3,160.2 L 267.5,162 L 262.3,163.8 L 260.5,169 L 258.7,163.8 L 253.5,162 L 258.7,160.2 Z"
                                fill="#a855f7"
                              />
                            </svg>

                            {/* Centered Potential Name */}
                            <h3 className="text-[17px] font-bold text-[#3b4252] text-center tracking-tight leading-snug mb-2 shrink-0">
                              {activePotential.name}
                            </h3>

                            {/* Left-Aligned Description with Accessible Highlight Colors */}
                            <div className="flex-1 text-left text-[14.5px] leading-[1.48] text-[#334155] font-medium">
                              <p>
                                <PotentialDesc
                                  descTemplate={activePotential.descTemplate}
                                  params={activePotential.params}
                                  level={effectiveLevel}
                                  defaultElement={character.element}
                                  characterId={character.id}
                                  forceLight
                                />
                              </p>
                            </div>

                            <div className="pt-2.5 mt-2.5 border-t border-slate-200 flex items-center justify-center gap-1 text-[11px] font-semibold text-[#5b21b6]">
                              <span>Inspect full details</span>
                              <ChevronRight className="size-3" />
                            </div>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="p-8 text-center text-xs text-slate-600 dark:text-white/75 rounded-2xl bg-surface-elevated border border-border-subtle">
                        Select a potential to inspect.
                      </div>
                    )}
                  </div>
                </div>

                {/* -------------------------------------------------------------- */}
                {/* RIGHT: IN-GAME BUILDS & WHOLE-IMAGE POTENTIAL CARDS            */}
                {/* -------------------------------------------------------------- */}
                <div className="space-y-6">
                  {currentBuilds.map((build) => (
                    <div key={build.id} className="space-y-2.5">
                      {/* Cyan Ribbon Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="bg-[#0e7490] text-white px-3 py-1 font-bold text-xs tracking-wide inline-flex items-center rounded-sm [clip-path:polygon(0_0,calc(100%-8px)_0,100%_100%,0_100%)]">
                            {build.title}
                          </h2>
                          {build.description && (
                            <span className="text-xs text-slate-600 dark:text-white/80 leading-normal">
                              {build.description}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 5-Card Row of Whole Potential Images */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                        {build.potentials.map((pot) => {
                          const isSelected = activePotential?.id === pot.id;
                          const isHovered = hoveredPotential?.id === pot.id;
                          return (
                            <button
                              key={pot.id}
                              type="button"
                              aria-label={pot.name}
                              aria-pressed={isSelected}
                              onClick={() => {
                                setSelectedPotential(pot);
                              }}
                              onMouseEnter={() => setHoveredPotential(pot)}
                              onMouseLeave={() => setHoveredPotential(null)}
                              className={cn(
                                'group relative aspect-[3/3.8] rounded-lg overflow-hidden border cursor-pointer transition-transform transition-colors duration-150 press-feedback text-left bg-[#0f172a]',
                                isSelected
                                  ? 'ring-2 ring-[#8ecb70] border-[#8ecb70] -translate-y-0.5'
                                  : 'border-border-subtle hover:-translate-y-0.5 hover:shadow-md'
                              )}
                            >
                              {/* Target Corner Brackets on Active / Hovered Card */}
                              {(isSelected || isHovered) && (
                                <>
                                  <span className="absolute top-0 left-0 size-2.5 border-t-2 border-l-2 border-[#8ecb70] z-20 pointer-events-none" />
                                  <span className="absolute top-0 right-0 size-2.5 border-t-2 border-r-2 border-[#8ecb70] z-20 pointer-events-none" />
                                  <span className="absolute bottom-0 left-0 size-2.5 border-b-2 border-l-2 border-[#8ecb70] z-20 pointer-events-none" />
                                  <span className="absolute bottom-0 right-0 size-2.5 border-b-2 border-r-2 border-[#8ecb70] z-20 pointer-events-none" />
                                </>
                              )}

                              {/* Top Left Level Badge for non-core potentials */}
                              {!pot.isCore && (
                                <span className="absolute top-0 left-0 z-10 px-1.5 py-1 rounded-br-md bg-white/95 text-slate-950 font-bold tabular-nums text-[11px] leading-none shadow-xs">
                                  {potentialLevel}
                                </span>
                              )}

                              {/* The Whole Potential Image */}
                              <img
                                src={getPotentialImageUrl(pot.id)}
                                alt={pot.name}
                                loading="lazy"
                                decoding="async"
                                className="size-full object-contain pointer-events-none"
                                onError={(e) => {
                                  const img = e.target as HTMLImageElement;
                                  if (!img.dataset.fallbackApplied) {
                                    img.dataset.fallbackApplied = '1';
                                    img.src = `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/potential/${pot.icon}_A.webp`;
                                  }
                                }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

          {/* ==================================================================== */}
          {/* TAB 4: TALENTS (T1–T5)                                               */}
          {/* ==================================================================== */}
          <section
            role="tabpanel"
            hidden={activeTab !== 'talents'}
            className={cn(
              activeTab === 'talents'
                ? 'grid grid-cols-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[410px_1fr] gap-6 items-start'
                : 'hidden'
            )}
          >
            {activeTab === 'talents' && fullIllustrationAside}
            <div className="min-w-0 space-y-5">
              <div className="game-card celestial-card p-5 sm:p-6 space-y-6">
                {exactTalents.map((tierData) => (
                  <div key={tierData.tier} className="space-y-1.5">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                      {tierData.tier}. {tierData.name}
                    </h2>
                    <p className="pl-3 sm:pl-4 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-white/95">
                      <PotentialDesc
                        descTemplate={tierData.desc}
                        params={[]}
                        defaultElement={character.element}
                        characterId={character.id}
                      />
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ==================================================================== */}
          {/* TAB 5: AFFINITY & LOVED GIFTS MATRIX                                 */}
          {/* ==================================================================== */}
          <section
            role="tabpanel"
            hidden={activeTab !== 'affinity'}
            className={cn(
              activeTab === 'affinity'
                ? 'grid grid-cols-1 lg:grid-cols-[380px_1fr] xl:grid-cols-[410px_1fr] gap-6 items-start'
                : 'hidden'
            )}
          >
            {activeTab === 'affinity' && fullIllustrationAside}
            <div className="min-w-0 space-y-6">
              {/* Loved Gifts Showcase Card */}
              <div className="game-card celestial-card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
                  <div className="space-y-1">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                      Loved Gifts Collection ({lovedGifts.length})
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-white/80">
                      Gifts in the character&apos;s loved category grant a <strong>+50% Affinity EXP bonus</strong>.
                    </p>
                    {favoriteFamilies.length > 0 && (
                      <p className="text-xs text-slate-600 dark:text-white/75">
                        Preferred families:{' '}
                        <span className="font-semibold text-slate-800 dark:text-white">
                          {favoriteFamilies
                            .map((famKey) => GIFT_FAMILIES[famKey]?.label || famKey)
                            .join(' · ')}
                        </span>
                      </p>
                    )}
                  </div>

                  <Link
                    href={`/bond?char=${character.id}`}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors press-feedback shrink-0"
                  >
                    <Gift className="size-3.5" aria-hidden="true" />
                    <span>Calculate in Affinity Tool</span>
                  </Link>
                </div>

                {/* Loved Gift Cards Grid (grouped one family per row) */}
                <div className="space-y-3">
                  {favoriteFamilies
                    .map((famKey) => ({
                      famKey,
                      gifts: lovedGifts
                        .filter((g) => g.family === famKey)
                        .sort((a, b) => b.rarity - a.rarity),
                    }))
                    .filter((group) => group.gifts.length > 0)
                    .map(({ famKey, gifts }) => (
                      <div key={famKey} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {gifts.map((gift) => (
                          <div
                            key={gift.id}
                            className="p-3.5 rounded-xl border border-border-subtle bg-surface-elevated flex"
                          >
                            <div className="flex items-start gap-3 w-full">
                              <div className="size-12 rounded-lg bg-surface-elevated border border-border overflow-hidden shrink-0 flex items-center justify-center p-1">
                                <img
                                  src={gift.imageUrl}
                                  alt={gift.name}
                                  loading="lazy"
                                  decoding="async"
                                  className="size-full object-contain"
                                  onError={(e) => {
                                    const img = e.target as HTMLImageElement;
                                    if (!img.dataset.fallbackApplied) {
                                      img.dataset.fallbackApplied = '1';
                                      img.src = '/bastelina.png';
                                    }
                                  }}
                                />
                              </div>

                              <div className="flex-1 min-w-0 h-full flex flex-col justify-between gap-1">
                                <div>
                                  <div className="mb-0.5">
                                    <RarityStars count={gift.rarity} size="sm" />
                                  </div>
                                  <h3 className="text-xs font-bold text-slate-900 dark:text-white break-words">
                                    {gift.name}
                                  </h3>
                                </div>
                                <span className="text-xs text-slate-600 dark:text-white/75 truncate">
                                  {gift.familyName}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              </div>
              </div>
            </section>
        </div>

        {/* ==================================================================== */}
        {/* AUTHENTIC IN-GAME BOTTOM DOCK NAVIGATION BAR                        */}
        {/* ==================================================================== */}
        <div className="sticky bottom-3 z-30 w-full pt-2 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-2xl mx-auto p-1 rounded-xl bg-surface-card dark:bg-[#0d1f38] border border-border dark:border-[#1a3250] shadow-md flex items-center justify-between gap-1">
            <button
              type="button"
              aria-label="Previous section"
              onClick={() => cycleTab('prev')}
              className="p-1.5 rounded-lg bg-surface-elevated/80 hover:bg-surface-hover text-slate-700 dark:text-white/90 hover:text-slate-900 dark:hover:text-white transition-colors press-feedback cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>

            <div className="flex-1 grid grid-cols-5 gap-1">
              {DOCK_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'group relative px-2 py-2 text-xs font-semibold tracking-wide transition-colors press-feedback cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 rounded-lg sm:rounded-none select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                      isActive
                        ? 'bg-[#132c4a] dark:bg-[#16365c] text-white border-b-2 border-[#0e7490] dark:border-[#0abec5] sm:[clip-path:polygon(7px_0%,100%_0%,calc(100%-7px)_100%,0%_100%)]'
                        : 'bg-surface-elevated/70 dark:bg-[#0e2138]/60 hover:bg-surface-hover dark:hover:bg-[#163050] text-slate-700 dark:text-white/85 hover:text-slate-900 dark:hover:text-white border border-border-subtle/50 dark:border-[#1b3455]/50'
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-3.5 shrink-0 transition-colors',
                        isActive
                          ? 'text-white'
                          : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white'
                      )}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        'font-bold tracking-wide whitespace-nowrap text-xs',
                        isActive
                          ? 'text-white'
                          : 'text-slate-700 dark:text-white/85 group-hover:text-slate-900 dark:group-hover:text-white'
                      )}
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              aria-label="Next section"
              onClick={() => cycleTab('next')}
              className="p-1.5 rounded-lg bg-surface-elevated/80 hover:bg-surface-hover text-slate-700 dark:text-white/90 hover:text-slate-900 dark:hover:text-white transition-colors press-feedback cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

      {/* ==================================================================== */}
      {/* TAROT INSPECT MODAL: ARCHED PRESENTATION                              */}
      {/* ==================================================================== */}
      {inspectedPotential && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="potential-modal-title"
          className={cn(
            'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 overlay-backdrop',
            isPotentialModalClosing && 'is-closing'
          )}
          onClick={() => requestClosePotentialModal()}
        >
          <div
            ref={modalDialogRef}
            className={cn(
              'w-full max-w-lg max-h-[90vh] overflow-y-auto game-card celestial-card rounded-3xl border-2 border-pink-500/50 p-5 sm:p-6 space-y-4 shadow-xl relative bg-surface-card',
              isPotentialModalClosing ? 'modal-exit' : 'modal-entrance'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              ref={modalCloseBtnRef}
              type="button"
              aria-label="Close dialog"
              onClick={() => requestClosePotentialModal()}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white hover:bg-surface-hover transition-colors press-feedback cursor-pointer"
            >
              <X className="size-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-start gap-3.5 pr-8">
              <div className="size-14 rounded-full bg-[#0f172a] border-2 border-pink-400/60 overflow-hidden shrink-0 flex items-center justify-center p-1">
                <img
                  src={`https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/potential/${inspectedPotential.icon}_A.webp`}
                  alt={inspectedPotential.name}
                  className="size-full object-contain"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (!img.dataset.fallbackApplied) {
                      img.dataset.fallbackApplied = '1';
                      img.src = getPotentialImageUrl(inspectedPotential.id);
                    }
                  }}
                />
              </div>

              <div>
                <h2
                  id="potential-modal-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  {inspectedPotential.name}
                </h2>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 dark:text-white/80 flex-wrap">
                  {inspectedPotential.nameJP && <span>JP: {inspectedPotential.nameJP}</span>}
                  {inspectedPotential.nameCN && <span>• CN: {inspectedPotential.nameCN}</span>}
                  {inspectedPotential.nameKR && <span>• KR: {inspectedPotential.nameKR}</span>}
                </div>
              </div>
            </div>

            {/* Tag Badges */}
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <span
                className={cn(
                  'px-2 py-0.5 rounded font-semibold capitalize',
                  inspectedPotential.isCore
                    ? 'bg-[#be185d] text-white font-bold'
                    : 'bg-surface-elevated border border-border-subtle text-slate-700 dark:text-white'
                )}
              >
                {inspectedPotential.rarity || (inspectedPotential.isCore ? 'Core' : 'Standard')}
              </span>

              <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-700 dark:text-teal-400 font-medium capitalize">
                Slot: {inspectedPotential.slot}
              </span>

              <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-slate-600 dark:text-white/80 tabular-nums">
                Max Lv: {inspectedPotential.maxLevel}
              </span>

              {inspectedPotential.damageType && inspectedPotential.damageType.map((dt, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-400 text-[11px]"
                >
                  {dt}
                </span>
              ))}
            </div>

            {/* Scaled Description at Current Slider Level */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-slate-600 dark:text-white/80 tabular-nums">
                Scaled description (Lv. {potentialLevel})
              </span>
              <div className="p-3.5 rounded-lg bg-surface-elevated/50 border border-border-subtle text-xs sm:text-sm text-slate-700 dark:text-white leading-relaxed font-normal whitespace-pre-line">
                <PotentialDesc
                  descTemplate={inspectedPotential.descTemplate}
                  params={inspectedPotential.params}
                  level={
                    (inspectedPotential.isCore || inspectedPotential.rarityNum === 0) &&
                    String(inspectedPotential.params?.[0] ?? '').split('/').length > 9 &&
                    potentialLevel === 1
                      ? 8
                      : potentialLevel
                  }
                  defaultElement={character.element}
                  characterId={character.id}
                />
              </div>
            </div>

            {/* Effect Types */}
            {inspectedPotential.effectType && inspectedPotential.effectType.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-600 dark:text-white/80">
                  Effect types
                </span>
                <div className="flex flex-wrap gap-1">
                  {inspectedPotential.effectType.map((eff, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-slate-600 dark:text-white/80 text-[11px]"
                    >
                      {eff}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Footer action */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => requestClosePotentialModal()}
                className="px-4 py-1.5 rounded-md bg-surface-elevated border border-border-subtle hover:bg-surface-hover text-slate-700 dark:text-white text-xs font-semibold transition-colors press-feedback cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
