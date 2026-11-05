'use client';

import { SSCharacter, SlotType } from '@/types';
import { UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWikiTideTrekkerUrl } from '@/lib/wikitide';

interface TrekkerCardProps {
  slot: SlotType;
  character: SSCharacter | null;
  onSelectClick: () => void;
  onRemoveClick: () => void;
  onDragStart?: (slot: SlotType) => void;
  onDragOver?: (slot: SlotType) => void;
  onDragLeave?: () => void;
  onDrop?: (sourceSlot: SlotType, targetSlot: SlotType) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isDragOver?: boolean;
}

export function TrekkerCard({
  slot,
  character,
  onSelectClick,
  onRemoveClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  isDragging = false,
  isDragOver = false,
}: TrekkerCardProps) {
  const roleConfig = {
    vanguard: {
      label: 'Vanguard',
      badgeBg: 'bg-rose-500/15 text-rose-600 border border-rose-500/30',
    },
    versatile: {
      label: 'Support',
      badgeBg: 'bg-indigo-500/15 text-indigo-700 border border-indigo-500/30',
    },
    support: {
      label: 'Support',
      badgeBg: 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30',
    },
  };

  const classConfig: Record<string, { label: string; badgeBg: string }> = {
    Vanguard: {
      label: 'Vanguard',
      badgeBg: 'bg-[#f43f5e]',
    },
    Versatile: {
      label: 'Versatile',
      badgeBg: 'bg-[#6366f1]',
    },
    Support: {
      label: 'Support',
      badgeBg: 'bg-[#10b981]',
    },
  };

  const role = roleConfig[slot];

  if (!character) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onSelectClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectClick();
          }
        }}
        aria-label={`Assign ${role.label} slot`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          onDragOver?.(slot);
        }}
        onDragLeave={() => onDragLeave?.()}
        onDrop={(e) => {
          e.preventDefault();
          const source = (e.dataTransfer.getData('text/plain') as SlotType);
          onDrop?.(source, slot);
        }}
        className={cn(
          'relative w-32 sm:w-36 aspect-[3.4/4.4] rounded-xl overflow-hidden border border-dashed transition-[border-color,background-color] flex flex-col items-center justify-between p-3.5 group cursor-pointer select-none shrink-0 bg-surface-card focus-visible:ring-2 focus-visible:ring-slate-400',
          isDragOver
            ? 'border-slate-400 bg-surface-elevated'
            : 'border-border hover:border-slate-400 hover:bg-surface-hover'
        )}
      >
        <div className="w-full text-center">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-white/60">
            Slot #{slot === 'vanguard' ? '1' : slot === 'versatile' ? '2' : '3'}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center my-auto">
          <UserPlus
            className="size-5 text-slate-400 group-hover:text-slate-700 dark:text-white/60 dark:group-hover:text-white transition-colors mb-1"
            aria-hidden="true"
          />
          <span className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-slate-900 dark:group-hover:text-white text-center transition-colors">
            Assign {role.label}
          </span>
        </div>
        <span className="text-[11px] text-slate-400 dark:text-white/50 text-center">
          {isDragOver ? 'Drop Trekker here' : 'Click to choose'}
        </span>
      </div>
    );
  }

  const isFiveStar = (character.star || 4) >= 5;
  const charClass = character.class || 'Versatile';
  const classInfo = classConfig[charClass] || classConfig.Versatile;

  return (
    <div className="relative group shrink-0">
      <div
        role="button"
        tabIndex={0}
        onClick={onSelectClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectClick();
          }
        }}
        aria-label={`Slot ${role.label}: ${character.name.EN}, click to change`}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.setData('text/plain', slot);
          e.dataTransfer.effectAllowed = 'move';
          onDragStart?.(slot);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          onDragOver?.(slot);
        }}
        onDragLeave={() => onDragLeave?.()}
        onDrop={(e) => {
          e.preventDefault();
          const source = (e.dataTransfer.getData('text/plain') as SlotType);
          onDrop?.(source, slot);
        }}
        onDragEnd={() => onDragEnd?.()}
        title="Click to change, or drag to swap seats"
        className={cn(
          'relative w-32 sm:w-36 aspect-[3.4/4.4] rounded-xl overflow-hidden bg-surface-card border select-none transition-[border-color] cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-slate-400',
          isDragging && 'opacity-40 ring-2 ring-dashed ring-slate-400',
          isDragOver && 'ring-2 ring-slate-400 z-20',
          !isDragOver && !isDragging && 'hover:border-slate-400',
          isFiveStar
            ? 'border-2 border-purple-400/60'
            : 'border-2 border-border'
        )}
      >
        {/* Top Accent Line for 5-star vs 4-star like ex.png */}
        <div
          className={cn(
            'absolute inset-x-0 top-0 h-0.5 z-20',
            isFiveStar
              ? 'bg-gradient-to-r from-[#c084fc] via-[#818cf8] to-[#38bdf8]'
              : 'bg-[#fde047]'
          )}
        />

        {/* Top Dark Gradient Overlay for Tag & Badge Visibility */}
        <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none z-10" />

        {/* Top-Left Element Badge */}
        <div className="absolute top-0.5 left-0.5 z-20 pointer-events-none">
          <img
            src={`/ss-element/${character.element}.webp`}
            alt={character.element}
            className="size-8 sm:size-8.5 object-contain drop-shadow-md"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Top-Right Slanted Role Banner + Dark Navy Attack Type Box: High visibility like ex.png */}
        <div className="absolute top-0 right-0 z-20 flex items-stretch h-5.5 shadow-sm pointer-events-none">
          <div
            className={cn(
              'flex items-center px-2 text-[11px] font-bold tracking-tight text-white',
              '[clip-path:polygon(7px_0%,100%_0%,100%_100%,0%_100%)] pl-2.5',
              classInfo.badgeBg
            )}
          >
            {classInfo.label}
          </div>
          <div className="bg-[#0f172a] px-1.5 flex items-center justify-center border-l border-white/20">
            <img
              src={`/ss-class/${character.attackType}.png`}
              alt={character.attackType}
              className="size-3.5 object-contain filter brightness-0 invert drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Character Bust Artwork */}
        <img
          src={getWikiTideTrekkerUrl(character.name.EN) || `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/head/head_${character.id}01_XL.webp`}
          alt={character.name.EN}
          width={144}
          height={186}
          className="w-full h-full object-cover object-top"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            const autumnVnUrl = `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/head/head_${character.id}01_XL.webp`;
            if (target.src !== autumnVnUrl && !target.src.includes('ssassets')) {
              target.src = autumnVnUrl;
            } else if (!target.src.includes('/characters/')) {
              target.src = `/characters/head_${character.id}01_XL.webp`;
            }
          }}
        />

        {/* Bottom Dark Gradient Fade */}
        <div className="absolute inset-x-0 bottom-1.5 h-12 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-none z-10" />

        {/* Character Name in Crisp White Font & Stars at Bottom */}
        <div className="absolute bottom-2 inset-x-1.5 z-20 flex items-center justify-between pointer-events-none">
          <span className="font-bold text-xs sm:text-sm text-white tracking-tight drop-shadow truncate">
            {character.name.EN}
          </span>
          {isFiveStar ? (
            <span className="text-[11px] text-amber-400 font-mono font-bold shrink-0 drop-shadow">
              5★
            </span>
          ) : (
            <span className="text-[11px] text-amber-300 font-mono font-bold shrink-0 drop-shadow">
              4★
            </span>
          )}
        </div>

        {/* Bottom Horizontal Bar: 5-Star Rainbow/Purple vs 4-Star Yellow/Gold like ex.png */}
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 h-1.5 z-20',
            isFiveStar
              ? 'bg-gradient-to-r from-[#c084fc] via-[#818cf8] to-[#38bdf8] border-t border-purple-200/50'
              : 'bg-gradient-to-r from-[#fde047] via-[#facc15] to-[#eab308] border-t border-yellow-200/50'
          )}
        />
      </div>

      {/* Quick Remove Button */}
      <button
        type="button"
        aria-label={`Remove ${character.name.EN}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemoveClick();
        }}
        title={`Remove ${character.name.EN}`}
        className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-surface-card hover:bg-rose-600 text-slate-700 hover:text-slate-900 border border-border flex items-center justify-center z-30 shadow transition-colors cursor-pointer"
      >
        <X className="size-3 stroke-[2]" />
      </button>
    </div>
  );
}
