import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

const memoryStore = new Map<string, CacheEntry<unknown>>();

function getCacheDir(): string {
  const primaryDir = path.resolve(process.cwd(), '.data-cache');
  try {
    if (!fsSync.existsSync(primaryDir)) {
      fsSync.mkdirSync(primaryDir, { recursive: true });
    }
    return primaryDir;
  } catch {
    const fallbackDir = path.join(os.tmpdir(), 'sstt-data-cache');
    if (!fsSync.existsSync(fallbackDir)) {
      fsSync.mkdirSync(fallbackDir, { recursive: true });
    }
    return fallbackDir;
  }
}

function getFilePath(key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(getCacheDir(), `${safeKey}.json`);
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = {
    timestamp: Date.now(),
    data,
  };
  memoryStore.set(key, entry as CacheEntry<unknown>);

  try {
    const filePath = getFilePath(key);
    // Write directly using async writeFile to avoid Windows rename lock collisions
    await fs.writeFile(filePath, JSON.stringify(entry), 'utf-8');
  } catch (err) {
    console.warn(`[cache-store] Failed to write cache to disk for key "${key}":`, err);
  }
}

export async function readCache<T>(key: string): Promise<T | null> {
  // Check memory store first
  const mem = memoryStore.get(key);
  if (mem) {
    return mem.data as T;
  }

  // Fallback to disk store
  try {
    const filePath = getFilePath(key);
    if (fsSync.existsSync(filePath)) {
      const raw = await fs.readFile(filePath, 'utf-8');
      const entry = JSON.parse(raw) as CacheEntry<T>;
      memoryStore.set(key, entry as CacheEntry<unknown>);
      return entry.data;
    }
  } catch (err) {
    console.warn(`[cache-store] Failed to read disk cache for key "${key}":`, err);
  }

  return null;
}

export function isCacheValid(key: string, ttlMs: number): boolean {
  if (ttlMs <= 0) return false;

  let timestamp: number | null = null;
  const mem = memoryStore.get(key);
  if (mem) {
    timestamp = mem.timestamp;
  } else {
    try {
      const filePath = getFilePath(key);
      if (fsSync.existsSync(filePath)) {
        const raw = fsSync.readFileSync(filePath, 'utf-8');
        const entry = JSON.parse(raw) as CacheEntry<unknown>;
        timestamp = entry.timestamp;
        memoryStore.set(key, entry);
      }
    } catch {
      return false;
    }
  }

  if (!timestamp) return false;
  return Date.now() - timestamp < ttlMs;
}

export async function clearCache(): Promise<void> {
  memoryStore.clear();
  try {
    const dir = getCacheDir();
    if (fsSync.existsSync(dir)) {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.endsWith('.json') || file.endsWith('.tmp')) {
          await fs.unlink(path.join(/*turbopackIgnore: true*/ dir, file));
        }
      }
    }
  } catch (err) {
    console.warn('[cache-store] Failed to clear disk cache:', err);
  }
}
