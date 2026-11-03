'use client';

import { useState } from 'react';
import type { UnreleasedTrekker } from '@/lib/roadmap/types';
import { Sparkles, ChevronDown, ChevronUp, AlertCircle, Database, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UnreleasedTrekkersBarProps {
  trekkers: UnreleasedTrekker[];
}

export function UnreleasedTrekkersBar({ trekkers }: UnreleasedTrekkersBarProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  if (!trekkers || trekkers.length === 0) return null;

  return (
    <div className="w-full rounded-2xl border border-sky-500/20 bg-surface-card p-5 shadow-xl transition-colors">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-600">
            <Database className="size-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Datamined Upcoming Trekkers</span>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/20 text-sky-700 border border-sky-500/30">
                  Client Binaries
                </span>
              </h3>
            </div>
            <p className="text-xs text-slate-600">
              Unannounced characters datamined from Stella Sora game files. Element and class assignments may change before official release.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-subtle border border-border-subtle hover:bg-surface-elevated text-xs text-slate-700 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <span>{isExpanded ? 'Collapse' : `Show Units (${trekkers.length})`}</span>
          {isExpanded ? <ChevronUp className="size-3.5" aria-hidden="true" /> : <ChevronDown className="size-3.5" aria-hidden="true" />}
        </button>
      </div>

      {/* Expanded Grid */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-border-subtle flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {trekkers.map((unit) => (
              <div
                key={unit.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-elevated border border-border-subtle hover:border-sky-500/40 transition-colors group"
              >
                {/* Silhouette / Avatar */}
                <div className="relative size-12 shrink-0 rounded-xl overflow-hidden border border-border-subtle bg-slate-100/80 flex items-center justify-center">
                  <img
                    src={unit.avatarUrl}
                    alt={unit.displayName}
                    width={48}
                    height={48}
                    className="size-full object-cover transition-opacity"
                    onError={(e) => {
                      // Fallback silhouette icon
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-slate-600 pointer-events-none" aria-hidden="true">
                    <Shield className="size-5 opacity-40" aria-hidden="true" />
                  </div>
                  {unit.element && unit.element !== 'Unknown' && (
                    <div className="absolute top-0.5 left-0.5 size-3.5">
                      <img
                        src={`/ss-element/${unit.element}.webp`}
                        alt={String(unit.element)}
                        width={14}
                        height={14}
                        className="size-full object-contain"
                      />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900 truncate">{unit.displayName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs font-medium">
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-700 border border-sky-500/20">
                      {unit.class}
                    </span>
                    <span className="text-slate-600">
                      {unit.element}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-amber-700/80 bg-amber-500/10 px-3 py-2 rounded-lg border border-amber-500/20">
            <Sparkles className="size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
            <span>
              Tip: Prepare your Stellanite Crystals and Runic Discs in advance. Rate-up character banners require 160 pulls for guaranteed hard pity spark.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
