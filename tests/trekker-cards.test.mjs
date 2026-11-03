import { readFileSync } from 'fs';
import assert from 'node:assert/strict';

const trekkersPage = readFileSync('src/app/trekkers/page.tsx', 'utf8');
assert.ok(!trekkersPage.includes('bg-white'), 'Trekkers page must not use white card backgrounds');
assert.ok(trekkersPage.includes('from-[#c084fc]'), 'Trekkers page must feature top and bottom gradients like ex.png');
assert.ok(trekkersPage.includes('clip-path:polygon'), 'Trekkers page must use high visibility role banner');

const trekkerCard = readFileSync('src/components/builder/trekker-card.tsx', 'utf8');
assert.ok(trekkerCard.includes('#131720') || trekkerCard.includes('bg-surface'), 'Trekker card must use dark surface background');
assert.ok(trekkerCard.includes('clip-path:polygon'), 'Trekker card must use high visibility role banner');
assert.ok(trekkerCard.includes('from-[#c084fc]'), 'Trekker card must feature top and bottom gradients like ex.png');
console.log('✓ Trekker card & portrait checks passed');
