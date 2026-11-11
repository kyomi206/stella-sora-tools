'use client';

import { useState, useMemo } from 'react';
import { getCharacterData } from '@/lib/calculator/resource-engine';
import { TrekkerPickerModal } from '@/components/builder/trekker-picker-modal';
import { UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTrekkerImageUrl } from '@/lib/wikitide';

// TrekkerPickerModal handles search query and element filters: Ignis, Aqua, Terra, Ventus, Umbra, Lux

interface TrekkerSelectorProps {
  selectedId: string;
  onSelect: (id: string) => void;
  title?: string;
  subtitle?: string;
}

const CLASS_CONFIG: Record<string, { label: string; badgeBg: string }> = {
  Vanguard: {
    label: 'Vanguard',
    badgeBg: 'bg-rose-600',
  },
  Versatile: {
    label: 'Versatile',
    badgeBg: 'bg-indigo-600',
  },
  Support: {
    label: 'Support',
    badgeBg: 'bg-emerald-600',
  },
};

export function TrekkerSelector({ selectedId, onSelect, title, subtitle }: TrekkerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeChar = useMemo(() => getCharacterData(selectedId), [selectedId]);

  const isFiveStar = (activeChar?.star || 4) === 5;
  const activeClassInfo = CLASS_CONFIG[activeChar?.class || 'Vanguard'] || CLASS_CONFIG.Vanguard;

  return (
    <div className="relative">
      {/* Selected Trekker Showcase */}
      <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-5">
        {/* Clickable Vertical Trekker Card */}
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="Click to change Trekker"
          aria-label={`Change Trekker: currently ${activeChar?.name || 'none'}`}
          className={cn(
            'group relative w-36 sm:w-40 aspect-[3.4/4.4] rounded-xl overflow-hidden bg-surface select-none transition-[border-color,box-shadow] cursor-pointer shrink-0 text-left focus-visible:ring-2 focus-visible:ring-amber-400',
            'hover:shadow-xl',
            isFiveStar
              ? 'border-2 border-purple-400/60 shadow-lg shadow-purple-500/10'
              : 'border-2 border-border hover:border-slate-400'
          )}
        >
          {/* Top Accent Line (5-star prismatic vs 4-star yellow) */}
          <div
            className={cn(
              'absolute inset-x-0 top-0 h-0.5 z-20',
              isFiveStar
                ? 'bg-gradient-to-r from-[#c084fc] via-[#818cf8] to-[#38bdf8]'
                : 'bg-[#fde047]'
            )}
          />

          {/* Top Dark Gradient Overlay */}
          <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none z-10" />

          {/* Top-Left Element Diamond Badge */}
          {activeChar?.element && (
            <div className="absolute top-0.5 left-0.5 z-20 pointer-events-none">
              <img
                src={`/ss-element/${activeChar.element}.webp`}
                alt={activeChar.element}
                width={34}
                height={34}
                className="size-8 sm:size-8.5 object-contain drop-shadow-md"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Top-Right Role Banner */}
          <div className="absolute top-0 right-0 z-20 flex items-stretch h-5.5 shadow-sm pointer-events-none">
            <div
              className={cn(
                'flex items-center px-2 text-xs font-bold tracking-tight text-white pl-2.5',
                activeClassInfo.badgeBg
              )}
            >
              {activeChar?.class || 'Vanguard'}
            </div>
            {activeChar?.attackType && (
              <div className="bg-[#0f172a] px-1.5 flex items-center justify-center border-l border-white/20">
                <img
                  src={`/ss-class/${activeChar.attackType}.png`}
                  alt={activeChar.attackType}
                  width={14}
                  height={14}
                  className="size-3.5 object-contain filter brightness-0 invert drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          {/* Character Bust Artwork */}
          <img
            key={selectedId}
            src={getTrekkerImageUrl(selectedId)}
            alt={activeChar?.name ? `${activeChar.name} portrait` : 'Trekker portrait'}
            width={160}
            height={207}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover object-top pointer-events-none"
          />

          {/* Hover Prompt Overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20 pointer-events-none">
            <span className="text-xs font-bold text-white bg-black/70 px-2.5 py-1 rounded-md border border-white/20">
              Click to Change
            </span>
          </div>

          {/* Bottom Dark Gradient Fade */}
          <div className="absolute inset-x-0 bottom-1.5 h-12 bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-none z-10" />

          {/* Character Name & Stars at Bottom */}
          <div className="absolute bottom-2 inset-x-1.5 z-20 flex items-center justify-between pointer-events-none">
            <span className="font-bold text-xs sm:text-sm text-white tracking-tight drop-shadow truncate">
              {activeChar?.name || 'Trekker'}
            </span>
            <span className="text-xs text-amber-400 font-mono font-bold shrink-0 drop-shadow">
              {isFiveStar ? '5★' : '4★'}
            </span>
          </div>

          {/* Bottom Accent Bar */}
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 h-1.5 z-20',
              isFiveStar
                ? 'bg-gradient-to-r from-[#c084fc] via-[#818cf8] to-[#38bdf8] border-t border-purple-200/50'
                : 'bg-gradient-to-r from-[#fde047] via-[#facc15] to-[#eab308] border-t border-yellow-200/50'
            )}
          />
        </button>

        {/* Character Info Summary Beside Card */}
        <div className="flex-1 min-w-0 flex flex-col justify-between py-1 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-amber-500/15 text-amber-700 border border-amber-500/30">
                {activeChar?.star || 4}★
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-medium bg-surface-elevated text-slate-700 border border-border-subtle">
                {activeChar?.element || 'Ignis'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-medium bg-surface-elevated text-slate-700 border border-border-subtle">
                {activeChar?.class || 'Vanguard'}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {title || activeChar?.name || 'Trekker'}
            </h2>

            {subtitle && (
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border-hover text-slate-800 text-xs font-semibold transition-colors cursor-pointer press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <UserPlus className="size-3.5 text-amber-600" aria-hidden="true" />
              <span>Switch Trekker</span>
            </button>
          </div>
        </div>
      </div>

      {/* Trekker Selection Modal */}
      {isOpen && (
        <TrekkerPickerModal
          isOpen={isOpen}
          selectedId={Number(selectedId)}
          onClose={() => setIsOpen(false)}
          onSelect={(id) => {
            onSelect(String(id));
            setIsOpen(false);
          }}
        />
      )}
    </div>
  );
}
