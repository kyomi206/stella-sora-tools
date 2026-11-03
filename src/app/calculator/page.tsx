'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  calculateTrekkerCosts,
  getCharacterData,
  SkillRankRange,
} from '@/lib/calculator/resource-engine';
import { TrekkerSelector } from '@/components/calculator/trekker-selector';
import { LevelStepper } from '@/components/calculator/level-stepper';
import { SkillsMatrix } from '@/components/calculator/skills-matrix';
import { MaterialsBill } from '@/components/calculator/materials-bill';
import { Calculator, Coins, FileText, ChevronUp, X } from 'lucide-react';

export default function ResourceCalculatorPage() {
  const [selectedCharId, setSelectedCharId] = useState<string>('103'); // Amber by default
  const [startLevel, setStartLevel] = useState<number>(1);
  const [targetLevel, setTargetLevel] = useState<number>(80);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  const [skills, setSkills] = useState<{
    combat: SkillRankRange;
    support: SkillRankRange;
    ultimate: SkillRankRange;
    normal: SkillRankRange;
  }>({
    combat: { current: 1, target: 7 },
    support: { current: 1, target: 7 },
    ultimate: { current: 1, target: 5 },
    normal: { current: 1, target: 1 },
  });

  // Handle Escape key dismissal for mobile drawer
  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileDrawerOpen]);

  const activeChar = useMemo(() => getCharacterData(selectedCharId), [selectedCharId]);

  const tally = useMemo(() => {
    return calculateTrekkerCosts({
      characterId: selectedCharId,
      startLevel,
      targetLevel,
      skills,
    });
  }, [selectedCharId, startLevel, targetLevel, skills]);

  const handleLevelChange = (newStart: number, newTarget: number) => {
    setStartLevel(newStart);
    setTargetLevel(newTarget);
  };

  const handleSkillChange = (
    key: 'combat' | 'support' | 'ultimate' | 'normal',
    current: number,
    target: number
  ) => {
    setSkills((prev) => ({
      ...prev,
      [key]: { current, target },
    }));
  };

  const handleBulkSkillSet = (target: number) => {
    setSkills((prev) => ({
      combat: { current: prev.combat.current, target: Math.max(prev.combat.current, target) },
      support: { current: prev.support.current, target: Math.max(prev.support.current, target) },
      ultimate: { current: prev.ultimate.current, target: Math.max(prev.ultimate.current, target) },
      normal: { current: prev.normal.current, target: Math.max(prev.normal.current, target) },
    }));
  };

  const handleResetSkills = () => {
    setSkills({
      combat: { current: 1, target: 1 },
      support: { current: 1, target: 1 },
      ultimate: { current: 1, target: 1 },
      normal: { current: 1, target: 1 },
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border-subtle">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Resource Calculator</h1>
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl text-pretty">
            Interactive investment planner for Stella Sora Trekkers. Calculate exact Dorra, class breakthrough drops, and skill cartridges.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs px-2.5 py-1 rounded-full border border-border bg-surface-card celestial-card text-slate-700 font-medium">
            Ascension &amp; Skills Planner
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 font-medium font-mono tabular-nums">
            Lv. {startLevel} &rarr; {targetLevel}
          </span>
        </div>
      </div>

      {/* Two-Column Workbench Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Configurator Panel */}
        <div className="lg:col-span-7 space-y-5">
          <TrekkerSelector
            selectedId={selectedCharId}
            onSelect={(id) => setSelectedCharId(id)}
            subtitle="Calculate exact Dorra, class breakthrough drops, and skill cartridges for your Trekker."
          />

          <LevelStepper
            startLevel={startLevel}
            targetLevel={targetLevel}
            onChange={handleLevelChange}
          />

          <SkillsMatrix
            skills={skills}
            character={activeChar}
            onChange={handleSkillChange}
            onBulkSet={handleBulkSkillSet}
            onReset={handleResetSkills}
          />
        </div>

        {/* Right Column: Sticky Material Bill (Desktop Viewport, padded below 48px TopBar) */}
        <div className="lg:col-span-5 lg:sticky lg:top-14">
          <MaterialsBill
            tally={tally}
            trekkerName={activeChar?.name || 'Trekker'}
            startLevel={startLevel}
            targetLevel={targetLevel}
            skills={skills}
          />
        </div>
      </div>

      {/* Mobile Sticky Summary Dock (Visible only on < lg screens) */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-surface-card/95 backdrop-blur-md border-t border-border px-4 py-2.5 shadow-2xl">
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Coins className="size-4 text-amber-600" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-600">Total Dorra</div>
              <div className="text-sm font-extrabold text-amber-600 font-mono tabular-nums truncate">
                {tally.dorra.toLocaleString()}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 press-feedback cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <FileText className="size-3.5" aria-hidden="true" />
            <span>View Bill ({tally.allMaterials.length})</span>
            <ChevronUp className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile Bottom Sheet Drawer (< lg screens) */}
      {isMobileDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-bill-drawer-title"
          className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-180"
        >
          {/* Backdrop button */}
          <button
            type="button"
            aria-label="Dismiss bill drawer"
            className="absolute inset-0 w-full h-full cursor-default border-0"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
          <div
            className="relative w-full max-h-[85vh] rounded-t-2xl border-t border-x border-border-subtle bg-surface-subtle flex flex-col shadow-2xl overflow-hidden drawer-entrance overscroll-contain"
          >
            {/* Drawer Drag Bar & Close Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-border-subtle bg-surface-card shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-1 rounded-full bg-slate-500" />
                <h3 id="mobile-bill-drawer-title" className="text-sm font-bold text-slate-900">
                  Materials Bill: {activeChar?.name || 'Trekker'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(false)}
                aria-label="Close bill drawer"
                className="size-8 rounded-lg border border-border-subtle flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-surface-hover transition-colors cursor-pointer press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="overflow-y-auto p-4 flex-1 overscroll-contain">
              <MaterialsBill
                tally={tally}
                trekkerName={activeChar?.name || 'Trekker'}
                startLevel={startLevel}
                targetLevel={targetLevel}
                skills={skills}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
