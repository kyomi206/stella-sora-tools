import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import characters from '../../data/characters.json' with { type: 'json' };
import { getTrekkerImageUrl } from '../wikitide.ts';

describe('Trekker portraits self-hosting', () => {
  it('every Trekker in characters.json has a mirrored portrait', () => {
    const ids = Object.keys(characters);
    assert.strictEqual(ids.length, 41);

    for (const id of ids) {
      const filePath = path.join(process.cwd(), 'public', 'trekkers', `${id}.webp`);
      assert.ok(fs.existsSync(filePath), `Missing portrait file: ${filePath}`);
      const stats = fs.statSync(filePath);
      assert.ok(
        stats.size > 5000,
        `Portrait file ${id}.webp is too small (${stats.size} bytes), expected > 5000 bytes`
      );
    }
  });

  it('getTrekkerImageUrl returns the local path', () => {
    assert.strictEqual(getTrekkerImageUrl(144), '/trekkers/144.webp');
  });
});
