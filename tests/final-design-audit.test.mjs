import { readFileSync } from 'fs';
import assert from 'node:assert/strict';

const home = readFileSync('src/app/page.tsx', 'utf8');
assert.ok(!home.includes('bg-clip-text text-transparent'), 'Home page must not have gradient text');

const toolsGrid = readFileSync('src/components/home/tools-grid.tsx', 'utf8');
assert.ok(!toolsGrid.includes('bg-gradient-to-b'), 'Tools grid must not use gradient backgrounds');

const roadmapPage = readFileSync('src/app/roadmap/page.tsx', 'utf8');
assert.ok(roadmapPage.includes('w-full'), 'Roadmap must have full width container');
console.log('✓ Task 6 final audit checks passed');
