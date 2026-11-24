import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

export type NeonSql = NeonQueryFunction<false, false>;

let cachedSql: NeonSql | null = null;
let cachedUrl: string | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getSql(): NeonSql | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    return null;
  }
  if (!cachedSql || cachedUrl !== url) {
    cachedSql = neon(url);
    cachedUrl = url;
  }
  return cachedSql;
}
