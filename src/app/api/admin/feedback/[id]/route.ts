import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequestAuthorized } from '@/lib/community-builds/security';
import { getSql } from '@/lib/db/neon';

const VALID_STATUSES = new Set(['open', 'resolved']);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      { error: 'Database is not configured.' },
      { status: 503 }
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing feedback ID.' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (typeof body.status !== 'string' || !VALID_STATUSES.has(body.status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }
  const nextStatus = body.status;

  try {
    const updated = (await sql`
      UPDATE community_feedback
      SET
        status = ${nextStatus},
        resolved_at = CASE WHEN ${nextStatus} = 'resolved' THEN NOW() ELSE NULL END
      WHERE id = ${id}
      RETURNING id, status, resolved_at
    `) as Array<{ id: string; status: string; resolved_at: string | null }>;

    if (!updated[0]) {
      return NextResponse.json({ error: 'Feedback item not found.' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      id: updated[0].id,
      status: updated[0].status,
      resolved_at: updated[0].resolved_at,
    });
  } catch (err) {
    console.error('Failed to update feedback status:', err);
    return NextResponse.json(
      { error: 'Failed to update feedback item.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequestAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      { error: 'Database is not configured.' },
      { status: 503 }
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: 'Missing feedback ID.' }, { status: 400 });
  }

  try {
    const deleted = (await sql`
      DELETE FROM community_feedback
      WHERE id = ${id}
      RETURNING id
    `) as Array<{ id: string }>;

    if (!deleted[0]) {
      return NextResponse.json({ error: 'Feedback item not found.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id: deleted[0].id });
  } catch (err) {
    console.error('Failed to delete feedback item:', err);
    return NextResponse.json(
      { error: 'Failed to delete feedback item.' },
      { status: 500 }
    );
  }
}
