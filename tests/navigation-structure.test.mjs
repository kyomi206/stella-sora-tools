import { readFileSync } from 'fs';
import assert from 'node:assert/strict';

const layout = readFileSync('src/app/layout.tsx', 'utf8');
assert.ok(!layout.includes('<Navbar'), 'Navbar must be removed from layout');
assert.ok(layout.includes('<SideTab') || layout.includes('<Sidebar'), 'Sidebar must be present in layout');
assert.ok(layout.includes('flex'), 'Layout must use flex shell');

const sideTab = readFileSync('src/components/layout/side-tab.tsx', 'utf8');
assert.ok(!sideTab.includes('fixed left-0 top-16'), 'Sidebar must dock cleanly rather than overlaying at top-16');
assert.ok(sideTab.includes('Stella Sora Tools') || sideTab.includes('Tyrant'), 'Sidebar must include brand title header');
console.log('✓ Task 2 navigation structure checks passed');
