'use client';

import { useEffect, useState } from 'react';
import charactersData from '@/data/characters.json';
import { SSCharacter } from '@/types';
import { getTrekkerImageUrl } from '@/lib/wikitide';

const CHAR_LIST = Object.values(charactersData as Record<string, SSCharacter>);

export function TrekkerSpotlight() {
  // Default to first character on server, update on client
  const [featuredIndex, setFeaturedIndex] = useState<number>(0);

  useEffect(() => {
    if (!CHAR_LIST.length) return;
    const now = new Date();
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) /
        1000 /
        60 /
        60 /
        24
    );
    setFeaturedIndex(dayOfYear % CHAR_LIST.length);
  }, []);

  const featured = CHAR_LIST[featuredIndex];
  if (!featured) return null;

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Outer Section Title */}
      <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
        Trekker of the Day
      </h2>

      {/* Main Card */}
      <div className="flex-1 p-6 game-card celestial-card border border-border bg-surface-card flex flex-col items-center justify-center gap-3">
        {/* Circular Avatar with Element and Role Accents */}
        <div className="relative">
          <div className="size-32 sm:size-36 rounded-full overflow-hidden border-2 border-amber-400/60 shadow-xl bg-surface-subtle">
            <img
              src={getTrekkerImageUrl(featured.id)}
              alt={featured.name.EN}
              width={144}
              height={144}
              className="w-full h-full object-cover object-top"
            />
          </div>
          {/* Element Badge */}
          <div className="absolute bottom-0 right-1 size-7 rounded-full bg-surface-subtle border border-border-hover p-0.5 shadow-md flex items-center justify-center">
            <img
              src={`/ss-element/${featured.element}.webp`}
              alt={featured.element}
              width={18}
              height={18}
              className="size-4.5 object-contain"
            />
          </div>
        </div>

        {/* Trekker Name & Minimal Metadata Badges */}
        <div className="flex flex-col items-center gap-1.5 mt-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg sm:text-xl text-slate-900 tracking-tight">
              {featured.name.EN}
            </h3>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-amber-500 text-slate-950 tabular-nums">
              {featured.star}★
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-slate-700 font-medium">
              {featured.element}
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border-subtle text-slate-700 font-medium">
              {featured.class}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
