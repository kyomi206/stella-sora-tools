'use client';

import { useMemo } from 'react';
import { formatPotentialSegments } from '@/lib/potentials';

interface PotentialDescProps {
  descTemplate: string;
  params: (string | number)[];
  level?: number;
  className?: string;
}

export function PotentialDesc({
  descTemplate,
  params,
  level = 1,
  className,
}: PotentialDescProps) {
  const segments = useMemo(
    () => formatPotentialSegments(descTemplate, params, level),
    [descTemplate, params, level]
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
            <span key={index} className="underline underline-offset-2 font-medium">
              {segment.text}
            </span>
          );
        }
        return <span key={index}>{segment.text}</span>;
      })}
    </span>
  );
}
