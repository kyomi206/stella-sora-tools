import { NextRequest, NextResponse } from 'next/server';
import {
  getClientIp,
  hashActor,
  VISITOR_COOKIE_NAME,
} from '@/lib/community-builds/security';
import { getLiveMetricsForIds } from '@/lib/community-builds/store';

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get('ids') || '';
  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (ids.length === 0) {
    return NextResponse.json(
      { metrics: {} },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const vid = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
  const voterHash = vid ? hashActor('vote', vid, getClientIp(request)) : null;

  try {
    const metrics = await getLiveMetricsForIds(ids, voterHash);
    return NextResponse.json(
      { metrics },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('Failed to load live build metrics:', err);
    return NextResponse.json(
      { metrics: {} },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
