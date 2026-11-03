import { readCache, writeCache, isCacheValid } from './cache-store.ts';
import charactersSeed from '../data/characters.json' with { type: 'json' };
import potentialsSeed from '../data/potentials-db.json' with { type: 'json' };
import { ROADMAP_ITEMS as roadmapSeed, type RoadmapItem } from '../data/roadmap.ts';
import { getMergedRoadmapItems } from './roadmap/data-loader.ts';
import type { SSCharacter } from '../types/index.ts';

const TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const FAILURE_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes negative caching on network failure

// Failure timestamps to avoid hanging every request during outages
const failureCooldowns = new Map<string, number>();

// In-flight single flight request deduplication
const inFlightRequests = new Map<string, Promise<unknown>>();

async function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<T>;
  }
  const promise = fn().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
}

async function fetchWithTimeout(url: string, timeoutMs = 4000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'StellaSoraTools-Sync/1.0' },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export interface SyncOptions {
  force?: boolean;
}

export async function getSyncedCharacters(options?: SyncOptions): Promise<Record<string, SSCharacter>> {
  const cacheKey = 'characters_data';
  const cached = await readCache<Record<string, SSCharacter>>(cacheKey);

  const lastFailure = failureCooldowns.get(cacheKey) || 0;
  const isCooldownActive = Date.now() - lastFailure < FAILURE_BACKOFF_MS;

  if (!options?.force && cached && (isCacheValid(cacheKey, TTL_MS) || isCooldownActive)) {
    return cached;
  }

  return singleFlight(cacheKey, async () => {
    try {
      const url = 'https://raw.githubusercontent.com/AutumnVN/ss-data/main/characters.json';
      const res = await fetchWithTimeout(url, 3500);
      if (res.ok) {
        const data = (await res.json()) as Record<string, SSCharacter>;
        if (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0) {
          await writeCache(cacheKey, data);
          failureCooldowns.delete(cacheKey);
          return data;
        }
      }
    } catch {
      // Record failure timestamp so subsequent requests don't hang
      failureCooldowns.set(cacheKey, Date.now());
    }

    if (cached && !options?.force) return cached;
    const seed = charactersSeed as unknown as Record<string, SSCharacter>;
    await writeCache(cacheKey, seed);
    return seed;
  });
}

export async function getSyncedPotentials(options?: SyncOptions): Promise<unknown> {
  const cacheKey = 'potentials_data';
  const cached = await readCache<unknown>(cacheKey);

  const lastFailure = failureCooldowns.get(cacheKey) || 0;
  const isCooldownActive = Date.now() - lastFailure < FAILURE_BACKOFF_MS;

  if (!options?.force && cached && (isCacheValid(cacheKey, TTL_MS) || isCooldownActive)) {
    return cached;
  }

  return singleFlight(cacheKey, async () => {
    try {
      const url = 'https://raw.githubusercontent.com/AutumnVN/ss-data/main/potentials-db.json';
      const res = await fetchWithTimeout(url, 3500);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length > 0) {
          await writeCache(cacheKey, data);
          failureCooldowns.delete(cacheKey);
          return data;
        }
      }
    } catch {
      failureCooldowns.set(cacheKey, Date.now());
    }

    if (cached && !options?.force) return cached;
    await writeCache(cacheKey, potentialsSeed);
    return potentialsSeed;
  });
}

export async function getSyncedRoadmap(options?: SyncOptions): Promise<RoadmapItem[]> {
  const cacheKey = 'roadmap_data';
  const cached = await readCache<RoadmapItem[]>(cacheKey);

  const lastFailure = failureCooldowns.get(cacheKey) || 0;
  const isCooldownActive = Date.now() - lastFailure < FAILURE_BACKOFF_MS;

  if (!options?.force && cached && (isCacheValid(cacheKey, TTL_MS) || isCooldownActive)) {
    return cached;
  }

  return singleFlight(cacheKey, async () => {
    try {
      // Utilize the full datamined transformation and merging pipeline
      const mergedItems = getMergedRoadmapItems();
      if (Array.isArray(mergedItems) && mergedItems.length > 0) {
        await writeCache(cacheKey, mergedItems);
        failureCooldowns.delete(cacheKey);
        return mergedItems;
      }
    } catch {
      failureCooldowns.set(cacheKey, Date.now());
    }

    if (cached && !options?.force) return cached;
    await writeCache(cacheKey, roadmapSeed);
    return roadmapSeed;
  });
}

export async function triggerDataSync(options?: SyncOptions): Promise<{
  success: boolean;
  syncedAt: string;
  counts: Record<string, number>;
}> {
  const force = options?.force ?? true;
  const [chars, potentials, roadmap] = await Promise.all([
    getSyncedCharacters({ force }),
    getSyncedPotentials({ force }),
    getSyncedRoadmap({ force }),
  ]);

  return {
    success: true,
    syncedAt: new Date().toISOString(),
    counts: {
      characters: Object.keys(chars || {}).length,
      roadmapItems: roadmap?.length || 0,
      potentials: typeof potentials === 'object' && potentials !== null ? Object.keys(potentials).length : 0,
    },
  };
}
