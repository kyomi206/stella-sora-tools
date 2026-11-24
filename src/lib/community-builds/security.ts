import crypto from 'node:crypto';
import type { NeonSql } from '../db/neon.ts';

export const ADMIN_COOKIE_NAME = 'sstt_admin';
export const VISITOR_COOKIE_NAME = 'sstt_vid';
const ADMIN_COOKIE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}

export function hashActor(purpose: string, ...parts: string[]): string {
  const salt =
    process.env.METRICS_SALT?.trim() ||
    process.env.ADMIN_SECRET?.trim() ||
    'dev-local-salt';
  return crypto
    .createHash('sha256')
    .update(`${salt}:${purpose}:${parts.join(':')}`)
    .digest('hex');
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createAdminCookieValue(secret: string, nowMs: number = Date.now()): string {
  const payload = `v1.${nowMs}`;
  const sig = signPayload(payload, secret);
  return `${payload}.${sig}`;
}

export function verifyAdminCookieValue(
  cookie: string | undefined | null,
  secret: string | undefined | null,
  nowMs: number = Date.now()
): boolean {
  if (!cookie || !secret || !secret.trim()) return false;
  const parts = cookie.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;

  const issuedAt = Number(parts[1]);
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return false;
  if (issuedAt > nowMs + 60_000) return false;
  if (nowMs - issuedAt > ADMIN_COOKIE_TTL_MS) return false;

  const expectedSig = signPayload(`v1.${parts[1]}`, secret);
  const actualBuf = Buffer.from(parts[2], 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (actualBuf.length !== expectedBuf.length) return false;

  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function isAdminRequestAuthorized(
  request: { cookies: { get(name: string): { value?: string } | undefined } },
  secretOverride: string | undefined = process.env.ADMIN_SECRET
): boolean {
  const secret = secretOverride?.trim();
  if (!secret) return false;
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminCookieValue(cookie, secret);
}

export function verifyAdminSecret(
  candidate: string | undefined | null,
  secret: string | undefined | null
): boolean {
  if (!candidate || !secret || !secret.trim()) return false;
  const candidateDigest = crypto.createHash('sha256').update(candidate).digest();
  const secretDigest = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(candidateDigest, secretDigest);
}

export async function verifyTurnstile(
  token: string | undefined | null,
  ip: string
): Promise<{ ok: boolean; error?: string }> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secretKey) {
    return { ok: true };
  }
  if (!token || !token.trim()) {
    return { ok: false, error: 'Please complete the anti-bot verification.' };
  }

  try {
    const body = new URLSearchParams({
      secret: secretKey,
      response: token.trim(),
    });
    if (ip && ip !== 'unknown') {
      body.set('remoteip', ip);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) {
      return { ok: false, error: 'Verification service unavailable. Please try again.' };
    }
    const json = (await res.json()) as { success?: boolean };
    if (!json.success) {
      return { ok: false, error: 'Anti-bot verification failed. Please retry.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Verification timed out. Please try again.' };
  }
}

export async function consumeRateLimit(
  sql: NeonSql,
  scope: string,
  actorHash: string,
  maxHits: number,
  windowSec: number
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const nowSec = Math.floor(Date.now() / 1000);
  const windowStartSec = Math.floor(nowSec / windowSec) * windowSec;
  const windowStartIso = new Date(windowStartSec * 1000).toISOString();
  const retryAfterSec = Math.max(1, windowStartSec + windowSec - nowSec);

  const rows = await sql`
    INSERT INTO rate_limits (scope, actor_hash, window_start, hits)
    VALUES (${scope}, ${actorHash}, ${windowStartIso}::timestamptz, 1)
    ON CONFLICT (scope, actor_hash, window_start)
    DO UPDATE SET hits = rate_limits.hits + 1
    RETURNING hits
  `;

  const hits = Number(rows[0]?.hits ?? 1);
  return {
    allowed: hits <= maxHits,
    retryAfterSec,
  };
}
