import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const css = readFileSync('src/app/globals.css', 'utf8');
assert.ok(css.includes('@keyframes modalIn'), 'globals.css must define @keyframes modalIn');
assert.ok(css.includes('.modal-entrance'), 'globals.css must define .modal-entrance utility');

const trekkerPicker = readFileSync('src/components/builder/trekker-picker-modal.tsx', 'utf8');
assert.ok(trekkerPicker.includes('modal-entrance'), 'trekker-picker-modal must use modal-entrance class');

const potentialsPicker = readFileSync('src/components/builder/potentials-picker-modal.tsx', 'utf8');
assert.ok(potentialsPicker.includes('modal-entrance'), 'potentials-picker-modal must use modal-entrance class');

console.log('✓ Modal entrance animation test passed');
