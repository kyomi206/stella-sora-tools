'use client';

import { useState, useMemo, useRef, useEffect, useCallback, memo } from 'react';
import type { RoadmapItem, RoadmapCategoryKey } from '@/lib/roadmap/types';
import { ROADMAP_CATEGORIES, getTrekkerAvatarUrl } from '@/data/roadmap';
import { getMergedRoadmapItems } from '@/lib/roadmap/data-loader';
import {
  Search,
  Filter,
  Check,
  ZoomIn,
  ZoomOut,
  Move,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const LANE_HEIGHT = 66;
const HEADER_HEIGHT = 44;
const EMPTY_DAYS: { x: number; dayNum: number; isWeekend: boolean }[] = [];

// Width of the sticky category sidebar (w-44) plus the horizontal padding of the
// element that sticks. Native `position: sticky` insets are measured from the
// scrollport edge, while the old transform approach measured from the card, so
// these constants reproduce the exact same resting position for sticky content.
const SIDEBAR_WIDTH = 176;
const CARD_PADDING_X = 10;
const MONTH_PADDING_X = 12;
const CARD_STICKY_INSET = SIDEBAR_WIDTH + CARD_PADDING_X;
const MONTH_STICKY_INSET = SIDEBAR_WIDTH + MONTH_PADDING_X;

// Historical timeline range from the game's launch on October 19, 2025 through the 1st Anniversary
const RANGE_START = new Date('2025-10-15T00:00:00Z');
const RANGE_END = new Date('2026-11-30T23:59:59Z');

interface LaneAssignment {
  lanes: Map<string, number>;
  laneCount: number;
}

function packIntoLanes(items: RoadmapItem[], isMainStory = false, dayWidth = 32): LaneAssignment {
  const lanes = new Map<string, number>();
  const laneIntervals: { start: number; end: number }[][] = [];

  // Sort items chronologically by start date
  const sorted = [...items].sort((a, b) => {
    const startA = new Date(a.startDate).getTime();
    const startB = new Date(b.startDate).getTime();
    if (startA !== startB) return startA - startB;
    const durA = new Date(a.endDate).getTime() - startA;
    const durB = new Date(b.endDate).getTime() - startB;
    return durB - durA;
  });

  for (const item of sorted) {
    const start = new Date(item.startDate).getTime();
    // For main story, content is permanent (lasts forever).
    // We treat its visual text footprint (~240px wide) as the collision interval for staggering lanes.
    const end = isMainStory
      ? start + Math.max(7 * DAY_MS, (240 / Math.max(16, dayWidth)) * DAY_MS)
      : new Date(item.endDate).getTime();

    let assignedLane = laneIntervals.findIndex((lane) =>
      lane.every((interval) => interval.end <= start || interval.start >= end)
    );

    if (assignedLane === -1) {
      assignedLane = laneIntervals.length;
      laneIntervals.push([]);
    }

    laneIntervals[assignedLane].push({ start, end });
    lanes.set(item.id, assignedLane);
  }

  return {
    lanes,
    laneCount: Math.max(1, laneIntervals.length),
  };
}

// ---------------------------------------------------------------------------
// Module-scope pure helpers & memoized card components. Kept outside the
// component so their identities never change between renders.
// ---------------------------------------------------------------------------

function formatDateRangeShort(startStr: string, endStr: string) {
  const s = new Date(startStr);
  const e = new Date(endStr);
  const sm = s.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const sd = s.getUTCDate();
  const sy = s.getUTCFullYear();
  const em = e.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const ed = e.getUTCDate();
  const ey = e.getUTCFullYear();
  if (sy !== ey) {
    return `${sm} ${sd}, '${String(sy).slice(2)} – ${em} ${ed}, '${String(ey).slice(2)}`;
  }
  return `${sm} ${sd} – ${em} ${ed}`;
}

// Format milestone date & time strictly matching lore1.png: "Nov 24, 02:00"
function formatMilestoneDate(dateStr: string) {
  const d = new Date(dateStr);
  const m = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${m} ${day}, ${hh}:${mm}`;
}

// Wiki artwork is served as full-size illustrations (2400×1700). The timeline
// only paints a ~112×80 silhouette, and decoding 4 megapixels per card during
// a drag is what caused the remaining stutter. Ask WikiTide for a small
// thumbnail instead (the full-res original is still used by the details modal).
function wikiArtworkThumb(url: string, width = 320): string {
  const match = url.match(
    /^(https:\/\/static\.wikitide\.net\/[^/]+\/)([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)$/
  );
  if (!match) return url;
  const [, base, a, ab, file] = match;
  return `${base}thumb/${a}/${ab}/${file}/${width}px-${file}`;
}

// Color theme classes (module scope so they are not re-allocated per item per render).
const COLOR_STYLES: Record<string, { card: string; badge: string; badgeText: string }> = {
  purple: {
    card: 'border-violet-300 bg-gradient-to-r from-violet-100 via-violet-50 to-surface-card text-violet-900 hover:border-violet-400',
    badge: 'bg-violet-100 text-violet-800 border-violet-300',
    badgeText: 'text-violet-700',
  },
  amber: {
    card: 'border-amber-300 bg-gradient-to-r from-amber-100 via-amber-50 to-surface-card text-amber-900 hover:border-amber-400',
    badge: 'bg-amber-100 text-amber-800 border-amber-300',
    badgeText: 'text-amber-700',
  },
  blue: {
    card: 'border-sky-300 bg-gradient-to-r from-sky-100 via-sky-50 to-surface-card text-sky-900 hover:border-sky-400',
    badge: 'bg-sky-100 text-sky-800 border-sky-300',
    badgeText: 'text-sky-700',
  },
  rose: {
    card: 'border-rose-300 bg-gradient-to-r from-rose-100 via-rose-50 to-surface-card text-rose-900 hover:border-rose-400',
    badge: 'bg-rose-100 text-rose-700 border-rose-300',
    badgeText: 'text-rose-600',
  },
  emerald: {
    card: 'border-emerald-300 bg-gradient-to-r from-emerald-100 via-emerald-50 to-surface-card text-emerald-900 hover:border-emerald-400',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    badgeText: 'text-emerald-700',
  },
  orange: {
    card: 'border-orange-300 bg-gradient-to-r from-orange-100 via-orange-50 to-surface-card text-orange-900 hover:border-orange-400',
    badge: 'bg-orange-100 text-orange-800 border-orange-300',
    badgeText: 'text-orange-700',
  },
  indigo: {
    card: 'border-indigo-300 bg-gradient-to-r from-indigo-100 via-indigo-50 to-surface-card text-indigo-900 hover:border-indigo-400',
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    badgeText: 'text-indigo-700',
  },
};

interface TimelineCardProps {
  item: RoadmapItem;
  left: number;
  width: number;
  top: number;
  isOngoing: boolean;
}

const TimelineCard = memo(function TimelineCard({
  item,
  left,
  width,
  top,
  isOngoing,
}: TimelineCardProps) {
  const colorStyles = COLOR_STYLES[item.colorTheme];

  return (
    <div
      className={cn(
        // `overflow-clip` (not `overflow-hidden`) is deliberate: it clips the card
        // artwork exactly the same way but does not create a scroll container, so
        // the native `position: sticky` content below still tracks the timeline
        // scrollport instead of the card itself.
        'absolute rounded-xl border px-2.5 py-1 flex items-center overflow-clip shadow-md group select-none transition-[border-color,box-shadow] duration-150',
        colorStyles.card,
        isOngoing && 'ring-1 ring-white/20 shadow-[0_0_12px_rgba(15,23,42,0.12)]'
      )}
      style={{ left: `${left}px`, width: `${width}px`, top: `${top}px`, height: `${LANE_HEIGHT - 6}px` }}
      title={item.title}
    >
      {/* Background Artwork Silhouette */}
      {(item.artworkUrl || item.imageUrl) && (
        <img
          src={item.artworkUrl ? wikiArtworkThumb(item.artworkUrl) : item.imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className={cn(
            "absolute -right-2 -bottom-2 pointer-events-none rounded-xl blur-[0.3px] transition-opacity",
            item.bannerType === 'disc'
              ? "h-20 w-28 object-cover object-center opacity-30 group-hover:opacity-50"
              : "h-20 w-20 object-cover opacity-25 group-hover:opacity-40"
          )}
          style={{ maskImage: 'linear-gradient(to right, transparent, black 60%)' }}
        />
      )}

      {/* Card Content Left (Native sticky avatar/disc, text, and badges).
          CSS `position: sticky` is resolved by the browser alongside the scroll
          offset, so there is no JS/CSS-var lag for the content to vibrate against. */}
      <div
        className="sticky flex items-center gap-2.5 min-w-0 z-10 pointer-events-none"
        style={{ left: `${CARD_STICKY_INSET}px` }}
      >
        {/* Avatar / Disc / Icon */}
        {(item.imageUrl || item.bannerTabUrl) ? (
          item.bannerType === 'disc' ? (
            <div className="relative size-[52px] shrink-0 flex items-center justify-center">
              <img
                src={item.imageUrl || item.bannerTabUrl}
                alt={item.characterName || item.discName || item.title}
                loading="lazy"
                decoding="async"
                draggable={false}
                referrerPolicy="no-referrer"
                className="size-full object-contain drop-shadow"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (item.bannerTabUrl && img.src !== item.bannerTabUrl) {
                    img.src = item.bannerTabUrl;
                  } else {
                    img.style.display = 'none';
                  }
                }}
              />
              {item.element && (
                <div className="absolute -bottom-0.5 -right-0.5 size-3.5 drop-shadow">
                  <img
                    src={`/ss-element/${item.element}.webp`}
                    alt={item.element}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="size-full object-contain"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="relative size-10 rounded-lg overflow-hidden border border-white/20 bg-black/40 shrink-0 shadow">
              <img
                src={item.imageUrl}
                alt={item.characterName || item.discName || item.title}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="size-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              {item.element && (
                <div className="absolute top-0.5 left-0.5 size-3">
                  <img
                    src={`/ss-element/${item.element}.webp`}
                    alt={item.element}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="size-full object-contain"
                  />
                </div>
              )}
            </div>
          )
        ) : null}

        {/* Info Text */}
        <div className="flex flex-col min-w-0">
          {/* Badges Row */}
          <div className="flex items-center gap-1.5 flex-nowrap">
            {item.badge && (
              <span
                className={cn(
                  'text-[9px] font-black tracking-wider shrink-0',
                  item.category === 'bossBlitz' || item.category === 'events' || item.category === 'cataclysm'
                    ? colorStyles.badgeText
                    : cn('px-1.5 py-0.2 rounded border', colorStyles.badge)
                )}
              >
                {item.badge}
              </span>
            )}
            {isOngoing && (
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            )}
            {item.bossWeakness && item.bossWeakness.length > 0 && width > 180 && (
              <div className="hidden sm:flex items-center gap-1 shrink-0 ml-0.5">
                {item.bossWeakness.map((elem) => (
                  <img
                    key={elem}
                    src={`/ss-element/${elem}.webp`}
                    alt={elem}
                    draggable={false}
                    title={`Weak to ${elem}`}
                    className="size-3.5 object-contain drop-shadow"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <span className="font-bold text-xs truncate leading-tight mt-0.5">
            {item.title}
          </span>

          {/* Date range subtitle */}
          <span className="text-[10px] opacity-75 font-mono truncate mt-0.5">
            {formatDateRangeShort(item.startDate, item.endDate)}
          </span>
        </div>
      </div>
    </div>
  );
});

interface MainStoryPinProps {
  item: RoadmapItem;
  left: number;
  top: number;
}

const MainStoryPin = memo(function MainStoryPin({ item, left, top }: MainStoryPinProps) {
  return (
    <div
      className="absolute flex items-start gap-2.5 select-none transition-colors duration-150 z-10 group"
      style={{ left: `${left}px`, top: `${top}px` }}
      title={item.title}
    >
      {/* Circle dot marker matching lore1.png */}
      <div className="relative mt-0.5 shrink-0">
        <span className="block size-2.5 rounded-full bg-[#6366f1] shadow-[0_0_8px_rgba(99,102,241,0.9)] group-hover:scale-125 transition-transform" />
      </div>

      {/* Stacked text matching lore1.png */}
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] font-bold tracking-wider uppercase text-sky-600 leading-none">
          MAIN STORY
        </span>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-xs font-bold text-slate-900 whitespace-nowrap leading-snug group-hover:text-sky-800 transition-colors">
            {item.title}
          </span>
          {item.wikiUrl && (
            <a
              href={item.wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
              title="View on Miraheze Wiki"
            >
              <ExternalLink className="size-2.5" />
            </a>
          )}
        </div>
        <span className="text-[10px] text-sky-700/80 font-mono whitespace-nowrap leading-none mt-1">
          {formatMilestoneDate(item.startDate)}
        </span>
      </div>
    </div>
  );
});

export function RoadmapTimeline() {
  const [dayWidth, setDayWidth] = useState<number>(32);
  const [hiddenCategories, setHiddenCategories] = useState<RoadmapCategoryKey[]>([]);
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState<boolean>(false);
  const categoryMenuRef = useRef<HTMLDivElement>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'upcoming'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pointer drag-to-pan & viewport virtualization state & refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollAnchor, setScrollAnchor] = useState<number>(0);
  const scrollAnchorRef = useRef<number>(0);
  const [viewportWidth, setViewportWidth] = useState<number>(1200);
  const activePointerIdRef = useRef<number | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragScrollLeftRef = useRef<number>(0);
  const dragMaxScrollRef = useRef<number>(0);
  const dragAnchorStepRef = useRef<number>(600);
  const hasDraggedRef = useRef<boolean>(false);

  // Current time — always reflects the actual present moment
  const [now, setNow] = useState<Date>(() => RANGE_START);

  // The today line's position depends on the live clock, so it must stay out of
  // the SSR output — server and client timestamps never match exactly.
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
    setNow(new Date());
  }, []);

  // Load merged roadmap items
  const allRoadmapItems = useMemo(() => getMergedRoadmapItems(), []);

  const totalDays = Math.ceil((RANGE_END.getTime() - RANGE_START.getTime()) / DAY_MS);
  const totalTimelineWidth = totalDays * dayWidth;

  const dateToX = (date: Date | string): number => {
    const t = typeof date === 'string' ? new Date(date).getTime() : date.getTime();
    return ((t - RANGE_START.getTime()) / DAY_MS) * dayWidth;
  };

  const todayX = dateToX(now);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    // The sticky content is now handled natively by CSS, so scrolling only has
    // to re-anchor the virtualization window once it drifts far enough. A small
    // step keeps each new batch of mounting cards cheap (short commit, no jank).
    if (Math.abs(el.scrollLeft - scrollAnchorRef.current) > el.clientWidth * 0.5) {
      scrollAnchorRef.current = el.scrollLeft;
      setScrollAnchor(el.scrollLeft);
    }
  }, []);

  // Close category dropdown on outside click or Escape
  useEffect(() => {
    if (!isCategoryMenuOpen) return;
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(e.target as Node)) {
        setIsCategoryMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsCategoryMenuOpen(false);
    };
    window.addEventListener('pointerdown', handlePointerDownOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCategoryMenuOpen]);

  const toggleCategoryVisibility = (key: RoadmapCategoryKey) => {
    setHiddenCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  // Dragging event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.pointerType === 'mouse' && e.button !== 0) || activePointerIdRef.current !== null || !scrollContainerRef.current) return;
    activePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartXRef.current = e.clientX;
    const container = scrollContainerRef.current;
    dragScrollLeftRef.current = container.scrollLeft;
    // Cache the scroll bounds once per gesture: reading them on every
    // pointermove would force a synchronous layout on each frame.
    dragMaxScrollRef.current = Math.max(0, container.scrollWidth - container.clientWidth);
    dragAnchorStepRef.current = container.clientWidth * 0.5;
    hasDraggedRef.current = false;
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId || !scrollContainerRef.current) return;
    const deltaX = e.clientX - dragStartXRef.current;
    if (!hasDraggedRef.current && Math.abs(deltaX) > 3) {
      hasDraggedRef.current = true;
    }
    const container = scrollContainerRef.current;
    const nextScroll = Math.min(
      dragMaxScrollRef.current,
      Math.max(0, dragScrollLeftRef.current - deltaX)
    );

    // Write the scroll position directly. The sticky card content is native CSS
    // sticky, so it follows this scroll without a second per-frame style pass.
    container.scrollLeft = nextScroll;

    if (Math.abs(nextScroll - scrollAnchorRef.current) > dragAnchorStepRef.current) {
      scrollAnchorRef.current = nextScroll;
      setScrollAnchor(nextScroll);
    }
  };

  const finishPointerDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    activePointerIdRef.current = null;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = '';
      scrollContainerRef.current.style.userSelect = '';
    }
  };

  // Global mouse up & move listeners to maintain drag gesture across elements
  useEffect(() => {
    const handleWindowBlur = () => {
      activePointerIdRef.current = null;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.style.cursor = '';
        scrollContainerRef.current.style.userSelect = '';
      }
    };
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // Jump to today / active
  const handleJumpToToday = () => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const targetLeft = Math.max(0, todayX - container.clientWidth / 2 + 100);
      container.scrollTo({ left: targetLeft, behavior: 'smooth' });
    }
  };

  // Jump to launch
  const handleJumpToLaunch = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  // Center on today upon initial mount & track viewport width
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollContainerRef.current) {
        const container = scrollContainerRef.current;
        const cw = container.clientWidth || 1200;
        setViewportWidth(cw);
        const targetLeft = Math.max(0, todayX - cw / 2 + 100);
        container.scrollTo({ left: targetLeft, behavior: 'auto' });
        scrollAnchorRef.current = container.scrollLeft;
        setScrollAnchor(container.scrollLeft);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [dayWidth, todayX]);

  // Keep the virtualization window in sync with the actual viewport width on resize
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (!w) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setViewportWidth((prev) => (Math.abs(prev - w) > 2 ? w : prev));
      });
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const windowStart = scrollAnchor - viewportWidth;
  const windowEnd = scrollAnchor + viewportWidth * 2;

  // Precompute the full day grid once per zoom level (no Date allocation per frame).
  const allDays = useMemo(() => {
    const out: { x: number; dayNum: number; isWeekend: boolean }[] = new Array(totalDays);
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(RANGE_START.getTime() + i * DAY_MS);
      const dayOfWeek = date.getUTCDay();
      out[i] = {
        x: i * dayWidth,
        dayNum: date.getUTCDate(),
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      };
    }
    return out;
  }, [dayWidth]);

  // Slice of visible calendar days inside the viewport window
  const visibleCalendarDays = useMemo(() => {
    const first = Math.max(0, Math.floor(windowStart / dayWidth));
    const last = Math.min(totalDays, Math.ceil(windowEnd / dayWidth));
    return first >= last ? EMPTY_DAYS : allDays.slice(first, last);
  }, [allDays, windowStart, windowEnd, dayWidth]);

  // Generate calendar months for top header
  const calendarMonths = useMemo(() => {
    const list: { key: string; label: string; left: number; width: number }[] = [];
    let cur = new Date(Date.UTC(RANGE_START.getUTCFullYear(), RANGE_START.getUTCMonth(), 1));

    while (cur < RANGE_END) {
      const monthStart = new Date(Math.max(cur.getTime(), RANGE_START.getTime()));
      const nextMonth = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
      const monthEnd = new Date(Math.min(nextMonth.getTime(), RANGE_END.getTime()));

      const left = dateToX(monthStart);
      const width = dateToX(monthEnd) - left;

      if (width > 0) {
        list.push({
          key: cur.toISOString(),
          label: cur.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
          left,
          width,
        });
      }

      cur = nextMonth;
    }
    return list;
  }, [dayWidth]);

  // Filter items
  const filteredItems = useMemo(() => {
    return allRoadmapItems.filter((item) => {
      // Category filter
      if (hiddenCategories.includes(item.category)) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const start = new Date(item.startDate).getTime();
        const end = new Date(item.endDate).getTime();
        const nowMs = now.getTime();
        if (statusFilter === 'active' && (nowMs < start || nowMs > end)) {
          return false;
        }
        if (statusFilter === 'upcoming' && nowMs >= start) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchSubtitle = item.subtitle?.toLowerCase().includes(q);
        const matchChar = item.characterName?.toLowerCase().includes(q);
        const matchBoss = item.bossName?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchSubtitle && !matchChar && !matchBoss && !matchDesc) {
          return false;
        }
      }
      return true;
    });
  }, [allRoadmapItems, hiddenCategories, statusFilter, searchQuery, now]);

  // Group items by category and compute lane packing
  const categoryRows = useMemo(() => {
    return ROADMAP_CATEGORIES.filter((cat) => !hiddenCategories.includes(cat.key)).map((cat) => {
      const catItems = filteredItems.filter((i) => i.category === cat.key);
      const isMainStory = cat.key === 'mainStory';
      const { lanes, laneCount } = packIntoLanes(catItems, isMainStory, dayWidth);
      const rowHeight = isMainStory
        ? Math.max(1, laneCount) * 54 + 18
        : laneCount * LANE_HEIGHT + 14;

      return {
        category: cat,
        items: catItems,
        lanes,
        laneCount,
        rowHeight,
        isMainStory,
      };
    });
  }, [filteredItems, hiddenCategories, dayWidth]);

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Top Toolbar: Filters, Search, Zoom, Jump Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-xl border border-border bg-surface-card">
        <div className="flex items-center gap-2.5 flex-1 max-w-xl">
          {/* Categories Dropdown Menu (matching exam.png) */}
          <div ref={categoryMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsCategoryMenuOpen((v) => !v)}
              aria-expanded={isCategoryMenuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border border-border bg-base text-slate-900 hover:bg-surface-hover hover:border-border-hover"
            >
              <Filter className="size-3.5 text-slate-700" aria-hidden="true" />
              <span>Categories</span>
              {hiddenCategories.length > 0 && (
                <span className="text-[11px] text-slate-600">
                  ({ROADMAP_CATEGORIES.length - hiddenCategories.length}/{ROADMAP_CATEGORIES.length})
                </span>
              )}
            </button>

            {isCategoryMenuOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-1.5 z-50 min-w-[230px] rounded-xl border border-border bg-surface-card p-1.5 shadow-2xl flex flex-col gap-0.5"
              >
                {ROADMAP_CATEGORIES.map((cat) => {
                  const isChecked = !hiddenCategories.includes(cat.key);
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={isChecked}
                      onClick={() => toggleCategoryVisibility(cat.key)}
                      className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer text-left"
                    >
                      <span className="size-4 flex items-center justify-center shrink-0">
                        {isChecked && <Check className="size-3.5 text-slate-900 stroke-[2.5]" aria-hidden="true" />}
                      </span>
                      <span className={cn('size-2.5 rounded-full shrink-0', cat.dotColor)} />
                      <span className="truncate">{cat.label.split('(')[0].trim()}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-600" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search banners, bosses, events…"
              aria-label="Search banners, bosses, events"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              suppressHydrationWarning
              className="w-full bg-base border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-amber-400 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Right Toolbar Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Drag Hint */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-base text-xs text-slate-600 select-none">
            <Move className="size-3 text-amber-600 shrink-0" aria-hidden="true" />
            <span>Drag canvas to pan timeline</span>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center rounded-lg border border-border bg-base p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setDayWidth((w) => Math.max(18, w - 6))}
              disabled={dayWidth <= 18}
              aria-label="Zoom Out"
              className="p-1.5 rounded text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer transition-colors focus-visible:ring-1 focus-visible:ring-amber-400"
              title="Zoom Out"
            >
              <ZoomOut className="size-3.5" aria-hidden="true" />
            </button>
            <span className="px-2 font-mono text-xs font-semibold text-slate-600">
              {dayWidth}px
            </span>
            <button
              type="button"
              onClick={() => setDayWidth((w) => Math.min(60, w + 6))}
              disabled={dayWidth >= 60}
              aria-label="Zoom In"
              className="p-1.5 rounded text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer transition-colors focus-visible:ring-1 focus-visible:ring-amber-400"
              title="Zoom In"
            >
              <ZoomIn className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Jump to Launch (Chitose Debut) */}
          <button
            type="button"
            onClick={handleJumpToLaunch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-base text-amber-700 border border-amber-500/30 hover:bg-surface-hover text-xs font-semibold transition-colors cursor-pointer shrink-0"
            title="Jump to Game Launch (Oct 19, 2025)"
          >
            <span>Launch (Oct '25)</span>
          </button>

          {/* Jump to Active / Today */}
          <button
            type="button"
            onClick={handleJumpToToday}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 border border-amber-600 hover:bg-amber-400 text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-sm"
            title="Jump to Current Time (Oct 26, 2026)"
          >
            <span>Jump to Active</span>
          </button>
        </div>
      </div>

      {/* Main Timeline Viewport Container */}
      <div className="relative isolate z-10 rounded-xl border border-border bg-base shadow-2xl overflow-hidden flex flex-col">
        {/* Scrollable Container with Pointer Drag Panning */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          onLostPointerCapture={finishPointerDrag}
          onDragStart={(e) => e.preventDefault()}
          className="relative overflow-x-auto overflow-y-hidden select-none touch-pan-y overscroll-x-contain scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent cursor-grab active:cursor-grabbing"
          style={{ minHeight: '480px' }}
        >
          <div
            className="relative flex"
            style={{ width: `${totalTimelineWidth + 180}px` }}
          >
            {/* Sticky Left Sidebar with Category Labels */}
            <div
              className="sticky left-0 top-0 bottom-0 z-30 w-44 shrink-0 bg-surface-subtle border-r border-border flex flex-col"
              style={{ width: SIDEBAR_WIDTH }}
            >
              {/* Top Corner Box (Timezone indicator) */}
              <div
                className="flex items-center justify-between px-3 border-b border-border bg-surface-card text-[11px] font-semibold uppercase tracking-wider text-slate-600 shrink-0"
                style={{ height: HEADER_HEIGHT }}
              >
                <span>Category</span>
                <span className="font-mono text-[10px] text-amber-600">UTC</span>
              </div>

              {/* Category Row Labels */}
              {categoryRows.map(({ category, rowHeight, items }) => (
                <div
                  key={category.key}
                  className="flex flex-col justify-start p-3 border-b border-border shrink-0 bg-surface-subtle"
                  style={{ height: rowHeight }}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('size-2.5 rounded-full shrink-0', category.dotColor)} />
                    <span className="text-xs font-bold text-foreground truncate">
                      {category.label.split('(')[0].trim()}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {items.length} {items.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
              ))}
            </div>

            {/* Scrollable Timeline Grid */}
            <div
              className="relative flex-1"
              style={{ width: `${totalTimelineWidth}px` }}
            >
              {/* Timeline Header (Months + Days) */}
              <div
                className="sticky top-0 z-20 flex flex-col border-b border-border bg-surface-subtle select-none"
                style={{ height: HEADER_HEIGHT }}
              >
                {/* Months Bar */}
                <div className="relative h-6 border-b border-border/30 overflow-clip">
                  {calendarMonths.map((m) => (
                    <div
                      key={m.key}
                      className="absolute top-0 bottom-0 flex items-center px-3 border-r border-border/40 text-[11px] font-bold text-foreground overflow-clip bg-card/40 pointer-events-none"
                      style={{ left: m.left, width: m.width }}
                    >
                      <span
                        className="sticky whitespace-nowrap"
                        style={{ left: `${MONTH_STICKY_INSET}px` }}
                      >
                        {m.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Days Numbers Bar */}
                <div className="relative h-5 overflow-hidden">
                  {visibleCalendarDays.map((d) => (
                    <div
                      key={d.x}
                      className={cn(
                        'absolute top-0 bottom-0 flex items-center justify-center font-mono text-[10px] border-r border-border/20',
                        d.isWeekend
                          ? 'bg-sky-500/[0.08] text-sky-700 font-semibold'
                          : 'text-muted-foreground'
                      )}
                      style={{ left: d.x, width: dayWidth }}
                    >
                      {d.dayNum}
                    </div>
                  ))}
                </div>
              </div>

              {/* Day Vertical Grid Lines (CSS background repeat + weekend highlights in viewport) */}
              <div
                className="absolute inset-0 top-[44px] pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, rgba(15, 23, 42, 0.10) 1px, transparent 1px)',
                  backgroundSize: `${dayWidth}px 100%`,
                }}
              >
                {visibleCalendarDays.map((d) =>
                  d.isWeekend ? (
                    <div
                      key={d.x}
                      className="absolute top-0 bottom-0 bg-sky-500/[0.04]"
                      style={{ left: d.x, width: dayWidth }}
                    />
                  ) : null
                )}
              </div>

              {/* Month Vertical Border Separators */}
              <div className="absolute inset-0 top-[44px] pointer-events-none">
                {calendarMonths.map((m) =>
                  m.left > 0 ? (
                    <div
                      key={m.key}
                      className="absolute inset-y-0 border-l-2 border-sky-400/70 shadow-[0_0_8px_rgba(56,189,248,0.25)] z-10"
                      style={{ left: m.left }}
                    />
                  ) : null
                )}
              </div>

              {/* Red Vertical Today Line Indicator (client-only: clock-dependent) */}
              {isHydrated && (
                <div
                  className="absolute top-0 bottom-0 z-20 w-0.5 bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.35)] pointer-events-none"
                  style={{ left: todayX }}
                >
                  <div className="sticky top-[48px] -translate-x-1/2 bg-rose-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded-sm shadow-md uppercase tracking-wider flex items-center gap-1 whitespace-nowrap">
                    <span className="size-1.5 rounded-full bg-white animate-ping" />
                    <span>Today</span>
                  </div>
                </div>
              )}

              {/* Category Horizontal Rows */}
              {categoryRows.map(({ category, items, lanes, rowHeight, isMainStory }) => (
                <div
                  key={category.key}
                  className="relative border-b border-slate-200"
                  style={{ height: rowHeight }}
                >
                  {items.map((item) => {
                    const laneIndex = lanes.get(item.id) ?? 0;
                    const left = Math.max(0, dateToX(item.startDate));
                    const right = isMainStory ? left + 260 : dateToX(item.endDate);

                    // Cull offscreen items outside the viewport window
                    if (right < windowStart || left > windowEnd) {
                      return null;
                    }

                    // MAIN STORY: Render as open milestone pin strictly matching lore1.png (no box/container)
                    if (isMainStory) {
                      return (
                        <MainStoryPin
                          key={item.id}
                          item={item}
                          left={left}
                          top={10 + laneIndex * 54}
                        />
                      );
                    }

                    // OTHER CATEGORIES: Render as bounded duration box cards
                    const top = 7 + laneIndex * LANE_HEIGHT;
                    const width = Math.max(72, right - left);
                    const startDate = new Date(item.startDate);
                    const endDate = new Date(item.endDate);
                    const isOngoing = now >= startDate && now <= endDate;

                    return (
                      <TimelineCard
                        key={item.id}
                        item={item}
                        left={left}
                        width={width}
                        top={top}
                        isOngoing={isOngoing}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
