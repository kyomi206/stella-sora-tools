import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatPotentialSegments } from '../potentials.ts';

describe('formatPotentialSegments', () => {
  it('highlights percentage numbers and underlines element marks', () => {
    const descTemplate =
      "Increases the squad's HP by &Param1&. After the Main Trekker triggers Lux Mark for the first time, gains 1 stack of Starwish.";
    const segments = formatPotentialSegments(descTemplate, ['15%'], 1);

    assert.deepEqual(segments, [
      { text: "Increases the squad's HP by ", kind: 'text' },
      { text: '15%', kind: 'percent' },
      { text: '. After the Main Trekker triggers ', kind: 'text' },
      { text: 'Lux Mark', kind: 'mark' },
      { text: ' for the first time, gains 1 stack of Starwish.', kind: 'text' },
    ]);
  });

  it('underlines element marks with subtitle', () => {
    const descTemplate =
      'Sweeping Blast (Ultimate) can trigger Ignis Mark: Sacred Flame, dealing &Param1& of ATK as AoE Ignis Mark DMG.';
    const segments = formatPotentialSegments(descTemplate, ['50%'], 1);

    assert.deepEqual(segments, [
      { text: 'Sweeping Blast (Ultimate) can trigger ', kind: 'text' },
      { text: 'Ignis Mark: Sacred Flame', kind: 'mark' },
      { text: ', dealing ', kind: 'text' },
      { text: '50%', kind: 'percent' },
      { text: ' of ATK as AoE ', kind: 'text' },
      { text: 'Ignis Mark', kind: 'mark' },
      { text: ' DMG.', kind: 'text' },
    ]);
  });

  it('underlines generic mark and plural marks', () => {
    const descTemplate =
      'When the Mark is triggered, consumes all Sweep Marks and grants max stacks of Sweep Mark buffs.';
    const segments = formatPotentialSegments(descTemplate, [], 1);

    assert.deepEqual(segments, [
      { text: 'When the ', kind: 'text' },
      { text: 'Mark', kind: 'mark' },
      { text: ' is triggered, consumes all ', kind: 'text' },
      { text: 'Sweep Marks', kind: 'mark' },
      { text: ' and grants max stacks of ', kind: 'text' },
      { text: 'Sweep Mark', kind: 'mark' },
      { text: ' buffs.', kind: 'text' },
    ]);
  });
});
