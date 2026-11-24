import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server.js';
import referencePresetsData from '../calculator/__tests__/fixtures/reference-presets.json' with { type: 'json' };
import { resolveCommunityPreset, type CommunityPresetEntry } from '../community-presets.ts';
import { localWebpToPngDataUrl, remoteWebpToPngDataUrl } from '../og-image.ts';
import { GET, renderBuildOgResponse } from '../og-route.ts';

const ROOT_DIR = path.resolve(import.meta.dirname, '../../..');

function assertValidPng1200x630(buf: Buffer, label: string) {
  assert.ok(buf.length > 5000, `${label}: expected > 5000 bytes, got ${buf.length}`);
  assert.equal(
    buf.subarray(0, 8).toString('hex'),
    '89504e470d0a1a0a',
    `${label}: missing PNG signature`
  );
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  assert.equal(width, 1200, `${label}: expected width 1200, got ${width}`);
  assert.equal(height, 630, `${label}: expected height 630, got ${height}`);
}

describe('Dynamic OG Image Helper & /api/og Route', () => {
  it('localWebpToPngDataUrl converts local .webp to PNG data URL and blocks path traversal', async () => {
    const dataUrl = await localWebpToPngDataUrl('trekkers/137.webp', 256);
    assert.ok(dataUrl && dataUrl.startsWith('data:image/png;base64,'));
    const decoded = Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64');
    assert.equal(decoded.subarray(0, 4).toString('hex'), '89504e47');

    assert.equal(await localWebpToPngDataUrl('../package.json', 256), null);
    assert.equal(await localWebpToPngDataUrl('../../etc/passwd', 256), null);
    assert.equal(await localWebpToPngDataUrl('C:/Windows/win.ini', 256), null);
    assert.equal(await localWebpToPngDataUrl('trekkers/does-not-exist-9999.webp', 256), null);
  });

  it('remoteWebpToPngDataUrl strictly allowlists ssassets origin against SSRF', async () => {
    let called = false;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      called = true;
      return new Response(null, { status: 500 });
    }) as typeof fetch;

    try {
      assert.equal(await remoteWebpToPngDataUrl('https://example.com/evil.webp'), null);
      assert.equal(await remoteWebpToPngDataUrl('http://169.254.169.254/latest/meta-data/'), null);
      assert.equal(
        await remoteWebpToPngDataUrl(
          'https://raw.githubusercontent.com/someone-else/repo/main/x.webp'
        ),
        null
      );
      assert.equal(
        await remoteWebpToPngDataUrl(
          'https://raw.githubusercontent.com/AutumnVN/ssassets/%2e%2e/%2e%2e/other/repo/x.webp'
        ),
        null
      );
      assert.equal(
        await remoteWebpToPngDataUrl(
          'https://raw.githubusercontent.com/AutumnVN/ssassets/main/x.webp?redirect=http://127.0.0.1'
        ),
        null
      );
      assert.equal(called, false, 'Disallowed URLs must never invoke fetch');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('GET /api/og?type=trekker&id=137 renders a 1200x630 PNG card with cache headers', async () => {
    const req = new NextRequest('https://kiyostella.vercel.app/api/og?type=trekker&id=137');
    const res = await GET(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    const cacheControl = res.headers.get('cache-control') || '';
    assert.ok(cacheControl.includes('s-maxage=604800'));

    const buf = Buffer.from(await res.arrayBuffer());
    assertValidPng1200x630(buf, 'trekker-137');
  });

  it('GET /api/og?type=disc&id=214021 renders 1200x630 PNG even when fetch fails offline', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('offline simulated');
    }) as typeof fetch;

    try {
      const req = new NextRequest('https://kiyostella.vercel.app/api/og?type=disc&id=214021');
      const res = await GET(req);
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('content-type'), 'image/png');

      const buf = Buffer.from(await res.arrayBuffer());
      assertValidPng1200x630(buf, 'disc-214021-offline');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('renderBuildOgResponse renders a 1200x630 PNG card for a resolved squad preset', async () => {
    const entries = referencePresetsData as unknown as CommunityPresetEntry[];
    const sample = resolveCommunityPreset(entries[0]);
    assert.ok(sample, 'Expected sample reference preset');

    const res = await renderBuildOgResponse(sample);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    const buf = Buffer.from(await res.arrayBuffer());
    assertValidPng1200x630(buf, 'build-sample');
  });

  it('GET /api/og?type=disc&id=214032 renders special symbol disc names cleanly without missing glyphs', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('offline simulated');
    }) as typeof fetch;

    try {
      const req = new NextRequest('https://kiyostella.vercel.app/api/og?type=disc&id=214032');
      const res = await GET(req);
      assert.equal(res.status, 200);
      const buf = Buffer.from(await res.arrayBuffer());
      assertValidPng1200x630(buf, 'disc-214032-symbol');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('GET /api/og redirects unknown, missing, or malformed requests 302 to /kiyostella.png', async () => {
    for (const url of [
      'https://kiyostella.vercel.app/api/og',
      'https://kiyostella.vercel.app/api/og?type=trekker&id=999999',
      'https://kiyostella.vercel.app/api/og?type=trekker&id=%E0%A4%A',
      'https://kiyostella.vercel.app/api/og?type=disc&id=999999',
      'https://kiyostella.vercel.app/api/og?type=build&id=nonexistent-build-id',
      'https://kiyostella.vercel.app/api/og?type=unknown&id=1',
    ]) {
      const res = await GET(new NextRequest(url));
      assert.equal(res.status, 302, `Expected 302 for ${url}`);
      assert.equal(
        res.headers.get('location'),
        'https://kiyostella.vercel.app/kiyostella.png',
        `Expected /kiyostella.png redirect for ${url}`
      );
    }
  });

  it('detail pages wire /api/og ogImage while keeping titles untouched', () => {
    const trekkerPage = fs.readFileSync(
      path.join(ROOT_DIR, 'src/app/trekkers/[name]/page.tsx'),
      'utf8'
    );
    const discPage = fs.readFileSync(
      path.join(ROOT_DIR, 'src/app/discs/[slug]/page.tsx'),
      'utf8'
    );
    const buildPage = fs.readFileSync(
      path.join(ROOT_DIR, 'src/app/builds/[id]/page.tsx'),
      'utf8'
    );

    assert.ok(trekkerPage.includes('title: char.name.EN'));
    assert.ok(trekkerPage.includes('/api/og?type=trekker&id='));
    assert.ok(discPage.includes('title: disc.name'));
    assert.ok(discPage.includes('/api/og?type=disc&id='));
    assert.ok(buildPage.includes('title: preset.title'));
    assert.ok(buildPage.includes('/api/og?type=build&id='));
  });
});
