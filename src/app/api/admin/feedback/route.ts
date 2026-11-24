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
      { items: [], dbConfigured: false },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const rows = await sql`
      SELECT
        id,
        category,
        status,
        page_context,
        message,
        contact,
        created_at,
        resolved_at
      FROM community_feedback
      ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, created_at DESC
      LIMIT 500
    `;

    return NextResponse.json(
      { items: rows, dbConfigured: true },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('Failed to list admin feedback:', err);
    return NextResponse.json(
      { error: 'Failed to load feedback inbox.' },
      { status: 500 }
    );
  }
}
