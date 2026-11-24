'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  X,
} from 'lucide-react';
import { inferSquadElement } from '@/lib/calculator/disc-rankings-client';
import {
  COMMUNITY_MODE_LABELS,
  type CommunityPresetMode,
  type CommunityPresetTier,
} from '@/lib/community-presets';
import { packAdvancedPresetCode } from '@/lib/preset-code';
import { cn } from '@/lib/utils';
import { getTrekkerImageUrl } from '@/lib/wikitide';
import type { AdvancedTeamBuild, SSCharacter, SSDisc } from '@/types';

interface PublishBuildModalProps {
  isOpen: boolean;
  onClose: () => void;
  build: AdvancedTeamBuild;
  characters: Record<string, SSCharacter>;
  discs: Record<string, SSDisc>;
}

const MODE_OPTIONS: ReadonlyArray<{ value: CommunityPresetMode; label: string }> = [
  { value: 'general', label: COMMUNITY_MODE_LABELS.general },
  { value: 'boss-blitz', label: COMMUNITY_MODE_LABELS['boss-blitz'] },
  { value: 'cataclysm', label: COMMUNITY_MODE_LABELS.cataclysm },
];

const TIER_OPTIONS: ReadonlyArray<{ value: CommunityPresetTier; label: string }> = [
  { value: 'f2p', label: 'F2P' },
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
];

const DEFAULT_BUILD_NAMES = new Set([
  'new advanced preset',
  'new squad build',
  'untitled preset',
  '',
]);

const AUTHOR_STORAGE_KEY = 'sstt:last-author-name';

export function PublishBuildModal({
  isOpen,
  onClose,
  build,
  characters,
  discs,
}: PublishBuildModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const pressedOutsideRef = useRef(false);
  const resetOnNextOpenRef = useRef(false);
  const lastOpenedBuildKeyRef = useRef<string>('');

  const [title, setTitle] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [tier, setTier] = useState<CommunityPresetTier>('standard');
  const [modes, setModes] = useState<CommunityPresetMode[]>(['general']);
  const [summary, setSummary] = useState('');
  const [rotationNotes, setRotationNotes] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [turnstileToken, setTurnstileToken] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [duplicateUrl, setDuplicateUrl] = useState<string | null>(null);
  const [publishedResult, setPublishedResult] = useState<{
    id: string;
    url: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';

  const squadPreview = useMemo(() => {
    const slotOrder = ['vanguard', 'versatile', 'support'] as const;
    const trekkers = slotOrder.map((slotKey) => {
      const cid = build.slots[slotKey]?.characterId;
      return cid ? characters[String(cid)] || null : null;
    });
    const element = inferSquadElement(build, characters, discs);
    const mainDiscCount = build.mainDiscs.filter((d) => Boolean(d.discId)).length;
    const supportDiscCount = build.supportDiscs.filter((d) => Boolean(d.discId)).length;
    const squadKey = `${slotOrder.map((k) => build.slots[k]?.characterId ?? 0).join('-')}|${build.mainDiscs.map((d) => d.discId ?? 0).join('-')}`;
    return { trekkers, element, mainDiscCount, supportDiscCount, squadKey };
  }, [build, characters, discs]);

  const noteLines = useMemo(
    () =>
      rotationNotes
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    [rotationNotes]
  );

  // Restore saved author handle once on mount
  useEffect(() => {
    try {
      const savedAuthor = window.localStorage.getItem(AUTHOR_STORAGE_KEY);
      if (savedAuthor) setAuthorName(savedAuthor.slice(0, 30));
    } catch {
      // Ignore storage access errors
    }
  }, []);

  // Synchronize native <dialog> top-layer modal open/close state
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      const squadChanged =
        lastOpenedBuildKeyRef.current !== '' &&
        lastOpenedBuildKeyRef.current !== squadPreview.squadKey;
      lastOpenedBuildKeyRef.current = squadPreview.squadKey;

      const trimmedName = (build.name || '').trim();
      const isCustomized = !DEFAULT_BUILD_NAMES.has(trimmedName.toLowerCase());
      setTitle(isCustomized ? trimmedName.slice(0, 60) : '');

      if (resetOnNextOpenRef.current || squadChanged) {
        setTier('standard');
        setModes(['general']);
        setSummary('');
        setRotationNotes('');
        resetOnNextOpenRef.current = false;
      }

      setErrorMsg(null);
      setTitleError(null);
      setDuplicateUrl(null);
      setPublishedResult(null);
      setCopiedLink(false);
      setWebsite('');
      setTurnstileToken('');

      if (!dialog.open) {
        dialog.showModal();
      }
      const focusTimer = window.setTimeout(() => {
        titleInputRef.current?.focus();
      }, 20);
      return () => window.clearTimeout(focusTimer);
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, build.name, squadPreview.squadKey]);

  // Progressive-enhancement fallback for browsers without native dialog closedby="any" (e.g. Safari)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !isOpen) return;
    if ('closedBy' in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    const onPointerDown = (e: PointerEvent) => {
      pressedOutsideRef.current = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pressedOutsideRef.current && isOutside(e)) {
        dialog.close();
      }
      pressedOutsideRef.current = false;
    };

    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const toggleMode = (mode: CommunityPresetMode) => {
    setErrorMsg(null);
    setModes((prev) =>
      prev.includes(mode)
        ? prev.filter((m) => m !== mode)
        : prev.length < 3
          ? [...prev, mode]
          : prev
    );
  };

  const handleCopyPublishedUrl = async (urlPath: string) => {
    try {
      const fullUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${urlPath}`
          : urlPath;
      await navigator.clipboard.writeText(fullUrl);
      setCopiedLink(true);
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setTitleError(null);
    setDuplicateUrl(null);

    const trimmedTitle = title.trim();
    if (trimmedTitle.length < 4 || trimmedTitle.length > 60) {
      const msg = 'Build title must be between 4 and 60 characters.';
      setTitleError(msg);
      setErrorMsg(msg);
      titleInputRef.current?.focus();
      return;
    }

    if (modes.length === 0) {
      setErrorMsg('Select at least one game mode.');
      return;
    }

    const advCode = packAdvancedPresetCode(build, characters, discs);
    if (!advCode) {
      setErrorMsg('Add at least 1 valid Trekker before publishing.');
      return;
    }

    if (noteLines.length > 8) {
      setErrorMsg('Please keep author notes to 8 lines or fewer.');
      return;
    }
    if (noteLines.some((line) => line.length > 160)) {
      setErrorMsg('Each author note line must be 160 characters or fewer.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/builds/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: trimmedTitle,
          authorName: authorName.trim(),
          tier,
          modes,
          summary: summary.trim(),
          rotation: noteLines,
          combatRotation: build.rotation ?? undefined,
          advCode,
          element: squadPreview.element,
          website,
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        url?: string;
        error?: string;
        existingUrl?: string;
      };

      if (res.status === 201 && data.id && data.url) {
        resetOnNextOpenRef.current = true;
        try {
          const cleanAuthor = authorName.trim();
          if (cleanAuthor) {
            window.localStorage.setItem(AUTHOR_STORAGE_KEY, cleanAuthor);
          }
        } catch {
          // Ignore storage failures
        }
        setPublishedResult({ id: data.id, url: data.url });
        return;
      }

      if (res.status === 409 && data.existingUrl) {
        setDuplicateUrl(data.existingUrl);
        setErrorMsg(data.error || 'This exact build is already published.');
        return;
      }

      setErrorMsg(data.error || 'Could not publish build. Please try again.');
    } catch {
      setErrorMsg('Network error while publishing. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="publish-build-title"
      onClose={() => {
        if (isOpen) onClose();
      }}
      {...({ closedby: 'any' } as Record<string, string>)}
      className="m-auto p-0 w-[calc(100%-1.5rem)] max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface-card text-inherit shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="size-4.5 text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
          <h2
            id="publish-build-title"
            className="text-base font-bold text-slate-900 dark:text-white truncate"
          >
            Publish to Community Builds
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close publish modal"
          className="size-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 hover:bg-surface-hover hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      {/* Squad Preview Strip */}
      <div className="px-5 py-3 bg-surface-subtle border-b border-border-subtle flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {squadPreview.trekkers.map((char, idx) =>
            char ? (
              <div key={char.id} className="flex items-center gap-1.5">
                <img
                  src={getTrekkerImageUrl(char.id)}
                  alt={char.name.EN}
                  width={32}
                  height={32}
                  className={cn(
                    'size-8 rounded-lg object-cover object-top border',
                    idx === 0 ? 'border-amber-500/70' : 'border-border'
                  )}
                />
                <span className="text-xs font-semibold text-slate-800 dark:text-white/90 hidden sm:inline">
                  {char.name.EN}
                </span>
              </div>
            ) : (
              <div
                key={`empty-${idx}`}
                className="size-8 rounded-lg border border-dashed border-border bg-surface-card"
                aria-label="Empty slot"
              />
            )
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-white/90">
            <img
              src={`/ss-element/${squadPreview.element}.webp`}
              alt={squadPreview.element}
              width={14}
              height={14}
              className="size-3.5 object-contain"
            />
            <span>{squadPreview.element}</span>
          </span>
          <span aria-hidden="true">·</span>
          <span
            className={cn(
              'tabular-nums',
              squadPreview.mainDiscCount === 0 && squadPreview.supportDiscCount === 0 && 'text-amber-700 font-medium'
            )}
          >
            {squadPreview.mainDiscCount === 0 && squadPreview.supportDiscCount === 0
              ? 'No discs equipped'
              : `${squadPreview.mainDiscCount}/3 Main · ${squadPreview.supportDiscCount}/3 Support`}
          </span>
        </div>
      </div>

      {publishedResult ? (
        <div className="p-5 space-y-4">
          <div
            role="status"
            className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2"
          >
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
              <Check className="size-4 shrink-0" aria-hidden="true" />
              <span>Build published live</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-white/85">
              Your squad is now live on Community Builds and ready to share.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => handleCopyPublishedUrl(publishedResult.url)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {copiedLink ? (
                <>
                  <Check className="size-3.5 text-emerald-700" aria-hidden="true" />
                  <span className="text-emerald-700">Link Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" aria-hidden="true" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <Link
              href={publishedResult.url}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 border border-amber-600 text-xs font-bold text-slate-950 transition-colors press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <span>Open Live Build</span>
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="p-5 space-y-4">
          {errorMsg && (
            <div
              id="publish-form-error"
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-700 space-y-1.5"
            >
              <div className="flex items-start gap-2 font-semibold">
                <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
              {duplicateUrl && (
                <div>
                  <Link
                    href={duplicateUrl}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 font-bold underline hover:text-rose-800"
                  >
                    <span>View existing build</span>
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Honeypot input */}
          <input
            type="text"
            name="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            tabIndex={-1}
            aria-hidden="true"
            autoComplete="off"
            className="absolute -left-[9999px] size-px opacity-0 pointer-events-none"
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="publish-title-input"
                className="text-xs font-bold text-slate-700 dark:text-white/90"
              >
                Build Title <span className="text-rose-600 dark:text-rose-400" aria-hidden="true">*</span>
              </label>
              <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {title.trim().length}/60
              </span>
            </div>
            <input
              ref={titleInputRef}
              id="publish-title-input"
              name="title"
              type="text"
              required
              minLength={4}
              maxLength={60}
              aria-invalid={titleError ? true : undefined}
              aria-describedby={titleError ? 'publish-form-error' : undefined}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) {
                  setTitleError(null);
                  setErrorMsg(null);
                }
              }}
              placeholder="e.g. Eleanor Skill Willow Boss Blitz"
              className={cn(
                'w-full rounded-lg border bg-base px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                titleError ? 'border-rose-500/70' : 'border-border'
              )}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="publish-author-input"
              className="text-xs font-bold text-slate-700 dark:text-white/90"
            >
              Author Name
            </label>
            <input
              id="publish-author-input"
              name="authorName"
              type="text"
              autoComplete="nickname"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={30}
              placeholder="Anonymous"
              className="w-full rounded-lg border border-border bg-base px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-700 dark:text-white/90">
                Investment Tier
              </span>
              <div className="flex items-center gap-1.5" role="group" aria-label="Investment tier">
                {TIER_OPTIONS.map((opt) => {
                  const active = tier === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setTier(opt.value)}
                      className={cn(
                        'flex-1 px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                        active
                          ? 'bg-teal-500/15 border-teal-500/60 text-teal-700 font-bold'
                          : 'bg-surface-card border-border text-slate-700 dark:text-white/85 font-semibold hover:bg-surface-hover'
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-bold text-slate-700 dark:text-white/90">
                Modes
              </span>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Game modes">
                {MODE_OPTIONS.map((opt) => {
                  const active = modes.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleMode(opt.value)}
                      className={cn(
                        'px-2.5 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                        active
                          ? 'bg-teal-500/15 border-teal-500/60 text-teal-700 font-bold'
                          : 'bg-surface-card border-border text-slate-700 dark:text-white/85 font-semibold hover:bg-surface-hover'
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="publish-summary-input"
                className="text-xs font-bold text-slate-700 dark:text-white/90"
              >
                Summary
              </label>
              <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {summary.length}/280
              </span>
            </div>
            <textarea
              id="publish-summary-input"
              name="summary"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={280}
              placeholder="Key gameplan, timing tips, or disc swaps…"
              className="w-full rounded-lg border border-border bg-base px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 resize-y"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="publish-rotation-input"
                className="text-xs font-bold text-slate-700 dark:text-white/90"
              >
                Author Notes{' '}
                <span className="font-normal text-slate-500 dark:text-slate-400">
                  (optional, one note per line)
                </span>
              </label>
              <span
                className={cn(
                  'text-xs tabular-nums shrink-0',
                  noteLines.length > 8
                    ? 'text-rose-700 font-bold'
                    : 'text-slate-500 dark:text-slate-400'
                )}
              >
                {noteLines.length}/8 lines
              </span>
            </div>
            <textarea
              id="publish-rotation-input"
              name="authorNotes"
              rows={3}
              value={rotationNotes}
              onChange={(e) => {
                setRotationNotes(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              placeholder={'Open with Support skill to apply Mark\nSwap to Main Vanguard and trigger Ultimate'}
              className="w-full rounded-lg border border-border bg-base px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 resize-y"
            />
          </div>

          {turnstileSiteKey && (
            <div
              className="cf-turnstile"
              data-sitekey={turnstileSiteKey}
              data-callback="onTurnstileVerify"
            />
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 border border-amber-600 text-xs font-bold text-slate-950 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  <span>Publishing…</span>
                </>
              ) : (
                <>
                  <Globe className="size-3.5" aria-hidden="true" />
                  <span>Publish Build</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
