import { NextRequest, NextResponse } from 'next/server';
import {
  getClientIp,
  hashActor,
  VISITOR_COOKIE_NAME,
} from '@/lib/community-builds/security';
import { isBotUserAgent } from '@/lib/community-builds/validation';
import { getResolvedCommunityPresetById } from '@/lib/community-presets';
import { getSql } from '@/lib/db/neon';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing build ID.' }, { status: 400 });
  }

  const sql = getSql();
  const ua = request.headers.get('user-agent') || '';
  if (!sql || isBotUserAgent(ua)) {
    return NextResponse.json({ viewsCount: 0, counted: false });
  }

  const isCurated = Boolean(getResolvedCommunityPresetById(id));
  if (!isCurated) {
    const existing = (await sql`
      SELECT id
      FROM community_builds
      WHERE id = ${id}
        AND status IN ('live', 'verified')
      LIMIT 1
    `) as Array<{ id: string }>;
    if (!existing[0]) {
      return NextResponse.json({ error: 'Build not found.' }, { status: 404 });
    }
  }

  const vid = request.cookies.get(VISITOR_COOKIE_NAME)?.value || '';
  const ip = getClientIp(request);
  const viewerHash = hashActor('view', vid || ip, ua.slice(0, 120));

  try {
    const inserted = (await sql`
      INSERT INTO build_views (build_id, viewer_hash, view_date)
      VALUES (${id}, ${viewerHash}, CURRENT_DATE)
      ON CONFLICT DO NOTHING
      RETURNING build_id
    `) as Array<{ build_id: string }>;

    const counted = inserted.length > 0;
    let viewsCount = 0;

    if (counted) {
      const mRows = (await sql`
        INSERT INTO build_metrics (build_id, views_count, upvotes_count, updated_at)
        VALUES (${id}, 1, 0, NOW())
        ON CONFLICT (build_id)
        DO UPDATE SET views_count = build_metrics.views_count + 1, updated_at = NOW()
        RETURNING views_count
      `) as Array<{ views_count: number }>;
      viewsCount = Number(mRows[0]?.views_count ?? 1) || 1;
    } else {
      const mRows = (await sql`
        SELECT views_count
        FROM build_metrics
        WHERE build_id = ${id}
        LIMIT 1
      `) as Array<{ views_count: number }>;
      viewsCount = Number(mRows[0]?.views_count ?? 0) || 0;
    }

    return NextResponse.json({ viewsCount, counted });
  } catch (err) {
    console.error('Failed to record build view:', err);
    return NextResponse.json({ viewsCount: 0, counted: false });
  }
}
