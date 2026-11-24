import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  consumeRateLimit,
  createAdminCookieValue,
  getClientIp,
  hashActor,
  verifyAdminCookieValue,
  verifyAdminSecret,
} from '@/lib/community-builds/security';
import { getSql } from '@/lib/db/neon';

export async function GET(request: NextRequest) {
  const secret = process.env.ADMIN_SECRET?.trim();
  const configured = Boolean(secret);
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const authenticated = configured && verifyAdminCookieValue(cookie, secret);

  return NextResponse.json(
    { authenticated, configured },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function POST(request: NextRequest) {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: 'ADMIN_SECRET is not configured on this server.' },
      { status: 503 }
    );
  }

  const sql = getSql();
  if (sql) {
    try {
      const rl = await consumeRateLimit(
        sql,
        'admin_auth',
        hashActor('admin_auth', getClientIp(request)),
        10,
        900
      );
      if (!rl.allowed) {
        return NextResponse.json(
          { error: 'Too many login attempts. Please try again later.' },
          {
            status: 429,
            headers: { 'Retry-After': String(rl.retryAfterSec) },
          }
        );
      }
    } catch (err) {
      console.error('Admin auth rate limit check failed:', err);
    }
  }

  let password = '';
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body?.password === 'string' ? body.password : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!verifyAdminSecret(password, secret)) {
    return NextResponse.json({ error: 'Invalid admin password.' }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(ADMIN_COOKIE_NAME, createAdminCookieValue(secret), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
