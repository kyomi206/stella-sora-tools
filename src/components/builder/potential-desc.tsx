'use client';

import { useMemo } from 'react';
import { formatPotentialSegments } from '@/lib/potentials';
import type { ElementType } from '@/types';

interface PotentialDescProps {
  descTemplate: string;
  params: (string | number)[];
  level?: number;
  className?: string;
  defaultElement?: ElementType;
  characterId?: number | null;
}

export function PotentialDesc({
  descTemplate,
  params,
  level = 1,
  className,
  defaultElement,
  characterId,
}: PotentialDescProps) {
  const segments = useMemo(
    () => formatPotentialSegments(descTemplate, params, level, defaultElement, characterId),
    [descTemplate, params, level, defaultElement, characterId]
  );

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        if (segment.kind === 'percent') {
          return (
            <span key={index} className="font-semibold text-amber-500 dark:text-amber-400">
              {segment.text}
            </span>
          );
        }
        if (segment.kind === 'mark') {
          return (
            <span key={index}>
              <span className="underline underline-offset-2 font-medium text-sky-600 dark:text-sky-400">
                {segment.text}
              </span>
              {segment.element && (
                <img
                  src={`/ss-element/${segment.element}.webp`}
                  alt={segment.element}
                  className="inline-block size-[1.15em] object-contain align-[-0.15em] ml-1 select-none pointer-events-none"
                />
              )}
            </span>
          );
        }
        return <span key={index}>{segment.text}</span>;
      })}
    </span>
  );
}
