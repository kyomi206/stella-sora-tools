'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Code2, ExternalLink } from 'lucide-react';
import type { ResolvedCommunityPreset } from '@/lib/community-presets';
import { getTrekkerImageUrl } from '@/lib/wikitide';
import type { SSCharacter, SSDisc } from '@/types';

export interface CommunityPresetCardProps {
  preset: ResolvedCommunityPreset;
  characters: Record<string, SSCharacter>;
  discs?: Record<string, SSDisc>;
  hasAnalytics?: boolean;
  onLoadIntoBuilder?: (preset: ResolvedCommunityPreset) => void;
  compact?: boolean;
}

export function CommunityPresetCard({
  preset,
  characters,
  onLoadIntoBuilder,
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
          <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">
            <Link
              href={`/builds/${encodeURIComponent(preset.id)}`}
              className="after:absolute after:inset-0 after:content-[''] group-hover:text-teal-700 dark:group-hover:text-teal-400 transition-colors focus:outline-none focus-visible:underline"
            >
              {preset.title}
            </Link>
          </h3>
        </div>
      </div>

      {/* Minimal Footer: Credit + Code */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-3.5 py-2 border-t border-border-subtle bg-surface-subtle/50">
        {primarySource ? (
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
          <span />
        )}

        <div className="flex items-center gap-1.5 shrink-0">
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
                  <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  <span className="text-emerald-600 dark:text-emerald-400">Copied</span>
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
