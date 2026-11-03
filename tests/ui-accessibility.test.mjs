import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve('src');

test('gift count stepper buttons have aria-label', () => {
  const content = fs.readFileSync(path.join(SRC_DIR, 'app/bond/page.tsx'), 'utf-8');
  assert.ok(content.includes('aria-label="Decrease'), 'Must have decrease aria-label');
  assert.ok(content.includes('aria-label="Increase'), 'Must have increase aria-label');
});

test('trekker-card remove button has aria-label', () => {
  const content = fs.readFileSync(path.join(SRC_DIR, 'components/builder/trekker-card.tsx'), 'utf-8');
  assert.ok(content.includes('aria-label='), 'Trekker card remove button must have aria-label');
});

test('potentials-slot-row remove button has aria-label', () => {
  const content = fs.readFileSync(path.join(SRC_DIR, 'components/builder/potentials-slot-row.tsx'), 'utf-8');
  assert.ok(content.includes('aria-label='), 'Potentials slot row remove button must have aria-label');
});
