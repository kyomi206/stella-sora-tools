import { readFileSync, existsSync } from 'fs';
import assert from 'node:assert/strict';

const resolvePath = (p) => existsSync(p) ? p : (existsSync(`blank/${p}`) ? `blank/${p}` : p);
assert.ok(existsSync(resolvePath('src/components/calculator/trekker-selector.tsx')), 'trekker-selector.tsx must exist');
assert.ok(existsSync(resolvePath('src/components/calculator/level-stepper.tsx')), 'level-stepper.tsx must exist');

const selectorSource = readFileSync(resolvePath('src/components/calculator/trekker-selector.tsx'), 'utf8');
assert.ok(selectorSource.includes('export function TrekkerSelector'), 'Must export TrekkerSelector component');
assert.ok(selectorSource.includes('Ignis') && selectorSource.includes('Aqua') && selectorSource.includes('Ventus'), 'Must include element filters');
assert.ok(selectorSource.includes('searchTerm') || selectorSource.includes('search') || selectorSource.includes('query'), 'Must support search');

const stepperSource = readFileSync(resolvePath('src/components/calculator/level-stepper.tsx'), 'utf8');
assert.ok(stepperSource.includes('export function LevelStepper'), 'Must export LevelStepper component');
assert.ok(stepperSource.includes('startLevel') && stepperSource.includes('targetLevel'), 'Must take start and target levels');
assert.ok(stepperSource.includes('50') && stepperSource.includes('80') && stepperSource.includes('90'), 'Must include level presets');

console.log('✓ Selector and stepper component checks passed');
