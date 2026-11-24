import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ADMIN_COOKIE_NAME,
  createAdminCookieValue,
  isAdminRequestAuthorized,
} from '../../community-builds/security.ts';
import {
  generateFeedbackId,
  resolveFeedbackFromPath,
  validateFeedbackInput,
} from '../validation.ts';
import {
  buildDiscordFeedbackEmbed,
  notifyDiscordFeedbackSubmitted,
} from '../discord.ts';

describe('feedback validation & helpers', () => {
  it('accepts valid feedback, preserves message newlines, and normalizes optional fields', () => {
    const res = validateFeedbackInput({
      category: 'math',
      pageContext: '  /builds/local\r\n ',
      message: '  Eleanor Support Skill +3\r\nlooks off by 2%  ',
      contact: '  tomi#1234\n ',
      website: '',
    });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.data.category, 'math');
    assert.equal(res.data.pageContext, '/builds/local');
    assert.equal(res.data.message, 'Eleanor Support Skill +3\nlooks off by 2%');
    assert.equal(res.data.contact, 'tomi#1234');
  });

  it('rejects honeypot, invalid category, short/long messages, and oversized optional fields', () => {
    assert.equal(
      validateFeedbackInput({
        category: 'bug',
        message: 'Valid length message',
        website: 'https://spam.example',
      }).ok,
      false
    );
    assert.equal(
      validateFeedbackInput({
        category: 'unknown',
        message: 'Valid length message',
      }).ok,
      false
    );
    assert.equal(
      validateFeedbackInput({
        category: 'bug',
        message: '   short\u0000  ',
      }).ok,
      false
    );
    assert.equal(
      validateFeedbackInput({
        category: 'bug',
        message: 'a'.repeat(2001),
      }).ok,
      false
    );
    assert.equal(
      validateFeedbackInput({
        category: 'bug',
        message: 'Valid length message',
        contact: 'x'.repeat(121),
      }).ok,
      false
    );
    assert.equal(
      validateFeedbackInput({
        category: 'bug',
        message: 'Valid length message',
        pageContext: '/'.repeat(121),
      }).ok,
      false
    );
  });

  it('sanitizes ?from= paths against external URLs, // redirects, /admin, and /feedback', () => {
    assert.deepEqual(resolveFeedbackFromPath('https://evil.example/phish'), {
      sectionValue: '',
      exactPath: null,
    });
    assert.deepEqual(resolveFeedbackFromPath('//evil.example'), {
      sectionValue: '',
      exactPath: null,
    });
    assert.deepEqual(resolveFeedbackFromPath('/admin/builds'), {
      sectionValue: '',
      exactPath: null,
    });
    assert.deepEqual(resolveFeedbackFromPath('/feedback'), {
      sectionValue: '',
      exactPath: null,
    });
    assert.deepEqual(resolveFeedbackFromPath('/trekkers/Eleanor?tab=skills#top'), {
      sectionValue: '/trekkers',
      exactPath: '/trekkers/Eleanor',
    });
    assert.deepEqual(resolveFeedbackFromPath('/'), {
      sectionValue: '',
      exactPath: '/',
    });
  });

  it('truncates 2000-char messages inside Discord embed fields and ignores DISCORD_BUILD_WEBHOOK_URL', async () => {
    const id = generateFeedbackId(1700000000000);
    assert.match(id, /^fb_[0-9a-z]+_[0-9a-f]{6}$/);

    const embed = buildDiscordFeedbackEmbed({
      id,
      category: 'bug',
      pageContext: '/damage',
      message: 'm'.repeat(1900),
      contact: null,
    });
    const fields = embed.fields as Array<{ name: string; value: string }>;
    const msgField = fields.find((f) => f.name === 'Details');
    assert.ok(msgField && msgField.value.length <= 1024);

    const prevFeedback = process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
    const prevBuild = process.env.DISCORD_BUILD_WEBHOOK_URL;
    let called = false;
    const origFetch = globalThis.fetch;
    try {
      delete process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
      process.env.DISCORD_BUILD_WEBHOOK_URL = 'https://discord.invalid/public-builds';
      globalThis.fetch = (async () => {
        called = true;
        return new Response(null, { status: 204 });
      }) as typeof fetch;
      await notifyDiscordFeedbackSubmitted({
        id: 'fb_test',
        category: 'other',
        pageContext: null,
        message: 'Private note with contact',
        contact: 'secret@example.com',
      });
      assert.equal(called, false);
    } finally {
      globalThis.fetch = origFetch;
      if (prevFeedback === undefined) delete process.env.DISCORD_FEEDBACK_WEBHOOK_URL;
      else process.env.DISCORD_FEEDBACK_WEBHOOK_URL = prevFeedback;
      if (prevBuild === undefined) delete process.env.DISCORD_BUILD_WEBHOOK_URL;
      else process.env.DISCORD_BUILD_WEBHOOK_URL = prevBuild;
    }
  });

  it('authorizes requests only with a valid signed sstt_admin cookie', () => {
    const secret = 'test-admin-secret-32chars-minimum';
    const validCookie = createAdminCookieValue(secret);
    const makeReq = (val?: string) => ({
      cookies: {
        get: (name: string) =>
          name === ADMIN_COOKIE_NAME && val ? { value: val } : undefined,
      },
    });
    assert.equal(isAdminRequestAuthorized(makeReq(validCookie), secret), true);
    assert.equal(isAdminRequestAuthorized(makeReq('tampered'), secret), false);
    assert.equal(isAdminRequestAuthorized(makeReq(undefined), secret), false);
    assert.equal(isAdminRequestAuthorized(makeReq(validCookie), ''), false);
  });
});
