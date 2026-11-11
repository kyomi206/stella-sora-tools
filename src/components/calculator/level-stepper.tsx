'use client';

import { ArrowRight, Minus, Plus } from 'lucide-react';

interface LevelStepperProps {
  startLevel: number;
  targetLevel: number;
  onChange: (start: number, target: number) => void;
}

const PRESET_MILESTONES = [
  { label: 'Lv 40', level: 40, tier: 3 },
  { label: 'Lv 50', level: 50, tier: 4 },
  { label: 'Lv 60', level: 60, tier: 5 },
  { label: 'Lv 70', level: 70, tier: 6 },
  { label: 'Lv 80', level: 80, tier: 7 },
  { label: 'Max 90', level: 90, tier: 8 },
];

export function LevelStepper({ startLevel, targetLevel, onChange }: LevelStepperProps) {
  const currentStart = Math.max(1, Math.min(90, startLevel));
  const currentTarget = Math.max(1, Math.min(90, targetLevel));

  const handleStartChange = (val: number) => {
    const clamped = Math.max(1, Math.min(90, val));
    onChange(clamped, Math.max(clamped, currentTarget));
  };

  const handleTargetChange = (val: number) => {
    const clamped = Math.max(1, Math.min(90, val));
    onChange(Math.min(clamped, currentStart), clamped);
  };

  return (
    <div className="border border-border bg-surface-card celestial-card rounded-xl p-4 sm:p-5 space-y-3.5">
      {/* Title & Tier Status */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border-subtle">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900">Level &amp; Breakthrough</h3>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-surface-elevated border border-border text-slate-800 font-mono tabular-nums">
            Lv. {currentStart}
          </span>
          <ArrowRight className="w-3 h-3 text-amber-600" aria-hidden="true" />
          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-500 border border-amber-600 text-slate-950 font-mono tabular-nums">
            Lv. {currentTarget}
          </span>
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Start Level */}
        <div className="bg-surface-subtle border border-border-subtle rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">Start Level</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleStartChange(currentStart - 1)}
                disabled={currentStart <= 1}
                aria-label="Decrease start level"
                className="size-8 sm:size-7 rounded-md bg-surface-elevated hover:bg-border border border-border disabled:opacity-40 flex items-center justify-center text-slate-800 cursor-pointer disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-amber-400 touch-manipulation"
              >
                <Minus className="w-3.5 h-3.5 sm:w-3 sm:h-3" aria-hidden="true" />
              </button>
              <span className="text-xs font-bold text-slate-900 w-6 text-center font-mono tabular-nums">{currentStart}</span>
              <button
                type="button"
                onClick={() => handleStartChange(currentStart + 1)}
                disabled={currentStart >= 90}
                aria-label="Increase start level"
                className="size-8 sm:size-7 rounded-md bg-surface-elevated hover:bg-border border border-border disabled:opacity-40 flex items-center justify-center text-slate-800 cursor-pointer disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-amber-400 touch-manipulation"
              >
                <Plus className="w-3.5 h-3.5 sm:w-3 sm:h-3" aria-hidden="true" />
              </button>
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={90}
            value={currentStart}
            aria-label="Start level slider"
            onChange={(e) => handleStartChange(Number(e.target.value))}
            className="w-full celestial-slider focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
          />
        </div>

        {/* Target Level */}
        <div className="bg-surface-subtle border border-border-subtle rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-700">Target Level</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleTargetChange(currentTarget - 1)}
                disabled={currentTarget <= 1}
                aria-label="Decrease target level"
                className="size-8 sm:size-7 rounded-md bg-surface-elevated hover:bg-border border border-border disabled:opacity-40 flex items-center justify-center text-slate-800 cursor-pointer disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-amber-400 touch-manipulation"
              >
                <Minus className="w-3.5 h-3.5 sm:w-3 sm:h-3" aria-hidden="true" />
              </button>
              <span className="text-xs font-bold text-slate-900 w-6 text-center font-mono tabular-nums">{currentTarget}</span>
              <button
                type="button"
                onClick={() => handleTargetChange(currentTarget + 1)}
                disabled={currentTarget >= 90}
                aria-label="Increase target level"
                className="size-8 sm:size-7 rounded-md bg-surface-elevated hover:bg-border border border-border disabled:opacity-40 flex items-center justify-center text-slate-800 cursor-pointer disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-amber-400 touch-manipulation"
              >
                <Plus className="w-3.5 h-3.5 sm:w-3 sm:h-3" aria-hidden="true" />
              </button>
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={90}
            value={currentTarget}
            aria-label="Target level slider"
            onChange={(e) => handleTargetChange(Number(e.target.value))}
            className="w-full celestial-slider focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
          />
        </div>
      </div>

      {/* Quick Milestone Presets */}
      <div className="flex items-center gap-2 pt-0.5">
        <span className="text-xs font-medium text-slate-600 shrink-0">
          Presets:
        </span>
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {PRESET_MILESTONES.map((milestone) => {
            const isSelected = currentTarget === milestone.level;
            return (
              <button
                key={milestone.level}
                type="button"
                onClick={() => handleTargetChange(milestone.level)}
                className={`text-xs px-2.5 py-1 rounded-md border font-medium transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  isSelected
                    ? 'bg-amber-500 border-amber-600 text-slate-950 font-bold'
                    : 'bg-surface-elevated border-border text-slate-700 hover:text-slate-900 hover:border-slate-400'
                }`}
              >
                {milestone.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
