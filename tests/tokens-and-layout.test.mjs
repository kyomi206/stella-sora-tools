import { readFileSync } from 'fs';
import assert from 'node:assert/strict';

const css = readFileSync('src/app/globals.css', 'utf8');
assert.ok(css.includes('--color-base: #ffffff'), 'Base color token missing');
assert.ok(css.includes('--color-surface: #ffffff'), 'Surface color token missing');
assert.ok(css.includes('--color-border: #e2e8f0'), 'Border color token missing');
assert.ok(css.includes('--color-accent: #f59e0b'), 'Accent color token missing');
assert.ok(!css.includes('font-family: Arial'), 'Arial fallback should be removed');
assert.ok(css.includes('font-family: var(--font-sans)'), 'Body must bind to font-sans');
console.log('✓ Task 1 token and typography checks passed');
