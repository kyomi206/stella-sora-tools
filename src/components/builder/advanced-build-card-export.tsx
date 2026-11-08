'use client';

import { useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import {
  AdvancedTeamBuild,
  SSCharacter,
  SSDisc,
  SSDiscSecondarySkill,
  SSPotentialFull,
  NoteName,
} from '@/types';
import {
  getPotentialById,
  getPotentialImageUrl,
  formatPotentialDesc,
} from '@/lib/potentials';
import {
  MUSICAL_NOTES,
  getDiscOutfitIconUrl,
  getNoteIconUrl,
  getDiscSkillIconUrl,
  calculateSupportStartingNotes,
  getHarmonyActivationLevel,
} from '@/data/notes';
import { Download, Share2, Check, Disc } from 'lucide-react';
import { compressAdvancedBuild, cn } from '@/lib/utils';
import { getWikiTideTrekkerUrl } from '@/lib/wikitide';
import { HarmonySkillDetail } from './disc-detail-card';

interface AdvancedBuildCardExportProps {
  build: AdvancedTeamBuild;
  characters: Record<string, SSCharacter>;
  discs: Record<string, SSDisc>;
}

export function AdvancedBuildCardExport({
  build,
  characters,
  discs,
}: AdvancedBuildCardExportProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [hoveredPot, setHoveredPot] = useState<{
    pot: SSPotentialFull;
    level: number;
    priority: string;
    targetRect?: DOMRect;
  } | null>(null);
  const [hoveredHarmony, setHoveredHarmony] = useState<{
    skill: SSDiscSecondarySkill;
    level: number;
    targetRect: DOMRect;
  } | null>(null);

  const vanguardChar = build.slots.vanguard.characterId
    ? characters[String(build.slots.vanguard.characterId)]
    : null;
  const versatileChar = build.slots.versatile.characterId
    ? characters[String(build.slots.versatile.characterId)]
    : null;
  const supportChar = build.slots.support.characterId
    ? characters[String(build.slots.support.characterId)]
    : null;

  const supportStartingNotes = calculateSupportStartingNotes(build.supportDiscs, discs);
  const effectiveNotes: Record<NoteName, number> = Object.fromEntries(
    MUSICAL_NOTES.map((n) => {
      const start = supportStartingNotes[n.name] || 0;
      const custom = build.targetNotes[n.name];
      return [n.name, custom !== undefined ? Math.max(0, custom) : start];
    })
  ) as Record<NoteName, number>;

  const activeNoteEntries = MUSICAL_NOTES.filter((n) => (effectiveNotes[n.name] || 0) > 0);

  const harmonySkills = build.mainDiscs.flatMap((slot) => {
    const disc = slot.discId ? discs[String(slot.discId)] : null;
    if (!disc) return [];
    return [disc.secondarySkill1, disc.secondarySkill2].flatMap((skill) =>
      skill
        ? [
            {
              key: `${disc.id}-${skill.name}`,
              skill,
              name: skill.name,
              icon: skill.icon,
              level: getHarmonyActivationLevel(skill, effectiveNotes),
            },
          ]
        : []
    );
  });

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          clonedDoc.documentElement.classList.remove('dark');
        },
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const safeName = (build.name || 'advanced-preset')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-');
      a.download = `${safeName}-advanced-preset.png`;
      a.click();
    } catch (err) {
      console.error('Failed to export advanced preset image', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyShareLink = () => {
    const encoded = compressAdvancedBuild(build);
    if (!encoded) return;
    const url = `${window.location.origin}/builder/advanced?b=${encoded}`;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const squadRows = [
    {
      slotKey: 'vanguard' as const,
      roleBadge: 'MAIN',
      roleBadgeBg: 'bg-[#ff2a70]',
      char: vanguardChar,
      potentials: build.slots.vanguard.potentials,
    },
    {
      slotKey: 'versatile' as const,
      roleBadge: 'SUPPORT',
      roleBadgeBg: 'bg-[#6366f1]',
      char: versatileChar,
      potentials: build.slots.versatile.potentials,
    },
    {
      slotKey: 'support' as const,
      roleBadge: 'SUPPORT',
      roleBadgeBg: 'bg-[#6366f1]',
      char: supportChar,
      potentials: build.slots.support.potentials,
    },
  ];

  const priorityDefinitions = [
    {
      key: 'Core',
      label: 'Core',
      headerBg: 'bg-[#2dd4bf]',
      boxBorder: 'border-[2.5px] border-[#2dd4bf] bg-[#2dd4bf]/10',
      divideBorder: 'divide-x-[2px] divide-[#2dd4bf]',
    },
    {
      key: 'Medium',
      label: 'Medium',
      headerBg: 'bg-[#6366f1]',
      boxBorder: 'border-[2.5px] border-[#6366f1] bg-[#6366f1]/10',
      divideBorder: 'divide-x-[2px] divide-[#6366f1]',
    },
    {
      key: 'Low',
      label: 'Low',
      headerBg: 'bg-[#f59e0b]',
      boxBorder: 'border-[2.5px] border-[#f59e0b] bg-[#f59e0b]/10',
      divideBorder: 'divide-x-[2px] divide-[#f59e0b]',
    },
    {
      key: 'Optional',
      label: 'Optional',
      headerBg: 'bg-[#f43f5e]',
      boxBorder: 'border-[2.5px] border-dashed border-[#f43f5e] bg-[#f43f5e]/10',
      divideBorder: 'divide-x-[2px] divide-dashed divide-[#f43f5e]',
    },
  ] as const;

  return (
    <div className="flex flex-col gap-5 mt-2 w-full">
      <div
        ref={cardRef}
        id="advanced-team-card-export"
        className="w-full bg-surface-card text-slate-900 p-4 sm:p-6 rounded-xl flex flex-col gap-5 relative overflow-x-auto select-none border border-border"
      >
        {/* 1. Trekkers & Potentials Rows */}
        <div className="flex flex-col gap-4">
          {squadRows.map(({ slotKey, roleBadge, roleBadgeBg, char, potentials }) => {
            const isFiveStar = (char?.star || 4) >= 5;

            return (
              <div
                key={slotKey}
                className="flex items-center gap-4 sm:gap-6 pb-4 border-b border-border last:border-b-0 last:pb-0"
              >
                <div className="shrink-0 flex items-center justify-center">
                  {char ? (
                    <div
                      className={cn(
                        'relative w-24 sm:w-28 aspect-[3.4/4.4] rounded-lg overflow-hidden bg-white select-none shrink-0',
                        isFiveStar ? 'border-2 border-purple-300/80' : 'border-2 border-border'
                      )}
                    >
                      {/* Top Accent Line for 5-star vs 4-star */}
                      <div
                        className={cn(
                          'absolute inset-x-0 top-0 h-0.5 z-20',
                          isFiveStar
                            ? 'bg-gradient-to-r from-[#c084fc] via-[#818cf8] to-[#38bdf8]'
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
                          crossOrigin="anonymous"
                          className="size-6 sm:size-7 object-contain drop-shadow"
                        />
                      </div>

                      {/* Character Bust Artwork */}
                      <img
                        src={
                          getWikiTideTrekkerUrl(char.name.EN) ||
                          `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/head/head_${char.id}01_XL.webp`
                        }
                        alt={char.name.EN}
                        crossOrigin="anonymous"
                        className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          const autumnVnUrl = `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/head/head_${char.id}01_XL.webp`;
                          if (target.src !== autumnVnUrl && !target.src.includes('ssassets')) {
                            target.src = autumnVnUrl;
                          } else if (!target.src.includes('/characters/')) {
                            target.src = `/characters/head_${char.id}01_XL.webp`;
                          }
                        }}
                      />

                      {/* Bottom Soft White Gradient Fade */}
                      <div className="absolute inset-x-0 bottom-1 h-10 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-10" />

                      {/* Character Name in Bold Royal Blue Font at Bottom */}
                      <div className="absolute bottom-1 inset-x-1.5 z-20 flex items-center justify-between pointer-events-none">
                        <span className="font-extrabold text-xs sm:text-sm text-[#1a56db] tracking-tight drop-shadow truncate">
                          {char.name.EN}
                        </span>
                      </div>

                      {/* Bottom Horizontal Bar: 5-Star Rainbow/Purple vs 4-Star Yellow/Gold */}
                      <div
                        className={cn(
                          'absolute inset-x-0 bottom-0 h-1.5 z-20',
                          isFiveStar
                            ? 'bg-gradient-to-r from-[#c084fc] via-[#818cf8] to-[#38bdf8] border-t border-purple-200/50'
                            : 'bg-gradient-to-r from-[#fde047] via-[#facc15] to-[#eab308] border-t border-yellow-200/50'
                        )}
                      />
                    </div>
                  ) : (
                    <div className="w-24 sm:w-28 aspect-[3.4/4.4] rounded-lg border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center p-2 text-center text-slate-600">
                      <span className="text-xs font-semibold capitalize text-slate-700">Empty</span>
                      <span className="text-[11px] capitalize text-slate-500">{slotKey}</span>
                    </div>
                  )}
                </div>

                {/* Right: Potentials grouped by Priority matching new-squad-build-stella-sora-build (1).png */}
                <div className="flex-1 flex items-center gap-3 overflow-x-auto py-2">
                  {char && potentials.length > 0 ? (
                    priorityDefinitions
                      .filter((prio) => {
                        return potentials.some((sel) => {
                          const pot = getPotentialById(char.id, sel.id);
                          const assignedPriority = sel.priority || (pot?.isCore ? 'Core' : 'Medium');
                          return assignedPriority === prio.key;
                        });
                      })
                      .map((prio) => {
                        const groupPotentials = potentials.filter((sel) => {
                          const pot = getPotentialById(char.id, sel.id);
                          const assignedPriority = sel.priority || (pot?.isCore ? 'Core' : 'Medium');
                          return assignedPriority === prio.key;
                        });

                        return (
                          <div key={prio.key} className="flex flex-col shrink-0">
                            {/* Priority Tab Header */}
                            <div className="self-start relative z-10 -mb-[2.5px]">
                              <span
                                className={cn(
                                  'px-3.5 py-0.5 text-xs font-bold text-white rounded-t-md shadow-xs inline-block tracking-wide',
                                  prio.headerBg
                                )}
                              >
                                {prio.label}
                              </span>
                            </div>

                            {/* Priority Box Container */}
                            <div
                              className={cn(
                                'relative z-0 rounded-b-md rounded-tr-md overflow-hidden flex items-stretch shadow-sm',
                                prio.boxBorder,
                                prio.divideBorder
                              )}
                            >
                              {groupPotentials.map((sel) => {
                                const pot = getPotentialById(char.id, sel.id);
                                if (!pot) return null;
                                const levelVal = Number(sel.level) || (pot.isCore ? 1 : 6);

                                return (
                                  <div
                                    key={sel.id}
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setHoveredPot({
                                        pot,
                                        level: levelVal,
                                        priority: prio.label,
                                        targetRect: rect,
                                      });
                                    }}
                                    onMouseMove={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setHoveredPot((prev) => (prev ? { ...prev, targetRect: rect } : null));
                                    }}
                                    onMouseLeave={() => setHoveredPot(null)}
                                    className="relative w-[88px] sm:w-[98px] aspect-[87/107] shrink-0 cursor-pointer select-none bg-white"
                                  >
                                    {/* Official Potential Graphic */}
                                    <img
                                      src={getPotentialImageUrl(pot.id)}
                                      alt={pot.name}
                                      crossOrigin="anonymous"
                                      className="w-full h-full object-cover pointer-events-none"
                                    />

                                    {/* Level number in the top-left white notch matching previewold.png */}
                                    {!pot.isCore ? (
                                      <div className="absolute left-[13%] top-[7%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center">
                                        <span
                                          style={{ color: '#0f172a' }}
                                          className="text-[11px] sm:text-[12px] font-mono font-extrabold text-slate-800 dark:!text-slate-950 leading-none select-none"
                                        >
                                          {levelVal}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="absolute left-[13%] top-[7%] -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center">
                                        <span
                                          style={{ color: '#ffffff' }}
                                          className="text-[11px] sm:text-[12px] font-mono font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] leading-none select-none"
                                        >
                                          {levelVal}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div className="flex items-center text-xs text-slate-600 italic py-4">
                      {char ? 'No potentials chosen yet.' : 'Assign Trekker above to configure.'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 2. Runic Discs Summary Row (3 Main + 3 Support) */}
        <div className="pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Main Discs */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Disc className="size-3.5" />
              <span>Main Discs (Melody & Harmony)</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {build.mainDiscs.map((slot, idx) => {
                const disc = slot.discId ? discs[String(slot.discId)] : null;
                if (!disc) {
                  return (
                    <div
                      key={`exp-main-${idx}`}
                      className="rounded-lg border border-dashed border-border p-2.5 flex items-center justify-center text-[11px] text-slate-500 min-h-[72px]"
                    >
                      Empty Main #{idx + 1}
                    </div>
                  );
                }
                const h1 = getHarmonyActivationLevel(disc.secondarySkill1, effectiveNotes);
                const h2 = getHarmonyActivationLevel(disc.secondarySkill2, effectiveNotes);

                return (
                  <div
                    key={`exp-main-${idx}`}
                    className="rounded-lg border border-border bg-surface-subtle p-2 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={getDiscOutfitIconUrl(disc.id, 'full')}
                        alt={disc.name}
                        crossOrigin="anonymous"
                        className="size-10 rounded-md object-cover border border-border shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-slate-900 truncate">
                          {disc.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 font-semibold">
                          C{slot.crescendo} • Lv.{slot.level}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap text-[11px] font-mono">
                      {disc.secondarySkill1 && (
                        <span
                          className={cn(
                            'px-1 py-0.5 rounded',
                            h1 > 0
                              ? 'bg-emerald-500/20 text-emerald-700 font-bold'
                              : 'bg-surface-subtle text-slate-500'
                          )}
                        >
                          H1: Lv.{h1}
                        </span>
                      )}
                      {disc.secondarySkill2 && (
                        <span
                          className={cn(
                            'px-1 py-0.5 rounded',
                            h2 > 0
                              ? 'bg-emerald-500/20 text-emerald-700 font-bold'
                              : 'bg-surface-subtle text-slate-500'
                          )}
                        >
                          H2: Lv.{h2}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Support Discs */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Disc className="size-3.5" />
              <span>Support Discs (Starting Notes)</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {build.supportDiscs.map((slot, idx) => {
                const disc = slot.discId ? discs[String(slot.discId)] : null;
                if (!disc) {
                  return (
                    <div
                      key={`exp-sup-${idx}`}
                      className="rounded-lg border border-dashed border-border p-2.5 flex items-center justify-center text-[11px] text-slate-500 min-h-[72px]"
                    >
                      Empty Sup #{idx + 1}
                    </div>
                  );
                }
                const phaseIdx = Math.max(
                  0,
                  Math.min((disc.supportNote?.length || 1) - 1, slot.phase)
                );
                const startNotes = disc.supportNote?.[phaseIdx] || {};

                return (
                  <div
                    key={`exp-sup-${idx}`}
                    className="rounded-lg border border-border bg-surface-subtle p-2 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={getDiscOutfitIconUrl(disc.id, 'full')}
                        alt={disc.name}
                        crossOrigin="anonymous"
                        className="size-10 rounded-md object-cover border border-border shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-slate-900 truncate">
                          {disc.name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 font-semibold">
                          C{slot.crescendo ?? 1} • Phase {slot.phase} • Lv.{slot.level}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap text-[11px] font-mono text-slate-700 font-semibold">
                      {Object.entries(startNotes).map(([k, v]) => (
                        <span key={k} className="px-1 py-0.5 rounded bg-surface-elevated border border-border">
                          {k.replace('Melody of ', '')} +{v}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Musical Notes + Harmony Skills board (in-game layout, site theme) */}
        <div className="pt-4 border-t border-border">
          <div className="note-panel">
            {/* Musical Note Skills */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">Musical Note Skills</span>
              <span className="text-[10px] font-semibold text-[color:var(--np-ink-muted)] tabular-nums">
                {activeNoteEntries.length} Active
              </span>
            </div>

            <div className="mt-2.5 flex items-start justify-between gap-1 px-0.5">
              {MUSICAL_NOTES.map((note) => {
                const count = effectiveNotes[note.name] || 0;
                const active = count > 0;
                const bonus = +(count * note.perLevelPct).toFixed(2);
                return (
                  <div
                    key={note.id}
                    className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
                    title={`${note.name} — ${note.statLabel}`}
                  >
                    <img
                      src={getNoteIconUrl(note.id)}
                      alt={note.shortName}
                      crossOrigin="anonymous"
                      className={cn(
                        'size-7 sm:size-8 object-contain drop-shadow',
                        !active && 'opacity-75'
                      )}
                    />
                    <span
                      className={cn(
                        'text-xs sm:text-[13px] font-bold tabular-nums leading-none',
                        active ? 'text-[color:var(--np-ink)]' : 'text-[color:var(--np-ink-muted)]'
                      )}
                    >
                      {count}
                    </span>
                    <span className="h-2.5 text-[9px] font-semibold leading-none tabular-nums text-amber-600 dark:text-amber-400">
                      {active ? `+${bonus}%` : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Harmony Skills */}
            <div className="mt-3 border-t border-border-subtle pt-2.5">
              <span className="text-xs font-semibold text-slate-800">Harmony Skills</span>

              {harmonySkills.length === 0 ? (
                <p className="mt-2 text-[11px] italic text-[color:var(--np-ink-muted)]">
                  Equip Main Discs to unlock Harmony Skills.
                </p>
              ) : (
                <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
                  {harmonySkills.map((skill) => (
                    <button
                      key={skill.key}
                      type="button"
                      onMouseEnter={(e) =>
                        setHoveredHarmony({
                          skill: skill.skill,
                          level: skill.level,
                          targetRect: e.currentTarget.getBoundingClientRect(),
                        })
                      }
                      onFocus={(e) =>
                        setHoveredHarmony({
                          skill: skill.skill,
                          level: skill.level,
                          targetRect: e.currentTarget.getBoundingClientRect(),
                        })
                      }
                      onMouseLeave={() => setHoveredHarmony(null)}
                      onBlur={() => setHoveredHarmony(null)}
                      aria-label={`Show ${skill.name} harmony skill`}
                      className="harmony-plate w-full cursor-help text-left"
                    >
                      <span className="disc-icon-tile flex size-7 shrink-0 items-center justify-center rounded-[4px]">
                        <img
                          src={getDiscSkillIconUrl(skill.icon)}
                          alt=""
                          crossOrigin="anonymous"
                          className="size-4.5 object-contain"
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-bold leading-tight text-[color:var(--np-plate-ink)]">
                          {skill.name}
                        </div>
                        <div
                          className={cn(
                            'text-[10px] font-semibold leading-tight text-[color:var(--np-plate-sub)]',
                            skill.level === 0 && 'opacity-55'
                          )}
                        >
                          Level {skill.level}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Harmony skill hover popover: tier comes from the current note pool */}
      {hoveredHarmony && (() => {
        const rect = hoveredHarmony.targetRect;
        const centerX = rect.left + rect.width / 2;
        const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const popupHalf = 185;
        const popupLeft = Math.max(popupHalf, Math.min(centerX, windowWidth - popupHalf));
        const showBelow = rect.top < 260;

        return (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: `${popupLeft}px`,
              top: showBelow ? `${rect.bottom + 8}px` : `${rect.top - 8}px`,
              transform: showBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            }}
          >
            <div className="disc-card w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--dc-panel-border)] bg-[var(--dc-panel)] p-2 shadow-2xl">
              <HarmonySkillDetail skill={hoveredHarmony.skill} level={hoveredHarmony.level} />
            </div>
          </div>
        );
      })()}

      {/* Floating Hover Popover in Preview matching build-card-export */}
      {hoveredPot && hoveredPot.targetRect && (() => {
        const rect = hoveredPot.targetRect;
        const centerX = rect.left + rect.width / 2;
        const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const popupLeft = Math.max(160, Math.min(centerX, windowWidth - 160));
        const arrowOffset = centerX - popupLeft;
        const showBelow = rect.top < 120;

        return (
          <div
            className="fixed z-50 pointer-events-none transition-opacity duration-100"
            style={{
              left: `${popupLeft}px`,
              top: showBelow ? `${rect.bottom + 8}px` : `${rect.top - 8}px`,
              transform: showBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
            }}
          >
            <div className="relative bg-surface-card text-slate-800 text-xs leading-snug rounded-xl px-4 py-2.5 shadow-2xl border border-border max-w-[280px] sm:max-w-[320px] text-left">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-bold text-amber-600 dark:text-amber-400">{hoveredPot.pot.name}</span>
                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-subtle text-slate-600 border border-border-subtle">
                  {hoveredPot.priority} • Lv.{hoveredPot.level}
                </span>
              </div>
              <p className="font-normal select-none">
                {formatPotentialDesc(hoveredPot.pot.descTemplate, hoveredPot.pot.params, hoveredPot.level)}
              </p>

              {/* Speech bubble tail pointer */}
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

      {/* Export Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-card border border-border p-4 rounded-xl">
        <div>
          <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
            Advanced Preset Export & Share
          </h4>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border bg-surface-elevated hover:bg-border text-xs sm:text-sm font-semibold text-slate-900 dark:text-white transition-colors cursor-pointer press-feedback"
          >
            {isCopied ? (
              <>
                <Check className="size-4 text-emerald-500" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="size-4" />
                <span>Copy Share Link</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadImage}
            disabled={isExporting}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition-colors cursor-pointer press-feedback disabled:opacity-50"
          >
            <Download className="size-4" />
            <span>{isExporting ? 'Exporting…' : 'Download PNG'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
