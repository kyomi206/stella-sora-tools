import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('ToolsGrid spans the 5th card across 2 columns on md screens and uses celestial-card', () => {
  const grid = fs.readFileSync('src/components/home/tools-grid.tsx', 'utf8');
  assert.ok(grid.includes('md:col-span-2'), '5th tool card must span 2 columns on desktop');
  assert.ok(grid.includes('celestial-card'), 'Tool cards must use celestial-card surface class');
  assert.ok(!grid.includes('bg-gradient-to-b'), 'Must not use bg-gradient-to-b');
});

test('TrekkerSpotlight shows minimal role and element badges and matches heading hierarchy', () => {
  const spotlight = fs.readFileSync('src/components/home/trekker-spotlight.tsx', 'utf8');
  const resetTimer = fs.readFileSync('src/components/home/reset-timer.tsx', 'utf8');
  const home = fs.readFileSync('src/app/page.tsx', 'utf8');

  assert.ok(spotlight.includes('featured.class'), 'TrekkerSpotlight must display character role/class badge');
  assert.ok(spotlight.includes('featured.element'), 'TrekkerSpotlight must display character element badge');
  assert.ok(spotlight.includes('border border-border bg-surface-card'), 'TrekkerSpotlight card must include explicit border and surface classes');
  assert.ok(resetTimer.includes('border border-border bg-surface-card'), 'ResetTimer card must include explicit border and surface classes');
  assert.ok(spotlight.includes('text-lg sm:text-xl'), 'TrekkerSpotlight heading must use unified text-lg sm:text-xl');
  assert.ok(resetTimer.includes('text-lg sm:text-xl'), 'ResetTimer heading must use unified text-lg sm:text-xl');
  assert.ok(home.includes('text-lg sm:text-xl'), 'Home Tools section heading must use unified text-lg sm:text-xl');
});
