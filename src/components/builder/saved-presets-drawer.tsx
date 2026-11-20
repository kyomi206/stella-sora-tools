'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bookmark,
  BookmarkPlus,
  Check,
  Copy,
  Disc,
  Download,
  Edit3,
  KeyRound,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import discsData from '@/data/discs.json';
import { getDiscOutfitIconUrl } from '@/data/notes';
import { type AdvancedPresetData, unpackAdvancedPresetCode } from '@/lib/preset-code';
import {
  deleteSavedPreset,
  duplicateSavedPreset,
  hasAnyBuildContent,
  loadSavedPresetsFromStorage,
  MAX_BACKUP_JSON_LENGTH,
  MAX_PRESET_NAME_LENGTH,
  parsePresetsBackup,
  renameSavedPreset,
  saveDraftBuildToStorage,
  savePresetsToStorage,
  serializePresetsBackup,
  upsertSavedPreset,
  type BuildContentInput,
  type SavedPresetMode,
  type SavedPresetRecord,
} from '@/lib/saved-presets';
import { useOverlayExit } from '@/lib/use-overlay-exit';
import { cn } from '@/lib/utils';
import { getTrekkerImageUrl } from '@/lib/wikitide';
import type { SSCharacter, SSDisc, SlotType, TeamBuild } from '@/types';

export interface SavedPresetsControlProps {
  mode: SavedPresetMode;
  buildId: string;
  buildName: string;
  slots: TeamBuild['slots'];
  advancedData?: Omit<AdvancedPresetData, 'slots'>;
  characters: Record<string, SSCharacter>;
  discs?: Record<string, SSDisc>;
  onLoadPreset: (payload: {
    id: string;
    name: string;
    data: AdvancedPresetData;
  }) => void;
  onPresetSaved?: (record: SavedPresetRecord) => void;
}

const SLOT_LABELS: ReadonlyArray<{
  key: SlotType;
  label: string;
  badgeClass: string;
}> = [
  {
    key: 'vanguard',
    label: 'Vanguard',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  },
  {
    key: 'versatile',
    label: 'Support',
    badgeClass: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  },
  {
    key: 'support',
    label: 'Support',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
];

function formatSavedTimestamp(ts: number): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ts));
  } catch {
    return '';
  }
}

export function useDebouncedDraftSave(
  mode: SavedPresetMode,
  build: BuildContentInput & { id: string; name: string },
  isDraftReady: boolean
) {
  const latestBuildRef = useRef(build);
  latestBuildRef.current = build;
  const isDraftReadyRef = useRef(isDraftReady);
  isDraftReadyRef.current = isDraftReady;

  useEffect(() => {
    if (!isDraftReady) return;
    const timer = window.setTimeout(() => {
      saveDraftBuildToStorage(mode, build);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [mode, build, isDraftReady]);

  useEffect(() => {
    const flushDraft = () => {
      if (isDraftReadyRef.current) {
        saveDraftBuildToStorage(mode, latestBuildRef.current);
      }
    };
    window.addEventListener('pagehide', flushDraft);
    return () => {
      window.removeEventListener('pagehide', flushDraft);
      flushDraft();
    };
  }, [mode]);
}

export function SavedPresetsControl({
  mode,
  buildId,
  buildName,
  slots,
  advancedData,
  characters,
  discs: externalDiscs,
  onLoadPreset,
  onPresetSaved,
}: SavedPresetsControlProps) {
  const allDiscs = useMemo(
    () => (externalDiscs || discsData) as Record<string, SSDisc>,
    [externalDiscs]
  );

  const [presets, setPresets] = useState<SavedPresetRecord[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [quickSaved, setQuickSaved] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const quickSavedTimerRef = useRef<number | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const lastToggledIdRef = useRef<string | null>(null);

  // Hydrate client bookmarks strictly after mount so SSR HTML matches initial client render.
  useEffect(() => {
    setPresets(loadSavedPresetsFromStorage());
  }, []);

  useEffect(
    () => () => {
      if (quickSavedTimerRef.current) window.clearTimeout(quickSavedTimerRef.current);
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current);
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    },
    []
  );

  const { requestClose, isClosing } = useOverlayExit(() => {
    setIsOpen(false);
    setRenamingId(null);
    setConfirmDeleteId(null);
    setSelectedIds(new Set());
    setConfirmBatchDelete(false);
    lastToggledIdRef.current = null;
    setFeedback(null);
    openerRef.current?.focus();
  }, isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const rafId = window.requestAnimationFrame(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      } else {
        dialogRef.current?.focus();
      }
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (renamingId) {
          setRenamingId(null);
          return;
        }
        if (confirmDeleteId) {
          setConfirmDeleteId(null);
          return;
        }
        if (confirmBatchDelete) {
          setConfirmBatchDelete(false);
          return;
        }
        requestClose();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), a[href], input:not([disabled]):not([type="hidden"]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (!active || !dialogRef.current.contains(active)) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
          return;
        }

        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, renamingId, confirmDeleteId, confirmBatchDelete, requestClose]);

  const hasCurrentContent = useMemo(
    () =>
      hasAnyBuildContent({
        slots,
        mainDiscs: advancedData?.mainDiscs,
        supportDiscs: advancedData?.supportDiscs,
        targetNotes: advancedData?.targetNotes,
      }),
    [slots, advancedData]
  );

  const activeSavedRecord = useMemo(
    () => presets.find((item) => item.id === buildId) || null,
    [presets, buildId]
  );

  const showFeedback = (kind: 'success' | 'error', text: string) => {
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    setFeedback({ kind, text });
    feedbackTimerRef.current = window.setTimeout(() => {
      feedbackTimerRef.current = null;
      setFeedback((prev) => (prev?.text === text ? null : prev));
    }, 3200);
  };

  const persistList = (nextList: SavedPresetRecord[]): boolean => {
    setPresets(nextList);
    const saved = savePresetsToStorage(nextList);
    if (!saved) {
      showFeedback(
        'error',
        'Browser storage is full or unavailable. Export a JSON backup to free space.'
      );
    }
    return saved;
  };

  const handleSaveBuild = (forceNew = false) => {
    const result = upsertSavedPreset(presets, {
      id: buildId,
      name: buildName,
      mode,
      slots,
      mainDiscs: advancedData?.mainDiscs,
      supportDiscs: advancedData?.supportDiscs,
      targetNotes: advancedData?.targetNotes,
      forceNew,
    });
    if (!result) return;

    const saved = persistList(result.list);
    onPresetSaved?.(result.record);

    if (quickSavedTimerRef.current) {
      window.clearTimeout(quickSavedTimerRef.current);
    }
    setQuickSaved(true);
    quickSavedTimerRef.current = window.setTimeout(() => {
      quickSavedTimerRef.current = null;
      setQuickSaved(false);
    }, 1800);

    if (isOpen && saved) {
      showFeedback(
        'success',
        forceNew
          ? `Saved copy "${result.record.name}".`
          : `Saved "${result.record.name}".`
      );
    }
  };

  const handleCopyInGameCode = async (record: SavedPresetRecord) => {
    if (!record.inGameCode) return;
    try {
      await navigator.clipboard.writeText(record.inGameCode);
      if (copiedTimerRef.current) {
        window.clearTimeout(copiedTimerRef.current);
      }
      setCopiedId(record.id);
      copiedTimerRef.current = window.setTimeout(() => {
        copiedTimerRef.current = null;
        setCopiedId((prev) => (prev === record.id ? null : prev));
      }, 1800);
    } catch {
      showFeedback('error', 'Clipboard write failed.');
    }
  };

  const handleStartRename = (record: SavedPresetRecord) => {
    setRenamingId(record.id);
    setRenameDraft(record.name);
    setConfirmDeleteId(null);
  };

  const handleCommitRename = (id: string) => {
    const nextList = renameSavedPreset(presets, id, renameDraft);
    if (nextList !== presets) {
      persistList(nextList);
      if (id === buildId) {
        const updated = nextList.find((item) => item.id === id);
        if (updated) onPresetSaved?.(updated);
      }
    }
    setRenamingId(null);
  };

  const handleDuplicate = (id: string) => {
    const { list: nextList, duplicated } = duplicateSavedPreset(presets, id);
    if (!duplicated) return;
    if (persistList(nextList)) {
      showFeedback('success', `Duplicated "${duplicated.name}".`);
    }
  };

  const handleDelete = (id: string) => {
    const nextList = deleteSavedPreset(presets, id);
    const saved = persistList(nextList);
    setConfirmDeleteId(null);
    if (lastToggledIdRef.current === id) {
      lastToggledIdRef.current = null;
    }
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (saved) {
      showFeedback('success', 'Removed saved squad.');
    }
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    const removedCount = selectedIds.size;
    const nextList = presets.filter((item) => !selectedIds.has(item.id));
    const saved = persistList(nextList);
    setSelectedIds(new Set());
    setConfirmBatchDelete(false);
    lastToggledIdRef.current = null;
    if (saved) {
      showFeedback('success', `Removed ${removedCount} saved squad(s).`);
    }
  };

  const handleExportJson = () => {
    if (presets.length === 0) return;
    const targets =
      selectedIds.size > 0
        ? presets.filter((item) => selectedIds.has(item.id))
        : presets;
    if (targets.length === 0) return;
    const json = serializePresetsBackup(targets);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'stella-sora-squads.json';
    link.click();
    URL.revokeObjectURL(url);
    showFeedback('success', `Exported ${targets.length} squad(s).`);
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_BACKUP_JSON_LENGTH) {
      showFeedback('error', 'Backup file exceeds the 2 MB limit.');
      return;
    }

    try {
      const text = await file.text();
      const parsed = parsePresetsBackup(text, presets);
      if (!parsed) {
        showFeedback('error', 'Invalid backup JSON or no valid squads found.');
        return;
      }
      if (persistList(parsed.list)) {
        showFeedback('success', `Imported ${parsed.importedCount} squad(s).`);
      }
    } catch {
      showFeedback('error', 'Could not read the selected JSON file.');
    }
  };

  const decodedEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return presets
      .map((record) => {
        const unpacked = unpackAdvancedPresetCode(record.advCode, characters, allDiscs);
        return { record, unpacked };
      })
      .filter(({ record, unpacked }) => {
        if (!unpacked) return false;
        if (!q) return true;
        if (record.name.toLowerCase().includes(q)) return true;

        const charMatch = SLOT_LABELS.some(({ key }) => {
          const cid = unpacked.slots[key]?.characterId;
          const char = cid ? characters[String(cid)] : null;
          if (!char) return false;
          return [char.name.EN, char.name.JP, char.name.CN, char.name.KR, char.name.TW]
            .filter(Boolean)
            .some((name) => name!.toLowerCase().includes(q));
        });
        if (charMatch) return true;

        const discIds = [
          ...unpacked.mainDiscs.map((d) => d.discId),
          ...unpacked.supportDiscs.map((d) => d.discId),
        ];
        return discIds.some((did) => {
          const disc = did ? allDiscs[String(did)] : null;
          return disc?.name.toLowerCase().includes(q);
        });
      });
  }, [presets, search, characters, allDiscs]);

  const visibleIds = useMemo(
    () => decodedEntries.map(({ record }) => record.id),
    [decodedEntries]
  );

  const selectedCount = useMemo(
    () => presets.filter((item) => selectedIds.has(item.id)).length,
    [presets, selectedIds]
  );

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const toggleSelectedId = (id: string, shiftKey = false) => {
    setConfirmBatchDelete(false);
    const anchor = lastToggledIdRef.current;

    if (shiftKey && anchor && anchor !== id) {
      const startIdx = visibleIds.indexOf(anchor);
      const endIdx = visibleIds.indexOf(id);
      if (startIdx !== -1 && endIdx !== -1) {
        const [low, high] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const targetState = !selectedIds.has(id);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (let i = low; i <= high; i++) {
            if (targetState) {
              next.add(visibleIds[i]);
            } else {
              next.delete(visibleIds[i]);
            }
          }
          return next;
        });
        lastToggledIdRef.current = id;
        return;
      }
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    lastToggledIdRef.current = id;
  };

  const handleToggleSelectAll = () => {
    setConfirmBatchDelete(false);
    lastToggledIdRef.current = null;
    if (selectedCount > 0 && (allVisibleSelected || visibleIds.length === 0)) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          data-testid="save-squad-btn"
          onClick={() => handleSaveBuild(false)}
          disabled={!hasCurrentContent}
          title={
            hasCurrentContent
              ? activeSavedRecord
                ? `Update saved squad "${activeSavedRecord.name}"`
                : 'Save current squad to local bookmarks'
              : 'Assign at least one Trekker or Runic Disc before saving'
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-elevated hover:border-border-hover text-xs font-semibold text-slate-800 dark:text-white transition-colors cursor-pointer press-feedback disabled:opacity-45 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          {quickSaved ? (
            <>
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span className="text-emerald-600 dark:text-emerald-400">Saved!</span>
            </>
          ) : (
            <>
              <BookmarkPlus className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>{activeSavedRecord ? 'Update Squad' : 'Save Squad'}</span>
            </>
          )}
        </button>

        <button
          ref={openerRef}
          type="button"
          data-testid="open-saved-squads-btn"
          onClick={() => {
            setPresets(loadSavedPresetsFromStorage());
            setIsOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-elevated hover:border-border-hover text-xs font-semibold text-slate-800 dark:text-white transition-colors cursor-pointer press-feedback focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <Bookmark className="size-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          <span>Saved Squads</span>
          <span className="inline-flex items-center justify-center min-w-4.5 h-4.5 px-1 rounded-full bg-surface-elevated border border-border-subtle text-[11px] font-mono tabular-nums font-bold text-slate-700 dark:text-white/90">
            {presets.length}
          </span>
        </button>
      </div>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="saved-presets-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 overlay-backdrop"
          onClick={requestClose}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className={cn(
              'relative w-full max-w-4xl max-h-[88vh] rounded-2xl border border-border-subtle bg-surface-card text-slate-900 flex flex-col shadow-2xl overflow-hidden modal-entrance overscroll-contain focus:outline-none',
              isClosing && 'modal-exit'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-4 p-4 sm:p-5 border-b border-border bg-surface-card shrink-0">
              <div className="flex items-center gap-2">
                <Bookmark className="size-5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                <h2
                  id="saved-presets-modal-title"
                  className="text-base sm:text-lg font-bold text-slate-900 dark:text-white"
                >
                  Saved Squads
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-surface-elevated border border-border text-xs font-mono tabular-nums font-semibold text-slate-700 dark:text-white/90">
                  {presets.length}
                </span>
              </div>

              <button
                type="button"
                onClick={requestClose}
                aria-label="Close saved squads modal"
                className="size-8 rounded-lg border border-border flex items-center justify-center text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white hover:bg-surface-hover transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            {/* Action & Search Toolbar */}
            <div className="flex flex-col gap-3 p-4 sm:px-5 border-b border-border bg-surface-subtle/60 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {hasCurrentContent && activeSavedRecord ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSaveBuild(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 border border-amber-600 text-xs font-bold text-slate-950 transition-colors cursor-pointer press-feedback focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <BookmarkPlus className="size-3.5" aria-hidden="true" />
                        <span>Update Active</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveBuild(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-800 dark:text-white transition-colors cursor-pointer press-feedback focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <Copy className="size-3.5" aria-hidden="true" />
                        <span>Save as New</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSaveBuild(true)}
                      disabled={!hasCurrentContent}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 border border-amber-600 text-xs font-bold text-slate-950 transition-colors cursor-pointer press-feedback disabled:opacity-45 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <BookmarkPlus className="size-3.5" aria-hidden="true" />
                      <span>Save Current Squad</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {decodedEntries.length > 0 && (
                    <button
                      type="button"
                      data-testid="toggle-select-all-squads-btn"
                      onClick={handleToggleSelectAll}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold tabular-nums text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <Check
                        className={cn(
                          'size-3.5',
                          allVisibleSelected
                            ? 'text-teal-600 dark:text-teal-400'
                            : 'text-slate-600 dark:text-white/60'
                        )}
                        aria-hidden="true"
                      />
                      <span>
                        {selectedCount > 0 && allVisibleSelected
                          ? `Clear (${selectedCount})`
                          : selectedCount > 0
                          ? `Select All (${selectedCount})`
                          : 'Select All'}
                      </span>
                    </button>
                  )}

                  {selectedCount > 0 && (
                    confirmBatchDelete ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          data-testid="confirm-delete-selected-squads-btn"
                          onClick={handleDeleteSelected}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-[#be123c] text-xs font-bold tabular-nums text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                        >
                          <span>Confirm Delete ({selectedCount})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmBatchDelete(false)}
                          className="px-2 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-medium text-slate-600 dark:text-white/80 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        data-testid="delete-selected-squads-btn"
                        onClick={() => setConfirmBatchDelete(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-xs font-semibold tabular-nums text-rose-700 dark:text-rose-300 transition-colors cursor-pointer press-feedback focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                        <span>Delete Selected ({selectedCount})</span>
                      </button>
                    )
                  )}

                  <button
                    type="button"
                    onClick={handleExportJson}
                    disabled={presets.length === 0}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold tabular-nums text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback disabled:opacity-45 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    <span>{selectedCount > 0 ? `Export Selected (${selectedCount})` : 'Export JSON'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    <Upload className="size-3.5" aria-hidden="true" />
                    <span>Import JSON</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportFileChange}
                    className="hidden"
                    aria-label="Import saved squads JSON backup"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search
                    className="size-4 text-slate-600 dark:text-white/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by squad name, Trekker, or Runic Disc…"
                    aria-label="Filter saved squads"
                    className="w-full rounded-lg border border-border bg-base pl-9 pr-9 py-1.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-600 dark:placeholder:text-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Clear search filter"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 size-6 flex items-center justify-center text-slate-600 dark:text-white/75 hover:text-slate-900 dark:hover:text-white cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <X className="size-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {feedback && (
                  <p
                    role={feedback.kind === 'error' ? 'alert' : 'status'}
                    aria-live="polite"
                    className={
                      feedback.kind === 'error'
                        ? 'text-xs font-medium text-rose-600 dark:text-rose-400'
                        : 'text-xs font-medium text-emerald-600 dark:text-emerald-400'
                    }
                  >
                    {feedback.text}
                  </p>
                )}
              </div>
            </div>

            {/* Bookmark List Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {decodedEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-elevated/40 p-8 text-center space-y-2">
                  <Bookmark className="size-7 mx-auto text-slate-600 dark:text-white/60" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-white text-balance">
                    {presets.length === 0 ? 'No saved squads yet' : 'No saved squads match your search'}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-white/75 max-w-md mx-auto text-pretty">
                    {presets.length === 0
                      ? 'Assemble a squad on the canvas and click Save Squad to bookmark setups for quick switching or backup.'
                      : 'Try another Trekker, Runic Disc, or squad name.'}
                  </p>
                </div>
              ) : (
                decodedEntries.map(({ record, unpacked }) => {
                  if (!unpacked) return null;
                  const isActive = record.id === buildId;
                  const isSelected = selectedIds.has(record.id);
                  const noteCount = Object.values(unpacked.targetNotes || {}).filter(
                    (v) => typeof v === 'number' && v > 0
                  ).length;

                  const assignedMain = unpacked.mainDiscs.filter((d) => d.discId !== null);
                  const assignedSupport = unpacked.supportDiscs.filter((d) => d.discId !== null);

                  return (
                    <article
                      key={record.id}
                      data-testid="saved-squad-card"
                      className={cn(
                        '[content-visibility:auto] [contain-intrinsic-size:auto_180px] rounded-xl border bg-surface-elevated/70 p-4 space-y-3 transition-colors',
                        isSelected
                          ? 'border-teal-500/80 ring-1 ring-teal-400/50 bg-teal-500/[0.04]'
                          : isActive
                          ? 'border-amber-500/70 ring-1 ring-amber-400/40'
                          : 'border-border-subtle hover:border-border-hover'
                      )}
                    >
                      {/* Card Title Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isSelected}
                            aria-label={`Select ${record.name}`}
                            data-testid="select-saved-squad-checkbox"
                            onClick={(e) => toggleSelectedId(record.id, e.shiftKey)}
                            className={cn(
                              'size-6 rounded border flex items-center justify-center shrink-0 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                              isSelected
                                ? 'bg-teal-500 border-teal-500 text-slate-950'
                                : 'bg-surface-card border-border hover:border-teal-500/60 hover:bg-teal-500/10'
                            )}
                          >
                            {isSelected && <Check className="size-3.5 stroke-[3]" aria-hidden="true" />}
                          </button>

                          {renamingId === record.id ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleCommitRename(record.id);
                              }}
                              className="flex items-center gap-1.5 flex-1 min-w-[200px]"
                            >
                              <input
                                type="text"
                                value={renameDraft}
                                onChange={(e) => setRenameDraft(e.target.value)}
                                maxLength={MAX_PRESET_NAME_LENGTH}
                                aria-label="New squad name"
                                autoFocus
                                className="flex-1 rounded-md border border-border bg-base px-2.5 py-1 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                              />
                              <button
                                type="submit"
                                className="px-2.5 py-1 rounded-md bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setRenamingId(null)}
                                className="px-2 py-1 rounded-md border border-border text-xs text-slate-600 dark:text-white/80 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                              >
                                Cancel
                              </button>
                            </form>
                          ) : (
                            <>
                              <h3
                                title={record.name}
                                className="text-sm sm:text-base font-bold text-slate-900 dark:text-white max-w-[240px] sm:max-w-[340px] truncate"
                              >
                                {record.name}
                              </h3>
                              {isActive && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                  Active
                                </span>
                              )}
                              <span className="text-[11px] text-slate-600 dark:text-white/75 font-mono tabular-nums">
                                {formatSavedTimestamp(record.updatedAt)}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartRename(record)}
                            aria-label={`Rename ${record.name}`}
                            title="Rename squad"
                            className="size-8 rounded-md border border-border bg-surface-card hover:bg-surface-hover flex items-center justify-center text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          >
                            <Edit3 className="size-3.5" aria-hidden="true" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDuplicate(record.id)}
                            aria-label={`Duplicate ${record.name}`}
                            title="Duplicate squad"
                            className="size-8 rounded-md border border-border bg-surface-card hover:bg-surface-hover flex items-center justify-center text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          >
                            <Copy className="size-3.5" aria-hidden="true" />
                          </button>

                          {confirmDeleteId === record.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDelete(record.id)}
                                className="px-2 py-1 rounded-md bg-rose-600 hover:bg-[#be123c] text-[11px] font-bold text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                              >
                                Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 rounded-md border border-border text-[11px] text-slate-600 dark:text-white/80 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(record.id)}
                              aria-label={`Delete ${record.name}`}
                              title="Delete squad"
                              className="size-8 rounded-md border border-border bg-surface-card hover:bg-rose-500/15 hover:border-rose-500/40 flex items-center justify-center text-slate-600 dark:text-white/80 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* 3 Trekker Roster Strip */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {SLOT_LABELS.map(({ key, label, badgeClass }) => {
                          const slotState = unpacked.slots[key];
                          const char = slotState?.characterId
                            ? characters[String(slotState.characterId)]
                            : null;

                          return (
                            <div
                              key={key}
                              className="rounded-lg border border-border-subtle bg-surface-card/90 p-2 flex items-center gap-2.5 min-w-0"
                            >
                              {char ? (
                                <>
                                  <div className="relative size-10 shrink-0 mr-1">
                                    <div className="size-full rounded-md overflow-hidden border border-border-subtle bg-base">
                                      <img
                                        src={getTrekkerImageUrl(char.id)}
                                        alt={char.name.EN}
                                        width={40}
                                        height={40}
                                        loading="lazy"
                                        decoding="async"
                                        className="size-full object-cover object-top"
                                      />
                                    </div>
                                    <img
                                      src={`/ss-element/${char.element}.webp`}
                                      alt={char.element}
                                      width={16}
                                      height={16}
                                      loading="lazy"
                                      decoding="async"
                                      data-testid="trekker-corner-element-icon"
                                      className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 z-10 size-4 object-contain drop-shadow-sm pointer-events-none"
                                    />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className={cn(
                                          'px-1.5 py-0.5 rounded border text-[11px] font-bold leading-none',
                                          badgeClass
                                        )}
                                      >
                                        {label}
                                      </span>
                                    </div>
                                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate mt-0.5">
                                      {char.name.EN}
                                    </div>
                                    <div className="text-[11px] text-slate-600 dark:text-white/75 tabular-nums">
                                      {slotState.potentials.length} Potentials
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="flex items-center justify-between w-full px-1 py-1 text-xs text-slate-600 dark:text-white/70">
                                  <span className="font-semibold">{label}</span>
                                  <span>Empty</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Runic Disc & Notes Strip (when present) */}
                      {(assignedMain.length > 0 || assignedSupport.length > 0 || noteCount > 0) && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-white/75 mr-1">
                            <Disc className="size-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                            <span>Discs:</span>
                          </span>
                          {unpacked.mainDiscs.map((slot, idx) => {
                            if (!slot.discId) return null;
                            const disc = allDiscs[String(slot.discId)];
                            return (
                              <span
                                key={`m-${idx}`}
                                className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-md border border-border bg-surface-card text-[11px] font-medium text-slate-800 dark:text-white/90"
                              >
                                <img
                                  src={getDiscOutfitIconUrl(slot.discId, 'full')}
                                  alt=""
                                  width={16}
                                  height={16}
                                  loading="lazy"
                                  decoding="async"
                                  className="size-4 rounded object-cover"
                                />
                                <span className="truncate max-w-[140px]">
                                  {disc?.name || `#${slot.discId}`}
                                </span>
                                <span className="font-mono tabular-nums text-[11px] text-slate-600 dark:text-white/75">
                                  Lv.{slot.level} C{slot.crescendo}
                                </span>
                              </span>
                            );
                          })}
                          {unpacked.supportDiscs.map((slot, idx) => {
                            if (!slot.discId) return null;
                            const disc = allDiscs[String(slot.discId)];
                            return (
                              <span
                                key={`s-${idx}`}
                                className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-md border border-border-subtle bg-surface-card/70 text-[11px] font-medium text-slate-700 dark:text-white/80"
                              >
                                <img
                                  src={getDiscOutfitIconUrl(slot.discId, 'full')}
                                  alt=""
                                  width={16}
                                  height={16}
                                  loading="lazy"
                                  decoding="async"
                                  className="size-4 rounded object-cover"
                                />
                                <span className="truncate max-w-[120px]">
                                  {disc?.name || `#${slot.discId}`}
                                </span>
                                <span className="font-mono tabular-nums text-[11px] text-slate-600 dark:text-white/75">
                                  P{slot.phase + 1}
                                </span>
                              </span>
                            );
                          })}
                          {noteCount > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-surface-card border border-border-subtle text-[11px] font-mono tabular-nums text-slate-600 dark:text-white/75">
                              {noteCount} Target Notes
                            </span>
                          )}
                        </div>
                      )}

                      {/* Card Footer Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            data-testid="load-saved-squad-btn"
                            onClick={() => {
                              onLoadPreset({
                                id: record.id,
                                name: record.name,
                                data: unpacked,
                              });
                              requestClose();
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 border border-amber-600 text-xs font-bold text-slate-950 transition-colors cursor-pointer press-feedback focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          >
                            <span>Load Squad</span>
                          </button>

                          {mode === 'basic' && (
                            <Link
                              href={`/builder/advanced?adv=${encodeURIComponent(record.advCode)}`}
                              onClick={requestClose}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            >
                              <span>Open in Advanced</span>
                              <ArrowRight className="size-3.5" aria-hidden="true" />
                            </Link>
                          )}
                        </div>

                        {record.inGameCode && (
                          <button
                            type="button"
                            onClick={() => handleCopyInGameCode(record)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-surface-card hover:bg-surface-hover text-xs font-semibold text-slate-700 dark:text-white/90 transition-colors cursor-pointer press-feedback focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          >
                            {copiedId === record.id ? (
                              <>
                                <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                                <span className="text-emerald-600 dark:text-emerald-400">Code Copied!</span>
                              </>
                            ) : (
                              <>
                                <KeyRound className="size-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
                                <span>Copy Preset Code</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
