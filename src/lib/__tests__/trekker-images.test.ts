import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  md5Hex,
  getWikiTideFileUrl,
  formatIllustrationVariantLabel,
} from '../wikitide.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');

describe('WikiTide Trekker illustrations', () => {
  it('computes MD5 hashes matching node:crypto and builds canonical WikiTide CDN URLs', () => {
    const samples = ['Chaton_a_02.png', 'Chaton_b_02.png', 'Koyuki_02.png', 'Chitose awakened 02.png'];
    for (const name of samples) {
      const clean = name.trim().replace(/ /g, '_');
      const expectedHash = crypto.createHash('md5').update(clean).digest('hex');
      assert.equal(md5Hex(clean), expectedHash);
      assert.equal(
        getWikiTideFileUrl(name),
        `https://static.wikitide.net/stellasorawiki/${expectedHash[0]}/${expectedHash.slice(0, 2)}/${encodeURIComponent(clean)}`
      );
    }
  });

  it('formats human-readable variant labels cleanly', () => {
    assert.equal(formatIllustrationVariantLabel('Chaton_a_02.png', 'Chaton'), 'Pose A');
    assert.equal(formatIllustrationVariantLabel('Chaton_b_02.png', 'Chaton'), 'Pose B');
    assert.equal(formatIllustrationVariantLabel('Chaton_awakened_02.png', 'Chaton'), 'Awakened');
    assert.equal(formatIllustrationVariantLabel('Tilia_skin1_02.png', 'Tilia'), 'Skin 1');
    assert.equal(formatIllustrationVariantLabel('Firefly_Bright_a_02.png', 'Firefly'), 'Bright A');
  });

  it('maps every Trekker in characters.json to at least one *_02.png illustration', () => {
    const charactersRaw = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'characters.json'), 'utf8')
    ) as Record<string, { id: number; name: { EN: string } }> | Array<{ id: number; name: { EN: string } }>;
    const characters = Array.isArray(charactersRaw) ? charactersRaw : Object.values(charactersRaw);
    const illustrations = JSON.parse(
      fs.readFileSync(path.join(dataDir, 'trekker-illustrations.json'), 'utf8')
    ) as Record<string, string[]>;

    assert.ok(characters.length >= 41);
    for (const char of characters) {
      const files = illustrations[String(char.id)];
      assert.ok(
        Array.isArray(files) && files.length >= 1,
        `Missing illustrations for ${char.name.EN} (${char.id})`
      );
      for (const file of files) {
        assert.match(file, /_02\.png$/);
      }
    }
  });
});
