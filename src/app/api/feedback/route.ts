import { after, NextRequest, NextResponse } from 'next/server';
import {
  consumeRateLimit,
  getClientIp,
  hashActor,
} from '@/lib/community-builds/security';
import { getSql } from '@/lib/db/neon';
import { notifyDiscordFeedbackSubmitted } from '@/lib/feedback/discord';
import {
  generateFeedbackId,
  validateFeedbackInput,
} from '@/lib/feedback/validation';

export async function POST(request: NextRequest) {
  const sql = getSql();
  if (!sql) {
    return NextResponse.json(
      { error: 'Feedback inbox is not configured on this server yet.' },
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

  // Validate payload & honeypot before consuming hourly rate-limit quota
  const validation = validateFeedbackInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data } = validation;
  const ipHash = hashActor('feedback', getClientIp(request));

  try {
    const rl = await consumeRateLimit(sql, 'feedback', ipHash, 5, 3600);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many feedback submissions. Please try again later.' },
        {
          status: 429,
          headers: { 'Retry-After': String(rl.retryAfterSec) },
        }
      );
    }
  } catch (err) {
    console.error('Feedback rate limit check failed:', err);
    return NextResponse.json(
      { error: 'Unable to process feedback right now.' },
      { status: 500 }
    );
  }

  const id = generateFeedbackId();

  try {
    await sql`
      INSERT INTO community_feedback (
        id,
        category,
        status,
        page_context,
        message,
        contact,
        submitter_hash
      )
      VALUES (
        ${id},
        ${data.category},
        'open',
        ${data.pageContext},
        ${data.message},
        ${data.contact},
        ${ipHash}
      )
    `;
  } catch (err) {
    console.error('Failed to save feedback:', err);
    return NextResponse.json(
      { error: 'Failed to save feedback. Please try again.' },
      { status: 500 }
    );
  }

  after(async () => {
    await notifyDiscordFeedbackSubmitted({
      id,
      category: data.category,
      pageContext: data.pageContext,
      message: data.message,
      contact: data.contact,
    });
  });

  return NextResponse.json({ ok: true, id }, { status: 201 });
}
