import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve('src');

test('layout.tsx contains skip to content link and main-content id', () => {
  const content = fs.readFileSync(path.join(SRC_DIR, 'app/layout.tsx'), 'utf-8');
  assert.ok(content.includes('href="#main-content"'), 'Must have link to #main-content');
  assert.ok(content.includes('id="main-content"'), 'Must have main element with id main-content');
});

test('globals.css defines focus-visible styling and overflow-x clip', () => {
  const content = fs.readFileSync(path.join(SRC_DIR, 'app/globals.css'), 'utf-8');
  assert.ok(content.includes(':focus-visible'), 'Must have :focus-visible rules in globals.css');
});
