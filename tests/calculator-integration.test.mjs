import { readFileSync, existsSync } from 'fs';
import assert from 'node:assert/strict';

const resolvePath = (p) => existsSync(p) ? p : (existsSync(`blank/${p}`) ? `blank/${p}` : p);
assert.ok(existsSync(resolvePath('src/app/calculator/page.tsx')), 'calculator/page.tsx must exist');

const pageSource = readFileSync(resolvePath('src/app/calculator/page.tsx'), 'utf8');
assert.ok(pageSource.includes('TrekkerSelector'), 'Page must include TrekkerSelector');
assert.ok(pageSource.includes('LevelStepper'), 'Page must include LevelStepper');
assert.ok(pageSource.includes('SkillsMatrix'), 'Page must include SkillsMatrix');
assert.ok(pageSource.includes('MaterialsBill'), 'Page must include MaterialsBill');
assert.ok(pageSource.includes('calculateTrekkerCosts'), 'Page must call calculateTrekkerCosts');
assert.ok(pageSource.includes('isMobileDrawerOpen'), 'Page must support mobile bill drawer');
assert.ok(pageSource.includes('role="dialog"') && pageSource.includes('aria-modal="true"'), 'Mobile drawer must have proper a11y dialog roles');

const sideTabSource = readFileSync(resolvePath('src/components/layout/side-tab.tsx'), 'utf8');
assert.ok(sideTabSource.includes("href: '/calculator'"), 'Sidebar must have link to /calculator');
assert.ok(sideTabSource.includes('Resource Calculator'), 'Sidebar must display Resource Calculator');

console.log('✓ Calculator integration, mobile responsiveness, and navigation checks passed');
