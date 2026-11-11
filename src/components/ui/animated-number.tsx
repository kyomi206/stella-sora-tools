'use client';

import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  format: (value: number) => string;
  duration?: number;
  className?: string;
}

/**
 * Settles a changing figure instead of swapping it.
 *
 * Only the transition between two real values animates. A figure arriving from
 * zero snaps instead, so a page that decodes its data after mount does not play
 * a count-up from nothing. Reduced-motion users get the new value immediately.
 */
export function AnimatedNumber({ value, format, duration = 240, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const displayedRef = useRef(value);

  useEffect(() => {
    const from = displayedRef.current;
    if (from === value) return;

    if (from === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      displayedRef.current = value;
      setDisplay(value);
      return;
    }

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (value - from) * eased;
      displayedRef.current = next;
      setDisplay(next);

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        displayedRef.current = value;
        setDisplay(value);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}
