import { readFileSync, existsSync } from 'fs';
import assert from 'node:assert/strict';

const filePath = existsSync('src/app/bond/page.tsx') ? 'src/app/bond/page.tsx' : 'blank/src/app/bond/page.tsx';
const bondPage = readFileSync(filePath, 'utf8');
assert.ok(!bondPage.includes('SELECT GIFT TIER'), 'Upper dropdown tier selector must be removed');
assert.ok(!bondPage.includes('from-rose-500 to-amber-400'), 'Progress gauge must not use multi-color neon gradient');
assert.ok(bondPage.includes('Exquisite Gift') || bondPage.includes('exquisite'), 'Must support Exquisite gift row');
assert.ok(!bondPage.includes('Auto Optimize'), 'Auto Optimize option must be removed');
assert.ok(bondPage.includes('purple-500') || bondPage.includes('purple-950'), 'Exquisite gift must use purple theme like bo.png');
assert.ok(bondPage.includes('amber-500') || bondPage.includes('amber-950'), 'Rare gift must use amber theme like bo.png');
assert.ok(bondPage.includes('sky-500') || bondPage.includes('sky-950'), 'Common gift must use sky theme like bo.png');
assert.ok(bondPage.includes('Trash2') || bondPage.includes('Empty'), 'Must have empty gift button on left of number wheel');
console.log('✓ Bond calculator checks passed');
