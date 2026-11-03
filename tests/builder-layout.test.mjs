import { readFileSync } from 'fs';
import assert from 'node:assert/strict';

const builderPage = readFileSync('src/app/builder/page.tsx', 'utf8');
assert.ok(builderPage.includes('BuildCardExport'), 'Export canvas must remain an inline live preview');
assert.ok(!builderPage.includes('bg-gradient-to-r'), 'Builder header must not use gradient text');

const exportComponent = readFileSync('src/components/builder/build-card-export.tsx', 'utf8');
assert.ok(exportComponent.includes('#ffffff') || exportComponent.includes('bg-white'), 'Export card container must use preview styling');
assert.ok(exportComponent.includes('text-slate-800'), 'Potential level number must be visible in preview notch');
console.log('✓ Builder layout & preview checks passed');
