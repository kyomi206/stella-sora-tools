'use client';

import { cn } from '@/lib/utils';

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

function polar(cx: number, cy: number, radius: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  };
}

function slicePath(start: number, end: number): string {
  const cx = 50;
  const cy = 50;
  const radius = 50;
  const clampedEnd = Math.min(end, start + 359.99);
  const startPoint = polar(cx, cy, radius, start);
  const endPoint = polar(cx, cy, radius, clampedEnd);
  const largeArc = clampedEnd - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${startPoint.x.toFixed(3)} ${startPoint.y.toFixed(3)} A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x.toFixed(3)} ${endPoint.y.toFixed(3)} Z`;
}

export function PieChart({
  slices,
  size = 148,
  className,
  label,
}: {
  slices: PieSlice[];
  size?: number;
  className?: string;
  label?: string;
}) {
  const visible = slices.filter((slice) => slice.value > 0);
  const total = visible.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={label ?? 'Pie chart'}
      className={cn('shrink-0', className)}
    >
      {total <= 0 ? (
        <circle cx={50} cy={50} r={49} className="fill-surface-subtle" />
      ) : visible.length === 1 ? (
        <circle cx={50} cy={50} r={49} fill={visible[0].color} />
      ) : (
        visible.map((slice, index) => {
          const start = visible
            .slice(0, index)
            .reduce((sum, previous) => sum + (previous.value / total) * 360, 0);
          const sweep = (slice.value / total) * 360;
          return (
            <path
              key={`${slice.label}-${index}`}
              d={slicePath(start, start + sweep)}
              fill={slice.color}
              stroke="var(--color-surface-card)"
              strokeWidth={1.2}
              strokeLinejoin="round"
            >
              <title>{`${slice.label}: ${((slice.value / total) * 100).toFixed(1)}%`}</title>
            </path>
          );
        })
      )}
    </svg>
  );
}

export function PieLegend({
  slices,
  total,
  className,
  emptyLabel = 'No damage',
}: {
  slices: PieSlice[];
  total?: number;
  className?: string;
  emptyLabel?: string;
}) {
  const sum = total ?? slices.reduce((acc, slice) => acc + slice.value, 0);
  const visible = slices.filter((slice) => slice.value > 0);

  if (visible.length === 0) {
    return <p className={cn('text-[10px] text-slate-500 dark:text-slate-400', className)}>{emptyLabel}</p>;
  }

  return (
    <ul className={cn('min-w-0 space-y-1', className)}>
      {visible.map((slice) => {
        const share = sum > 0 ? (slice.value / sum) * 100 : 0;
        return (
          <li key={slice.label} className="flex min-w-0 items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: slice.color }}
            />
            <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-600 dark:text-white/70">
              {slice.label}
            </span>
            <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-slate-500 dark:text-slate-400">
              {share.toFixed(1)}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
