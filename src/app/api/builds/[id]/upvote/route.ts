import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  consumeRateLimit,
  getClientIp,
  hashActor,
  VISITOR_COOKIE_NAME,
} from '@/lib/community-builds/security';
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
  if (!sql) {
    return NextResponse.json(
      { error: 'Metrics database is not configured.' },
      { status: 503 }
    );
  }

  const ip = getClientIp(request);
  const ipHash = hashActor('upvote_rl', ip);

  try {
    const rl = await consumeRateLimit(sql, 'upvote', ipHash, 30, 60);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many vote requests. Please wait a moment.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
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

    const existingVid = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
    const isNewVid = !existingVid;
    const vid = existingVid || crypto.randomUUID();
    const voterHash = hashActor('vote', vid, ip);

    const deleted = (await sql`
      DELETE FROM build_votes
      WHERE build_id = ${id}
        AND voter_hash = ${voterHash}
      RETURNING build_id
    `) as Array<{ build_id: string }>;

    let voted = false;
    let upvotesCount = 0;

    if (deleted.length > 0) {
      voted = false;
      const mRows = (await sql`
        INSERT INTO build_metrics (build_id, views_count, upvotes_count, updated_at)
        VALUES (${id}, 0, 0, NOW())
        ON CONFLICT (build_id)
        DO UPDATE SET
          upvotes_count = GREATEST(0, build_metrics.upvotes_count - 1),
          updated_at = NOW()
        RETURNING upvotes_count
      `) as Array<{ upvotes_count: number }>;
      upvotesCount = Number(mRows[0]?.upvotes_count ?? 0) || 0;
    } else {
      voted = true;
      const inserted = (await sql`
        INSERT INTO build_votes (build_id, voter_hash)
        VALUES (${id}, ${voterHash})
        ON CONFLICT DO NOTHING
        RETURNING build_id
      `) as Array<{ build_id: string }>;

      if (inserted.length > 0) {
        const mRows = (await sql`
          INSERT INTO build_metrics (build_id, views_count, upvotes_count, updated_at)
          VALUES (${id}, 0, 1, NOW())
          ON CONFLICT (build_id)
          DO UPDATE SET
            upvotes_count = build_metrics.upvotes_count + 1,
            updated_at = NOW()
          RETURNING upvotes_count
        `) as Array<{ upvotes_count: number }>;
        upvotesCount = Number(mRows[0]?.upvotes_count ?? 1) || 1;
      } else {
        const mRows = (await sql`
          SELECT upvotes_count
          FROM build_metrics
          WHERE build_id = ${id}
          LIMIT 1
        `) as Array<{ upvotes_count: number }>;
        upvotesCount = Number(mRows[0]?.upvotes_count ?? 0) || 0;
      }
    }

    const response = NextResponse.json({ upvotesCount, voted });
    if (isNewVid) {
      response.cookies.set(VISITOR_COOKIE_NAME, vid, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 31_536_000,
        secure: process.env.NODE_ENV === 'production',
      });
    }
    return response;
  } catch (err) {
    console.error('Failed to toggle build upvote:', err);
    return NextResponse.json({ error: 'Failed to update vote.' }, { status: 500 });
  }
}
