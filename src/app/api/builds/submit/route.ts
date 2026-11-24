import { revalidateTag } from 'next/cache';
import { after, NextRequest, NextResponse } from 'next/server';
import charactersData from '@/data/characters.json';
import { notifyDiscordBuildPublished } from '@/lib/community-builds/discord';
import {
  consumeRateLimit,
  getClientIp,
  hashActor,
  verifyTurnstile,
} from '@/lib/community-builds/security';
import { generateBuildSlug, validatePublishInput } from '@/lib/community-builds/validation';
import { CURRENT_PATCH, getResolvedCommunityPresets } from '@/lib/community-presets';
import { getSql } from '@/lib/db/neon';
import type { SSCharacter } from '@/types';

export async function POST(request: NextRequest) {
  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      { error: 'Community publishing is not configured on this server yet.' },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const ip = getClientIp(request);
  const ipHash = hashActor('submit', ip);

  // Fast in-memory validation first so typos and honeypot traps never consume a real user's hourly publish quota
  const validation = validatePublishInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const turnstileToken =
    typeof body.turnstileToken === 'string' ? body.turnstileToken : null;
  const turnstile = await verifyTurnstile(turnstileToken, ip);
  if (!turnstile.ok) {
    return NextResponse.json(
      { error: turnstile.error || 'Verification failed.' },
      { status: 400 }
    );
  }

  const { data } = validation;

  // Duplicate check against curated presets
  const curatedDuplicate = getResolvedCommunityPresets().find(
    (preset) => preset.advCode === data.advCode
  );
  if (curatedDuplicate) {
    return NextResponse.json(
      {
        error: 'This exact build already exists in Community Builds.',
        existingId: curatedDuplicate.id,
        existingUrl: `/builds/${encodeURIComponent(curatedDuplicate.id)}`,
      },
      { status: 409 }
    );
  }

  // Duplicate check against active community builds
  try {
    const existingRows = (await sql`
      SELECT id
      FROM community_builds
      WHERE adv_code = ${data.advCode}
        AND status IN ('live', 'verified')
      LIMIT 1
    `) as Array<{ id: string }>;

    if (existingRows[0]) {
      const existingId = existingRows[0].id;
      return NextResponse.json(
        {
          error: 'This exact build has already been published.',
          existingId,
          existingUrl: `/builds/${encodeURIComponent(existingId)}`,
        },
        { status: 409 }
      );
    }
  } catch (err) {
    console.error('Duplicate build check failed:', err);
    return NextResponse.json({ error: 'Database query failed.' }, { status: 500 });
  }

  // Consume hourly publish quota only after validation & duplicate checks pass
  try {
    const rl = await consumeRateLimit(sql, 'submit', ipHash, 3, 3600);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Submission rate limit reached. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }
  } catch (err) {
    console.error('Rate limit check failed:', err);
    return NextResponse.json({ error: 'Unable to process submission.' }, { status: 500 });
  }

  const id = generateBuildSlug(data.title);

  try {
    await sql`
      INSERT INTO community_builds (
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
        combat_rotation,
        adv_code,
        in_game_code,
        verified_patch,
        submitter_hash
      )
      VALUES (
        ${id},
        'live',
        ${data.title},
        ${data.authorName},
        ${data.element},
        ${data.archetype},
        ${data.tier},
        ${JSON.stringify(data.modes)}::jsonb,
        ${data.summary},
        ${JSON.stringify(data.rotation)}::jsonb,
        ${data.combatRotation ? JSON.stringify(data.combatRotation) : null}::jsonb,
        ${data.advCode},
        ${data.inGameCode},
        ${CURRENT_PATCH},
        ${ipHash}
      )
    `;

    await sql`
      INSERT INTO build_metrics (build_id, views_count, upvotes_count)
      VALUES (${id}, 0, 0)
      ON CONFLICT (build_id) DO NOTHING
    `;
  } catch (err: unknown) {
    const pgCode =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (pgCode === '23505') {
      const dupRows = (await sql`
        SELECT id
        FROM community_builds
        WHERE adv_code = ${data.advCode}
          AND status IN ('live', 'verified')
        LIMIT 1
      `) as Array<{ id: string }>;
      if (dupRows[0]) {
        return NextResponse.json(
          {
            error: 'This exact build has already been published.',
            existingId: dupRows[0].id,
            existingUrl: `/builds/${encodeURIComponent(dupRows[0].id)}`,
          },
          { status: 409 }
        );
      }
    }
    console.error('Failed to insert community build:', err);
    return NextResponse.json({ error: 'Failed to save build.' }, { status: 500 });
  }

  revalidateTag('community-builds', { expire: 0 });
  revalidateTag(`build:${id}`, { expire: 0 });

  const allCharacters = charactersData as Record<string, SSCharacter>;
  const trekkerNames = data.characterIds.map(
    (cid) => allCharacters[String(cid)]?.name?.EN || `#${cid}`
  );

  after(async () => {
    await notifyDiscordBuildPublished({
      id,
      title: data.title,
      authorName: data.authorName,
      element: data.element,
      trekkerNames,
    });
  });

  return NextResponse.json(
    { id, url: `/builds/${encodeURIComponent(id)}` },
    { status: 201 }
  );
}
