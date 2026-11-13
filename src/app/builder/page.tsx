'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { TeamBuild, SlotType, SelectedPotential, SSCharacter } from '@/types';
import charactersData from '@/data/characters.json';
import { TrekkerCard } from '@/components/builder/trekker-card';
import { TrekkerPickerModal } from '@/components/builder/trekker-picker-modal';
import { PotentialsPickerModal } from '@/components/builder/potentials-picker-modal';
import { BuildCardExport } from '@/components/builder/build-card-export';
import { PresetCodeBar } from '@/components/builder/preset-code-bar';
import { compressBuild } from '@/lib/utils';
import { decompressBuild } from '@/lib/share-link';
import { unpackPresetCode } from '@/lib/preset-code';
import { RotateCcw, Edit3, ArrowRight } from 'lucide-react';

const INITIAL_BUILD: TeamBuild = {
  id: 'default',
  name: 'New Squad Build',
  createdAt: Date.now(),
  slots: {
    vanguard: { characterId: null, potentials: [] },
    versatile: { characterId: null, potentials: [] },
    support: { characterId: null, potentials: [] },
  },
};

function BuilderContent() {
  const searchParams = useSearchParams();
  const [build, setBuild] = useState<TeamBuild>(INITIAL_BUILD);
  const characters = charactersData as Record<string, SSCharacter>;

  // Modal states
  const [activePickerSlot, setActivePickerSlot] = useState<SlotType | null>(null);
  const [activePotentialsSlot, setActivePotentialsSlot] = useState<SlotType | null>(null);
  const [draggedSlot, setDraggedSlot] = useState<SlotType | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<SlotType | null>(null);

  // Check URL query for compressed build or in-game preset code
  useEffect(() => {
    const encoded = searchParams.get('b');
    const codeParam = searchParams.get('code') || searchParams.get('preset');

    if (codeParam) {
      const slots = unpackPresetCode(codeParam, characters);
      if (slots) {
        setBuild((prev) => ({ ...prev, slots }));
        return;
      }
    }

    if (encoded) {
      const decoded = decompressBuild(encoded, characters);
      if (decoded) {
        setBuild(decoded);
        return;
      }
      const fallbackSlots = unpackPresetCode(encoded, characters);
      if (fallbackSlots) {
        setBuild((prev) => ({ ...prev, slots: fallbackSlots }));
        return;
      }
    } else {
      const vanguardParam = searchParams.get('vanguard') || searchParams.get('char');
      if (vanguardParam && characters[vanguardParam]) {
        setBuild((prev) => ({
          ...prev,
          slots: {
            ...prev.slots,
            vanguard: { characterId: Number(vanguardParam), potentials: [] },
          },
        }));
      }
    }
  }, [searchParams]);

  const handleSelectCharacter = (slot: SlotType, characterId: number) => {
    setBuild((prev) => ({
      ...prev,
      slots: {
        ...prev.slots,
        [slot]: { characterId, potentials: [] },
      },
    }));
  };

  const handleRemoveCharacter = (slot: SlotType) => {
    setBuild((prev) => ({
      ...prev,
      slots: {
        ...prev.slots,
        [slot]: { characterId: null, potentials: [] },
      },
    }));
  };

  const handleSwapSlots = (fromSlot: SlotType, toSlot: SlotType) => {
    if (fromSlot === toSlot) return;
    setBuild((prev) => {
      const fromData = prev.slots[fromSlot];
      const toData = prev.slots[toSlot];
      return {
        ...prev,
        slots: {
          ...prev.slots,
          [fromSlot]: toData,
          [toSlot]: fromData,
        },
      };
    });
  };

  const handleUpdateSlotPotentials = (slot: SlotType, potentials: SelectedPotential[]) => {
    setBuild((prev) => ({
      ...prev,
      slots: {
        ...prev.slots,
        [slot]: {
          ...prev.slots[slot],
          potentials,
        },
      },
    }));
  };

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleReset = () => {
    setBuild(INITIAL_BUILD);
    setShowResetConfirm(false);
  };

  const advancedHref = (() => {
    const hasChar =
      build.slots.vanguard.characterId ||
      build.slots.versatile.characterId ||
      build.slots.support.characterId;
    if (!hasChar) return '/builder/advanced';
    const encoded = compressBuild(build);
    return encoded ? `/builder/advanced?b=${encoded}` : '/builder/advanced';
  })();

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto px-4 py-6">
      {/* Top Header with Squad Name Input */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex-1 min-w-0 flex items-center gap-2 max-w-xl group">
          <input
            type="text"
            value={build.name}
            onChange={(e) => setBuild((prev) => ({ ...prev, name: e.target.value }))}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              const parsed = unpackPresetCode(pasted, characters);
              if (parsed) {
                e.preventDefault();
                setBuild((prev) => ({ ...prev, slots: parsed }));
              }
            }}
            placeholder="Squad Build Name…"
            aria-label="Squad build name"
            suppressHydrationWarning
            className="text-2xl sm:text-3xl font-bold bg-transparent border-b border-transparent hover:border-border focus-visible:ring-2 focus-visible:ring-amber-400 text-slate-900 transition-colors py-0.5 px-1 rounded w-full truncate"
          />
          <Edit3 className="size-4.5 text-slate-600 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={advancedHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 border border-amber-600 text-xs font-bold text-slate-950 transition-colors shrink-0 press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span>Advanced Visualizer</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>

          {showResetConfirm ? (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-xs text-rose-600 hover:bg-rose-500/30 transition-colors shrink-0 cursor-pointer focus-visible:ring-1 focus-visible:ring-rose-400 font-semibold"
              >
                <span>Confirm Reset</span>
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-slate-600 hover:text-slate-900 transition-colors shrink-0 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-surface-elevated text-xs text-slate-600 hover:text-rose-600 transition-colors shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              <span>Reset Squad</span>
            </button>
          )}
        </div>
      </div>

      {/* In-Game Preset Code Import / Export */}
      <PresetCodeBar
        slots={build.slots}
        onLoadSlots={(slots) => setBuild((prev) => ({ ...prev, slots }))}
      />

      {/* 3 Trekker Selection Area */}
      <div className="flex flex-col items-center gap-4 w-full">
        <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
          {/* Vanguard Card */}
          <TrekkerCard
            slot="vanguard"
            character={
              build.slots.vanguard.characterId
                ? characters[String(build.slots.vanguard.characterId)]
                : null
            }
            onSelectClick={() => setActivePickerSlot('vanguard')}
            onRemoveClick={() => handleRemoveCharacter('vanguard')}
            onDragStart={(s) => setDraggedSlot(s)}
            onDragOver={(s) => setDragOverSlot(s)}
            onDragLeave={() => setDragOverSlot(null)}
            onDrop={(sourceSlot, targetSlot) => {
              const from = sourceSlot || draggedSlot;
              if (from && from !== targetSlot) {
                handleSwapSlots(from, targetSlot);
              }
              setDraggedSlot(null);
              setDragOverSlot(null);
            }}
            onDragEnd={() => {
              setDraggedSlot(null);
              setDragOverSlot(null);
            }}
            isDragging={draggedSlot === 'vanguard'}
            isDragOver={dragOverSlot === 'vanguard' && draggedSlot !== 'vanguard'}
          />

          {/* Versatile Card */}
          <TrekkerCard
            slot="versatile"
            character={
              build.slots.versatile.characterId
                ? characters[String(build.slots.versatile.characterId)]
                : null
            }
            onSelectClick={() => setActivePickerSlot('versatile')}
            onRemoveClick={() => handleRemoveCharacter('versatile')}
            onDragStart={(s) => setDraggedSlot(s)}
            onDragOver={(s) => setDragOverSlot(s)}
            onDragLeave={() => setDragOverSlot(null)}
            onDrop={(sourceSlot, targetSlot) => {
              const from = sourceSlot || draggedSlot;
              if (from && from !== targetSlot) {
                handleSwapSlots(from, targetSlot);
              }
              setDraggedSlot(null);
              setDragOverSlot(null);
            }}
            onDragEnd={() => {
              setDraggedSlot(null);
              setDragOverSlot(null);
            }}
            isDragging={draggedSlot === 'versatile'}
            isDragOver={dragOverSlot === 'versatile' && draggedSlot !== 'versatile'}
          />

          {/* Support Card */}
          <TrekkerCard
            slot="support"
            character={
              build.slots.support.characterId
                ? characters[String(build.slots.support.characterId)]
                : null
            }
            onSelectClick={() => setActivePickerSlot('support')}
            onRemoveClick={() => handleRemoveCharacter('support')}
            onDragStart={(s) => setDraggedSlot(s)}
            onDragOver={(s) => setDragOverSlot(s)}
            onDragLeave={() => setDragOverSlot(null)}
            onDrop={(sourceSlot, targetSlot) => {
              const from = sourceSlot || draggedSlot;
              if (from && from !== targetSlot) {
                handleSwapSlots(from, targetSlot);
              }
              setDraggedSlot(null);
              setDragOverSlot(null);
            }}
            onDragEnd={() => {
              setDraggedSlot(null);
              setDragOverSlot(null);
            }}
            isDragging={draggedSlot === 'support'}
            isDragOver={dragOverSlot === 'support' && draggedSlot !== 'support'}
          />
        </div>

        {/* Change Trekker and Choose Potentials controls */}
        <div className="flex items-center justify-center gap-3 mt-1">
          <button
            type="button"
            onClick={() => setActivePickerSlot('vanguard')}
            className="px-4 py-2 rounded-lg border border-border bg-surface-card celestial-card hover:bg-surface-elevated hover:border-border-hover text-xs sm:text-sm font-semibold text-slate-900 transition-colors flex items-center justify-center text-center cursor-pointer press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span>Change Trekker</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePotentialsSlot('vanguard')}
            className="px-4 py-2 rounded-lg border border-border bg-surface-card celestial-card hover:bg-surface-elevated hover:border-border-hover text-xs sm:text-sm font-semibold text-slate-900 transition-colors flex items-center justify-center text-center cursor-pointer press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span>Choose Potentials</span>
          </button>
        </div>
      </div>

      {/* Build Export & Live Preview */}
      <BuildCardExport build={build} characters={characters} />

      {/* Trekker Picker Modal */}
      {activePickerSlot && (
        <TrekkerPickerModal
          isOpen={!!activePickerSlot}
          slot={activePickerSlot}
          build={build}
          characters={characters}
          onClose={() => setActivePickerSlot(null)}
          onSelect={(charId) => handleSelectCharacter(activePickerSlot, charId)}
          onSwitchSlot={(slot) => setActivePickerSlot(slot)}
        />
      )}

      {/* Potentials Picker Modal */}
      {activePotentialsSlot && (
        <PotentialsPickerModal
          isOpen={!!activePotentialsSlot}
          activeSlot={activePotentialsSlot}
          build={build}
          onClose={() => setActivePotentialsSlot(null)}
          onSwitchSlot={(slot) => setActivePotentialsSlot(slot)}
          onUpdateSlotPotentials={handleUpdateSlotPotentials}
          onSwapSlots={handleSwapSlots}
        />
      )}
    </div>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-sm text-slate-600">Loading Team Builder...</div>}>
      <BuilderContent />
    </Suspense>
  );
}
