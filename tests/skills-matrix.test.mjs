import { readFileSync, existsSync } from 'fs';
import assert from 'node:assert/strict';

const resolvePath = (p) => existsSync(p) ? p : (existsSync(`blank/${p}`) ? `blank/${p}` : p);
assert.ok(existsSync(resolvePath('src/components/calculator/skills-matrix.tsx')), 'skills-matrix.tsx must exist');

const source = readFileSync(resolvePath('src/components/calculator/skills-matrix.tsx'), 'utf8');
assert.ok(source.includes('export function SkillsMatrix'), 'Must export SkillsMatrix component');
assert.ok(source.includes('Combat Skill') && source.includes('Support Skill'), 'Must display Combat and Support tracks');
assert.ok(source.includes('Ultimate Skill') && source.includes('Normal Attack'), 'Must display Ultimate and Normal Attack tracks');
assert.ok(source.includes('All') && source.includes('Reset'), 'Must provide bulk preset controls');
assert.ok(source.includes('type="range"'), 'Must include range slider for skill upgrades');
assert.ok(!source.includes('Quick:'), 'Quick leveling buttons below skills must be removed');
assert.ok(source.includes('handleCurrentChange') && source.includes('handleTargetChange'), 'Must provide dual handlers for Current and Target');
assert.ok(source.includes('tabular-nums'), 'Must use tabular numerals to prevent layout jitter');
assert.ok(source.includes('aria-label'), 'Steppers and sliders must have explicit aria-labels');
assert.ok(source.includes('invert dark:invert-0'), 'Skill icons must invert in light mode and retain white in dark mode');

console.log('✓ Skills matrix component checks passed (slider present, quick leveling removed)');
