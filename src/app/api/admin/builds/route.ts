import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequestAuthorized } from '@/lib/community-builds/security';
import { getSql } from '@/lib/db/neon';

export async function GET(request: NextRequest) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      { builds: [], dbConfigured: false },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const rows = await sql`
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
        cb.adv_code,
        cb.in_game_code,
        cb.verified_patch,
        cb.created_at,
        cb.reviewed_at,
        COALESCE(bm.views_count, 0) AS views_count,
        COALESCE(bm.upvotes_count, 0) AS upvotes_count
      FROM community_builds cb
      LEFT JOIN build_metrics bm ON bm.build_id = cb.id
      ORDER BY cb.created_at DESC
      LIMIT 500
    `;

    return NextResponse.json(
      { builds: rows, dbConfigured: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('Failed to list admin builds:', err);
    return NextResponse.json(
      { error: 'Failed to load community builds.' },
      { status: 500 }
    );
  }
}
