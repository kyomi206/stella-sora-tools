'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AdvancedTeamBuild,
  SlotType,
  SelectedPotential,
  SSCharacter,
  SSDisc,
  SelectedMainDisc,
  SelectedSupportDisc,
  NoteName,
} from '@/types';
import charactersData from '@/data/characters.json';
import discsData from '@/data/discs.json';
import {
  calculateSupportStartingNotes,
  calculateRequiredHarmonyNotes,
  MUSICAL_NOTES,
} from '@/data/notes';
import { TrekkerCard } from '@/components/builder/trekker-card';
import { TrekkerPickerModal } from '@/components/builder/trekker-picker-modal';
import { PotentialsPickerModal } from '@/components/builder/potentials-picker-modal';
import { DiscPickerModal, DiscSlotRef } from '@/components/builder/disc-picker-modal';
import { DiscsAndNotesSection } from '@/components/builder/discs-and-notes-section';
import { AdvancedBuildCardExport } from '@/components/builder/advanced-build-card-export';
import { PresetCodeBar } from '@/components/builder/preset-code-bar';
import {
  compressBuild,
  compressAdvancedBuild,
  createEmptyAdvancedBuild,
} from '@/lib/utils';
import { decompressAdvancedBuild } from '@/lib/share-link';
import { unpackAdvancedPresetCode, unpackPresetCode } from '@/lib/preset-code';
import { RotateCcw, ArrowLeft } from 'lucide-react';

function AdvancedBuilderContent() {
  const searchParams = useSearchParams();
  const [build, setBuild] = useState<AdvancedTeamBuild>(createEmptyAdvancedBuild);
  const characters = charactersData as Record<string, SSCharacter>;
  const discs = discsData as Record<string, SSDisc>;

  const [activePickerSlot, setActivePickerSlot] = useState<SlotType | null>(null);
  const [activePotentialsSlot, setActivePotentialsSlot] = useState<SlotType | null>(null);
  const [activeDiscSlot, setActiveDiscSlot] = useState<DiscSlotRef | null>(null);
  const [draggedSlot, setDraggedSlot] = useState<SlotType | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<SlotType | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    const encoded = searchParams.get('b');
    const advParam = searchParams.get('adv');
    const codeParam = searchParams.get('code') || searchParams.get('preset');

    if (advParam) {
      const advParsed = unpackAdvancedPresetCode(advParam, characters, discs);
      if (advParsed) {
        setBuild((prev) => ({ ...prev, ...advParsed }));
        return;
      }
    }

    if (codeParam) {
      const advParsed = unpackAdvancedPresetCode(codeParam, characters, discs);
      if (advParsed) {
        setBuild((prev) => ({ ...prev, ...advParsed }));
        return;
      }
      const slots = unpackPresetCode(codeParam, characters);
      if (slots) {
        setBuild((prev) => ({ ...prev, slots }));
        return;
      }
    }

    if (encoded) {
      const decoded = decompressAdvancedBuild(encoded, characters, discs);
      if (decoded) {
        setBuild(decoded);
        return;
      }
      const fallbackAdv = unpackAdvancedPresetCode(encoded, characters, discs);
      if (fallbackAdv) {
        setBuild((prev) => ({ ...prev, ...fallbackAdv }));
        return;
      }
      const fallbackSlots = unpackPresetCode(encoded, characters);
      if (fallbackSlots) {
        setBuild((prev) => ({ ...prev, slots: fallbackSlots }));
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

  const handleUpdateSlotPotentials = (
    slot: SlotType,
    potentials: SelectedPotential[]
  ) => {
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

  const handleSelectDisc = (slotRef: DiscSlotRef, discId: number) => {
    if (slotRef.kind === 'main') {
      setBuild((prev) => {
        const next = [...prev.mainDiscs] as AdvancedTeamBuild['mainDiscs'];
        next[slotRef.index] = { ...next[slotRef.index], discId };
        return { ...prev, mainDiscs: next };
      });
    } else {
      setBuild((prev) => {
        const next = [...prev.supportDiscs] as AdvancedTeamBuild['supportDiscs'];
        next[slotRef.index] = { ...next[slotRef.index], discId };
        return { ...prev, supportDiscs: next };
      });
    }
  };

  const handleUpdateMainDisc = (
    index: 0 | 1 | 2,
    patch: Partial<SelectedMainDisc>
  ) => {
    setBuild((prev) => {
      const next = [...prev.mainDiscs] as AdvancedTeamBuild['mainDiscs'];
      next[index] = { ...next[index], ...patch };
      return { ...prev, mainDiscs: next };
    });
  };

  const handleUpdateSupportDisc = (
    index: 0 | 1 | 2,
    patch: Partial<SelectedSupportDisc>
  ) => {
    setBuild((prev) => {
      const next = [...prev.supportDiscs] as AdvancedTeamBuild['supportDiscs'];
      next[index] = { ...next[index], ...patch };
      return { ...prev, supportDiscs: next };
    });
  };

  const handleUpdateNoteCount = (noteName: NoteName, count: number) => {
    setBuild((prev) => ({
      ...prev,
      targetNotes: {
        ...prev.targetNotes,
        [noteName]: count,
      },
    }));
  };

  const handleAutoFillHarmonyNotes = (harmonyTier: number) => {
    setBuild((prev) => {
      const startNotes = calculateSupportStartingNotes(prev.supportDiscs, discs);
      const reqNotes = calculateRequiredHarmonyNotes(
        prev.mainDiscs,
        discs,
        harmonyTier
      );
      const nextTarget: Partial<Record<NoteName, number>> = {};
      for (const n of MUSICAL_NOTES) {
        const val = Math.max(startNotes[n.name] || 0, reqNotes[n.name] || 0);
        if (val > 0) nextTarget[n.name] = val;
      }
      return {
        ...prev,
        targetNotes: nextTarget,
      };
    });
  };

  const handleResetNotesToSupport = () => {
    setBuild((prev) => ({
      ...prev,
      targetNotes: {},
    }));
  };

  const handleReset = () => {
    setBuild(createEmptyAdvancedBuild());
    setShowResetConfirm(false);
  };

  const standardHref = (() => {
    const hasChar =
      build.slots.vanguard.characterId ||
      build.slots.versatile.characterId ||
      build.slots.support.characterId;
    if (!hasChar) return '/builder';
    const encoded = compressBuild({
      id: build.id,
      name: build.name,
      createdAt: build.createdAt,
      slots: build.slots,
    });
    return encoded ? `/builder?b=${encoded}` : '/builder';
  })();

  const damageHref = `/damage?b=${compressAdvancedBuild(build)}`;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto px-4 py-6">
      {/* Top Navigation & Mode Switch Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={standardHref}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-elevated text-xs font-semibold text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white transition-colors press-feedback"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>Standard Visualizer</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href={damageHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-elevated text-xs font-semibold text-slate-700 dark:text-white/80 hover:text-slate-900 dark:hover:text-white transition-colors press-feedback"
          >
            <span>Theoretical Damage Calculator</span>
          </Link>
        </div>
      </div>

      {/* Header with Squad Name Input */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <h1 className="flex-1 min-w-0 flex items-center max-w-xl text-lg sm:text-[20px] font-semibold text-slate-900 dark:text-white">
          <span className="text-slate-600 dark:text-white/70 font-normal mr-2 select-none text-base sm:text-lg whitespace-nowrap shrink-0">Preset /</span>
          <input
            type="text"
            value={build.name}
            onChange={(e) => setBuild((prev) => ({ ...prev, name: e.target.value }))}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              const advParsed = unpackAdvancedPresetCode(pasted, characters, discs);
              if (advParsed) {
                e.preventDefault();
                setBuild((prev) => ({ ...prev, ...advParsed }));
                return;
              }
              const parsed = unpackPresetCode(pasted, characters);
              if (parsed) {
                e.preventDefault();
                setBuild((prev) => ({ ...prev, slots: parsed }));
              }
            }}
            placeholder="Advanced Preset Name…"
            aria-label="Advanced preset name"
            suppressHydrationWarning
            className="w-full bg-transparent border-b border-transparent hover:border-border focus-visible:ring-1 focus-visible:ring-slate-400 text-slate-900 dark:text-white transition-colors py-0.5 px-1 rounded truncate font-semibold text-lg sm:text-[20px]"
          />
        </h1>

        {showResetConfirm ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-500/50 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer font-semibold"
            >
              <span>Confirm Reset</span>
            </button>
            <button
              type="button"
              onClick={() => setShowResetConfirm(false)}
              className="px-2.5 py-1.5 rounded-lg border border-border text-xs text-slate-600 hover:text-slate-900 dark:text-white/80 dark:hover:text-white transition-colors shrink-0 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-surface-elevated text-xs text-slate-600 dark:text-white/80 hover:text-rose-600 transition-colors shrink-0 cursor-pointer focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            <span>Reset Preset</span>
          </button>
        )}
      </div>

      {/* In-Game & Advanced Preset Code Import / Export */}
      <PresetCodeBar
        slots={build.slots}
        onLoadSlots={(slots) => setBuild((prev) => ({ ...prev, slots }))}
        advancedBuild={build}
        onLoadAdvancedBuild={(adv) => setBuild((prev) => ({ ...prev, ...adv }))}
      />

      {/* 1. 3 Trekker Selection Area */}
      <div className="flex flex-col items-center gap-3 w-full">
        <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
          {(['vanguard', 'versatile', 'support'] as const).map((slotKey) => (
            <TrekkerCard
              key={slotKey}
              slot={slotKey}
              character={
                build.slots[slotKey].characterId
                  ? characters[String(build.slots[slotKey].characterId)]
                  : null
              }
              onSelectClick={() => setActivePickerSlot(slotKey)}
              onRemoveClick={() => handleRemoveCharacter(slotKey)}
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
              isDragging={draggedSlot === slotKey}
              isDragOver={dragOverSlot === slotKey && draggedSlot !== slotKey}
            />
          ))}
        </div>

        {/* Change Trekker and Choose Potentials controls */}
        <div className="flex items-center justify-center gap-3 mt-1">
          <button
            type="button"
            onClick={() => setActivePickerSlot('vanguard')}
            className="px-4 py-2 rounded-lg border border-border bg-surface-card celestial-card hover:bg-surface-elevated hover:border-border-hover text-xs sm:text-sm font-semibold text-slate-900 dark:text-white transition-colors flex items-center justify-center text-center cursor-pointer press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span>Change Trekker</span>
          </button>

          <button
            type="button"
            onClick={() => setActivePotentialsSlot('vanguard')}
            className="px-4 py-2 rounded-lg border border-border bg-surface-card celestial-card hover:bg-surface-elevated hover:border-border-hover text-xs sm:text-sm font-semibold text-slate-900 dark:text-white transition-colors flex items-center justify-center text-center cursor-pointer press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span>Choose Potentials</span>
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-white/60 text-center select-none">
          Click any slot to assign or replace a Trekker, or drag cards to swap seats.
        </p>
      </div>

      {/* 2. Runic Discs (3 Main + 3 Support) & Musical Notes (13 Melodies) */}
      <DiscsAndNotesSection
        build={build}
        discs={discs}
        onOpenDiscPicker={(slotRef) => setActiveDiscSlot(slotRef)}
        onUpdateMainDisc={handleUpdateMainDisc}
        onUpdateSupportDisc={handleUpdateSupportDisc}
        onUpdateNoteCount={handleUpdateNoteCount}
        onAutoFillHarmonyNotes={handleAutoFillHarmonyNotes}
        onResetNotesToSupport={handleResetNotesToSupport}
      />

      {/* 3. Unified Live Preview & Export */}
      <AdvancedBuildCardExport
        build={build}
        characters={characters}
        discs={discs}
      />

      {/* Modals */}
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

      {activeDiscSlot && (
        <DiscPickerModal
          isOpen={!!activeDiscSlot}
          activeSlot={activeDiscSlot}
          build={build}
          discs={discs}
          onClose={() => setActiveDiscSlot(null)}
          onSelect={handleSelectDisc}
          onSwitchSlot={(slotRef) => setActiveDiscSlot(slotRef)}
        />
      )}
    </div>
  );
}

export default function AdvancedBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center text-sm text-slate-600">
          Loading Advanced Preset Visualizer…
        </div>
      }
    >
      <AdvancedBuilderContent />
    </Suspense>
  );
}
