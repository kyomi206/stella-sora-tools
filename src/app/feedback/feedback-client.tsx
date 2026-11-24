'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Lock,
  Send,
  X,
} from 'lucide-react';
import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_SITE_SECTIONS,
  resolveFeedbackFromPath,
  type FeedbackCategory,
} from '@/lib/feedback/validation';
import { cn } from '@/lib/utils';

const CATEGORIES: ReadonlyArray<FeedbackCategory> = [
  'bug',
  'math',
  'feature',
  'other',
];

const CATEGORY_PLACEHOLDERS: Record<FeedbackCategory, string> = {
  bug: 'Describe what went wrong, what you expected, and your device or browser if relevant…',
  math: 'Name the Trekker, Disc, or build and share the shown value vs. what you expected…',
  feature: 'Describe the workflow or tool improvement and how it would help you…',
  other: 'Write your question, note, or suggestion here…',
};

function FeedbackFromHydrator({
  onResolved,
}: {
  onResolved: (resolved: { sectionValue: string; exactPath: string | null }) => void;
}) {
  const searchParams = useSearchParams();
  const fromParam = searchParams.get('from');

  useEffect(() => {
    onResolved(resolveFeedbackFromPath(fromParam));
  }, [fromParam, onResolved]);

  return null;
}

export function FeedbackClient() {
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const hasManualSectionChangeRef = useRef(false);

  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [selectedSection, setSelectedSection] = useState('');
  const [hydratedExactPath, setHydratedExactPath] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [website, setWebsite] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedNote, setSubmittedNote] = useState<{
    id: string;
    category: FeedbackCategory;
    pageContext: string | null;
  } | null>(null);

  const handleFromResolved = useCallback(
    (resolved: { sectionValue: string; exactPath: string | null }) => {
      if (hasManualSectionChangeRef.current) return;
      setSelectedSection(resolved.sectionValue);
      setHydratedExactPath(resolved.exactPath);
    },
    []
  );

  const showDeepPathChip = Boolean(
    hydratedExactPath &&
      hydratedExactPath !== '/' &&
      hydratedExactPath !== selectedSection
  );

  const effectivePageContext =
    hydratedExactPath && hydratedExactPath !== '/'
      ? hydratedExactPath
      : selectedSection || null;

  const trimmedLength = message.trim().length;

  const handleSectionChange = (nextSection: string) => {
    hasManualSectionChangeRef.current = true;
    setSelectedSection(nextSection);
    setHydratedExactPath(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (trimmedLength < 10) {
      setErrorMsg('Please write at least 10 characters so we have enough detail.');
      messageRef.current?.focus();
      return;
    }
    if (trimmedLength > 2000) {
      setErrorMsg('Feedback details must be 2,000 characters or fewer.');
      messageRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          pageContext: effectivePageContext,
          message,
          contact: contact.trim() || null,
          website,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        error?: string;
      };

      if (!res.ok || !data.ok) {
        setErrorMsg(data.error || 'Could not send feedback. Please try again.');
        return;
      }

      setSubmittedNote({
        id: data.id || 'received',
        category,
        pageContext: effectivePageContext,
      });
    } catch {
      setErrorMsg('Network error while sending feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAfterSubmit = () => {
    setSubmittedNote(null);
    setMessage('');
    setErrorMsg(null);
    window.setTimeout(() => {
      messageRef.current?.focus();
    }, 20);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Suspense fallback={null}>
        <FeedbackFromHydrator onResolved={handleFromResolved} />
      </Suspense>

      <header className="space-y-1.5 border-b border-border-subtle pb-5">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Send Feedback
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Private note to the maintainer — nothing submitted here is shown publicly.
        </p>
      </header>

      <div className="game-card celestial-card p-5 sm:p-6">
        {submittedNote ? (
          <div role="status" className="space-y-4 py-2">
            <div className="flex items-start gap-3">
              <CheckCircle2
                className="size-5 text-teal-700 shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Thanks — your note has been received
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Logged under{' '}
                  <span className="font-semibold text-slate-800 dark:text-white/90">
                    {FEEDBACK_CATEGORY_LABELS[submittedNote.category]}
                  </span>
                  {submittedNote.pageContext ? (
                    <>
                      {' '}
                      for{' '}
                      <span className="font-mono text-xs text-slate-800 dark:text-white/90 break-all">
                        {submittedNote.pageContext}
                      </span>
                    </>
                  ) : null}
                  . Nothing you sent is displayed publicly.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <Lock className="size-3.5" aria-hidden="true" />
                <span>Private inbox only</span>
              </span>

              <button
                type="button"
                onClick={handleResetAfterSubmit}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-sm font-semibold text-slate-800 dark:text-white/90 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                Send another note
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {errorMsg && (
              <div
                id="feedback-form-error"
                role="alert"
                className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-sm font-semibold text-rose-800 flex items-center gap-2"
              >
                <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Category */}
            <div className="space-y-2">
              <span className="block text-sm font-semibold text-slate-800 dark:text-white/90">
                Category
              </span>
              <div
                role="group"
                aria-label="Feedback category"
                className="grid grid-cols-2 sm:grid-cols-4 gap-2"
              >
                {CATEGORIES.map((item) => {
                  const active = category === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setCategory(item);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      className={cn(
                        'min-h-10 px-3 py-2 rounded-lg border text-sm transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                        active
                          ? 'bg-teal-500/15 border-teal-600/50 text-teal-800 font-semibold'
                          : 'bg-surface-card border-border text-slate-700 dark:text-white/85 font-medium hover:bg-surface-hover hover:border-border-hover'
                      )}
                    >
                      {FEEDBACK_CATEGORY_LABELS[item]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Where on the site */}
            <div className="space-y-2">
              <label
                htmlFor="feedback-section-select"
                className="block text-sm font-semibold text-slate-800 dark:text-white/90"
              >
                Where on the site{' '}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  (optional)
                </span>
              </label>
              <div className="relative">
                <select
                  id="feedback-section-select"
                  name="section"
                  value={selectedSection}
                  onChange={(e) => handleSectionChange(e.target.value)}
                  className="w-full h-10 appearance-none rounded-lg border border-border hover:border-border-hover bg-white dark:bg-base pl-3 pr-9 text-sm text-slate-900 dark:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  {FEEDBACK_SITE_SECTIONS.map((sec) => (
                    <option key={sec.value || 'general'} value={sec.value}>
                      {sec.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="size-4 text-slate-500 dark:text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
              </div>

              {showDeepPathChip && hydratedExactPath && (
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-md border border-border bg-surface-subtle text-xs text-slate-700">
                    <span className="shrink-0">Page:</span>
                    <code className="font-mono text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {hydratedExactPath}
                    </code>
                    <button
                      type="button"
                      onClick={() => setHydratedExactPath(null)}
                      aria-label="Clear exact page context"
                      className="ml-0.5 rounded p-0.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  </span>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="feedback-message-input"
                  className="text-sm font-semibold text-slate-800 dark:text-white/90"
                >
                  Details
                </label>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    trimmedLength > 2000
                      ? 'text-rose-800 font-bold'
                      : 'text-slate-500 dark:text-slate-400'
                  )}
                >
                  {trimmedLength.toLocaleString('en-US')} / 2,000
                </span>
              </div>
              <textarea
                ref={messageRef}
                id="feedback-message-input"
                name="message"
                rows={5}
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                maxLength={2000}
                required
                aria-invalid={Boolean(errorMsg && (trimmedLength < 10 || trimmedLength > 2000))}
                aria-describedby={errorMsg ? 'feedback-form-error' : undefined}
                placeholder={CATEGORY_PLACEHOLDERS[category]}
                className="w-full rounded-lg border border-border hover:border-border-hover bg-white dark:bg-base px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 resize-y"
              />
            </div>

            {/* Contact */}
            <div className="space-y-2">
              <label
                htmlFor="feedback-contact-input"
                className="block text-sm font-semibold text-slate-800 dark:text-white/90"
              >
                Contact / handle{' '}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  (optional)
                </span>
              </label>
              <input
                id="feedback-contact-input"
                name="contact"
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={120}
                placeholder="Discord handle or email for follow-up"
                className="w-full h-10 rounded-lg border border-border hover:border-border-hover bg-white dark:bg-base px-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              />
            </div>

            {/* Honeypot */}
            <div className="sr-only" aria-hidden="true">
              <label htmlFor="feedback-website-input">Website</label>
              <input
                id="feedback-website-input"
                name="website"
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {/* Submit Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border-subtle">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Read only by the maintainer · no account needed</span>
              </span>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-60 border border-amber-600 text-sm font-semibold text-slate-950 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shrink-0"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    <span>Sending…</span>
                  </>
                ) : (
                  <>
                    <Send className="size-4" aria-hidden="true" />
                    <span>Send Feedback</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
