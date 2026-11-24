import { cacheLife, cacheTag } from 'next/cache.js';
import type { BuildRotation } from '../calculator/build-rotation.ts';
import {
  CURRENT_PATCH,
  getResolvedCommunityPresetById,
  getResolvedCommunityPresets,
  resolveCommunityPreset,
  type CommunityPresetEntry,
  type CommunityPresetMode,
  type CommunityPresetTier,
  type ResolvedCommunityPreset,
} from '../community-presets.ts';
import { getSql } from '../db/neon.ts';
import type { ElementType } from '../../types/index.ts';

export interface CommunityBuildDbRow {
  id: string;
  status: 'live' | 'verified' | 'archived' | 'removed';
  title: string;
  author_name: string;
  element: string;
  archetype: string;
  tier: CommunityPresetTier;
  modes: unknown;
  summary: string;
  rotation: unknown;
  combat_rotation: unknown;
  adv_code: string;
  in_game_code: string | null;
  verified_patch: string;
  created_at: string | Date;
  reviewed_at: string | Date | null;
  views_count?: number | string | null;
  upvotes_count?: number | string | null;
}

export interface LiveBuildMetric {
  views: number;
  upvotes: number;
  voted: boolean;
}

function toIsoDateOnly(val: string | Date): string {
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function toIsoTimestamp(val: string | Date): string {
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function parseJsonArray<T>(val: unknown, fallback: T[]): T[] {
  if (Array.isArray(val)) return val as T[];
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed as T[]) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function mapDbRowToResolvedPreset(
  row: CommunityBuildDbRow
): ResolvedCommunityPreset | null {
  const modes = parseJsonArray<CommunityPresetMode>(row.modes, ['general']);
  const rotation = parseJsonArray<string>(row.rotation, []);
  const combatRotation =
    row.combat_rotation && typeof row.combat_rotation === 'object'
      ? (row.combat_rotation as BuildRotation)
      : undefined;

  const createdIso = toIsoTimestamp(row.created_at);
  const entry: CommunityPresetEntry = {
    id: row.id,
    title: row.title,
    advCode: row.adv_code,
    inGameCode: row.in_game_code || undefined,
    element: row.element as ElementType,
    archetype: row.archetype || 'Community Build',
    modes: modes.length > 0 ? modes : ['general'],
    tier: row.tier || 'standard',
    summary: row.summary || '',
    rotation,
    ...(combatRotation ? { combatRotation } : {}),
    sources: [
      {
        label: row.author_name || 'Anonymous',
        author: row.author_name || 'Anonymous',
        url: '',
        kind: 'community',
      },
    ],
    verifiedPatch: row.verified_patch || CURRENT_PATCH,
    verifiedAt: toIsoDateOnly(row.created_at),
    status: row.status === 'archived' ? 'archived' : 'verified',
  };

  const resolved = resolveCommunityPreset(entry);
  if (!resolved) return null;

  return {
    ...resolved,
    origin: 'community',
    isVerified: row.status === 'verified',
    authorName: row.author_name || 'Anonymous',
    createdAt: createdIso,
    viewsCount: Number(row.views_count ?? 0) || 0,
    upvotesCount: Number(row.upvotes_count ?? 0) || 0,
  };
}

export async function getCachedCommunityBuilds(): Promise<ResolvedCommunityPreset[]> {
  'use cache';
  if (process.env.__NEXT_USE_CACHE) {
    cacheTag('community-builds');
    cacheLife('minutes');
  }

  const curated = getResolvedCommunityPresets().map((preset) => ({
    ...preset,
    origin: 'curated' as const,
    isVerified: true,
    authorName: preset.sources[0]?.author,
    createdAt: preset.verifiedAt,
    viewsCount: 0,
    upvotesCount: 0,
  }));

  const sql = getSql();
  if (!sql) {
    return curated;
  }

  try {
    const dbRows = (await sql`
      SELECT
        cb.id,
        cb.status,
        cb.title,
        cb.author_name,
        cb.element,
        cb.archetype,
        cb.tier,
        cb.modes,
        cb.summary,
        cb.rotation,
        cb.combat_rotation,
        cb.adv_code,
        cb.in_game_code,
        cb.verified_patch,
        cb.created_at,
        cb.reviewed_at,
        COALESCE(bm.views_count, 0) AS views_count,
        COALESCE(bm.upvotes_count, 0) AS upvotes_count
      FROM community_builds cb
      LEFT JOIN build_metrics bm ON bm.build_id = cb.id
      WHERE cb.status IN ('live', 'verified')
      ORDER BY cb.created_at DESC
      LIMIT 250
    `) as CommunityBuildDbRow[];

    const curatedIds = curated.map((p) => p.id);
    const curatedMetricsMap = new Map<string, { views: number; upvotes: number }>();
    if (curatedIds.length > 0) {
      const metricRows = (await sql`
        SELECT build_id, views_count, upvotes_count
        FROM build_metrics
        WHERE build_id = ANY(${curatedIds})
      `) as Array<{ build_id: string; views_count: number; upvotes_count: number }>;
      for (const m of metricRows) {
        curatedMetricsMap.set(m.build_id, {
          views: Number(m.views_count ?? 0) || 0,
          upvotes: Number(m.upvotes_count ?? 0) || 0,
        });
      }
    }

    const enrichedCurated = curated.map((preset) => {
      const m = curatedMetricsMap.get(preset.id);
      return m ? { ...preset, viewsCount: m.views, upvotesCount: m.upvotes } : preset;
    });

    const communityPresets = dbRows
      .map((row) => mapDbRowToResolvedPreset(row))
      .filter((p): p is ResolvedCommunityPreset => p !== null);

    return [...enrichedCurated, ...communityPresets];
  } catch (err) {
    console.warn('getCachedCommunityBuilds DB query failed, falling back to curated:', err);
    return curated;
  }
}

export async function getCachedCommunityBuildById(
  id: string
): Promise<ResolvedCommunityPreset | null> {
  'use cache';
  if (process.env.__NEXT_USE_CACHE) {
    cacheTag('community-builds');
    cacheTag(`build:${id}`);
    cacheLife('minutes');
  }

  const curated = getResolvedCommunityPresetById(id);
  const sql = getSql();

  if (curated) {
    let viewsCount = 0;
    let upvotesCount = 0;
    if (sql) {
      try {
        const mRows = (await sql`
          SELECT views_count, upvotes_count
          FROM build_metrics
          WHERE build_id = ${curated.id}
          LIMIT 1
        `) as Array<{ views_count: number; upvotes_count: number }>;
        if (mRows[0]) {
          viewsCount = Number(mRows[0].views_count ?? 0) || 0;
          upvotesCount = Number(mRows[0].upvotes_count ?? 0) || 0;
        }
      } catch (err) {
        console.warn('Failed to fetch curated build metrics:', err);
      }
    }
    return {
      ...curated,
      origin: 'curated',
      isVerified: true,
      authorName: curated.sources[0]?.author,
      createdAt: curated.verifiedAt,
      viewsCount,
      upvotesCount,
    };
  }

  if (!sql) {
    return null;
  }

  try {
    const rows = (await sql`
      SELECT
        cb.id,
        cb.status,
        cb.title,
        cb.author_name,
        cb.element,
        cb.archetype,
        cb.tier,
        cb.modes,
        cb.summary,
        cb.rotation,
        cb.combat_rotation,
        cb.adv_code,
        cb.in_game_code,
        cb.verified_patch,
        cb.created_at,
        cb.reviewed_at,
        COALESCE(bm.views_count, 0) AS views_count,
        COALESCE(bm.upvotes_count, 0) AS upvotes_count
      FROM community_builds cb
      LEFT JOIN build_metrics bm ON bm.build_id = cb.id
      WHERE cb.id = ${id}
        AND cb.status IN ('live', 'verified')
      LIMIT 1
    `) as CommunityBuildDbRow[];

    if (!rows[0]) return null;
    return mapDbRowToResolvedPreset(rows[0]);
  } catch (err) {
    console.warn('getCachedCommunityBuildById DB query failed:', err);
    return null;
  }
}

export async function getLiveMetricsForIds(
  ids: string[],
  voterHash: string | null
): Promise<Record<string, LiveBuildMetric>> {
  const result: Record<string, LiveBuildMetric> = {};
  if (ids.length === 0) return result;

  const sql = getSql();
  if (!sql) return result;

  const normalizedIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 100);
  if (normalizedIds.length === 0) return result;

  for (const id of normalizedIds) {
    result[id] = { views: 0, upvotes: 0, voted: false };
  }

  const metricRows = (await sql`
    SELECT build_id, views_count, upvotes_count
    FROM build_metrics
    WHERE build_id = ANY(${normalizedIds})
  `) as Array<{ build_id: string; views_count: number; upvotes_count: number }>;

  for (const row of metricRows) {
    result[row.build_id] = {
      views: Number(row.views_count ?? 0) || 0,
      upvotes: Number(row.upvotes_count ?? 0) || 0,
      voted: false,
    };
  }

  if (voterHash) {
    const voteRows = (await sql`
      SELECT build_id
      FROM build_votes
      WHERE build_id = ANY(${normalizedIds})
        AND voter_hash = ${voterHash}
    `) as Array<{ build_id: string }>;
    for (const v of voteRows) {
      if (result[v.build_id]) {
        result[v.build_id].voted = true;
      }
    }
  }

  return result;
}
