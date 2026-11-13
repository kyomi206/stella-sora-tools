'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Copy, KeyRound, SlidersHorizontal } from 'lucide-react';
import { TeamBuild } from '@/types';
import {
  AdvancedPresetData,
  normalizeAdvancedPresetCodeInput,
  packAdvancedPresetCode,
  packPresetCode,
  unpackAdvancedPresetCode,
  unpackPresetCode,
} from '@/lib/preset-code';

interface PresetCodeBarProps {
  slots: TeamBuild['slots'];
  onLoadSlots: (slots: TeamBuild['slots']) => void;
  advancedBuild?: AdvancedPresetData;
  onLoadAdvancedBuild?: (data: AdvancedPresetData) => void;
}

const EMPTY_DISCS_AND_NOTES: Omit<AdvancedPresetData, 'slots'> = {
  mainDiscs: [
    { discId: null, crescendo: 1, level: 90 },
    { discId: null, crescendo: 1, level: 90 },
    { discId: null, crescendo: 1, level: 90 },
  ],
  supportDiscs: [
    { discId: null, phase: 8, level: 80, crescendo: 1 },
    { discId: null, phase: 8, level: 80, crescendo: 1 },
    { discId: null, phase: 8, level: 80, crescendo: 1 },
  ],
  targetNotes: {},
};

export function PresetCodeBar({
  slots,
  onLoadSlots,
  advancedBuild,
  onLoadAdvancedBuild,
}: PresetCodeBarProps) {
  const router = useRouter();
  const [codeInput, setCodeInput] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [advCodeInput, setAdvCodeInput] = useState('');
  const [advStatusMessage, setAdvStatusMessage] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);
  const [isAdvCopied, setIsAdvCopied] = useState(false);

  const generatedCode = packPresetCode(slots);
  const generatedAdvCode = packAdvancedPresetCode(
    advancedBuild ?? { slots, ...EMPTY_DISCS_AND_NOTES }
  );

  const handleLoad = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = codeInput.trim();
    if (!trimmed) {
      setStatusMessage({
        kind: 'error',
        text: 'Paste an in-game Stella Sora preset code first.',
      });
      return;
    }

    const parsed = unpackPresetCode(trimmed);
    if (!parsed) {
      setStatusMessage({
        kind: 'error',
        text: 'Invalid preset code. Expected a 36-character Stella Sora preset code.',
      });
      return;
    }

    onLoadSlots(parsed);
    setStatusMessage({
      kind: 'success',
      text: 'Preset loaded!',
    });
    setTimeout(() => {
      setStatusMessage((prev) => (prev?.kind === 'success' ? null : prev));
    }, 2500);
  };

  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode);
    setCodeInput(generatedCode);
    setStatusMessage(null);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleLoadAdvanced = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = advCodeInput.trim();
    if (!trimmed) {
      setAdvStatusMessage({
        kind: 'error',
        text: 'Paste an Advanced Preset Code first.',
      });
      return;
    }

    const parsed = unpackAdvancedPresetCode(trimmed);
    if (!parsed) {
      if (unpackPresetCode(trimmed)) {
        setAdvStatusMessage({
          kind: 'error',
          text: 'That is a standard in-game preset code — paste it in the bar above.',
        });
        return;
      }
      setAdvStatusMessage({
        kind: 'error',
        text: 'Invalid Advanced Preset Code.',
      });
      return;
    }

    if (onLoadAdvancedBuild) {
      onLoadAdvancedBuild(parsed);
      setAdvStatusMessage({
        kind: 'success',
        text: 'Advanced preset loaded!',
      });
      setTimeout(() => {
        setAdvStatusMessage((prev) => (prev?.kind === 'success' ? null : prev));
      }, 2500);
      return;
    }

    const normalized = normalizeAdvancedPresetCodeInput(trimmed);
    if (normalized) {
      router.push(`/builder/advanced?adv=${encodeURIComponent(normalized)}`);
    }
  };

  const handleCopyAdvancedCode = () => {
    if (!generatedAdvCode) return;
    navigator.clipboard.writeText(generatedAdvCode);
    setAdvCodeInput(generatedAdvCode);
    setAdvStatusMessage(null);
    setIsAdvCopied(true);
    setTimeout(() => setIsAdvCopied(false), 2500);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-card p-3 sm:px-4 sm:py-3">
      <form onSubmit={handleLoad} className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <label
            htmlFor="stella-sora-preset-code-input"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-white/90 shrink-0"
          >
            <KeyRound className="size-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <span>In-Game Preset Code</span>
          </label>

          <input
            id="stella-sora-preset-code-input"
            type="text"
            value={codeInput}
            onChange={(e) => {
              setCodeInput(e.target.value);
              if (statusMessage?.kind === 'error') {
                setStatusMessage(null);
              }
            }}
            placeholder="Paste Stella Sora preset code…"
            aria-label="Stella Sora preset code"
            suppressHydrationWarning
            className="flex-1 min-w-[220px] rounded-lg border border-border bg-base px-3 py-1.5 font-mono text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          />

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 border border-amber-600 text-xs font-bold text-slate-950 transition-colors cursor-pointer press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Load Preset
            </button>

            <button
              type="button"
              onClick={handleCopyCode}
              disabled={!generatedCode}
              title={
                generatedCode
                  ? `Copy in-game preset code (${generatedCode})`
                  : 'Assign all 3 Trekker slots to generate an in-game preset code'
              }
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-elevated hover:bg-surface-hover text-xs font-semibold text-slate-800 dark:text-white transition-colors cursor-pointer press-feedback disabled:opacity-45 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {isCopied ? (
                <>
                  <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span className="text-emerald-600 dark:text-emerald-400">Code Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" aria-hidden="true" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {statusMessage && (
          <p
            role={statusMessage.kind === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            className={
              statusMessage.kind === 'error'
                ? 'text-xs font-medium text-rose-600 dark:text-rose-400'
                : 'text-xs font-medium text-emerald-600 dark:text-emerald-400'
            }
          >
            {statusMessage.text}
          </p>
        )}
      </form>

      <div className="flex items-center">
        <button
          type="button"
          onClick={() => setIsAdvancedOpen((prev) => !prev)}
          aria-expanded={isAdvancedOpen}
          aria-controls="advanced-preset-code-panel"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-white/65 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <span>advanced</span>
          <ChevronDown
            className={`size-3 transition-transform duration-150 ${isAdvancedOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {isAdvancedOpen && (
        <form
          id="advanced-preset-code-panel"
          onSubmit={handleLoadAdvanced}
          className="flex flex-col gap-2 rounded-lg border border-border/80 bg-base/60 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="advanced-preset-code-input"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-white/90"
            >
              <SlidersHorizontal
                className="size-3.5 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <span>Advanced Preset Code</span>
            </label>
            <span className="text-[11px] text-slate-500 dark:text-white/55">
              Includes Trekkers, Discs (Lv &amp; Crescendo), and Musical Notes
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <input
              id="advanced-preset-code-input"
              type="text"
              value={advCodeInput}
              onChange={(e) => {
                setAdvCodeInput(e.target.value);
                if (advStatusMessage?.kind === 'error') {
                  setAdvStatusMessage(null);
                }
              }}
              placeholder="Paste Advanced Preset Code…"
              aria-label="Advanced preset code"
              suppressHydrationWarning
              className="flex-1 min-w-[220px] rounded-lg border border-border bg-base px-3 py-1.5 font-mono text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            />

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="submit"
                className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 border border-amber-600 text-xs font-bold text-slate-950 transition-colors cursor-pointer press-feedback focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                Load Preset
              </button>

              <button
                type="button"
                onClick={handleCopyAdvancedCode}
                disabled={!generatedAdvCode}
                title={
                  generatedAdvCode
                    ? 'Copy Advanced Preset Code (Trekkers, Discs & Notes)'
                    : 'Assign at least one Trekker, Disc, or Musical Note to generate a code'
                }
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-elevated hover:bg-surface-hover text-xs font-semibold text-slate-800 dark:text-white transition-colors cursor-pointer press-feedback disabled:opacity-45 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {isAdvCopied ? (
                  <>
                    <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    <span className="text-emerald-600 dark:text-emerald-400">Code Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" aria-hidden="true" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {advStatusMessage && (
            <p
              role={advStatusMessage.kind === 'error' ? 'alert' : 'status'}
              aria-live="polite"
              className={
                advStatusMessage.kind === 'error'
                  ? 'text-xs font-medium text-rose-600 dark:text-rose-400'
                  : 'text-xs font-medium text-emerald-600 dark:text-emerald-400'
              }
            >
              {advStatusMessage.text}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
