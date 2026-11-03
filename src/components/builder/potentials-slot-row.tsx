'use client';

import { useState } from 'react';
import { SelectedPotential, SlotType } from '@/types';
import { getPotentialById, formatPotentialDesc, getPotentialImageUrl } from '@/lib/potentials';
import { SSPotentialFull } from '@/types';
import { X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PotentialsSlotRowProps {
  slot: SlotType;
  characterId: number | null;
  potentials: SelectedPotential[];
  onOpenPicker: () => void;
  onRemovePotential: (id: number) => void;
}

export function PotentialsSlotRow({
  slot,
  characterId,
  potentials,
  onOpenPicker,
  onRemovePotential,
}: PotentialsSlotRowProps) {
  const [hoveredPot, setHoveredPot] = useState<{
    pot: SSPotentialFull;
    level: number;
  } | null>(null);

  if (!characterId || potentials.length === 0) {
    return null;
  }

  return (
    <div className="w-full mt-1 flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-slate-600 px-1">
        <span>Active Potentials:</span>
        <span className="font-mono font-bold text-amber-600">{potentials.length}</span>
      </div>

      {/* Selected potentials thumbnail strip */}
      <div className="p-2 rounded-xl border border-border bg-surface-card flex flex-wrap gap-2 items-center justify-center min-h-[64px] relative">
        {potentials.map((sel) => {
          const pot = getPotentialById(characterId, sel.id);
          if (!pot) return null;
          const levelNum = Number(sel.level) || 1;

          return (
            <button
              type="button"
              key={sel.id}
              className="group relative size-12 sm:size-13 rounded-lg overflow-hidden border border-border bg-base flex flex-col items-center justify-between p-0.5 cursor-pointer hover:border-border-hover transition-colors shrink-0"
              onMouseEnter={() => setHoveredPot({ pot, level: levelNum })}
              onMouseLeave={() => setHoveredPot(null)}
              onClick={onOpenPicker}
              aria-label={`Configure ${pot.name}`}
            >
              {/* Potential Graphic */}
              <div className="relative size-8 mt-0.5 flex items-center justify-center">
                <img
                  src={getPotentialImageUrl(pot.id)}
                  alt={pot.name}
                  className="size-full object-contain pointer-events-none"
                  onError={(e) => {
                    (e.target as HTMLElement).style.opacity = '0.5';
                  }}
                />
              </div>

              {/* Name at bottom */}
              <span className="text-[7.5px] font-semibold text-slate-700 text-center truncate w-full px-0.5 pointer-events-none">
                {pot.name}
              </span>

              {/* Level / Core Badge at top-left */}
              <div className="absolute top-0.5 left-0.5 z-10">
                {pot.isCore ? (
                  <span className="px-1 py-0.2 rounded bg-amber-500 text-black text-[7px] font-black uppercase">
                    Core
                  </span>
                ) : (
                  <span className="px-1 py-0.2 rounded bg-surface-hover border border-border text-amber-700 text-[7px] font-mono font-bold">
                    Lv{levelNum}
                  </span>
                )}
              </div>

              {/* Remove button on hover */}
              <button
                type="button"
                aria-label={`Remove ${pot.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemovePotential(pot.id);
                }}
                className="absolute top-0.5 right-0.5 size-4 rounded-full bg-black/80 hover:bg-rose-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
              >
                <X className="size-2.5" />
              </button>
            </button>
          );
        })}
      </div>

      {/* Hover tooltip for potential detail */}
      {hoveredPot && (
        <div className="p-2.5 rounded-lg border border-border bg-surface-subtle text-xs text-slate-700 flex flex-col gap-1 shadow-lg animate-in fade-in duration-100">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900">{hoveredPot.pot.name}</span>
            <span className="text-[10px] text-amber-600 font-mono">
              {hoveredPot.pot.isCore ? 'CORE POTENTIAL' : `Level ${hoveredPot.level}`}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            {formatPotentialDesc(hoveredPot.pot.descTemplate, hoveredPot.pot.params, hoveredPot.level)}
          </p>
        </div>
      )}
    </div>
  );
}
