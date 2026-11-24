import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import robots from '../../app/robots.ts';
import sitemap from '../../app/sitemap.ts';
import { GET as getLlmsTxt } from '../../app/llms.txt/route.ts';
import { getAllDiscs, getExclusiveBannerByDiscId } from '../discs.ts';
import { getCachedCommunityBuilds } from '../community-builds/store.ts';
import {
  buildBreadcrumbJsonLd,
  buildDiscDescription,
  buildPageMetadata,
  buildTrekkerDescription,
  buildWebApplicationJsonLd,
  CONTENT_LAST_MODIFIED,
  DEFAULT_OG_HEIGHT,
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_WIDTH,
  serializeJsonLd,
} from '../seo.ts';
import type { SSCharacter } from '../../types/index.ts';

const ROOT_DIR = path.resolve(import.meta.dirname, '../../..');
const CHARACTERS_PATH = path.join(ROOT_DIR, 'src/data/characters.json');
const LORE_PATH = path.join(ROOT_DIR, 'src/data/trekker-lore.json');
const COMBAT_PATH = path.join(ROOT_DIR, 'src/data/character-combat.json');

describe('KiyoStella SEO & AI Discoverability', () => {
  it('robots() configures search, AI search, and AI training rules cleanly without blocking /api/og', () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];
    const expectedDisallow = ['/admin/', '/api/admin/', '/api/builds/', '/api/feedback'];

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
      assert.deepEqual(
        rule.disallow,
        expectedDisallow,
        `${allowedAgent} should disallow private admin and write APIs without blocking /api/og`
      );
      const disallows = Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow];
      assert.equal(disallows.includes('/api/'), false, 'Must not block /api/og via bare /api/');
      assert.equal(disallows.includes('/api/og'), false, 'Must not block /api/og');
    }

    for (const blockedAgent of ['Bytespider', 'CCBot']) {
      const rule = findRuleForAgent(blockedAgent);
      assert.ok(rule, `Missing robots rule for ${blockedAgent}`);
      assert.equal(rule.disallow, '/', `${blockedAgent} should disallow /`);
    }

    assert.ok(config.sitemap && String(config.sitemap).endsWith('/sitemap.xml'));
  });

  it('sitemap() awaits community builds, updates lastModified, and excludes /damage and numeric aliases', async () => {
    assert.equal(CONTENT_LAST_MODIFIED, '2026-11-24');

    const [entries, builds] = await Promise.all([sitemap(), getCachedCommunityBuilds()]);
    const expectedCount = 159 + builds.length; // 11 static + 42 trekkers + 106 discs + public builds
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
    assert.ok(urls.some((u) => u.endsWith('/feedback')));
  });

  it('buildPageMetadata supports custom ogImage while preserving all titles unchanged', () => {
    const meta = buildPageMetadata({
      title: 'Test Page',
      description: 'Test description',
      path: '/trekkers/',
    });

    assert.equal(meta.title, 'Test Page');
    assert.equal(meta.openGraph?.title, 'Test Page | kiyostella');
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

    const customOgMeta = buildPageMetadata({
      title: 'Eleanor',
      description: 'Eleanor guide',
      path: '/trekkers/Eleanor',
      ogImage: {
        url: '/api/og?type=trekker&id=137',
        alt: 'Eleanor',
      },
    });
    assert.equal(customOgMeta.title, 'Eleanor');
    assert.equal(customOgMeta.openGraph?.title, 'Eleanor | kiyostella');
    assert.equal(customOgMeta.twitter?.title, 'Eleanor | kiyostella');
    assert.deepEqual(customOgMeta.openGraph?.images, [
      {
        url: '/api/og?type=trekker&id=137',
        width: 1200,
        height: 630,
        alt: 'Eleanor',
      },
    ]);
    assert.deepEqual(customOgMeta.twitter?.images, ['/api/og?type=trekker&id=137']);

    const homeMeta = buildPageMetadata({
      title: 'Stella Sora Tools | kiyostella',
      absoluteTitle: true,
      description: 'Home desc',
      path: '/',
    });
    assert.deepEqual(homeMeta.title, { absolute: 'Stella Sora Tools | kiyostella' });
    assert.equal(homeMeta.openGraph?.title, 'Stella Sora Tools | kiyostella');

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

  it('llms.txt route includes /feedback, avoids "0 curated" text, and lists all 42 Trekkers', async () => {
    const res = await getLlmsTxt();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/plain; charset=utf-8');

    const text = await res.text();
    assert.ok(text.includes('# KiyoStella'));
    assert.equal(text.includes('/damage'), false, 'Must not expose /damage in llms.txt');
    assert.equal(text.includes('0 curated'), false, 'Must not claim 0 curated builds');
    assert.equal(text.includes('Browse 0 '), false, 'Must not print Browse 0');

    for (const pathSegment of [
      '/builds',
      '/builder',
      '/builder/advanced',
      '/bond',
      '/calculator',
      '/roadmap',
      '/trekkers',
      '/discs',
      '/feedback',
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

  it('optimized favicons exist on disk and layout/home keep exact titles while mentioning Community Builds', () => {
    for (const iconFile of [
      'public/favicon-32x32.png',
      'public/favicon-48x48.png',
      'public/apple-touch-icon.png',
    ]) {
      const fullPath = path.join(ROOT_DIR, iconFile);
      assert.ok(fs.existsSync(fullPath), `Missing ${iconFile}`);
      const buf = fs.readFileSync(fullPath);
      assert.equal(buf.subarray(0, 4).toString('hex'), '89504e47', `${iconFile} must be PNG`);
      assert.ok(buf.length <= 15_000, `${iconFile} should be <= 15 KB (got ${buf.length})`);
    }
    assert.ok(
      fs.existsSync(path.join(ROOT_DIR, 'public/bastelina.png')),
      'public/bastelina.png must remain intact'
    );

    const layoutSource = fs.readFileSync(path.join(ROOT_DIR, 'src/app/layout.tsx'), 'utf8');
    const pageSource = fs.readFileSync(path.join(ROOT_DIR, 'src/app/page.tsx'), 'utf8');
    assert.ok(layoutSource.includes("default: 'Stella Sora Tools | kiyostella'"));
    assert.ok(layoutSource.includes("template: '%s | kiyostella'"));
    assert.ok(layoutSource.includes('/favicon-32x32.png'));
    assert.ok(layoutSource.includes('/favicon-48x48.png'));
    assert.ok(layoutSource.includes('/apple-touch-icon.png'));
    assert.ok(layoutSource.includes('Community Builds'));
    assert.ok(pageSource.includes("title: 'Stella Sora Tools | kiyostella'"));
    assert.ok(pageSource.includes('Community Builds'));
  });

  it('buildTrekkerDescription and buildDiscDescription stay within 50..160 chars across all 42 Trekkers and 106 Discs', () => {
    const rawChars = JSON.parse(fs.readFileSync(CHARACTERS_PATH, 'utf8')) as Record<
      string,
      SSCharacter
    >;
    const loreMap = JSON.parse(fs.readFileSync(LORE_PATH, 'utf8')) as Record<string, any>;
    const combatMap = JSON.parse(fs.readFileSync(COMBAT_PATH, 'utf8')) as Record<string, any>;

    const chars = Object.values(rawChars);
    assert.equal(chars.length, 42);
    for (const char of chars) {
      const lore = loreMap[String(char.id)] || loreMap[char.name.EN] || null;
      const combat = combatMap[String(char.id)] || null;
      const desc = buildTrekkerDescription(char, lore, combat);
      assert.ok(
        desc.length >= 50 && desc.length <= 160,
        `Trekker ${char.name.EN} description out of bounds (${desc.length}): ${desc}`
      );
      assert.ok(desc.includes(char.name.EN), `Missing Trekker name in ${desc}`);
      assert.ok(desc.includes(char.element), `Missing element in ${desc}`);
    }

    const discs = getAllDiscs();
    assert.equal(discs.length, 106);
    for (const disc of discs) {
      const exclusive = getExclusiveBannerByDiscId(disc.id);
      const desc = buildDiscDescription(disc, exclusive?.trekkerName);
      assert.ok(
        desc.length >= 50 && desc.length <= 160,
        `Disc ${disc.name} description out of bounds (${desc.length}): ${desc}`
      );
      assert.ok(desc.includes(disc.name), `Missing Disc name in ${desc}`);
    }
  });
});
