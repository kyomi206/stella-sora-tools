import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('globals.css defines celestial surface utilities and preserves core tokens', () => {
  const css = fs.readFileSync('src/app/globals.css', 'utf8');
  assert.ok(css.includes('--color-base: #ffffff'), 'Must preserve --color-base');
  assert.ok(css.includes('.celestial-card'), 'Must define .celestial-card utility');
  assert.ok(css.includes('.celestial-slider'), 'Must define .celestial-slider utility');
  assert.ok(css.includes('radial-gradient'), 'Body must include subtle celestial radial backdrop');
});

test('navigation merges mobile header into TopBar and adds amber active indicator to SideTab', () => {
  const sideTab = fs.readFileSync('src/components/layout/side-tab.tsx', 'utf8');
  const topBar = fs.readFileSync('src/components/layout/top-bar.tsx', 'utf8');

  assert.ok(!sideTab.includes('md:hidden sticky top-0'), 'SideTab must not render a duplicate sticky mobile header');
  assert.ok(sideTab.includes('border-amber-400'), 'SideTab active link must use warm amber indicator');
  assert.ok(topBar.includes('/bastelina.png'), 'TopBar must display mobile brand logo on small viewports');
});
