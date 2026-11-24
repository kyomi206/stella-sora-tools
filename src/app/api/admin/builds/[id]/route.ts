import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequestAuthorized } from '@/lib/community-builds/security';
import { getSql } from '@/lib/db/neon';

const VALID_STATUSES = new Set(['live', 'verified', 'archived', 'removed']);
const VALID_TIERS = new Set(['f2p', 'standard', 'premium']);
const VALID_MODES = new Set(['general', 'boss-blitz', 'cataclysm']);

function cleanText(val: string): string {
  return val.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
}

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
    return NextResponse.json({ error: 'Missing build ID.' }, { status: 400 });
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

  const existingRows = (await sql`
    SELECT id, status, title, author_name, archetype, tier, modes, summary, rotation
    FROM community_builds
    WHERE id = ${id}
    LIMIT 1
  `) as Array<{
    id: string;
    status: string;
    title: string;
    author_name: string;
    archetype: string;
    tier: string;
    modes: unknown;
    summary: string;
    rotation: unknown;
  }>;

  const current = existingRows[0];
  if (!current) {
    return NextResponse.json({ error: 'Build not found.' }, { status: 404 });
  }

  let nextStatus = current.status;
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
    }
    nextStatus = body.status;
  }

  let nextTitle = current.title;
  if (body.title !== undefined) {
    const t = typeof body.title === 'string' ? cleanText(body.title) : '';
    if (t.length < 4 || t.length > 60) {
      return NextResponse.json(
        { error: 'Title must be between 4 and 60 characters.' },
        { status: 400 }
      );
    }
    nextTitle = t;
  }

  let nextAuthor = current.author_name;
  const rawAuthor = body.author_name !== undefined ? body.author_name : body.authorName;
  if (rawAuthor !== undefined) {
    const a = typeof rawAuthor === 'string' ? cleanText(rawAuthor) : '';
    if (a.length > 30) {
      return NextResponse.json(
        { error: 'Author name must be 30 characters or fewer.' },
        { status: 400 }
      );
    }
    nextAuthor = a || 'Anonymous';
  }

  let nextArchetype = current.archetype;
  if (body.archetype !== undefined) {
    const arch = typeof body.archetype === 'string' ? cleanText(body.archetype) : '';
    if (arch.length > 40) {
      return NextResponse.json(
        { error: 'Archetype must be 40 characters or fewer.' },
        { status: 400 }
      );
    }
    nextArchetype = arch || 'Community Build';
  }

  let nextTier = current.tier;
  if (body.tier !== undefined) {
    if (typeof body.tier !== 'string' || !VALID_TIERS.has(body.tier)) {
      return NextResponse.json({ error: 'Invalid investment tier.' }, { status: 400 });
    }
    nextTier = body.tier;
  }

  let nextSummary = current.summary;
  if (body.summary !== undefined) {
    const s =
      typeof body.summary === 'string'
        ? body.summary
            .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
            .replace(/\r\n?/g, '\n')
            .trim()
        : '';
    if (s.length > 280) {
      return NextResponse.json(
        { error: 'Summary must be 280 characters or fewer.' },
        { status: 400 }
      );
    }
    nextSummary = s;
  }

  let nextModes: string[] = Array.isArray(current.modes)
    ? (current.modes as string[])
    : ['general'];
  if (body.modes !== undefined) {
    if (!Array.isArray(body.modes)) {
      return NextResponse.json({ error: 'Modes must be an array.' }, { status: 400 });
    }
    const deduped: string[] = [];
    for (const m of body.modes) {
      if (typeof m === 'string' && VALID_MODES.has(m)) {
        if (!deduped.includes(m)) deduped.push(m);
      } else {
        return NextResponse.json({ error: 'Invalid game mode selected.' }, { status: 400 });
      }
    }
    if (deduped.length < 1 || deduped.length > 3) {
      return NextResponse.json({ error: 'Select between 1 and 3 game modes.' }, { status: 400 });
    }
    nextModes = deduped;
  }

  let nextRotation: string[] = Array.isArray(current.rotation)
    ? (current.rotation as string[])
    : [];
  if (body.rotation !== undefined) {
    if (!Array.isArray(body.rotation)) {
      return NextResponse.json({ error: 'Author notes must be a list of lines.' }, { status: 400 });
    }
    const cleanedNotes: string[] = [];
    for (const item of body.rotation) {
      if (typeof item !== 'string') {
        return NextResponse.json({ error: 'Invalid author note.' }, { status: 400 });
      }
      const line = cleanText(item);
      if (!line) continue;
      if (line.length > 160) {
        return NextResponse.json(
          { error: 'Each author note must be 160 characters or fewer.' },
          { status: 400 }
        );
      }
      cleanedNotes.push(line);
      if (cleanedNotes.length > 8) {
        return NextResponse.json(
          { error: 'Include at most 8 author notes.' },
          { status: 400 }
        );
      }
    }
    nextRotation = cleanedNotes;
  }

  try {
    const updatedRows = await sql`
      UPDATE community_builds
      SET
        status = ${nextStatus},
        title = ${nextTitle},
        author_name = ${nextAuthor},
        archetype = ${nextArchetype},
        tier = ${nextTier},
        modes = ${JSON.stringify(nextModes)}::jsonb,
        summary = ${nextSummary},
        rotation = ${JSON.stringify(nextRotation)}::jsonb,
        reviewed_at = NOW()
      WHERE id = ${id}
      RETURNING
        id,
        status,
        title,
        author_name,
        element,
        archetype,
        tier,
        modes,
        summary,
        rotation,
        adv_code,
        in_game_code,
        verified_patch,
        created_at,
        reviewed_at
    `;

    revalidateTag('community-builds', { expire: 0 });
    revalidateTag(`build:${id}`, { expire: 0 });

    return NextResponse.json({ build: updatedRows[0] });
  } catch (err: unknown) {
    const pgCode =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (pgCode === '23505') {
      return NextResponse.json(
        { error: 'Another active build with this exact squad code already exists.' },
        { status: 409 }
      );
    }
    console.error('Failed to update build:', err);
    return NextResponse.json({ error: 'Failed to update build.' }, { status: 500 });
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
    return NextResponse.json({ error: 'Missing build ID.' }, { status: 400 });
  }

  try {
    await sql`DELETE FROM build_votes WHERE build_id = ${id}`;
    await sql`DELETE FROM build_views WHERE build_id = ${id}`;
    await sql`DELETE FROM build_metrics WHERE build_id = ${id}`;
    const deleted = (await sql`
      DELETE FROM community_builds
      WHERE id = ${id}
      RETURNING id
    `) as Array<{ id: string }>;

    if (!deleted[0]) {
      return NextResponse.json({ error: 'Build not found.' }, { status: 404 });
    }

    revalidateTag('community-builds', { expire: 0 });
    revalidateTag(`build:${id}`, { expire: 0 });

    return NextResponse.json({ deleted: true, id });
  } catch (err) {
    console.error('Failed to delete build:', err);
    return NextResponse.json({ error: 'Failed to delete build.' }, { status: 500 });
  }
}
