'use client';

import { SkillRankRange, CharacterUpgradeInfo } from '@/lib/calculator/resource-engine';
import { getSkillIconUrl } from '@/lib/calculator/material-icons';
import { Minus, Plus, RotateCcw, Zap } from 'lucide-react';

interface SkillsState {
  combat: SkillRankRange;
  support: SkillRankRange;
  ultimate: SkillRankRange;
  normal: SkillRankRange;
}

interface SkillsMatrixProps {
  skills: SkillsState;
  character: CharacterUpgradeInfo | null;
  onChange: (key: keyof SkillsState, current: number, target: number) => void;
  onBulkSet: (target: number) => void;
  onReset: () => void;
}

interface TrackConfig {
  key: keyof SkillsState;
  label: string;
  defaultName: string;
}

const TRACKS: TrackConfig[] = [
  {
    key: 'combat',
    label: 'Combat Skill',
    defaultName: 'Combat Skill',
  },
  {
    key: 'support',
    label: 'Support Skill',
    defaultName: 'Support Skill',
  },
  {
    key: 'ultimate',
    label: 'Ultimate Skill',
    defaultName: 'Ultimate Skill',
  },
  {
    key: 'normal',
    label: 'Normal Attack',
    defaultName: 'Normal Attack',
  },
];

export function SkillsMatrix({ skills, character, onChange, onBulkSet, onReset }: SkillsMatrixProps) {
  const getSkillMeta = (track: TrackConfig): { name: string; icon?: string } => {
    if (!character) return { name: track.defaultName };
    if (track.key === 'combat') return { name: character.skill?.name || track.defaultName, icon: character.skill?.icon };
    if (track.key === 'support') return { name: character.supportSkill?.name || track.defaultName, icon: character.supportSkill?.icon };
    if (track.key === 'ultimate') return { name: character.ultimate?.name || track.defaultName, icon: character.ultimate?.icon };
    if (track.key === 'normal') return { name: character.normalAtk?.name || track.defaultName, icon: character.normalAtk?.icon };
    return { name: track.defaultName };
  };

  const handleCurrentChange = (key: keyof SkillsState, newCurrent: number) => {
    const clampedCurrent = Math.max(1, Math.min(10, newCurrent));
    const currentTarget = skills[key]?.target ?? 1;
    const clampedTarget = Math.max(clampedCurrent, currentTarget);
    onChange(key, clampedCurrent, clampedTarget);
  };

  const handleTargetChange = (key: keyof SkillsState, newTarget: number) => {
    const currentStart = skills[key]?.current ?? 1;
    const clampedTarget = Math.max(currentStart, Math.min(10, newTarget));
    onChange(key, currentStart, clampedTarget);
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-3 sm:p-4 space-y-3">
      {/* Header and Bulk Presets */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Skills Upgrades</h3>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => onBulkSet(10)}
            className="text-xs px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 border border-amber-600 text-slate-950 font-semibold transition-colors cursor-pointer focus-visible:outline-none focus:outline-none"
          >
            All Max (10)
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-surface-elevated hover:bg-border border border-border text-slate-600 hover:text-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus:outline-none"
            title="Reset all skills to Rank 1"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 4 Skill Tracks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {TRACKS.map((track) => {
          const state = skills[track.key] || { current: 1, target: 1 };
          const { name: skillName, icon: skillIcon } = getSkillMeta(track);
          const skillIconUrl = getSkillIconUrl(skillIcon);
          const isUpgraded = state.target > state.current;

          return (
            <div
              key={track.key}
              className={`rounded-xl border p-3.5 flex flex-col justify-between transition-colors ${
                isUpgraded ? 'bg-surface-elevated/70 border-slate-300 shadow-sm' : 'bg-surface-subtle border-border'
              }`}
            >
              {/* Header with Skill Icon & Status */}
              <div className="flex items-start gap-3 mb-2.5">
                <div className="relative size-12 rounded-lg border border-border bg-base overflow-hidden shrink-0 flex items-center justify-center shadow-inner">
                  {skillIconUrl ? (
                    <img
                      src={skillIconUrl}
                      alt={skillName}
                      width={48}
                      height={48}
                      className="w-full h-full object-contain p-0.5 invert dark:invert-0"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <Zap className="w-6 h-6 text-amber-600" aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-semibold text-slate-600">{track.label}</span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded border font-mono tabular-nums ${
                        isUpgraded
                          ? 'bg-amber-500 border-amber-600 text-slate-950'
                          : 'bg-surface-elevated border-border text-slate-600'
                      }`}
                    >
                      {isUpgraded ? `Lv ${state.current} → ${state.target}` : `Lv ${state.current}`}
                    </span>
                  </div>
                  <div className="mt-1 min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate" title={skillName}>
                      {skillName}
                    </h4>
                  </div>
                </div>
              </div>

              {/* Steppers & Slider */}
              <div className="pt-2.5 border-t border-border/70 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  {/* Current Rank Stepper */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 font-medium">Current:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCurrentChange(track.key, state.current - 1)}
                        disabled={state.current <= 1}
                        aria-label={`Decrease current level for ${track.label}`}
                        className="size-7 sm:size-6 rounded-md bg-surface-elevated hover:bg-border border border-border disabled:opacity-30 flex items-center justify-center text-slate-800 transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus:outline-none touch-manipulation"
                      >
                        <Minus className="w-3.5 h-3.5 sm:w-3 sm:h-3" aria-hidden="true" />
                      </button>
                      <span className="text-xs font-bold text-slate-900 w-6 text-center font-mono tabular-nums">
                        {state.current}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCurrentChange(track.key, state.current + 1)}
                        disabled={state.current >= 10}
                        aria-label={`Increase current level for ${track.label}`}
                        className="size-7 sm:size-6 rounded-md bg-surface-elevated hover:bg-border border border-border disabled:opacity-30 flex items-center justify-center text-slate-800 transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus:outline-none touch-manipulation"
                      >
                        <Plus className="w-3.5 h-3.5 sm:w-3 sm:h-3" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Target Rank Stepper */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-600 font-medium">Target:</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTargetChange(track.key, state.target - 1)}
                        disabled={state.target <= state.current}
                        aria-label={`Decrease target level for ${track.label}`}
                        className="size-7 sm:size-6 rounded-md bg-surface-elevated hover:bg-border border border-border disabled:opacity-30 flex items-center justify-center text-slate-800 transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus:outline-none touch-manipulation"
                      >
                        <Minus className="w-3.5 h-3.5 sm:w-3 sm:h-3" aria-hidden="true" />
                      </button>
                      <span className="text-xs font-bold text-slate-900 w-6 text-center font-mono tabular-nums">
                        {state.target}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleTargetChange(track.key, state.target + 1)}
                        disabled={state.target >= 10}
                        aria-label={`Increase target level for ${track.label}`}
                        className="size-7 sm:size-6 rounded-md bg-surface-elevated hover:bg-border border border-border disabled:opacity-30 flex items-center justify-center text-slate-800 transition-colors cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus:outline-none touch-manipulation"
                      >
                        <Plus className="w-3.5 h-3.5 sm:w-3 sm:h-3" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Target Level Range Slider */}
                <input
                  type="range"
                  min={state.current}
                  max={10}
                  value={state.target}
                  aria-label={`Target level slider for ${track.label}`}
                  onChange={(e) => handleTargetChange(track.key, Number(e.target.value))}
                  className="w-full accent-amber-500 bg-slate-100 h-1.5 rounded-lg cursor-pointer focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
