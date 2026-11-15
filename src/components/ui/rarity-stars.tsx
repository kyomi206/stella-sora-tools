'use client';

import { cn } from '@/lib/utils';

interface RarityStarsProps {
  count: number;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Renders Stella Sora rarity stars using the Miraheze wiki RaritySparkle sprites
 * with rightwards z-ordered overlap.
 */
export function RarityStars({ count, size = 'md', className }: RarityStarsProps) {
  const safeCount = Math.max(1, Math.min(5, count));

  return (
    <span
      role="img"
      aria-label={`${safeCount}-Star`}
      className={cn('inline-flex items-center shrink-0 select-none', className)}
    >
      {Array.from({ length: safeCount }).map((_, idx) => (
        <img
          key={idx}
          src="/ss-rarity/RaritySparkle@2x.png"
          srcSet="/ss-rarity/RaritySparkle.png 1x, /ss-rarity/RaritySparkle@2x.png 2x, /ss-rarity/RaritySparkle@3x.png 3x"
          alt=""
          aria-hidden="true"
          style={{ zIndex: safeCount - idx }}
          className={cn(
            'relative object-contain shrink-0',
            size === 'sm'
              ? 'size-4 [&:not(:first-child)]:-ml-1.5'
              : 'size-5 [&:not(:first-child)]:-ml-1.5'
          )}
        />
      ))}
    </span>
  );
}
