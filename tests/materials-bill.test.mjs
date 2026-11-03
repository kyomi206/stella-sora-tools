import { readFileSync, existsSync } from 'fs';
import assert from 'node:assert/strict';

const resolvePath = (p) => existsSync(p) ? p : (existsSync(`blank/${p}`) ? `blank/${p}` : p);
assert.ok(existsSync(resolvePath('src/components/calculator/materials-bill.tsx')), 'materials-bill.tsx must exist');

const source = readFileSync(resolvePath('src/components/calculator/materials-bill.tsx'), 'utf8');
assert.ok(source.includes('export function MaterialsBill'), 'Must export MaterialsBill component');
assert.ok(source.includes('Dorra') || source.includes('dorra'), 'Must display Dorra currency');
assert.ok(source.includes('Breakthrough') || source.includes('breakthrough'), 'Must include breakthrough section');
assert.ok(source.includes('Skill') || source.includes('skill'), 'Must include skill materials section');
assert.ok(source.includes('Copy') || source.includes('copy'), 'Must support copy to clipboard');

console.log('✓ Materials bill component checks passed');
