'use client';

import { MaterialTally, SkillRankRange } from '@/lib/calculator/resource-engine';
import {
  getMaterialIconUrl,
  getMaterialRarityStyle,
  MATERIAL_DATA,
} from '@/lib/calculator/material-icons';
import { Coins, Layers } from 'lucide-react';

interface MaterialsBillProps {
  tally: MaterialTally;
  trekkerName: string;
  startLevel: number;
  targetLevel: number;
  skills: {
    combat: SkillRankRange;
    support: SkillRankRange;
    ultimate: SkillRankRange;
    normal: SkillRankRange;
  };
}

function MaterialIconItem({ name }: { name: string }) {
  const iconUrl = getMaterialIconUrl(name);

  return (
    <div className="relative w-8 h-8 sm:w-9 sm:h-9 shrink-0 flex items-center justify-center">
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={name}
          width={36}
          height={36}
          className="w-full h-full object-contain"
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = 'none';
          }}
        />
      ) : (
        <span className="text-xs font-bold text-slate-600">{name.charAt(0)}</span>
      )}
    </div>
  );
}

export function MaterialsBill({
  tally,
  trekkerName,
  startLevel,
  targetLevel,
  skills,
}: MaterialsBillProps) {
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  const dorraIconUrl = getMaterialIconUrl('Dorra');

  return (
    <div className="bg-surface border border-border rounded-xl p-3 sm:p-3.5 space-y-2.5">
      {/* Bill Header */}
      <div className="pb-2 border-b border-border">
        <h3 className="text-xs font-bold text-slate-900">Materials Needed</h3>
      </div>

      {/* Dorra Section */}
      <div className="py-1.5 flex items-center gap-2.5 border-b border-border/60">
        <div className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center shrink-0">
          {dorraIconUrl ? (
            <img src={dorraIconUrl} alt="Dorra" width={36} height={36} className="w-full h-full object-contain" />
          ) : (
            <Coins className="w-5 h-5 text-amber-600" aria-hidden="true" />
          )}
        </div>
        <span className="text-xs font-bold text-slate-700">Dorra</span>
        <span className="text-sm sm:text-base font-extrabold !text-amber-600 font-mono tabular-nums">
          {formatNumber(tally.dorra)}
        </span>
      </div>

      {/* All Upgrade Materials */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-700">
            <Layers className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            <span className="text-xs font-bold">Upgrade Materials</span>
          </div>
          <span className="text-xs text-slate-600 font-mono tabular-nums">
            {tally.breakthroughItems.length + tally.skillItems.length} types
          </span>
        </div>
        {tally.breakthroughItems.length + tally.skillItems.length === 0 ? (
          <div className="p-3 text-center rounded-lg bg-surface-subtle border border-border text-slate-600 text-xs">No upgrade materials required for this range.</div>
        ) : (
          <div className="space-y-1">
            {[...tally.breakthroughItems.map((item) => ({ ...item, category: 'Tier Item' })), ...tally.skillItems.map((item) => ({ ...item, category: 'Skill Cartridge / Disc' }))].map((item) => (
              <div
                key={item.name}
                className="material-row py-1 flex items-center gap-2.5 transition-colors"
              >
                <MaterialIconItem name={item.name} />
                <span className="text-sm font-bold text-slate-900 font-mono tabular-nums shrink-0">
                  x{formatNumber(item.count)}
                </span>
                <span className="text-sm font-medium text-slate-800 truncate" title={item.name}>
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
