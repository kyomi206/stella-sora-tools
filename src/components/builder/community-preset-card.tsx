'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, Check, Code2, ExternalLink } from 'lucide-react';
import {
  BuildMetricsBar,
  type BuildMetricValues,
} from '@/components/builds/build-metrics-bar';
import {
  COMMUNITY_MODE_LABELS,
  type ResolvedCommunityPreset,
} from '@/lib/community-presets';
import { cn } from '@/lib/utils';
import { getTrekkerImageUrl } from '@/lib/wikitide';
import type { SSCharacter, SSDisc } from '@/types';

export interface CommunityPresetCardProps {
  preset: ResolvedCommunityPreset;
  characters: Record<string, SSCharacter>;
  discs?: Record<string, SSDisc>;
  hasAnalytics?: boolean;
  onLoadIntoBuilder?: (preset: ResolvedCommunityPreset) => void;
  compact?: boolean;
  metrics?: BuildMetricValues;
  onMetricChange?: (id: string, next: BuildMetricValues) => void;
}

export function CommunityPresetCard({
  preset,
  characters,
  onLoadIntoBuilder,
  metrics,
  onMetricChange,
}: CommunityPresetCardProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopyCode = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedCode(false), 1600);
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const mainChar = preset.advData.slots.vanguard.characterId
    ? characters[String(preset.advData.slots.vanguard.characterId)] || null
    : null;
  const supportChars = [
    preset.advData.slots.versatile.characterId
      ? characters[String(preset.advData.slots.versatile.characterId)] || null
      : null,
    preset.advData.slots.support.characterId
      ? characters[String(preset.advData.slots.support.characterId)] || null
      : null,
  ];
  const primarySource = preset.sources[0];
  const isVerified = preset.isVerified ?? preset.origin !== 'community';
  const authorDisplay = preset.authorName || primarySource?.author || 'Anonymous';
  const nonGeneralModes = preset.modes.filter((m) => m !== 'general');
  const views = metrics?.views ?? preset.viewsCount ?? 0;
  const upvotes = metrics?.upvotes ?? preset.upvotesCount ?? 0;
  const voted = metrics?.voted ?? false;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-surface-card hover:border-border-hover hover:bg-surface-elevated/60 transition-colors">
      {/* Main Clickable Area — stretched link opens /builds/[id] */}
      <div className="flex-1 p-3.5 pb-3 space-y-3">
        {/* Squad Portraits (larger Main + 2 Supports) & All 3 Names */}
        <div className="flex items-start gap-3">
          {mainChar ? (
            <img
              src={getTrekkerImageUrl(mainChar.id)}
              alt={mainChar.name.EN}
              width={52}
              height={52}
              loading="lazy"
              decoding="async"
              className="size-[52px] rounded-xl object-cover object-top border border-border bg-surface-subtle shrink-0"
            />
          ) : (
            <div className="size-[52px] rounded-xl border border-dashed border-border bg-surface-subtle shrink-0" />
          )}

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                {supportChars.map((char, idx) =>
                  char ? (
                    <img
                      key={char.id}
                      src={getTrekkerImageUrl(char.id)}
                      alt={char.name.EN}
                      width={32}
                      height={32}
                      loading="lazy"
                      decoding="async"
                      className="size-8 rounded-lg object-cover object-top border border-border bg-surface-subtle shrink-0"
                    />
                  ) : (
                    <div
                      key={`empty-${idx}`}
                      className="size-8 rounded-lg border border-dashed border-border bg-surface-subtle shrink-0"
                    />
                  )
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
                {nonGeneralModes.slice(0, 2).map((mode) => (
                  <span
                    key={mode}
                    className="px-1.5 py-0.5 rounded-md border border-border-subtle bg-surface-subtle text-[11px] font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap"
                  >
                    {COMMUNITY_MODE_LABELS[mode] || mode}
                  </span>
                ))}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-semibold whitespace-nowrap shrink-0',
                    isVerified
                      ? 'border-teal-500/35 bg-teal-500/10 text-teal-700'
                      : 'border-border bg-surface-subtle text-slate-600 dark:text-slate-400'
                  )}
                >
                  {isVerified && <BadgeCheck className="size-3 shrink-0" aria-hidden="true" />}
                  <span>{isVerified ? 'Verified' : 'Community'}</span>
                </span>
              </div>
            </div>

            <div className="text-xs leading-snug text-slate-600 dark:text-white/70">
              {mainChar && (
                <span className="font-semibold text-slate-900 dark:text-white">
                  {mainChar.name.EN}
                </span>
              )}
              {supportChars.map((char) =>
                char ? (
                  <span key={char.id}> · {char.name.EN}</span>
                ) : null
              )}
            </div>
          </div>
        </div>

        {/* Title Row */}
        <div className="pt-2.5 border-t border-border-subtle flex items-start gap-1.5 min-w-0">
          <img
            src={`/ss-element/${preset.element}.webp`}
            alt={preset.element}
            width={16}
            height={16}
            className="size-4 mt-0.5 object-contain shrink-0"
          />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 break-words min-w-0">
            <Link
              href={`/builds/${encodeURIComponent(preset.id)}`}
              className="after:absolute after:inset-0 after:content-[''] group-hover:text-teal-700 transition-colors focus:outline-none focus-visible:underline"
            >
              {preset.title}
            </Link>
          </h3>
        </div>
      </div>

      {/* Footer: Author, Live Metrics & Code */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-t border-border-subtle bg-surface-subtle/50">
        {primarySource?.url ? (
          <a
            href={primarySource.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 min-w-0 text-xs font-semibold text-slate-600 dark:text-white/70 hover:text-sky-700 dark:hover:text-sky-400 hover:underline truncate rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span className="truncate">{primarySource.author}</span>
            <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
          </a>
        ) : (
          <span className="truncate text-xs font-semibold text-slate-600 dark:text-slate-400 min-w-0">
            {authorDisplay}
          </span>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          <BuildMetricsBar
            buildId={preset.id}
            views={views}
            upvotes={upvotes}
            voted={voted}
            onMetricChange={
              onMetricChange ? (next) => onMetricChange(preset.id, next) : undefined
            }
            compact
          />

          {onLoadIntoBuilder && (
            <button
              type="button"
              onClick={() => onLoadIntoBuilder(preset)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 border border-amber-600 text-xs font-bold text-slate-950 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <span>Load</span>
            </button>
          )}

          {preset.inGameCode && (
            <button
              type="button"
              onClick={() => handleCopyCode(preset.inGameCode!)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-surface-card hover:bg-surface-hover text-xs font-bold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {copiedCode ? (
                <>
                  <Check className="size-3.5 text-emerald-700" aria-hidden="true" />
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Code2 className="size-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                  <span>Code</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
