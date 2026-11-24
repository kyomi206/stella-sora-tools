'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowBigUp,
  BadgeCheck,
  Check,
  Edit3,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import charactersData from '@/data/characters.json';
import discsData from '@/data/discs.json';
import {
  COMMUNITY_MODE_LABELS,
  type CommunityPresetMode,
  type CommunityPresetTier,
} from '@/lib/community-presets';
import { unpackAdvancedPresetCode } from '@/lib/preset-code';
import { cn, compressAdvancedBuild } from '@/lib/utils';
import { getTrekkerImageUrl } from '@/lib/wikitide';
import type { SSCharacter, SSDisc } from '@/types';

type BuildStatus = 'live' | 'verified' | 'archived' | 'removed';
type AdminFilterTab = 'live' | 'verified' | 'removed' | 'all';

interface AdminBuildRow {
  id: string;
  status: BuildStatus;
  title: string;
  author_name: string;
  element: string;
  archetype: string;
  tier: CommunityPresetTier;
  modes: CommunityPresetMode[];
  summary: string;
  rotation: string[];
  adv_code: string;
  in_game_code: string | null;
  verified_patch: string;
  created_at: string;
  reviewed_at: string | null;
  views_count: number | string;
  upvotes_count: number | string;
}

const FILTER_TABS: ReadonlyArray<{ id: AdminFilterTab; label: string }> = [
  { id: 'live', label: 'Unreviewed' },
  { id: 'verified', label: 'Verified' },
  { id: 'removed', label: 'Removed' },
  { id: 'all', label: 'All' },
];

const MODE_OPTIONS: ReadonlyArray<{ value: CommunityPresetMode; label: string }> = [
  { value: 'general', label: COMMUNITY_MODE_LABELS.general },
  { value: 'boss-blitz', label: COMMUNITY_MODE_LABELS['boss-blitz'] },
  { value: 'cataclysm', label: COMMUNITY_MODE_LABELS.cataclysm },
];

const TIER_LABELS: Record<string, string> = {
  f2p: 'F2P',
  standard: 'Standard',
  premium: 'Premium',
};

function normalizeStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed)
        ? parsed.filter((v): v is string => typeof v === 'string')
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

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

export function AdminBuildsClient() {
  const characters = charactersData as Record<string, SSCharacter>;
  const discs = discsData as Record<string, SSDisc>;
  const editDialogRef = useRef<HTMLDialogElement | null>(null);
  const editPressedOutsideRef = useRef(false);

  const [authLoading, setAuthLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [authConfigured, setAuthConfigured] = useState(true);

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [builds, setBuilds] = useState<AdminBuildRow[]>([]);
  const [dbConfigured, setDbConfigured] = useState(true);
  const [buildsLoading, setBuildsLoading] = useState(false);
  const [buildsError, setBuildsError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminFilterTab>('live');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [editingBuild, setEditingBuild] = useState<AdminBuildRow | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editTier, setEditTier] = useState<CommunityPresetTier>('standard');
  const [editModes, setEditModes] = useState<CommunityPresetMode[]>(['general']);
  const [editSummary, setEditSummary] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const editNoteLines = useMemo(
    () =>
      editNotes
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    [editNotes]
  );

  const loadBuilds = useCallback(async () => {
    setBuildsLoading(true);
    setBuildsError(null);
    try {
      const res = await fetch('/api/admin/builds', { cache: 'no-store' });
      if (res.status === 401) {
        setAuthenticated(false);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        builds?: AdminBuildRow[];
        dbConfigured?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setBuildsError(data.error || 'Failed to load builds.');
        return;
      }
      setDbConfigured(data.dbConfigured !== false);
      setBuilds(Array.isArray(data.builds) ? data.builds : []);
    } catch {
      setBuildsError('Network error while loading builds.');
    } finally {
      setBuildsLoading(false);
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
          void loadBuilds();
        }
      })
      .catch(() => {
        if (cancelled) return;
        setAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadBuilds]);

  // Synchronize native <dialog> for Edit Build Metadata
  useEffect(() => {
    const dialog = editDialogRef.current;
    if (!dialog) return;

    if (editingBuild) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [editingBuild]);

  // Progressive-enhancement click-outside fallback when closedby="any" is unsupported
  useEffect(() => {
    const dialog = editDialogRef.current;
    if (!dialog || !editingBuild) return;
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
      editPressedOutsideRef.current = isOutside(e);
    };
    const onPointerUp = (e: PointerEvent) => {
      if (editPressedOutsideRef.current && isOutside(e)) {
        dialog.close();
      }
      editPressedOutsideRef.current = false;
    };

    dialog.addEventListener('pointerdown', onPointerDown);
    dialog.addEventListener('pointerup', onPointerUp);
    return () => {
      dialog.removeEventListener('pointerdown', onPointerDown);
      dialog.removeEventListener('pointerup', onPointerUp);
    };
  }, [editingBuild]);

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
      await loadBuilds();
    } catch {
      setLoginError('Network error while signing in.');
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' }).catch(() => null);
    setAuthenticated(false);
    setBuilds([]);
  };

  const handleStatusChange = async (id: string, nextStatus: BuildStatus) => {
    setBusyId(id);
    setBuildsError(null);
    try {
      const res = await fetch(`/api/admin/builds/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        build?: Partial<AdminBuildRow>;
        error?: string;
      };
      if (!res.ok) {
        setBuildsError(data.error || 'Failed to update build status.');
        return;
      }
      setBuilds((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                status: nextStatus,
                reviewed_at: (data.build?.reviewed_at as string) || new Date().toISOString(),
              }
            : row
        )
      );
    } catch {
      setBuildsError('Network error while updating status.');
    } finally {
      setBusyId(null);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    setBusyId(id);
    setBuildsError(null);
    try {
      const res = await fetch(`/api/admin/builds/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setBuildsError(data.error || 'Failed to delete build.');
        return;
      }
      setBuilds((prev) => prev.filter((row) => row.id !== id));
      setConfirmDeleteId(null);
    } catch {
      setBuildsError('Network error while deleting build.');
    } finally {
      setBusyId(null);
    }
  };

  const openEditModal = (row: AdminBuildRow) => {
    const parsedModes = normalizeStringArray(row.modes).filter((m): m is CommunityPresetMode =>
      m === 'general' || m === 'boss-blitz' || m === 'cataclysm'
    );
    const parsedNotes = normalizeStringArray(row.rotation);

    setEditingBuild(row);
    setEditTitle(row.title);
    setEditAuthor(row.author_name || '');
    setEditTier(row.tier || 'standard');
    setEditModes(parsedModes.length > 0 ? parsedModes : ['general']);
    setEditSummary(row.summary || '');
    setEditNotes(parsedNotes.join('\n'));
    setEditError(null);
  };

  const toggleEditMode = (mode: CommunityPresetMode) => {
    setEditError(null);
    setEditModes((prev) =>
      prev.includes(mode)
        ? prev.filter((m) => m !== mode)
        : prev.length < 3
          ? [...prev, mode]
          : prev
    );
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBuild) return;
    setEditError(null);
    const trimmedTitle = editTitle.trim();
    if (trimmedTitle.length < 4 || trimmedTitle.length > 60) {
      setEditError('Title must be between 4 and 60 characters.');
      return;
    }
    if (editModes.length === 0) {
      setEditError('Select at least one game mode.');
      return;
    }
    if (editNoteLines.length > 8) {
      setEditError('Keep author notes to 8 lines or fewer.');
      return;
    }
    if (editNoteLines.some((line) => line.length > 160)) {
      setEditError('Each author note line must be 160 characters or fewer.');
      return;
    }

    setEditSaving(true);
    try {
      const res = await fetch(
        `/api/admin/builds/${encodeURIComponent(editingBuild.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: trimmedTitle,
            author_name: editAuthor.trim(),
            tier: editTier,
            modes: editModes,
            summary: editSummary.trim(),
            rotation: editNoteLines,
          }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        build?: AdminBuildRow;
        error?: string;
      };
      if (!res.ok || !data.build) {
        setEditError(data.error || 'Failed to save changes.');
        return;
      }

      setBuilds((prev) =>
        prev.map((row) =>
          row.id === editingBuild.id
            ? { ...row, ...data.build }
            : row
        )
      );
      setEditingBuild(null);
    } catch {
      setEditError('Network error while saving edits.');
    } finally {
      setEditSaving(false);
    }
  };

  const tabCounts = useMemo(() => {
    let live = 0;
    let verified = 0;
    let removed = 0;
    for (const b of builds) {
      if (b.status === 'live') live++;
      else if (b.status === 'verified') verified++;
      else removed++;
    }
    return { live, verified, removed, all: builds.length };
  }, [builds]);

  const filteredBuilds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return builds.filter((b) => {
      if (activeTab === 'removed') {
        if (b.status !== 'removed' && b.status !== 'archived') return false;
      } else if (activeTab !== 'all' && b.status !== activeTab) {
        return false;
      }
      if (!q) return true;
      return (
        b.title.toLowerCase().includes(q) ||
        (b.author_name || '').toLowerCase().includes(q) ||
        b.element.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q)
      );
    });
  }, [builds, activeTab, searchQuery]);

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
                Admin Build Review
              </h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Sign in with your admin password to verify, edit, or moderate submissions.
            </p>
          </div>

          {!authConfigured && (
            <div
              role="status"
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700"
            >
              <strong>ADMIN_SECRET</strong> is not configured in the server environment.
            </div>
          )}

          {loginError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-sm font-semibold text-rose-700 flex items-center gap-2"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-3.5">
            <div className="space-y-1.5">
              <label
                htmlFor="admin-password-input"
                className="text-sm font-semibold text-slate-800 dark:text-white/90"
              >
                Admin Password
              </label>
              <div className="relative">
                <input
                  id="admin-password-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (loginError) setLoginError(null);
                  }}
                  autoComplete="current-password"
                  placeholder="Enter ADMIN_SECRET"
                  className="w-full h-10 rounded-lg border border-border bg-base pl-3 pr-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
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
          <ShieldCheck className="size-5 text-teal-700 shrink-0" aria-hidden="true" />
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Community Build Moderation
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <nav
            aria-label="Admin sections"
            className="inline-flex items-center gap-1 p-1 rounded-xl border border-border bg-surface-subtle"
          >
            <Link
              href="/admin/builds"
              aria-current="page"
              className="px-3 py-1 rounded-lg border border-border-subtle bg-surface-card text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Builds
            </Link>
            <Link
              href="/admin/feedback"
              className="px-3 py-1 rounded-lg border border-transparent text-xs font-semibold text-slate-700 dark:text-white/80 hover:bg-surface-hover transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              Feedback
            </Link>
          </nav>

          <button
            type="button"
            onClick={() => void loadBuilds()}
            disabled={buildsLoading}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <RefreshCw className={cn('size-3.5', buildsLoading && 'animate-spin')} aria-hidden="true" />
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
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-700"
        >
          <strong>DATABASE_URL</strong> is not configured. Connect Neon Postgres to view and moderate submitted builds.
        </div>
      )}

      {buildsError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs font-semibold text-rose-700 flex items-center gap-2"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>{buildsError}</span>
        </div>
      )}

      {/* Queue Controls: Status Filter Tabs + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Filter submissions by review status"
          className="flex flex-wrap items-center gap-1 p-1 rounded-xl border border-border bg-surface-subtle w-fit"
        >
          {FILTER_TABS.map((tab) => {
            const active = activeTab === tab.id;
            const count = tabCounts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTab(tab.id)}
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

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search
            className="size-3.5 text-slate-500 dark:text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search title, author, element…"
            aria-label="Search moderation queue"
            className="w-full rounded-lg border border-border bg-surface-card pl-8.5 pr-8 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center rounded text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Build Rows */}
      {buildsLoading && builds.length === 0 ? (
        <div className="game-card celestial-card p-8 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>Loading submissions…</span>
        </div>
      ) : filteredBuilds.length === 0 ? (
        <div className="game-card celestial-card p-10 text-center text-sm text-slate-600 dark:text-slate-400">
          {searchQuery.trim() ? 'No matching builds found.' : 'No builds in this queue.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBuilds.map((row) => {
            const unpacked = unpackAdvancedPresetCode(row.adv_code, characters, discs);
            const trekkers = unpacked
              ? (['vanguard', 'versatile', 'support'] as const)
                  .map((s) => unpacked.slots[s]?.characterId)
                  .map((cid) => (cid ? characters[String(cid)] || null : null))
              : [null, null, null];

            const rowModes = normalizeStringArray(row.modes) as CommunityPresetMode[];
            const damageHref = unpacked
              ? `/damage?b=${encodeURIComponent(
                  compressAdvancedBuild({
                    id: row.id,
                    name: row.title,
                    createdAt: 0,
                    slots: unpacked.slots,
                    mainDiscs: unpacked.mainDiscs,
                    supportDiscs: unpacked.supportDiscs,
                    targetNotes: unpacked.targetNotes,
                  })
                )}`
              : null;

            const isBusy = busyId === row.id;
            const isConfirmDelete = confirmDeleteId === row.id;

            return (
              <article
                key={row.id}
                className="game-card celestial-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex items-center gap-1 shrink-0 pt-0.5">
                    {trekkers.map((ch, idx) =>
                      ch ? (
                        <img
                          key={ch.id}
                          src={getTrekkerImageUrl(ch.id)}
                          alt={ch.name.EN}
                          width={36}
                          height={36}
                          className={cn(
                            'size-9 rounded-lg object-cover object-top border',
                            idx === 0 ? 'border-amber-500/70' : 'border-border'
                          )}
                        />
                      ) : (
                        <div
                          key={`empty-${idx}`}
                          className="size-9 rounded-lg border border-dashed border-border bg-surface-subtle"
                        />
                      )
                    )}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <img
                        src={`/ss-element/${row.element}.webp`}
                        alt={row.element}
                        width={16}
                        height={16}
                        className="size-4 object-contain shrink-0"
                      />
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white break-words">
                        {row.title}
                      </h2>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold shrink-0',
                          row.status === 'verified'
                            ? 'border-teal-500/40 bg-teal-500/10 text-teal-700'
                            : row.status === 'live'
                              ? 'border-amber-500/40 bg-amber-500/10 text-amber-700'
                              : 'border-rose-500/40 bg-rose-500/10 text-rose-700'
                        )}
                      >
                        {row.status === 'verified' && <BadgeCheck className="size-3" aria-hidden="true" />}
                        <span className="capitalize">{row.status}</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-white/85">
                        by {row.author_name || 'Anonymous'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{TIER_LABELS[row.tier] || row.tier}</span>
                      {rowModes.length > 0 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {rowModes.map((m) => COMMUNITY_MODE_LABELS[m] || m).join(', ')}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatDateTime(row.created_at)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums text-teal-700 font-semibold">
                        <Eye className="size-3.5" aria-hidden="true" />
                        {Number(row.views_count || 0)}
                      </span>
                      <span className="inline-flex items-center gap-1 tabular-nums text-amber-700 font-semibold">
                        <ArrowBigUp className="size-3.5" aria-hidden="true" />
                        {Number(row.upvotes_count || 0)}
                      </span>
                    </div>

                    {row.summary && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 break-words">
                        {row.summary}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {(row.status === 'live' || row.status === 'verified') && (
                    <Link
                      href={`/builds/${encodeURIComponent(row.id)}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors press-feedback"
                    >
                      <span>View</span>
                      <ExternalLink className="size-3" aria-hidden="true" />
                    </Link>
                  )}

                  {damageHref && (
                    <Link
                      href={damageHref}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors press-feedback"
                    >
                      <span>Damage Calc</span>
                    </Link>
                  )}

                  {row.status !== 'verified' ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleStatusChange(row.id, 'verified')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-teal-500/50 bg-teal-500/15 hover:bg-teal-500/25 disabled:opacity-50 text-xs font-bold text-teal-700 transition-colors cursor-pointer press-feedback"
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      <span>Verify</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleStatusChange(row.id, 'live')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover disabled:opacity-50 text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback"
                    >
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      <span>Unverify</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => openEditModal(row)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover disabled:opacity-50 text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback"
                  >
                    <Edit3 className="size-3.5" aria-hidden="true" />
                    <span>Edit</span>
                  </button>

                  {row.status !== 'removed' && row.status !== 'archived' ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleStatusChange(row.id, 'removed')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-50 text-xs font-semibold text-rose-700 transition-colors cursor-pointer press-feedback"
                    >
                      <EyeOff className="size-3.5" aria-hidden="true" />
                      <span>Hide</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleStatusChange(row.id, 'live')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover disabled:opacity-50 text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback"
                    >
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      <span>Restore</span>
                    </button>
                  )}

                  {isConfirmDelete ? (
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handlePermanentDelete(row.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#be123c] hover:bg-[#e11d48] disabled:opacity-50 text-xs font-bold text-white transition-colors cursor-pointer press-feedback"
                      >
                        <span>Confirm Delete</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1.5 rounded-lg border border-border text-xs font-semibold text-slate-700 dark:text-white/85 cursor-pointer"
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
                      aria-label={`Delete ${row.title} permanently`}
                      className="inline-flex items-center justify-center p-1.5 rounded-lg border border-border bg-surface-card hover:bg-rose-500/10 hover:border-rose-500/40 text-slate-600 dark:text-slate-400 hover:text-rose-700 transition-colors cursor-pointer press-feedback"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Edit Metadata Native Modal Dialog */}
      <dialog
        ref={editDialogRef}
        aria-labelledby="admin-edit-title"
        onClose={() => {
          if (editingBuild) setEditingBuild(null);
        }}
        {...({ closedby: 'any' } as Record<string, string>)}
        className="m-auto p-0 w-[calc(100%-1.5rem)] max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface-card text-inherit shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id="admin-edit-title" className="text-base font-bold text-slate-900 dark:text-white">
            Edit Build Metadata
          </h2>
          <button
            type="button"
            onClick={() => setEditingBuild(null)}
            aria-label="Close edit modal"
            className="size-8 flex items-center justify-center rounded-lg text-slate-600 dark:text-slate-400 hover:bg-surface-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSaveEdit} noValidate className="p-5 space-y-3.5">
          {editError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700"
            >
              {editError}
            </div>
          )}

          <div className="space-y-1">
            <label
              htmlFor="admin-edit-title-input"
              className="text-xs font-bold text-slate-700 dark:text-white/90"
            >
              Title
            </label>
            <input
              id="admin-edit-title-input"
              name="title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={60}
              className="w-full rounded-lg border border-border bg-base px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="admin-edit-author-input"
                className="text-xs font-bold text-slate-700 dark:text-white/90"
              >
                Author
              </label>
              <input
                id="admin-edit-author-input"
                name="author"
                type="text"
                value={editAuthor}
                onChange={(e) => setEditAuthor(e.target.value)}
                maxLength={30}
                className="w-full rounded-lg border border-border bg-base px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="admin-edit-tier-select"
                className="text-xs font-bold text-slate-700 dark:text-white/90"
              >
                Tier
              </label>
              <select
                id="admin-edit-tier-select"
                name="tier"
                value={editTier}
                onChange={(e) => setEditTier(e.target.value as CommunityPresetTier)}
                className="w-full rounded-lg border border-border bg-base px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <option value="f2p">F2P</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-bold text-slate-700 dark:text-white/90">
              Modes
            </span>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Game modes">
              {MODE_OPTIONS.map((opt) => {
                const active = editModes.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleEditMode(opt.value)}
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

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="admin-edit-summary-input"
                className="text-xs font-bold text-slate-700 dark:text-white/90"
              >
                Summary
              </label>
              <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {editSummary.length}/280
              </span>
            </div>
            <textarea
              id="admin-edit-summary-input"
              name="summary"
              rows={2}
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              maxLength={280}
              className="w-full rounded-lg border border-border bg-base px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 resize-y"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="admin-edit-notes-input"
                className="text-xs font-bold text-slate-700 dark:text-white/90"
              >
                Author Notes
              </label>
              <span
                className={cn(
                  'text-xs tabular-nums',
                  editNoteLines.length > 8
                    ? 'text-rose-700 font-bold'
                    : 'text-slate-500 dark:text-slate-400'
                )}
              >
                {editNoteLines.length}/8 lines
              </span>
            </div>
            <textarea
              id="admin-edit-notes-input"
              name="authorNotes"
              rows={3}
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="One note per line"
              className="w-full rounded-lg border border-border bg-base px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 resize-y"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <button
              type="button"
              onClick={() => setEditingBuild(null)}
              className="px-3.5 py-2 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 border border-amber-600 text-xs font-bold text-slate-950 cursor-pointer press-feedback"
            >
              {editSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
