'use client';

import { useMemo } from 'react';
import { formatPotentialSegments } from '@/lib/potential-utils';
import type { ElementType } from '@/types';

interface PotentialDescProps {
  descTemplate: string;
  params: (string | number)[];
  level?: number;
  className?: string;
  defaultElement?: ElementType;
  characterId?: number | null;
  forceLight?: boolean;
}

export function PotentialDesc({
  descTemplate,
  params,
  level = 1,
  className,
  defaultElement,
  characterId,
  forceLight = false,
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
            <span
              key={index}
              className={
                forceLight
                  ? 'font-semibold text-[#e04f0f]'
                  : 'font-semibold text-[#e04f0f] dark:text-[#ff7433]'
              }
            >
              {segment.text}
            </span>
          );
        }
        if (segment.kind === 'mark') {
          return (
            <span key={index}>
              <span
                className={
                  forceLight
                    ? 'underline underline-offset-2 font-medium text-[#0369a1]'
                    : 'underline underline-offset-2 font-medium text-sky-600 dark:text-sky-400'
                }
              >
                {segment.text}
              </span>
              {segment.element && (
                <img
                  src={`/ss-mark/${segment.element}.png`}
                  alt={`${segment.element} Mark`}
                  className="inline-block size-[1.35em] object-contain align-[-0.25em] ml-1 select-none pointer-events-none"
                />
              )}
            </span>
          );
        }
        if (segment.kind === 'effect') {
          return (
            <span
              key={index}
              className={
                forceLight ? 'font-medium text-[#0369a1]' : 'font-medium text-sky-600 dark:text-sky-400'
              }
            >
              {segment.text}
            </span>
          );
        }
        return <span key={index}>{segment.text}</span>;
      })}
    </span>
  );
}
