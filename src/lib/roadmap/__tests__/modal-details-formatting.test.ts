import test from 'node:test';
import assert from 'node:assert';
import { formatRoadmapRemainingTime, getElementBadgeColor } from '../banner-transformer.ts';

test('formatRoadmapRemainingTime formats active and upcoming days', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  const future = new Date('2026-10-29T12:00:00Z');
  const past = new Date('2026-10-20T12:00:00Z');

  assert.strictEqual(formatRoadmapRemainingTime(future, now, 'upcoming'), 'Starts in 3 days');
  assert.strictEqual(formatRoadmapRemainingTime(future, now, 'ongoing'), '3 days left');
  assert.strictEqual(formatRoadmapRemainingTime(past, now, 'ended'), 'Ended');
});

test('getElementBadgeColor returns correct tailwind badge classes', () => {
  assert.ok(getElementBadgeColor('Ignis').includes('rose'));
  assert.ok(getElementBadgeColor('Aqua').includes('sky'));
  assert.ok(getElementBadgeColor('Terra').includes('amber'));
  assert.ok(getElementBadgeColor('Ventus').includes('emerald'));
  assert.ok(getElementBadgeColor('Umbra').includes('purple'));
  assert.ok(getElementBadgeColor('Lux').includes('yellow'));
});
