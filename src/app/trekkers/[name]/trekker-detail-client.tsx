'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Layers,
  Swords,
  Gift,
  ExternalLink,
  Contact,
  Crosshair,
  Shield,
  Star,
  Sparkles,
  Info,
  X,
  ChevronRight,
  ChevronLeft,
  Flame,
  Coffee,
  Moon,
  IceCream,
  Camera,
  Wind,
  Compass,
  Heart,
  Award,
  Activity,
  Check,
  BookOpen,
} from 'lucide-react';

import charactersData from '@/data/characters.json';
import trekkerLoreData from '@/data/trekker-lore.json';
import characterCombatData from '@/data/character-combat.json';
import potentialsDbData from '@/data/potentials-db.json';
import talentEmblemData from '@/data/talent-emblem.json';
import {
  STELLA_SORA_GIFTS,
  GIFT_FAMILIES,
  GiftFamily,
  isGiftLovedBy,
  getGiftEffectiveExp,
  getCharacterFavoriteFamilies,
} from '@/data/gifts';
import { getWikiTideTrekkerUrl } from '@/lib/wikitide';
import { getPotentialImageUrl, formatPotentialSegments } from '@/lib/potentials';
import { SSCharacter, SSPotentialFull } from '@/types';
import { cn } from '@/lib/utils';

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
      def: exact.def ?? 190,
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
    def: sHigh.def ?? sLow.def ?? 190,
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

  // Convert mark tags ##Title#ID# -> [Title] and strip empty mark tags ###ID#
  formatted = formatted.replace(/###\d+#/g, '').replace(/##([^#]+)#\d+#/g, '[$1]');

  // Convert \u000b to double line break
  formatted = formatted.replace(/\u000b/g, '\n\n');

  // Strip or normalize color tags
  formatted = formatted.replace(/<color=#[0-9a-fA-F]{6}>(.*?)<\/color>/g, '$1');
  formatted = formatted.replace(/<color=#[0-9a-fA-F]{6}>/g, '');
  formatted = formatted.replace(/<\/color>/g, '');

  return formatted;
}

export function formatPotentialDesc(
  descTemplate: string,
  params: (string | number)[],
  level: number = 1
): string {
  let desc = descTemplate || '';

  (params || []).forEach((paramSet, index) => {
    const parts = String(paramSet).split('/');
    let val = parts[0];
    if (parts.length > 1) {
      const idx = Math.min(Math.max(level, 1), parts.length) - 1;
      val = parts[idx] ?? parts[0];
    }
    desc = desc.replaceAll(new RegExp(`&Param${index + 1}(?:_.*?)?&`, 'g'), val);
  });

  return desc
    .replace(/<color=#([0-9a-fA-F]{6})>(.*?)<\/color>/g, '$2')
    .replace(/<color=#[0-9a-fA-F]{6}>/g, '')
    .replace(/<\/color>/g, '')
    .replace(/\u000b/g, ' ')
    .trim();
}

export function getBriefSkillDesc(formattedDesc: string): string {
  if (!formattedDesc) return '';
  const lines = formattedDesc.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return formattedDesc;
  return lines.slice(0, 2).join('\n\n');
}

export interface RichPotentialSpan {
  text: string;
  color?: string;
}

export function parsePotentialRichDesc(
  descTemplate: string,
  params: (string | number)[],
  level: number = 1,
  brief: boolean = false,
  briefDesc?: string
): RichPotentialSpan[] {
  let desc = brief && briefDesc ? briefDesc : descTemplate || '';

  if (!brief || !briefDesc) {
    (params || []).forEach((paramSet, index) => {
      const parts = String(paramSet).split('/');
      let val = parts[0];
      if (parts.length > 1) {
        const idx = Math.min(Math.max(level, 1), parts.length) - 1;
        val = parts[idx] ?? parts[0];
      }
      desc = desc.replaceAll(new RegExp(`&Param${index + 1}(?:_.*?)?&`, 'g'), val);
    });
    desc = desc.replace(/\u000b/g, ' ');
  }

  desc = desc.trim();

  const spans: RichPotentialSpan[] = [];
  const regex = /<color=#([0-9a-fA-F]{6})>(.*?)<\/color>/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(desc)) !== null) {
    if (match.index > lastIndex) {
      spans.push({
        text: desc
          .slice(lastIndex, match.index)
          .replace(/<color=#[0-9a-fA-F]{6}>/g, '')
          .replace(/<\/color>/g, ''),
      });
    }
    spans.push({
      text: match[2],
      color: `#${match[1]}`,
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < desc.length) {
    spans.push({
      text: desc
        .slice(lastIndex)
        .replace(/<color=#[0-9a-fA-F]{6}>/g, '')
        .replace(/<\/color>/g, ''),
    });
  }

  return spans;
}

// ------------------------------------------------------------------------------
// Family Icon Helper
// ------------------------------------------------------------------------------
function FamilyIcon({ family, className }: { family: GiftFamily; className?: string }) {
  switch (family) {
    case 'Flame':
      return <Flame className={cn('text-amber-500', className)} />;
    case 'Ceramic':
      return <Coffee className={cn('text-emerald-500', className)} />;
    case 'Astral':
      return <Moon className={cn('text-indigo-400', className)} />;
    case 'Dessert':
      return <IceCream className={cn('text-pink-400', className)} />;
    case 'Photo':
      return <Camera className={cn('text-blue-400', className)} />;
    case 'Wind':
      return <Wind className={cn('text-teal-400', className)} />;
    case 'Star':
      return <Star className={cn('text-yellow-400', className)} />;
    default:
      return <Gift className={cn('text-amber-500', className)} />;
  }
}

// ------------------------------------------------------------------------------
// Navigation Types & Definitions
// ------------------------------------------------------------------------------
export type DetailTab = 'details' | 'skills' | 'potentials' | 'talents' | 'affinity';

const DOCK_TABS: { key: DetailTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'details', label: 'Details', icon: BookOpen },
  { key: 'skills', label: 'Skills', icon: Sparkles },
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

interface TrekkerDetailClientProps {
  name?: string;
}

export default function TrekkerDetailClient({ name: propName }: TrekkerDetailClientProps) {
  const params = useParams();
  const router = useRouter();

  // Resolve character identifier
  const resolvedParam = propName || (params?.name as string) || '';
  const decodedQuery = decodeURIComponent(resolvedParam).trim();

  const characters = charactersData as Record<string, SSCharacter>;
  const character = useMemo(() => {
    if (!decodedQuery) return null;
    // 1. Direct ID match
    if (characters[decodedQuery]) return characters[decodedQuery];
    // 2. Name match (case-insensitive & space/underscore insensitive)
    const normalized = decodedQuery.replace(/_/g, ' ').toLowerCase();
    return (
      Object.values(characters).find(
        (c) => c.name.EN.toLowerCase() === normalized
      ) || null
    );
  }, [decodedQuery, characters]);

  // Interactive slider states
  const [statLevel, setStatLevel] = useState<number>(90);
  const [resonanceRank, setResonanceRank] = useState<number>(0);
  const [skillLevel, setSkillLevel] = useState<number>(1);
  const [potentialLevel, setPotentialLevel] = useState<number>(1);

  // Tab selections
  const [activeTab, setActiveTab] = useState<DetailTab>('details');
  const [activeSkillKey, setActiveSkillKey] = useState<'skill' | 'supportSkill' | 'ultimate' | 'normalAtk'>('skill');
  const [briefMode, setBriefMode] = useState<boolean>(false);
  const [potentialSlotMode, setPotentialSlotMode] = useState<'main' | 'support'>('main');
  const [selectedPotential, setSelectedPotential] = useState<SSPotentialFull | null>(null);
  const [hoveredPotential, setHoveredPotential] = useState<SSPotentialFull | null>(null);

  // Modal inspection dialog
  const [inspectedPotential, setInspectedPotential] = useState<SSPotentialFull | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInspectedPotential(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!character) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="game-card celestial-card p-8 inline-block max-w-md w-full">
          <Info className="size-10 text-amber-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Trekker Not Found
          </h1>
          <p className="text-sm text-slate-600 dark:text-white/80 mb-6">
            Could not locate Trekker matching &ldquo;{decodedQuery}&rdquo; in offline database.
          </p>
          <button
            type="button"
            onClick={() => router.push('/trekkers')}
            className="w-full h-9 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors shadow-xs cursor-pointer"
          >
            Return to Trekker Encyclopedia
          </button>
        </div>
      </div>
    );
  }

  const charIdStr = String(character.id);
  const isFiveStar = character.star >= 5;

  // Offline datasets lookup
  const lore = (trekkerLoreData as Record<string, any>)[charIdStr] ||
    (trekkerLoreData as Record<string, any>)[character.name.EN] ||
    null;

  const combat = (characterCombatData as Record<string, any>)[charIdStr] || null;
  const rawPotentials: SSPotentialFull[] = (potentialsDbData as Record<string, any>)[charIdStr] || [];

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
              : 'Primary combat build enhancing core skill damage and auto-attack synergies.',
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
              : 'Tactical ability build specialized for skill cooldown acceleration and burst multipliers.',
          potentials: [
            ...potentialGroups.mainCore.slice(2, 4),
            ...[...potentialGroups.mainNormal.slice(3, 6)].sort((a, b) => a.rarityNum - b.rarityNum),
          ],
        },
        {
          id: 'generic',
          title: 'Generic',
          description: 'Universal and versatile potentials compatible across multiple tactical situations.',
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
          description: 'Off-field support build providing elemental assistance and auxiliary attacks.',
          potentials: [
            ...potentialGroups.supportCore.slice(0, 2),
            ...[...potentialGroups.supportNormal.slice(0, 3)].sort((a, b) => a.rarityNum - b.rarityNum),
          ],
        },
        {
          id: 'support-2',
          title: `${character.name.EN}: Support Build 2`,
          description: 'Cooperative support build augmenting squad damage and tactical survivability.',
          potentials: [
            ...potentialGroups.supportCore.slice(2, 4),
            ...[...potentialGroups.supportNormal.slice(3, 6)].sort((a, b) => a.rarityNum - b.rarityNum),
          ],
        },
        {
          id: 'generic',
          title: 'Generic',
          description: 'Universal assist potentials for flexible team rotations.',
          potentials: [
            ...potentialGroups.supportNormal.slice(6),
            ...potentialGroups.common,
          ].sort((a, b) => a.rarityNum - b.rarityNum),
        },
      ];
    }
  }, [potentialSlotMode, character.name.EN, potentialGroups]);

  // Talents from talent-emblem dataset
  const characterTalents = useMemo(() => {
    const te = talentEmblemData as any;
    const talentKey = te.talentNames?.[charIdStr] || character.name.EN;
    const list: { stat: string; value: number; target: string }[][] =
      te.talents?.[talentKey] || te.talents?.[character.name.EN] || [];
    return list;
  }, [charIdStr, character.name.EN]);

  // Stat interpolation calculation
  const currentStats = useMemo(() => {
    if (!combat?.stats) return { atk: 0, hp: 0, def: 190, vul: 0 };
    return interpolateStats(statLevel, combat.stats);
  }, [statLevel, combat]);

  // Loved gifts calculation
  const lovedGifts = useMemo(() => {
    return STELLA_SORA_GIFTS.filter((gift) => isGiftLovedBy(gift, character.id));
  }, [character.id]);

  const favoriteFamilies = useMemo(() => {
    return getCharacterFavoriteFamilies(character.id);
  }, [character.id]);

  // Head portrait URL fallback chain
  const headUrl =
    getWikiTideTrekkerUrl(character.name.EN) ||
    `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/head/head_${character.id}01_XL.webp`;

  // Selected skill
  const currentSkill = combat ? combat[activeSkillKey] : null;

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 flex flex-col justify-between min-h-[700px]">
      <div className="space-y-6">
        {/* Quick Sub-Navigation Header Bar */}
        <div className="flex items-center justify-between border-b border-border-subtle pb-2 overflow-x-auto gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900 dark:text-white hidden sm:inline mr-2">
              {character.name.EN}
            </span>
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
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap',
                    isActive
                      ? 'bg-amber-500 text-slate-950 border border-amber-600 shadow-xs'
                      : 'bg-surface-elevated text-slate-600 dark:text-white/80 border border-border-subtle hover:text-slate-900 dark:hover:text-white hover:bg-surface-hover'
                  )}
                >
                  <Icon className="size-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {activeTab !== 'details' && (
            <div className="flex items-center gap-2">
              <Link
                href={`/builder?char=${character.id}`}
                className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-elevated border border-border-subtle text-xs text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white hover:bg-surface-hover transition-colors"
              >
                <Layers className="size-3 text-amber-500" />
                <span>Preset</span>
              </Link>
              <Link
                href={`/damage?char=${character.id}`}
                className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-surface-elevated border border-border-subtle text-xs text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white hover:bg-surface-hover transition-colors"
              >
                <Swords className="size-3 text-amber-500" />
                <span>Damage</span>
              </Link>
            </div>
          )}
        </div>

        {/* ==================================================================== */}
        {/* TAB 1: DETAILS (PORTRAIT & LORE ON LEFT + COMBAT TELEMETRY ON RIGHT)  */}
        {/* ==================================================================== */}
        {activeTab === 'details' && (
          <section className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 animate-in fade-in duration-150 items-start">
            {/* Character Portrait & Identity Card (Details Window Only) */}
            <aside className="space-y-4">
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

                {/* Portrait Bust Container */}
                <div className="relative aspect-[3.4/4] bg-slate-900 overflow-hidden">
                  <img
                    src={headUrl}
                    alt={character.name.EN}
                    className="absolute inset-0 w-full h-full object-cover object-top"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes('/characters/')) {
                        target.src = `/characters/head_${character.id}01_XL.webp`;
                      } else {
                        target.src = '/bastelina.png';
                      }
                    }}
                  />
                  {/* Subtle bottom gradient scrim */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />

                  {/* In-image Meta Overlays */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    {/* Star Rating */}
                    <div className="flex items-center gap-1 mb-1">
                      {Array.from({ length: character.star }).map((_, i) => (
                        <Star
                          key={i}
                          className="size-3.5 fill-amber-400 text-amber-400 drop-shadow-sm"
                        />
                      ))}
                    </div>

                    {/* Character Name in EN */}
                    <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-md">
                      {character.name.EN}
                    </h1>

                    {/* Multi-language sub-names */}
                    <div className="flex items-center gap-2 text-[11px] text-slate-300 font-medium">
                      {character.name.JP && <span>JP: {character.name.JP}</span>}
                      {character.name.CN && <span>• CN: {character.name.CN}</span>}
                    </div>
                  </div>
                </div>

                {/* Canonical Badges Bar */}
                <div className="p-3.5 border-b border-border-subtle bg-surface-elevated/40 grid grid-cols-3 gap-2 text-center text-xs">
                  {/* Element */}
                  <div className="flex items-center justify-center gap-1.5 py-1 px-2 rounded-md bg-surface-elevated border border-border-subtle">
                    <img
                      src={`/ss-element/${character.element}.webp`}
                      alt={character.element}
                      className="size-4 object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {character.element}
                    </span>
                  </div>

                  {/* Class */}
                  <div className="flex items-center justify-center py-1 px-2 rounded-md bg-surface-elevated border border-border-subtle">
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {character.class}
                    </span>
                  </div>

                  {/* Attack Type */}
                  <div className="flex items-center justify-center gap-1.5 py-1 px-2 rounded-md bg-surface-elevated border border-border-subtle">
                    <img
                      src={`/ss-class/${character.attackType}.png`}
                      alt={character.attackType}
                      className="size-3.5 object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <span className="font-semibold text-slate-800 dark:text-white">
                      {character.attackType}
                    </span>
                  </div>
                </div>

                {/* Companion Quick Action Buttons */}
                <div className="p-4 space-y-2">
                  <Link
                    href={`/builder?char=${character.id}`}
                    className="w-full flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                  >
                    <Layers className="size-4" />
                    <span>Load in Preset Visualizer</span>
                  </Link>

                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href={`/damage?char=${character.id}`}
                      className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-md border border-border-subtle bg-surface-elevated hover:bg-surface-hover text-slate-700 dark:text-white text-xs font-medium transition-colors"
                    >
                      <Swords className="size-3.5 text-amber-500" />
                      <span>Calculate Damage</span>
                    </Link>

                    <Link
                      href={`/bond?char=${character.id}`}
                      className="flex items-center justify-center gap-1.5 h-8 px-2.5 rounded-md border border-border-subtle bg-surface-elevated hover:bg-surface-hover text-slate-700 dark:text-white text-xs font-medium transition-colors"
                    >
                      <Gift className="size-3.5 text-amber-500" />
                      <span>Affinity Calc</span>
                    </Link>
                  </div>

                  <a
                    href={`https://stellasora.miraheze.org/wiki/${encodeURIComponent(character.name.EN.replace(/ /g, '_'))}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 h-7 text-xs text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    <span>Open Wiki Entry</span>
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            </aside>

            {/* Right Column: Character Profile & Combat Telemetry Instrument */}
            <div className="space-y-5">
              {/* Profile Card Window */}
              <div className="game-card celestial-card p-5 sm:p-6 space-y-4">
                {/* Header with Icon and Title */}
                <div className="flex items-center gap-2">
                  <Contact className="size-5 text-[#00c8e0]" />
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                    Profile
                  </h2>
                </div>

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

                {/* 4-Column Metadata Grid (Full Name, Experience, Birthday, Faction in a straight horizontal row) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <ProfileBox label="Full Name">
                    <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug block truncate">
                      {character.name.EN}
                    </span>
                    {(character.name.JP || character.name.CN) && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal block truncate mt-0.5">
                        {[character.name.JP, character.name.CN].filter(Boolean).join(' • ')}
                      </span>
                    )}
                  </ProfileBox>

                  <ProfileBox label="Experience">
                    <span className="text-sm sm:text-base font-bold text-[#00a8b5] dark:text-[#00d0de] leading-snug block truncate">
                      {lore?.experience || '—'}
                    </span>
                  </ProfileBox>

                  <ProfileBox label="Birthday">
                    <span className="text-sm sm:text-base font-bold text-[#00a8b5] dark:text-[#00d0de] leading-snug block truncate">
                      {lore?.birthday || '—'}
                    </span>
                  </ProfileBox>

                  <ProfileBox label="Faction">
                    <span className="text-sm sm:text-base font-bold text-[#00a8b5] dark:text-[#00d0de] leading-snug block truncate">
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
                    <span className="text-sm sm:text-base font-bold text-[#00a8b5] dark:text-[#00d0de] leading-snug block truncate">
                      {lore?.weapon || '—'}
                    </span>
                  </ProfileBox>

                  <ProfileBox label="Style">
                    <span className="text-sm sm:text-base font-bold text-[#00a8b5] dark:text-[#00d0de] leading-snug block truncate">
                      {lore?.style || '—'}
                    </span>
                  </ProfileBox>

                  <ProfileBox label="Address">
                    <span className="text-sm sm:text-base font-bold text-[#00a8b5] dark:text-[#00d0de] leading-snug block truncate">
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
                        <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug block truncate">
                          {lore.voiceActor.jp}
                        </span>
                      </ProfileBox>
                    )}
                    {lore.voiceActor.cn && (
                      <ProfileBox label="Voice Actor (CN)">
                        <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-snug block truncate">
                          {lore.voiceActor.cn}
                        </span>
                      </ProfileBox>
                    )}
                  </div>
                )}
              </div>

              {/* Combat Telemetry Instrument */}
              <div className="game-card celestial-card p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
                  <div>
                    <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-600 dark:text-white/90">
                      Combat Telemetry Instrument
                    </h2>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-slate-900 dark:text-white">
                        Base Attributes
                      </span>
                      <span className="text-xs text-slate-600 dark:text-white/80">
                        (Piecewise Linear Interpolation)
                      </span>
                    </div>
                  </div>

                  {/* Level Stepper / Milestone Pills */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-600 dark:text-white/80 mr-1">
                      Milestones:
                    </span>
                    {[1, 70, 80, 90].map((lvl) => (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() => setStatLevel(lvl)}
                        className={cn(
                          'px-2 py-0.5 rounded text-xs font-mono transition-colors cursor-pointer',
                          statLevel === lvl
                            ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                            : 'bg-surface-elevated border border-border-subtle text-slate-700 dark:text-white hover:bg-surface-hover hover:text-slate-900 dark:hover:text-white'
                        )}
                      >
                        Lv.{lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resonance Milestone Chain (T0–T5) */}
                <div className="p-3.5 rounded-xl bg-surface-elevated/60 border border-border-subtle space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Award className="size-4 text-cyan-500 shrink-0" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white">
                        Resonance Milestone Chain
                      </span>
                    </div>

                    {/* Diamond Chain Buttons */}
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      {[0, 1, 2, 3, 4, 5].map((tier) => {
                        const isUnlocked = resonanceRank >= tier;
                        const isCurrent = resonanceRank === tier;
                        return (
                          <button
                            key={tier}
                            type="button"
                            onClick={() => setResonanceRank(tier)}
                            className={cn(
                              'px-2 py-1 rounded text-xs font-mono transition-all cursor-pointer flex items-center gap-1',
                              isCurrent
                                ? 'bg-[#1e3a5f] text-cyan-300 border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)] font-bold'
                                : isUnlocked && tier > 0
                                ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30'
                                : 'bg-surface-elevated border border-border-subtle text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white'
                            )}
                          >
                            <span
                              className={cn(
                                'text-[11px]',
                                isUnlocked && tier > 0
                                  ? 'text-cyan-400 drop-shadow-[0_0_4px_rgba(6,182,212,0.8)]'
                                  : 'text-slate-400 dark:text-white/60'
                              )}
                            >
                              ◆
                            </span>
                            <span>T{tier}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Resonance Perk Callout */}
                  <div className="pt-2 border-t border-border-subtle/80 flex items-center gap-2 text-xs">
                    {resonanceRank === 0 ? (
                      <span className="text-slate-500 dark:text-white/80 italic">
                        T0 Baseline: Standard combat attributes calibrated.
                      </span>
                    ) : characterTalents[resonanceRank - 1] ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-cyan-700 dark:text-cyan-300">
                          T{resonanceRank} Perk:
                        </span>
                        {characterTalents[resonanceRank - 1].map((b, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-800 dark:text-cyan-200 border border-cyan-500/30 text-[11px] font-medium"
                          >
                            {b.stat} +{Math.round(b.value * 100)}% ({b.target})
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-500 dark:text-white/80">Resonance perk active.</span>
                    )}
                  </div>
                </div>

                {/* Level Slider Control */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-700 dark:text-white">
                      Selected Level
                    </span>
                    <span className="font-mono tabular-nums text-sm font-bold text-amber-500">
                      Lv. {statLevel} <span className="text-xs text-slate-400 dark:text-white/70 font-normal">/ 90</span>
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
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700/60 rounded-lg appearance-none cursor-pointer accent-teal-500"
                  />
                </div>

                {/* In-Game Horizontal Telemetry Pills Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* HP Pill */}
                  <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border-subtle space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-md bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
                          <Heart className="size-3.5 text-[#0abec5]" />
                        </div>
                        <span className="text-xs font-bold text-slate-700 dark:text-white">
                          HP <span className="text-[10px] font-normal text-slate-500 dark:text-white/70">(Health Points)</span>
                        </span>
                      </div>
                      <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white text-sm">
                        {currentStats.hp.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0abec5] rounded-full transition-all duration-150 shadow-[0_0_8px_rgba(10,190,197,0.4)]"
                        style={{ width: `${Math.min(100, Math.round((currentStats.hp / 50000) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* ATK Pill */}
                  <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border-subtle space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                          <Swords className="size-3.5 text-amber-500" />
                        </div>
                        <span className="text-xs font-bold text-slate-700 dark:text-white">
                          ATK <span className="text-[10px] font-normal text-slate-500 dark:text-white/70">(Attack Power)</span>
                        </span>
                      </div>
                      <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white text-sm">
                        {currentStats.atk.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full transition-all duration-150 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                        style={{ width: `${Math.min(100, Math.round((currentStats.atk / 7000) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* DEF Pill */}
                  <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border-subtle space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-md bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
                          <Shield className="size-3.5 text-sky-500" />
                        </div>
                        <span className="text-xs font-bold text-slate-700 dark:text-white">
                          DEF <span className="text-[10px] font-normal text-slate-500 dark:text-white/70">(Defense Rating)</span>
                        </span>
                      </div>
                      <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white text-sm">
                        {currentStats.def}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all duration-150 shadow-[0_0_8px_rgba(14,165,233,0.4)]"
                        style={{ width: `${Math.min(100, Math.round((currentStats.def / 250) * 100))}%` }}
                      />
                    </div>
                  </div>

                  {/* VUL Pill */}
                  <div className="p-3.5 rounded-xl bg-surface-elevated/70 border border-border-subtle space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="size-6 rounded-md bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                          <Crosshair className="size-3.5 text-rose-500" />
                        </div>
                        <span className="text-xs font-bold text-slate-700 dark:text-white">
                          VUL <span className="text-[10px] font-normal text-slate-500 dark:text-white/70">(Vulnerability)</span>
                        </span>
                      </div>
                      <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white text-sm">
                        {currentStats.vul}%
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 dark:bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full transition-all duration-150 shadow-[0_0_8px_rgba(244,63,94,0.4)]"
                        style={{ width: `${Math.min(100, Math.round((currentStats.vul / 10) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

          {/* ==================================================================== */}
          {/* TAB 2: COMBAT SKILLS (VERTICAL SELECTOR RAIL & CORNER BRACKETS)     */}
          {/* ==================================================================== */}
          {activeTab === 'skills' && (
            <section className="space-y-4 animate-in fade-in duration-150">
              <div className="game-card celestial-card p-5 space-y-4">
                {/* Level Controls & Brief Toggle Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Ability Matrix & Execution Rail
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-white/80">
                      Select any combat ability from the rail to inspect dynamic level scaling.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Brief Mode Toggle */}
                    <button
                      type="button"
                      onClick={() => setBriefMode(!briefMode)}
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer border',
                        briefMode
                          ? 'bg-teal-500 text-slate-950 border-teal-600 shadow-xs'
                          : 'bg-surface-elevated border-border-subtle text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white'
                      )}
                    >
                      <Check className={cn('size-3', briefMode ? 'opacity-100' : 'opacity-0')} />
                      <span>Brief</span>
                    </button>

                    {/* Milestones */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500 dark:text-white/70 mr-0.5">Milestones:</span>
                      {[1, 7, 10, 13].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => setSkillLevel(lvl)}
                          className={cn(
                            'px-2 py-0.5 rounded text-xs font-mono transition-colors cursor-pointer',
                            skillLevel === lvl
                              ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                              : 'bg-surface-elevated border border-border-subtle text-slate-700 dark:text-white hover:bg-surface-hover hover:text-slate-900 dark:hover:text-white'
                          )}
                        >
                          Lv.{lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Skill Level Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-600 dark:text-white">
                      Skill Level Scaling (Lv 1–13)
                    </span>
                    <span className="font-mono tabular-nums text-sm font-bold text-amber-500">
                      Lv. {skillLevel} <span className="text-xs text-slate-400 dark:text-white/70 font-normal">/ 13</span>
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
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700/60 rounded-lg appearance-none cursor-pointer accent-teal-500"
                  />
                </div>

                {/* Vertical Rail + Ability Details Display */}
                <div className="flex flex-col md:flex-row gap-4 pt-2">
                  {/* Left Rail: Vertical Ability Selector with Target Corner Brackets */}
                  <div className="flex flex-row md:flex-col gap-2 shrink-0 md:w-48 overflow-x-auto pb-1 md:pb-0">
                    {[
                      { key: 'skill', label: 'Combat Skill' },
                      { key: 'supportSkill', label: 'Support Skill' },
                      { key: 'ultimate', label: 'Ultimate' },
                      { key: 'normalAtk', label: 'Normal Attack' },
                    ].map((tab) => {
                      const isActive = activeSkillKey === tab.key;
                      const abilityData = combat ? combat[tab.key] : null;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveSkillKey(tab.key as any)}
                          className={cn(
                            'relative p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 shrink-0 md:w-full',
                            isActive
                              ? 'bg-[#0abec5]/10 border-teal-500 shadow-[0_0_12px_rgba(10,190,197,0.25)]'
                              : 'bg-surface-elevated/80 border-border-subtle hover:bg-surface-hover text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white'
                          )}
                        >
                          {/* Neon Target Corner Brackets on Active Ability */}
                          {isActive && (
                            <>
                              <span className="absolute -top-0.5 -left-0.5 size-2 border-t-2 border-l-2 border-teal-400 pointer-events-none" />
                              <span className="absolute -top-0.5 -right-0.5 size-2 border-t-2 border-r-2 border-teal-400 pointer-events-none" />
                              <span className="absolute -bottom-0.5 -left-0.5 size-2 border-b-2 border-l-2 border-teal-400 pointer-events-none" />
                              <span className="absolute -bottom-0.5 -right-0.5 size-2 border-b-2 border-r-2 border-teal-400 pointer-events-none" />
                            </>
                          )}

                          <div className={cn(
                            'size-9 rounded-lg border overflow-hidden shrink-0 flex items-center justify-center p-1 transition-all',
                            isActive
                              ? 'bg-gradient-to-b from-[#1b5b9c] to-[#0f345c] border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                              : 'bg-gradient-to-b from-[#163a63] to-[#0d223a] border-cyan-500/40'
                          )}>
                            {abilityData?.icon ? (
                              <img
                                src={`https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/skill/${abilityData.icon}.webp`}
                                alt={tab.label}
                                className="size-full object-contain filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = headUrl;
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
                            <span className="block text-[10px] text-slate-500 dark:text-white/70 truncate">
                              {abilityData?.name || 'Standard'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Right Detail Pane */}
                  <div className="flex-1 min-w-0 space-y-4">
                    {currentSkill ? (
                      <div className="p-4 rounded-xl bg-surface-elevated/60 border border-border-subtle space-y-3.5">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className="size-14 rounded-xl bg-gradient-to-b from-[#1b5b9c] to-[#0f345c] border-2 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)] overflow-hidden shrink-0 flex items-center justify-center p-1.5">
                              <img
                                src={`https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/skill/${currentSkill.icon}.webp`}
                                alt={currentSkill.name}
                                className="size-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = headUrl;
                                }}
                              />
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                                  {currentSkill.name}
                                </h4>
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                  {character.element} DMG
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-white/80 mt-0.5">
                                <span>
                                  Cooldown:{' '}
                                  <strong className={currentSkill.cooldown ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-700 dark:text-white'}>
                                    {currentSkill.cooldown || '—'}
                                  </strong>
                                </span>
                                <span>•</span>
                                <span>
                                  Energy:{' '}
                                  <strong className={currentSkill.energy ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-700 dark:text-white'}>
                                    {currentSkill.energy ? `${currentSkill.energy}` : '—'}
                                  </strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          <span className="px-2.5 py-1 rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30 font-mono tabular-nums text-xs font-bold">
                            Lv.{skillLevel} Scaling
                          </span>
                        </div>

                        {/* Skill Description (Full vs Brief) */}
                        <div className="p-4 rounded-xl bg-surface-elevated border border-border-subtle text-xs sm:text-sm text-slate-700 dark:text-white leading-relaxed whitespace-pre-line font-normal">
                          <div className="max-w-[70ch]">
                            {briefMode
                              ? getBriefSkillDesc(formatSkillDesc(currentSkill.desc, currentSkill.params, skillLevel))
                              : formatSkillDesc(currentSkill.desc, currentSkill.params, skillLevel)}
                          </div>
                        </div>

                        {/* Raw Dynamic Parameters Telemetry Matrix */}
                        {currentSkill.params && currentSkill.params.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-white/80 uppercase tracking-wider tabular-nums">
                              Parameter Values at Lv.{skillLevel}
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                              {currentSkill.params.map((param: any, idx: number) => {
                                let val = String(param);
                                if (typeof param === 'string' && param.includes('/')) {
                                  const parts = param.split('/');
                                  const safeIdx = Math.min(Math.max(skillLevel, 1), parts.length) - 1;
                                  val = parts[safeIdx] ?? parts[0];
                                }
                                return (
                                  <div
                                    key={idx}
                                    className="p-2 rounded-md bg-surface-elevated border border-border-subtle text-xs"
                                  >
                                    <span className="text-[10px] text-slate-400 dark:text-white/70 block font-mono">
                                      &Param{idx + 1}&
                                    </span>
                                    <span className="font-mono tabular-nums font-bold text-teal-600 dark:text-teal-400">
                                      {val}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-500 dark:text-white/80">
                        Combat skill data not available.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ==================================================================== */}
          {/* TAB 3: POTENTIALS (AUTHENTIC WHOLE-IMAGE CARDS & SPEECH BUBBLE)     */}
          {/* ==================================================================== */}
          {activeTab === 'potentials' && (
            <section className="space-y-4 animate-in fade-in duration-150">
              {/* Top Navigation Bar: Segmented [ Main ] / [ Support ] + Level Slider + Preset Link */}
              <div className="game-card celestial-card p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="inline-flex p-1 rounded-full bg-surface-elevated border border-border-subtle shadow-xs">
                    <button
                      type="button"
                      aria-pressed={potentialSlotMode === 'main'}
                      onClick={() => setPotentialSlotMode('main')}
                      className={cn(
                        'px-6 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer',
                        potentialSlotMode === 'main'
                          ? 'bg-[#1e325c] text-white shadow-xs'
                          : 'text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white'
                      )}
                    >
                      Main
                    </button>
                    <button
                      type="button"
                      aria-pressed={potentialSlotMode === 'support'}
                      onClick={() => setPotentialSlotMode('support')}
                      className={cn(
                        'px-6 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer',
                        potentialSlotMode === 'support'
                          ? 'bg-[#1e325c] text-white shadow-xs'
                          : 'text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white'
                      )}
                    >
                      Support
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-auto">
                  {/* Compact Level Scaling Control */}
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-elevated border border-border-subtle text-xs">
                    <span className="text-slate-600 dark:text-white/80 font-medium whitespace-nowrap tabular-nums">
                      Lv. <strong className="font-mono text-amber-500">{potentialLevel}</strong>/9
                    </span>
                    <input
                      type="range"
                      aria-label="Potential Level"
                      min={1}
                      max={9}
                      step={1}
                      value={potentialLevel}
                      onChange={(e) => setPotentialLevel(Number(e.target.value))}
                      className="w-20 sm:w-24 h-1.5 bg-slate-200 dark:bg-slate-700/60 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    />
                  </div>

                  <Link
                    href={`/builder?char=${character.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white hover:bg-slate-50 border border-slate-300 text-[#1e325c] text-xs font-bold transition-colors shadow-xs"
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
                <div className="relative sticky top-4 flex flex-col items-center lg:items-end">
                  <div className="w-[278px] space-y-2">
                    {/* Top-Right Brief Mode Toggle Pill (matching potentials.png) */}
                    <div className="flex justify-end pr-0.5">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={briefMode}
                        onClick={() => setBriefMode(!briefMode)}
                        className="inline-flex items-center gap-2.5 pl-3.5 pr-1.5 py-1 rounded-full bg-[#5b6677]/90 hover:bg-[#4e5868] text-white text-[13px] font-medium transition-colors cursor-pointer shadow-sm select-none"
                      >
                        <span className="leading-none tracking-tight">Brief</span>
                        <span
                          className={cn(
                            'w-8 h-[18px] rounded-full p-[2px] flex items-center transition-colors',
                            briefMode ? 'bg-[#0abec5]' : 'bg-[#2b3340]'
                          )}
                        >
                          <span
                            className={cn(
                              'size-[14px] rounded-full bg-white shadow-xs transition-transform duration-150',
                              briefMode ? 'translate-x-[14px]' : 'translate-x-0'
                            )}
                          />
                        </span>
                      </button>
                    </div>

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

                      const richSpans = parsePotentialRichDesc(
                        activePotential.descTemplate,
                        activePotential.params,
                        effectiveLevel,
                        briefMode,
                        activePotential.briefDesc
                      );

                      const gradId = `pot-bg-grad-${activePotential.rarityNum}`;
                      const starGradId = `pot-star-grad-${activePotential.rarityNum}`;

                      return (
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`Inspect ${activePotential.name} potential details`}
                          onClick={() => setInspectedPotential(activePotential)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setInspectedPotential(activePotential);
                            }
                          }}
                          title="Click to open detailed inspector"
                          className="relative w-[278px] h-[422px] rounded-[8px] bg-white p-[5px] border-[1.5px] border-[#6c63b8] shadow-[0_10px_28px_rgba(15,23,42,0.25)] flex flex-col overflow-hidden select-none cursor-pointer"
                        >
                          {/* ==================================================== */}
                          {/* TOP VESTIGE STARBURST HEADER (242px)                 */}
                          {/* ==================================================== */}
                          <div className="relative h-[242px] w-full overflow-hidden shrink-0">
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
                                className="size-full object-contain"
                                style={{ filter: palette.iconShadow }}
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = getPotentialImageUrl(activePotential.id);
                                }}
                              />
                            </div>
                          </div>

                          {/* ==================================================== */}
                          {/* BOTTOM WHITE CARD BODY (170px)                       */}
                          {/* ==================================================== */}
                          <div className="relative flex-1 bg-white flex flex-col pt-0.5 pb-[10px] px-[20px] overflow-hidden">
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
                            <h4 className="text-[17px] font-bold text-[#3b4252] text-center tracking-tight leading-snug mb-2 shrink-0">
                              {activePotential.name}
                            </h4>

                            {/* Left-Aligned Description with Authentic In-Game Highlight Colors */}
                            <div className="flex-1 overflow-y-auto text-left text-[14.5px] leading-[1.48] text-[#4a5568] font-medium [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                              <p>
                                {richSpans.map((span, idx) =>
                                  span.color ? (
                                    <span
                                      key={idx}
                                      style={{ color: span.color }}
                                      className="font-bold"
                                    >
                                      {span.text}
                                    </span>
                                  ) : (
                                    <span key={idx}>{span.text}</span>
                                  )
                                )}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })() : (
                      <div className="p-8 text-center text-xs text-slate-500 dark:text-white/70 rounded-2xl bg-surface-elevated border border-border-subtle">
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
                      {/* Cyan Ribbon Header & Subtitle */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="bg-[#0abec5] text-white px-3 py-1 font-bold text-xs uppercase tracking-wider inline-flex items-center rounded-sm [clip-path:polygon(0_0,calc(100%-8px)_0,100%_100%,0_100%)] shadow-xs">
                            {build.title}
                          </div>
                          <span className="text-xs text-slate-600 dark:text-white/80 leading-normal">
                            {build.description}
                          </span>
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
                                'group relative aspect-[3/3.8] rounded-lg overflow-hidden border cursor-pointer transition-all duration-150 text-left bg-slate-900',
                                isSelected
                                  ? 'ring-2 ring-[#8ecb70] shadow-[0_0_15px_rgba(142,203,112,0.45)] -translate-y-0.5'
                                  : 'border-border-subtle hover:-translate-y-0.5 hover:shadow-md'
                              )}
                            >
                              {/* Neon Green Target Corner Brackets on Active / Hovered Card */}
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
                                <span className="absolute top-0 left-0 z-10 px-1.5 py-0.5 rounded-br-md bg-white/90 text-slate-950 font-bold tabular-nums text-[9px] shadow-xs">
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
                                  (e.target as HTMLImageElement).src = `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/potential/${pot.icon}_A.webp`;
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
          )}

          {/* ==================================================================== */}
          {/* TAB 4: TALENT TREE & RESONANCE MILESTONES (T1–T5)                    */}
          {/* ==================================================================== */}
          {activeTab === 'talents' && (
            <section className="space-y-5 animate-in fade-in duration-150">
              <div className="game-card celestial-card p-5 space-y-4">
                <div className="border-b border-border-subtle pb-3">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Award className="size-4 text-cyan-500" />
                    <span>Resonance & Talent Tree Progression (T1–T5)</span>
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-white/80">
                    Each resonance breakthrough unlocks powerful character and squad-wide attribute multipliers.
                  </p>
                </div>

                {/* Talent Progression Constellation */}
                <div className="space-y-3 pt-2">
                  {characterTalents.map((tierBonuses, index) => {
                    const tierNum = index + 1;
                    const isUnlocked = resonanceRank >= tierNum;
                    return (
                      <div
                        key={tierNum}
                        className={cn(
                          'p-4 rounded-xl border transition-all space-y-2.5',
                          isUnlocked
                            ? 'bg-cyan-500/10 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                            : 'bg-surface-elevated/70 border-border-subtle'
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'size-7 rounded-lg flex items-center justify-center font-bold text-xs tabular-nums',
                                isUnlocked
                                  ? 'bg-[#1e3a5f] text-cyan-300 border border-cyan-400'
                                  : 'bg-surface-elevated border border-border-subtle text-slate-600 dark:text-white/80'
                              )}
                            >
                              T{tierNum}
                            </span>
                            <div>
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                                Resonance Breakthrough Tier {tierNum}
                              </h4>
                              <span className="text-[10px] text-slate-500 dark:text-white/70">
                                {isUnlocked ? 'Active in combat simulation' : 'Locked (Requires Harmony breakthrough)'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            aria-pressed={isUnlocked}
                            onClick={() => setResonanceRank(isUnlocked ? tierNum - 1 : tierNum)}
                            className={cn(
                              'px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer tabular-nums',
                              isUnlocked
                                ? 'bg-cyan-500 text-slate-950 font-bold'
                                : 'bg-surface-elevated border border-border-subtle text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white'
                            )}
                          >
                            {isUnlocked ? 'Activated' : 'Activate T' + tierNum}
                          </button>
                        </div>

                        {/* Modifiers List */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {tierBonuses.map((bonus, bIdx) => (
                            <div
                              key={bIdx}
                              className="p-2 rounded-lg bg-surface-elevated border border-border-subtle flex items-center justify-between text-xs"
                            >
                              <span className="font-semibold text-slate-800 dark:text-white">
                                {bonus.stat}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono tabular-nums font-bold text-teal-600 dark:text-teal-400">
                                  +{Math.round(bonus.value * 100)}%
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-surface-card border border-border-subtle text-[10px] text-slate-600 dark:text-white/80">
                                  {bonus.target}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* ==================================================================== */}
          {/* TAB 5: AFFINITY & LOVED GIFTS MATRIX                                 */}
          {/* ==================================================================== */}
          {activeTab === 'affinity' && (
            <section className="space-y-6 animate-in fade-in duration-150">
              {/* Loved Gifts Showcase Card */}
              <div className="game-card celestial-card p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Gift className="size-4 text-amber-500" />
                      <span>Loved Gifts Collection ({lovedGifts.length})</span>
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-white/80">
                      Gifts in the character&apos;s loved category grant a <strong>+50% Affinity EXP bonus</strong>.
                    </p>
                  </div>

                  <Link
                    href={`/bond?char=${character.id}`}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-xs transition-colors shadow-xs"
                  >
                    <Gift className="size-3.5" />
                    <span>Calculate in Affinity Tool</span>
                  </Link>
                </div>

                {/* Loved Gift Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {lovedGifts.map((gift) => {
                    const effectiveExp = getGiftEffectiveExp(gift, character.id);
                    return (
                      <div
                        key={gift.id}
                        className="p-3.5 rounded-xl border border-border-subtle bg-surface-elevated space-y-2.5 hover:-translate-y-0.5 hover:shadow-md transition-transform"
                      >
                        <div className="flex items-start gap-3">
                          <div className="size-12 rounded-lg bg-surface-elevated border border-border overflow-hidden shrink-0 flex items-center justify-center p-1">
                            <img
                              src={gift.imageUrl}
                              alt={gift.name}
                              className="size-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = gift.fallbackUrl;
                              }}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 mb-0.5">
                              {Array.from({ length: gift.rarity }).map((_, i) => (
                                <Star
                                  key={i}
                                  className="size-2.5 fill-amber-400 text-amber-400"
                                />
                              ))}
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {gift.name}
                            </h4>
                            <div className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-white/80 mt-0.5">
                              <FamilyIcon family={gift.family} className="size-3" />
                              <span>{gift.familyName}</span>
                            </div>
                          </div>
                        </div>

                        {/* EXP Breakdown Pill */}
                        <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-xs tabular-nums">
                          <span className="text-slate-500 dark:text-white/70 text-[11px]">Base: {gift.baseExp}</span>
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded text-[11px]">
                            +{effectiveExp} EXP (+50%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Favorite Gift Families */}
              <div className="game-card celestial-card p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Compass className="size-4 text-teal-500" />
                  <span>Preferred Gift Families ({favoriteFamilies.length})</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {favoriteFamilies.map((famKey) => {
                    const famData = GIFT_FAMILIES[famKey];
                    return (
                      <div
                        key={famKey}
                        className="p-3 rounded-lg border border-border-subtle bg-surface-elevated/40 flex items-start gap-3"
                      >
                        <div className="p-2 rounded-lg bg-surface-elevated border border-border shrink-0">
                          <FamilyIcon family={famKey} className="size-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {famData?.label || famKey}
                          </h4>
                          <p className="text-[11px] text-slate-600 dark:text-white/80 mt-0.5 leading-relaxed">
                            {famData?.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </div>

        {/* ==================================================================== */}
        {/* AUTHENTIC IN-GAME BOTTOM DOCK NAVIGATION BAR                        */}
        {/* ==================================================================== */}
        <div className="sticky bottom-2 sm:bottom-3 z-30 w-full pt-4">
          <div className="w-full max-w-6xl mx-auto p-1 sm:p-1.5 rounded-xl sm:rounded-2xl bg-surface-card dark:bg-[#081526] border border-border-subtle dark:border-[#1a3250] shadow-2xl flex items-center justify-between gap-1 sm:gap-2">
            <button
              type="button"
              aria-label="Previous section"
              onClick={() => cycleTab('prev')}
              className="p-2 sm:px-3 sm:py-2.5 rounded-lg bg-surface-elevated/80 hover:bg-surface-hover text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
            >
              <ChevronLeft className="size-4 sm:size-5" />
            </button>

            <div className="flex-1 grid grid-cols-5 gap-1 sm:gap-1.5">
              {DOCK_TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'group relative px-1 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-lg sm:rounded-none select-none',
                      isActive
                        ? 'bg-[#132c4a] dark:bg-[#16365c] text-white shadow-[0_0_15px_rgba(6,182,212,0.35)] border-b-2 border-[#0abec5] sm:[clip-path:polygon(10px_0%,100%_0%,calc(100%-10px)_100%,0%_100%)]'
                        : 'bg-surface-elevated/70 dark:bg-[#0e2138]/60 hover:bg-surface-hover dark:hover:bg-[#163050] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-border-subtle/50 dark:border-[#1b3455]/50'
                    )}
                  >
                    <div
                      className={cn(
                        'size-6 sm:size-7 rounded-full flex items-center justify-center shrink-0 transition-all',
                        isActive
                          ? 'bg-[#0abec5] text-white shadow-[0_0_8px_rgba(10,190,197,0.7)]'
                          : 'bg-black/5 dark:bg-white/5 text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'
                      )}
                    >
                      <Icon className="size-3.5 sm:size-4" />
                    </div>
                    <span
                      className={cn(
                        'font-bold tracking-wide truncate text-[11px] sm:text-sm',
                        isActive
                          ? 'text-white'
                          : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'
                      )}
                    >
                      {tab.label}
                    </span>
                    {tab.key === 'affinity' && (
                      <span className="absolute top-1 sm:top-1.5 right-1.5 sm:right-2 size-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              aria-label="Next section"
              onClick={() => cycleTab('next')}
              className="p-2 sm:px-3 sm:py-2.5 rounded-lg bg-surface-elevated/80 hover:bg-surface-hover text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
            >
              <ChevronRight className="size-4 sm:size-5" />
            </button>
          </div>
        </div>

      {/* ==================================================================== */}
      {/* TAROT INSPECT MODAL: ARCHED PRESENTATION WITH CORNER STARS          */}
      {/* ==================================================================== */}
      {inspectedPotential && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="potential-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 animate-in fade-in duration-150"
          onClick={() => setInspectedPotential(null)}
        >
          <div
            className="w-full max-w-lg game-card celestial-card rounded-3xl border-2 border-pink-500/50 p-5 sm:p-6 space-y-4 shadow-[0_0_30px_rgba(236,72,153,0.25)] relative bg-surface-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Ornate Corner Stars */}
            <span className="absolute top-3 left-3 text-pink-400 text-sm">✦</span>
            <span className="absolute top-3 right-3 text-pink-400 text-sm">✦</span>
            <span className="absolute bottom-3 left-3 text-pink-400 text-sm">✦</span>
            <span className="absolute bottom-3 right-3 text-pink-400 text-sm">✦</span>

            {/* Close Button */}
            <button
              type="button"
              aria-label="Close dialog"
              onClick={() => setInspectedPotential(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>

            {/* Modal Header */}
            <div className="flex items-start gap-3.5 pr-8">
              <div className="size-14 rounded-full bg-slate-900 border-2 border-pink-400/60 overflow-hidden shrink-0 flex items-center justify-center p-1 shadow-md">
                <img
                  src={`https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/potential/${inspectedPotential.icon}_A.webp`}
                  alt={inspectedPotential.name}
                  className="size-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/potential/${inspectedPotential.id}.webp`;
                  }}
                />
              </div>

              <div>
                <h3
                  id="potential-modal-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  {inspectedPotential.name}
                </h3>
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
                    ? 'bg-pink-500 text-white font-bold shadow-[0_0_6px_rgba(236,72,153,0.5)]'
                    : 'bg-surface-elevated border border-border-subtle text-slate-700 dark:text-white'
                )}
              >
                {inspectedPotential.rarity} {inspectedPotential.isCore ? 'Core' : 'Normal'}
              </span>

              <span className="px-2 py-0.5 rounded bg-teal-500/15 text-teal-600 dark:text-teal-400 font-medium">
                Slot: {inspectedPotential.slot}
              </span>

              <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-slate-600 dark:text-white/80 tabular-nums">
                Max Lv: {inspectedPotential.maxLevel}
              </span>

              {inspectedPotential.damageType && inspectedPotential.damageType.map((dt, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 text-[10px]"
                >
                  {dt}
                </span>
              ))}
            </div>

            {/* Scaled Description at Current Slider Level */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-white/80 uppercase tracking-wider tabular-nums">
                Scaled Description (Lv. {potentialLevel})
              </span>
              <div className="p-3.5 rounded-lg bg-surface-elevated/50 border border-border-subtle text-xs sm:text-sm text-slate-700 dark:text-white leading-relaxed font-normal whitespace-pre-line">
                {formatPotentialDesc(
                  inspectedPotential.descTemplate,
                  inspectedPotential.params,
                  (inspectedPotential.isCore || inspectedPotential.rarityNum === 0) &&
                    String(inspectedPotential.params?.[0] ?? '').split('/').length > 9 &&
                    potentialLevel === 1
                    ? 8
                    : potentialLevel
                )}
              </div>
            </div>

            {/* Brief Description from Wiki */}
            {inspectedPotential.briefDesc && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-white/80 uppercase tracking-wider">
                  Brief Description
                </span>
                <div className="p-3 rounded-lg bg-surface-elevated/40 border border-border-subtle text-xs text-slate-600 dark:text-white/80 leading-relaxed font-normal">
                  {inspectedPotential.briefDesc}
                </div>
              </div>
            )}

            {/* Effect Types */}
            {inspectedPotential.effectType && inspectedPotential.effectType.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-white/80 uppercase tracking-wider">
                  Effect Types
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
                onClick={() => setInspectedPotential(null)}
                className="px-4 py-1.5 rounded-md bg-surface-elevated border border-border-subtle hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-xs font-semibold transition-colors cursor-pointer"
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
