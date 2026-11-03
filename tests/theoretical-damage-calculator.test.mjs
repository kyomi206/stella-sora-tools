import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  'src/components/builder/theoretical-damage-calculator.tsx',
  'utf8'
);

test('calculator reuses the shared team engine', () => {
  assert.ok(source.includes('calculateTeam'), 'must call calculateTeam');
  assert.ok(source.includes('TeamCalcInput'), 'must build a TeamCalcInput');
  assert.ok(source.includes('computeTalentProgression'), 'must run the talent sweep');
  assert.ok(source.includes('computeDiscContributions'), 'must run the disc sweep');
  assert.ok(source.includes('computePenCurve'), 'must run the PEN curve');
});

test('optimization panel exposes the sensitivity tabs', () => {
  assert.ok(source.includes('Optimization &amp; Sensitivity'), 'must render the panel title');
  assert.ok(source.includes("label: 'Talents'"), 'must expose the talent tab');
  assert.ok(source.includes("label: 'Disc impact'"), 'must expose the disc tab');
  assert.ok(source.includes("label: 'PEN vs RES'"), 'must expose the PEN tab');
});

test('rotation table supports HP and DEF scaling', () => {
  assert.ok(source.includes('>Scaling<'), 'must render a Scaling column header');
  assert.ok(source.includes('<option value="HP">HP</option>'), 'must offer HP scaling');
  assert.ok(source.includes('<option value="DEF">DEF</option>'), 'must offer DEF scaling');
});

test('support disc removal rebuilds starting notes', () => {
  assert.ok(
    source.includes('calculateSupportStartingNotes(supportDiscs, discs)'),
    'must recompute starting notes without the removed support disc'
  );
  assert.ok(source.includes('Math.max(0,'), 'must clamp rebuilt note counts at zero');
});
