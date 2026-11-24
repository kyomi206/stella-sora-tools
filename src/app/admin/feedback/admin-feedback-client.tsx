'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
  type FeedbackStatus,
} from '@/lib/feedback/validation';
import { cn } from '@/lib/utils';

type StatusTab = 'open' | 'resolved' | 'all';
type CategoryFilter = 'all' | FeedbackCategory;

interface AdminFeedbackRow {
  id: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  page_context: string | null;
  message: string;
  contact: string | null;
  created_at: string;
  resolved_at: string | null;
}

const STATUS_TABS: ReadonlyArray<{ id: StatusTab; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'all', label: 'All' },
];

const CATEGORY_FILTERS: ReadonlyArray<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'All Categories' },
  { id: 'bug', label: FEEDBACK_CATEGORY_LABELS.bug },
  { id: 'math', label: FEEDBACK_CATEGORY_LABELS.math },
  { id: 'feature', label: FEEDBACK_CATEGORY_LABELS.feature },
  { id: 'other', label: FEEDBACK_CATEGORY_LABELS.other },
];

const CATEGORY_BADGE_CLASSES: Record<FeedbackCategory, string> = {
  bug: 'border-rose-500/40 bg-rose-500/10 text-rose-800',
  math: 'border-sky-500/40 bg-sky-500/10 text-sky-800',
  feature: 'border-teal-500/40 bg-teal-500/10 text-teal-800',
  other: 'border-border bg-surface-subtle text-slate-700',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isSafeInternalPath(path: string | null): path is string {
  return Boolean(path && /^\/(?!\/)/.test(path));
}

export function AdminFeedbackClient() {
  const [authLoading, setAuthLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(true);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [items, setItems] = useState<AdminFeedbackRow[]>([]);
  const [dbConfigured, setDbConfigured] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const [activeStatus, setActiveStatus] = useState<StatusTab>('open');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadFeedback = useCallback(async () => {
    setItemsLoading(true);
    setItemsError(null);
    try {
      const res = await fetch('/api/admin/feedback', { cache: 'no-store' });
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        items?: AdminFeedbackRow[];
        dbConfigured?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setItemsError(data.error || 'Failed to load feedback inbox.');
        return;
      }
      setDbConfigured(data.dbConfigured !== false);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItemsError('Network error while loading feedback.');
    } finally {
      setItemsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/admin/auth', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data: { authenticated?: boolean; configured?: boolean }) => {
        if (cancelled) return;
        setAuthConfigured(data.configured !== false);
        const authed = Boolean(data.authenticated);
        setAuthenticated(authed);
        setAuthLoading(false);
        if (authed) {
          void loadFeedback();
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadFeedback]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!password) {
      setLoginError('Enter the admin password.');
      return;
    }

    setLoginBusy(true);
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        authenticated?: boolean;
        error?: string;
      };
      if (!res.ok || !data.authenticated) {
        setLoginError(data.error || 'Authentication failed.');
        return;
      }
      setPassword('');
      setShowPassword(false);
      setAuthenticated(true);
      await loadFeedback();
    } catch {
      setLoginError('Network error while signing in.');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' }).catch(() => null);
    setAuthenticated(false);
    setItems([]);
  };

  const handleStatusChange = async (id: string, nextStatus: FeedbackStatus) => {
    setBusyId(id);
    setItemsError(null);
    try {
      const res = await fetch(`/api/admin/feedback/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        status?: FeedbackStatus;
        resolved_at?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setItemsError(data.error || 'Failed to update feedback status.');
        return;
      }
      setItems((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                status: data.status || nextStatus,
                resolved_at:
                  data.resolved_at !== undefined
                    ? data.resolved_at
                    : nextStatus === 'resolved'
                      ? new Date().toISOString()
                      : null,
              }
            : row
        )
      );
    } catch {
      setItemsError('Network error while updating feedback status.');
    } finally {
      setBusyId(null);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    setBusyId(id);
    setItemsError(null);
    try {
      const res = await fetch(`/api/admin/feedback/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setItemsError(data.error || 'Failed to delete feedback item.');
        return;
      }
      setItems((prev) => prev.filter((row) => row.id !== id));
      setConfirmDeleteId(null);
    } catch {
      setItemsError('Network error while deleting feedback item.');
    } finally {
      setBusyId(null);
    }
  };

  const tabCounts = useMemo(() => {
    let open = 0;
    let resolved = 0;
    for (const row of items) {
      if (row.status === 'resolved') resolved++;
      else open++;
    }
    return { open, resolved, all: items.length };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((row) => {
      if (activeStatus !== 'all' && row.status !== activeStatus) return false;
      if (activeCategory !== 'all' && row.category !== activeCategory) return false;
      if (!q) return true;
      return (
        row.message.toLowerCase().includes(q) ||
        (row.page_context || '').toLowerCase().includes(q) ||
        (row.contact || '').toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q)
      );
    });
  }, [items, activeStatus, activeCategory, searchQuery]);

  if (authLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="game-card celestial-card p-8 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>Checking admin session…</span>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="game-card celestial-card p-6 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Lock className="size-4.5 text-slate-600 dark:text-slate-400 shrink-0" aria-hidden="true" />
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Admin Feedback Inbox
              </h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Sign in with your admin password to review and resolve private visitor feedback.
            </p>
          </div>

          {!authConfigured && (
            <div
              role="status"
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800"
            >
              <strong>ADMIN_SECRET</strong> is not configured in the server environment.
            </div>
          )}

          {loginError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-sm font-semibold text-rose-800 flex items-center gap-2"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-feedback-password-input"
                className="text-sm font-semibold text-slate-800 dark:text-white/90"
              >
                Admin Password
              </label>
              <div className="relative">
                <input
                  id="admin-feedback-password-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (loginError) setLoginError(null);
                  }}
                  autoComplete="current-password"
                  placeholder="Enter ADMIN_SECRET"
                  className="w-full h-10 rounded-lg border border-border bg-base pl-3 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                />
                <button
                  type="button"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded-md text-slate-500 dark:text-slate-400 hover:bg-surface-hover hover:text-slate-900 dark:hover:text-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginBusy || !authConfigured}
              className="w-full h-10 inline-flex items-center justify-center gap-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 border border-amber-600 text-sm font-semibold text-slate-950 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              {loginBusy ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  <span>Signing In…</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="size-5 text-teal-700 shrink-0" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Feedback Inbox
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav
            aria-label="Admin sections"
            className="inline-flex items-center gap-1 p-1 rounded-xl border border-border bg-surface-subtle"
          >
            <Link
              href="/admin/builds"
              className="px-3 py-1 rounded-lg border border-transparent text-xs font-semibold text-slate-700 dark:text-white/80 hover:bg-surface-hover transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Builds
            </Link>
            <Link
              href="/admin/feedback"
              aria-current="page"
              className="px-3 py-1 rounded-lg border border-border-subtle bg-surface-card text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Feedback
            </Link>
          </nav>

          <button
            type="button"
            onClick={() => void loadFeedback()}
            disabled={itemsLoading}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <RefreshCw className={cn('size-3.5', itemsLoading && 'animate-spin')} aria-hidden="true" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <LogOut className="size-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {!dbConfigured && (
        <div
          role="status"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-800"
        >
          <strong>DATABASE_URL</strong> is not configured. Feedback inbox requires Postgres to store and view submissions.
        </div>
      )}

      {itemsError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-800 flex items-center gap-2"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>{itemsError}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Feedback status filter"
            className="flex flex-wrap items-center gap-1 p-1 rounded-xl border border-border bg-surface-subtle w-fit"
          >
            {STATUS_TABS.map((tab) => {
              const active = activeStatus === tab.id;
              const count = tabCounts[tab.id];
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveStatus(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                    active
                      ? 'bg-surface-card text-slate-900 dark:text-white font-bold border-border-subtle'
                      : 'border-transparent text-slate-700 dark:text-white/80 font-semibold hover:bg-surface-hover'
                  )}
                >
                  <span>{tab.label}</span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="relative flex-1 min-w-[220px] max-w-xs">
            <Search
              className="size-3.5 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search details, page, contact…"
              aria-label="Search feedback inbox"
              className="w-full rounded-lg border border-border bg-surface-card pl-8.5 pr-8 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div
          role="group"
          aria-label="Filter by category"
          className="flex flex-nowrap sm:flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0"
        >
          {CATEGORY_FILTERS.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'px-2.5 py-1 rounded-lg border text-xs whitespace-nowrap shrink-0 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                  active
                    ? 'bg-teal-500/15 border-teal-600/50 text-teal-800 font-bold'
                    : 'bg-surface-card border-border text-slate-700 dark:text-white/85 font-semibold hover:bg-surface-hover'
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feedback Rows */}
      {itemsLoading && items.length === 0 ? (
        <div className="game-card celestial-card p-8 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>Loading feedback…</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="game-card celestial-card p-10 text-center text-sm text-slate-600 dark:text-slate-400">
          {searchQuery.trim() || activeCategory !== 'all'
            ? 'No matching feedback found.'
            : activeStatus === 'open'
              ? 'No open feedback right now.'
              : activeStatus === 'resolved'
                ? 'No resolved feedback yet.'
                : 'No feedback submissions yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((row) => {
            const isBusy = busyId === row.id;
            const isConfirmDelete = confirmDeleteId === row.id;
            const categoryLabel = FEEDBACK_CATEGORY_LABELS[row.category] || row.category;

            return (
              <article
                key={row.id}
                className="game-card celestial-card p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold shrink-0',
                        CATEGORY_BADGE_CLASSES[row.category]
                      )}
                    >
                      {categoryLabel}
                    </span>

                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-bold capitalize shrink-0',
                        row.status === 'resolved'
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800'
                          : 'border-amber-500/40 bg-amber-500/10 text-amber-800'
                      )}
                    >
                      {row.status}
                    </span>

                    {isSafeInternalPath(row.page_context) ? (
                      <Link
                        href={row.page_context}
                        title={row.page_context}
                        className="inline-flex items-center gap-1 max-w-[230px] sm:max-w-sm px-2 py-0.5 rounded-md border border-border bg-surface-subtle hover:bg-surface-hover text-xs font-mono text-slate-800 dark:text-white/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <span className="truncate">{row.page_context}</span>
                        <ExternalLink className="size-3 text-slate-500 dark:text-slate-400 shrink-0" aria-hidden="true" />
                      </Link>
                    ) : row.page_context ? (
                      <span
                        title={row.page_context}
                        className="inline-flex items-center max-w-[230px] sm:max-w-sm px-2 py-0.5 rounded-md border border-border bg-surface-subtle text-xs text-slate-700 truncate"
                      >
                        {row.page_context}
                      </span>
                    ) : null}

                    {row.contact && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border bg-surface-subtle text-xs text-slate-700">
                        <User className="size-3 text-slate-500 dark:text-slate-400" aria-hidden="true" />
                        <span>{row.contact}</span>
                      </span>
                    )}
                  </div>

                  <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
                    {formatDateTime(row.created_at)}
                    {row.status === 'resolved' && row.resolved_at
                      ? ` · Resolved ${formatDateTime(row.resolved_at)}`
                      : ''}
                  </span>
                </div>

                <p className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap break-words leading-relaxed">
                  {row.message}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle">
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {row.id}
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {row.status === 'open' ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleStatusChange(row.id, 'resolved')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-teal-500/50 bg-teal-500/15 hover:bg-teal-500/25 disabled:opacity-50 text-xs font-bold text-teal-800 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <Check className="size-3.5" aria-hidden="true" />
                        <span>Mark Resolved</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleStatusChange(row.id, 'open')}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover disabled:opacity-50 text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                        <span>Reopen</span>
                      </button>
                    )}

                    {isConfirmDelete ? (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handlePermanentDelete(row.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#be123c] hover:bg-[#e11d48] disabled:opacity-50 text-xs font-bold text-white transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          <span>Confirm Delete</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1.5 rounded-lg border border-border text-xs font-semibold text-slate-700 dark:text-white/85 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setConfirmDeleteId(row.id)}
                        title="Delete permanently"
                        aria-label={`Delete feedback ${row.id} permanently`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-rose-500/10 hover:border-rose-500/40 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-rose-800 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
