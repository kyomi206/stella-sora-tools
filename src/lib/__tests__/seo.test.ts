import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import robots from '../../app/robots.ts';
import sitemap from '../../app/sitemap.ts';
import { GET as getLlmsTxt } from '../../app/llms.txt/route.ts';
import { getResolvedCommunityPresets } from '../community-presets.ts';
import {
  buildBreadcrumbJsonLd,
  buildPageMetadata,
  buildWebApplicationJsonLd,
  DEFAULT_OG_HEIGHT,
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_WIDTH,
  serializeJsonLd,
} from '../seo.ts';

const ROOT_DIR = path.resolve(import.meta.dirname, '../../..');
const CHARACTERS_PATH = path.join(ROOT_DIR, 'src/data/characters.json');

describe('KiyoStella SEO & AI Discoverability', () => {
  it('robots() configures search, AI search, and AI training rules cleanly', () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];

    const findRuleForAgent = (agent: string) =>
      rules.find((rule) =>
        Array.isArray(rule.userAgent)
          ? rule.userAgent.includes(agent)
          : rule.userAgent === agent
      );

    for (const allowedAgent of [
      'Googlebot',
      'bingbot',
      'OAI-SearchBot',
      'PerplexityBot',
      'GPTBot',
      'Google-Extended',
      'ClaudeBot',
      '*',
    ]) {
      const rule = findRuleForAgent(allowedAgent);
      assert.ok(rule, `Missing robots rule for ${allowedAgent}`);
      assert.equal(rule.allow, '/', `${allowedAgent} should allow /`);
      assert.equal(rule.disallow, undefined, `${allowedAgent} should not disallow`);
    }

    for (const blockedAgent of ['Bytespider', 'CCBot']) {
      const rule = findRuleForAgent(blockedAgent);
      assert.ok(rule, `Missing robots rule for ${blockedAgent}`);
      assert.equal(rule.disallow, '/', `${blockedAgent} should disallow /`);
    }

    assert.ok(config.sitemap && String(config.sitemap).endsWith('/sitemap.xml'));
  });

  it('sitemap() includes canonical URLs, excludes /damage and numeric aliases', () => {
    const entries = sitemap();
    const expectedCount = 158 + getResolvedCommunityPresets().length; // 10 static + 42 trekkers + 106 discs + public builds
    assert.equal(entries.length, expectedCount);

    const urls = entries.map((e) => e.url);
    assert.equal(new Set(urls).size, entries.length, 'Sitemap URLs must be unique');

    for (const entry of entries) {
      assert.ok(entry.lastModified, `Missing lastModified for ${entry.url}`);
      assert.equal(entry.url.includes('/damage'), false, 'Must exclude /damage');
      assert.equal(
        /\/(?:trekkers|discs)\/\d+$/.test(entry.url),
        false,
        `Must exclude numeric alias URL: ${entry.url}`
      );
    }

    assert.ok(urls.some((u) => u.endsWith('/trekkers/Chitose')));
    assert.ok(urls.some((u) => u.endsWith('/trekkers/Snowish%20Laru')));
    assert.ok(urls.some((u) => u.endsWith('/discs/beneath-billowing-sails')));
    assert.ok(urls.some((u) => u.endsWith('/builds')));
  });

  it('buildPageMetadata, JSON-LD builders, and serializeJsonLd escape safely', () => {
    const meta = buildPageMetadata({
      title: 'Test Page',
      description: 'Test description',
      path: '/trekkers/',
    });

    assert.equal(meta.alternates?.canonical, '/trekkers');
    assert.deepEqual(meta.openGraph?.images, [
      {
        url: DEFAULT_OG_IMAGE,
        width: DEFAULT_OG_WIDTH,
        height: DEFAULT_OG_HEIGHT,
        alt: 'KiyoStella — a Stella Sora utility web',
      },
    ]);
    assert.equal((meta.twitter as { card?: string })?.card, 'summary_large_image');
    assert.equal((meta.robots as { index?: boolean })?.index, true);

    const noIndexMeta = buildPageMetadata({
      title: 'Hidden',
      description: 'Hidden desc',
      path: '/damage',
      noIndex: true,
    });
    assert.equal((noIndexMeta.robots as { index?: boolean })?.index, false);

    const breadcrumb = buildBreadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Trekkers', path: '/trekkers' },
    ]);
    assert.equal(breadcrumb['@type'], 'BreadcrumbList');
    assert.equal(breadcrumb.itemListElement.length, 2);

    const appLd = buildWebApplicationJsonLd({
      name: 'KiyoStella Builder',
      description: 'Squad builder',
      path: '/builder',
      featureList: ['Squad builder'],
    });
    assert.equal(appLd['@type'], 'WebApplication');
    assert.equal((appLd as Record<string, unknown>).aggregateRating, undefined);

    const escaped = serializeJsonLd({ text: '</script><alert(1)>' });
    assert.equal(escaped.includes('<'), false);
    assert.ok(escaped.includes('\\u003c/script>'));
  });

  it('llms.txt route returns structured guide with all tools, terminology, and 42 Trekkers', async () => {
    const res = await getLlmsTxt();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');

    const text = await res.text();
    assert.ok(text.includes('# KiyoStella'));
    assert.equal(text.includes('/damage'), false, 'Must not expose /damage in llms.txt');

    for (const pathSegment of [
      '/builds',
      '/builder',
      '/builder/advanced',
      '/bond',
      '/calculator',
      '/roadmap',
      '/trekkers',
      '/discs',
      'Stella Sora Terminology',
      'Runic Discs',
      'Potentials',
    ]) {
      assert.ok(text.includes(pathSegment), `llms.txt missing ${pathSegment}`);
    }

    const rawChars = JSON.parse(fs.readFileSync(CHARACTERS_PATH, 'utf8')) as Record<
      string,
      { name: { EN: string } }
    >;
    for (const char of Object.values(rawChars)) {
      assert.ok(text.includes(char.name.EN), `llms.txt missing Trekker ${char.name.EN}`);
    }
  });
});
