'use client';

import { useEffect } from 'react';
import type { RoadmapItem } from '@/lib/roadmap/types';
import { getTrekkerAvatarUrl } from '@/data/roadmap';
import {
  X,
  Calendar,
  Sparkles,
  ShieldAlert,
  Gift,
  ExternalLink,
  Disc3,
  Users,
  Flame,
  Calculator,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

interface RoadmapItemDetailsProps {
  item: RoadmapItem | null;
  onClose: () => void;
  now?: Date;
}

export function RoadmapItemDetails({ item, onClose, now: propNow }: RoadmapItemDetailsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  const startDate = new Date(item.startDate);
  const endDate = new Date(item.endDate);
  const now = propNow ?? new Date('2026-10-26T17:38:11Z');

  const isOngoing = now >= startDate && now <= endDate;
  const isUpcoming = now < startDate;
  const isEnded = now > endDate;

  const totalDays = Math.max(
    1,
    Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const remainingDays = isOngoing
    ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : isUpcoming
    ? Math.max(0, Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="roadmap-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border/70 bg-surface-card p-6 shadow-2xl flex flex-col gap-5 text-foreground animate-in zoom-in-95 duration-150 custom-scrollbar overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 right-4 size-8 rounded-lg bg-card/60 border border-border/60 hover:bg-secondary text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer z-10 focus-visible:ring-1 focus-visible:ring-amber-400"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        {/* Top Badges & Category */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {item.badge && (
            <span className="px-2 py-0.5 rounded font-bold bg-rose-500/20 text-rose-600 border border-rose-500/30">
              {item.badge}
            </span>
          )}
          {item.bannerType === 'disc' && (
            <span className="px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-700 border border-amber-500/30 flex items-center gap-1">
              <Disc3 className="size-3" aria-hidden="true" />
              <span>Signature Disc</span>
            </span>
          )}
          {item.isDatamined && (
            <span className="px-2 py-0.5 rounded text-xs bg-sky-500/15 text-sky-600 border border-sky-500/25">
              Datamined
            </span>
          )}
          <span
            className={cn(
              'px-2 py-0.5 rounded-full font-semibold text-[11px] border',
              isOngoing
                ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                : isUpcoming
                ? 'bg-sky-500/15 text-sky-700 border-sky-500/30'
                : 'bg-zinc-500/15 text-zinc-600 border-zinc-500/30'
            )}
          >
            {isOngoing
              ? `Active Now • ${remainingDays}d left`
              : isUpcoming
              ? `Upcoming in ${remainingDays}d`
              : 'Completed'}
          </span>
        </div>

        {/* Title & Subtitle */}
        <div className="flex items-start gap-3.5">
          {item.imageUrl || item.bannerTabUrl ? (
            item.bannerType === 'disc' ? (
              <div className="relative size-20 shrink-0 flex items-center justify-center">
                <img
                  src={item.imageUrl || item.bannerTabUrl}
                  alt={item.characterName || item.discName || item.title}
                  referrerPolicy="no-referrer"
                  className="size-full object-contain drop-shadow-md"
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
                  <div className="absolute -bottom-0.5 -right-0.5 size-4 drop-shadow">
                    <img
                      src={`/ss-element/${item.element}.webp`}
                      alt={item.element}
                      className="size-full object-contain"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div
                className="relative size-16 shrink-0 rounded-xl overflow-hidden border shadow-md border-border/80 bg-muted"
              >
                <img
                  src={item.imageUrl}
                  alt={item.characterName || item.discName || item.title}
                  className="size-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                {item.element && (
                  <div className="absolute top-0.5 left-0.5 size-4">
                    <img
                      src={`/ss-element/${item.element}.webp`}
                      alt={item.element}
                      className="size-full object-contain"
                    />
                  </div>
                )}
              </div>
            )
          ) : null}

          <div className="flex-1 min-w-0">
            <h2 id="roadmap-modal-title" className="text-xl font-bold tracking-tight text-foreground leading-tight">
              {item.title}
            </h2>
            {item.subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {item.subtitle}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {item.wikiUrl && (
                <a
                  href={item.wikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 transition-colors"
                >
                  <span>Wiki Reference</span>
                  <ExternalLink className="size-3" />
                </a>
              )}
              {item.characterName && (
                <Link
                  href={`/calculator?trekker=${encodeURIComponent(item.characterName)}`}
                  className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 transition-colors font-medium"
                >
                  <Calculator className="size-3" />
                  <span>Open in Calculator</span>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Disc Full Artwork (for Disc Banners) */}
        {item.bannerType === 'disc' && (item.artworkUrl || item.bannerTabUrl) && (
          <div className="relative w-full h-36 sm:h-44 rounded-xl overflow-hidden border border-amber-500/30 bg-black/70 shadow-inner group">
            <img
              src={item.artworkUrl || item.bannerTabUrl}
              alt={item.discName || item.title}
              width={540}
              height={176}
              referrerPolicy="no-referrer"
              className="size-full object-cover object-center"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
            <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs font-mono text-white/90">
              <span className="truncate font-semibold text-amber-300">
                {item.discName ? `5★ Runic Disc: ${item.discName}` : '5★ Runic Disc Recruitment'}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-black/70 border border-amber-500/30 text-[10px] font-medium text-amber-300 shrink-0">
                {item.artworkUrl ? 'Disc Artwork' : 'In-Game Banner Art'}
              </span>
            </div>
          </div>
        )}

        {/* Character Recruitment Banner Art */}
        {item.bannerType !== 'disc' && item.bannerTabUrl && (
          <div className="relative w-full h-28 sm:h-32 rounded-xl overflow-hidden border border-border/70 bg-black/60 shadow-inner group">
            <img
              src={item.bannerTabUrl}
              alt={item.title}
              width={540}
              height={128}
              className="size-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs font-mono text-white/90">
              <span className="truncate font-semibold">5★ Trekker Rate-Up Recruitment</span>
              <span className="px-1.5 py-0.5 rounded bg-black/70 border border-white/20 text-[10px] font-medium text-amber-300 shrink-0">
                In-Game Banner Art
              </span>
            </div>
          </div>
        )}

        {/* Companion Signature Runic Disc */}
        {item.pairedDisc && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {item.pairedDisc.imageUrl ? (
                <div className="relative size-14 shrink-0 flex items-center justify-center">
                  <img
                    src={item.pairedDisc.imageUrl}
                    alt={item.pairedDisc.discName || item.pairedDisc.name}
                    width={56}
                    height={56}
                    referrerPolicy="no-referrer"
                    className="size-full object-contain drop-shadow"
                    onError={(e) => {
                      const img = e.target as HTMLImageElement;
                      if (item.pairedDisc!.bannerTabUrl && img.src !== item.pairedDisc!.bannerTabUrl) {
                        img.src = item.pairedDisc!.bannerTabUrl;
                      } else {
                        img.style.display = 'none';
                      }
                    }}
                  />
                  {item.pairedDisc.element && (
                    <div className="absolute -bottom-0.5 -right-0.5 size-3.5 drop-shadow">
                      <img
                        src={`/ss-element/${item.pairedDisc.element}.webp`}
                        alt={item.pairedDisc.element}
                        width={14}
                        height={14}
                        className="size-full object-contain"
                      />
                    </div>
                  )}
                </div>
              ) : null}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-amber-700">Companion Signature Disc</span>
                <span className="text-xs font-bold text-foreground truncate">
                  {item.pairedDisc.discName || item.pairedDisc.name}
                </span>
                {item.pairedDisc.element && (
                  <span className="text-xs text-muted-foreground">
                    5★ {item.pairedDisc.element} Signature Disc
                  </span>
                )}
              </div>
            </div>
            {item.pairedDisc.artworkUrl ? (
              <a
                href={item.pairedDisc.artworkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 border border-amber-500/30 shrink-0 inline-flex items-center gap-1 transition-colors"
                title="View Full Disc Artwork"
              >
                <span>Artwork</span>
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </a>
            ) : (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 border border-amber-500/30 shrink-0">
                Same Schedule
              </span>
            )}
          </div>
        )}

        {/* Date & Schedule Times */}
        <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/50 flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="size-3.5 text-sky-600" />
            <span>Event Duration: <strong className="text-foreground">{totalDays} days</strong></span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/30 text-[11px] font-mono">
            <div>
              <span className="text-muted-foreground block text-[10px]">STARTS</span>
              <strong className="text-foreground">{formatDate(startDate)}</strong>
            </div>
            <div>
              <span className="text-muted-foreground block text-[10px]">ENDS</span>
              <strong className="text-rose-600">{formatDate(endDate)}</strong>
            </div>
          </div>
        </div>

        {/* Boss Blitz Weakness & Resistance Info */}
        {(item.bossWeakness?.length || item.bossResist) && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600">
                <ShieldAlert className="size-4" />
                <span>Raid Combat Vulnerabilities</span>
              </div>
              {item.bossResist && (
                <span className="text-[11px] text-rose-600 font-mono">
                  Resists: <strong className="text-rose-700">{item.bossResist}</strong>
                </span>
              )}
            </div>
            {item.bossWeakness && item.bossWeakness.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-muted-foreground">Weaknesses:</span>
                {item.bossWeakness.map((elem) => (
                  <div
                    key={elem}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card/80 border border-border/50 text-xs font-bold text-foreground"
                  >
                    <img
                      src={`/ss-element/${elem}.webp`}
                      alt={elem}
                      className="size-4 object-contain"
                    />
                    <span>{elem}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Boss Blitz Scoring Mechanics */}
        {item.mechanics && item.mechanics.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Flame className="size-3.5 text-rose-600" />
              <span>Boss Mechanics & Score Modifiers</span>
            </span>
            <div className="flex flex-col gap-2">
              {item.mechanics.map((mech, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-secondary/50 border border-border/50 flex flex-col gap-1 text-xs"
                >
                  <span className="font-bold text-foreground text-xs">{mech.name}</span>
                  <p
                    className="text-muted-foreground text-[11px] leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: mech.desc.replace(/<color=([^>]+)>(.*?)<\/color>/g, '<strong style="color: $1">$2</strong>'),
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {item.description && (
          <div className="text-xs text-muted-foreground leading-relaxed">
            {item.description}
          </div>
        )}

        {/* Rewards */}
        {item.rewards && item.rewards.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Gift className="size-3.5 text-amber-600" />
              <span>Key Rewards & Drops</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {item.rewards.map((reward, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg bg-secondary/60 border border-border/50 text-xs text-foreground font-medium"
                >
                  {reward}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
