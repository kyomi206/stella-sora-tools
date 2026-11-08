'use client';

import { useRef, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import { TeamBuild, SSCharacter, SSPotentialFull } from '@/types';
import charactersData from '@/data/characters.json';
import { getPotentialById, getPotentialImageUrl, formatPotentialDesc } from '@/lib/potentials';
import { Download, Share2, Check } from 'lucide-react';
import { compressBuild, cn } from '@/lib/utils';
import { getWikiTideTrekkerUrl } from '@/lib/wikitide';

interface BuildCardExportProps {
  build: TeamBuild;
  characters?: Record<string, SSCharacter>;
}

export function BuildCardExport({ build, characters: externalCharacters }: BuildCardExportProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [hoveredPot, setHoveredPot] = useState<{
    pot: SSPotentialFull;
    level: number;
    priority: string;
    targetRect?: DOMRect;
  } | null>(null);

  const characters = (externalCharacters || charactersData) as Record<string, SSCharacter>;

  const vanguardChar = build.slots.vanguard.characterId
    ? characters[String(build.slots.vanguard.characterId)]
    : null;
  const versatileChar = build.slots.versatile.characterId
    ? characters[String(build.slots.versatile.characterId)]
    : null;
  const supportChar = build.slots.support.characterId
    ? characters[String(build.slots.support.characterId)]
    : null;

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Export the card in the light palette even when the app is in dark mode.
          clonedDoc.documentElement.classList.remove('dark');
        },
      });
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      const safeName = (build.name || 'stella-sora-build')
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-');
      a.download = `${safeName}-stella-sora-build.png`;
      a.click();
    } catch (err) {
      console.error('Failed to export image', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyShareLink = () => {
    const encoded = compressBuild(build);
    if (!encoded) return;
    const url = `${window.location.origin}/builder?b=${encoded}`;
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
      dashed: false,
    },
    {
      key: 'Medium',
      label: 'Medium',
      headerBg: 'bg-[#6366f1]',
      boxBorder: 'border-[2.5px] border-[#6366f1] bg-[#6366f1]/10',
      divideBorder: 'divide-x-[2px] divide-[#6366f1]',
      dashed: false,
    },
    {
      key: 'Low',
      label: 'Low',
      headerBg: 'bg-[#f59e0b]',
      boxBorder: 'border-[2.5px] border-[#f59e0b] bg-[#f59e0b]/10',
      divideBorder: 'divide-x-[2px] divide-[#f59e0b]',
      dashed: false,
    },
    {
      key: 'Optional',
      label: 'Optional',
      headerBg: 'bg-[#f43f5e]',
      boxBorder: 'border-[2.5px] border-dashed border-[#f43f5e] bg-[#f43f5e]/10',
      divideBorder: 'divide-x-[2px] divide-dashed divide-[#f43f5e]',
      dashed: true,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-5 mt-4 w-full">
      {/* 1. Live Preview Window matching previewold.png */}
      <div
        ref={cardRef}
        id="team-card-export"
        className="w-full bg-surface-card text-slate-900 p-4 sm:p-6 rounded-xl flex flex-col gap-4 relative overflow-x-auto select-none shadow-xl border border-border"
      >
        {squadRows.map(({ slotKey, roleBadge, roleBadgeBg, char, potentials }) => {
          const isFiveStar = (char?.star || 4) >= 5;

          return (
            <div
              key={slotKey}
              className="flex items-center gap-4 sm:gap-6 pb-4 border-b border-border last:border-b-0 last:pb-0"
            >
              {/* Left: Trekker Card matching previewold.png & ex.png */}
              <div className="shrink-0 flex items-center justify-center">
                {char ? (
                  <div
                    className={cn(
                      'relative w-24 sm:w-28 aspect-[3.4/4.4] rounded-lg overflow-hidden shadow-md bg-white select-none shrink-0',
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

                    {/* Top-Left Role Pill matching previewold.png */}
                    <div className="absolute top-1 left-1 z-20 flex items-center pointer-events-none">
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-bold tracking-tight text-white shadow-xs',
                          roleBadgeBg
                        )}
                      >
                        {roleBadge}
                      </span>
                    </div>

                    {/* Top-Right Element Badge matching previewold.png */}
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
                      src={getWikiTideTrekkerUrl(char.name.EN) || `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/head/head_${char.id}01_XL.webp`}
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

                    {/* Character Name in Bold Royal Blue Font at Bottom matching previewold.png */}
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
                    <span className="text-[10px] capitalize text-slate-500">{slotKey}</span>
                  </div>
                )}
              </div>

              {/* Right: Potentials grouped by Priority */}
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

      {/* 2. Action Bar Window placed BELOW the preview window */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-border celestial-card bg-surface-card">
        <h3 className="font-bold text-sm sm:text-base !text-slate-900 tracking-wide">
          Build Export & Live Preview
        </h3>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border-hover bg-surface-elevated/80 hover:bg-surface-elevated text-xs font-semibold text-slate-800 hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {isCopied ? (
              <>
                <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
                <span className="text-emerald-600">Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="size-3.5" aria-hidden="true" />
                <span>Copy Share Link</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isExporting}
            onClick={handleDownloadImage}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs transition-colors cursor-pointer shadow-md shadow-sky-500/20 disabled:opacity-50"
          >
            <Download className="size-3.5" />
            <span>{isExporting ? 'Generating PNG...' : 'Download Image Card'}</span>
          </button>
        </div>
      </div>

      {/* Floating Hover Popover in Preview */}
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
    </div>
  );
}
