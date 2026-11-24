'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowBigUp, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BuildMetricValues {
  views: number;
  upvotes: number;
  voted: boolean;
}

export interface BuildMetricsBarProps {
  buildId: string;
  views: number;
  upvotes: number;
  voted: boolean;
  onMetricChange?: (next: BuildMetricValues) => void;
  onViewRecorded?: (viewsCount: number) => void;
  recordViewOnMount?: boolean;
  compact?: boolean;
  part?: 'all' | 'views' | 'upvote';
}

function formatCompactCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 1000) return String(Math.round(n));
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

export function BuildMetricsBar({
  buildId,
  views,
  upvotes,
  voted,
  onMetricChange,
  onViewRecorded,
  recordViewOnMount = false,
  compact = false,
  part = 'all',
}: BuildMetricsBarProps) {
  const [localViews, setLocalViews] = useState(views);
  const [localUpvotes, setLocalUpvotes] = useState(upvotes);
  const [localVoted, setLocalVoted] = useState(voted);
  const [pendingVote, setPendingVote] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const onMetricChangeRef = useRef(onMetricChange);
  onMetricChangeRef.current = onMetricChange;
  const onViewRecordedRef = useRef(onViewRecorded);
  onViewRecordedRef.current = onViewRecorded;
  const latestMetricsRef = useRef({ views: localViews, upvotes: localUpvotes, voted: localVoted });
  latestMetricsRef.current = { views: localViews, upvotes: localUpvotes, voted: localVoted };

  useEffect(() => {
    setLocalViews((prev) => Math.max(prev, views));
  }, [views]);

  useEffect(() => {
    setLocalUpvotes(upvotes);
  }, [upvotes]);

  useEffect(() => {
    setLocalVoted(voted);
  }, [voted]);

  useEffect(() => {
    if (!recordViewOnMount || !buildId) return;
    const storageKey = `sstt:viewed:${buildId}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) return;
      window.sessionStorage.setItem(storageKey, '1');
    } catch {
      // Proceed without sessionStorage deduplication if restricted
    }

    let cancelled = false;
    fetch(`/api/builds/${encodeURIComponent(buildId)}/view`, { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { viewsCount?: number } | null) => {
        if (cancelled || !data || typeof data.viewsCount !== 'number') return;
        if (data.viewsCount > 0) {
          const nextViews = Math.max(latestMetricsRef.current.views, data.viewsCount);
          setLocalViews(nextViews);
          if (onViewRecordedRef.current) {
            onViewRecordedRef.current(nextViews);
          } else {
            onMetricChangeRef.current?.({
              views: nextViews,
              upvotes: latestMetricsRef.current.upvotes,
              voted: latestMetricsRef.current.voted,
            });
          }
        }
      })
      .catch(() => {
        // Non-blocking telemetry
      });

    return () => {
      cancelled = true;
    };
  }, [buildId, recordViewOnMount]);

  const handleToggleUpvote = async () => {
    if (pendingVote || !buildId) return;
    setVoteError(null);

    const prevUpvotes = localUpvotes;
    const prevVoted = localVoted;
    const optimisticVoted = !prevVoted;
    const optimisticUpvotes = optimisticVoted
      ? prevUpvotes + 1
      : Math.max(0, prevUpvotes - 1);

    setLocalVoted(optimisticVoted);
    setLocalUpvotes(optimisticUpvotes);
    setPendingVote(true);

    try {
      const res = await fetch(`/api/builds/${encodeURIComponent(buildId)}/upvote`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as {
        upvotesCount?: number;
        voted?: boolean;
        error?: string;
      };

      if (!res.ok || typeof data.upvotesCount !== 'number' || typeof data.voted !== 'boolean') {
        setLocalVoted(prevVoted);
        setLocalUpvotes(prevUpvotes);
        setVoteError(data.error || 'Could not update vote.');
        return;
      }

      setLocalVoted(data.voted);
      setLocalUpvotes(data.upvotesCount);
      onMetricChangeRef.current?.({
        views: latestMetricsRef.current.views,
        upvotes: data.upvotesCount,
        voted: data.voted,
      });
    } catch {
      setLocalVoted(prevVoted);
      setLocalUpvotes(prevUpvotes);
      setVoteError('Network error while voting.');
    } finally {
      setPendingVote(false);
    }
  };

  const showViews = part === 'all' || part === 'views';
  const showUpvote = part === 'all' || part === 'upvote';

  return (
    <div className="inline-flex items-center gap-1.5 shrink-0">
      {showViews && (
        <span
          title={`${localViews} views`}
          aria-label={`${localViews} views`}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-surface-subtle text-xs font-semibold tabular-nums text-teal-700',
            compact ? 'px-2 py-1' : 'px-2.5 py-1'
          )}
        >
          <Eye className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{formatCompactCount(localViews)}</span>
        </span>
      )}

      {showUpvote && (
        <button
          type="button"
          onClick={handleToggleUpvote}
          disabled={pendingVote}
          aria-pressed={localVoted}
          aria-label={localVoted ? `Remove upvote (${localUpvotes})` : `Upvote build (${localUpvotes})`}
          title={voteError || (localVoted ? 'Remove upvote' : 'Upvote build')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border text-xs tabular-nums transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
            compact ? 'px-2 py-1' : 'px-3 py-1.5',
            localVoted
              ? 'bg-amber-500 border-amber-600 text-slate-950 font-bold'
              : 'border-border bg-surface-card hover:bg-surface-hover text-slate-700 dark:text-white/90 font-semibold',
            pendingVote && 'opacity-70'
          )}
        >
          <ArrowBigUp
            className={cn('size-3.5 shrink-0', localVoted && 'fill-slate-950')}
            aria-hidden="true"
          />
          <span>{formatCompactCount(localUpvotes)}</span>
        </button>
      )}
    </div>
  );
}
