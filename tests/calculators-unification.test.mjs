import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('TrekkerSelector renders optional subtitle prop and uses prismatic 5-star gradient without card box', () => {
  const selector = fs.readFileSync('src/components/calculator/trekker-selector.tsx', 'utf8');
  assert.ok(selector.includes('{subtitle &&'), 'TrekkerSelector must conditionally render its subtitle prop');
  assert.ok(!selector.includes('celestial-card'), 'TrekkerSelector must not wrap content in a celestial-card box');
  assert.ok(selector.includes('from-[#c084fc]'), 'TrekkerSelector 5-star card must match prismatic gradient');
});

test('Bond calculator uses celestial-slider with level steppers', () => {
  const bond = fs.readFileSync('src/app/bond/page.tsx', 'utf8');
  assert.ok(!bond.includes('subtitle='), 'Bond page must omit TrekkerSelector subtitle per feedback');
  assert.ok(bond.includes('celestial-slider'), 'Bond level sliders must use celestial-slider class');
  assert.ok(bond.includes('aria-label="Decrease current level"'), 'Bond must include current level stepper buttons');
  assert.ok(bond.includes('aria-label="Increase target level"'), 'Bond must include target level stepper buttons');
});

test('LevelStepper uses compact desktop stepper buttons instead of oversized size-11 on sm+', () => {
  const stepper = fs.readFileSync('src/components/calculator/level-stepper.tsx', 'utf8');
  assert.ok(!stepper.includes('size-11 sm:size-11'), 'LevelStepper must not force 44px buttons on desktop');
  assert.ok(stepper.includes('celestial-slider'), 'LevelStepper must use celestial-slider class');
});

test('TrekkerSelector and LevelStepper buttons preserve visible keyboard focus rings', () => {
  const selector = fs.readFileSync('src/components/calculator/trekker-selector.tsx', 'utf8');
  const stepper = fs.readFileSync('src/components/calculator/level-stepper.tsx', 'utf8');
  assert.ok(!selector.includes('focus-visible:outline-none'), 'TrekkerSelector buttons must not suppress focus-visible outline without ring');
  assert.ok(selector.includes('focus-visible:ring-2 focus-visible:ring-amber-400'), 'TrekkerSelector buttons must include amber focus-visible ring');
  assert.ok(stepper.includes('focus-visible:ring-2 focus-visible:ring-amber-400'), 'LevelStepper buttons must include amber focus-visible ring');
});
