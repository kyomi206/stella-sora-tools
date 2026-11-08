import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatPotentialSegments } from '../potentials.ts';
import { formatDiscSkillSegments } from '../../data/notes.ts';

describe('formatPotentialSegments', () => {
  it('highlights percentage numbers and underlines element marks with element icon', () => {
    const descTemplate =
      "Increases the squad's HP by &Param1&. After the Main Trekker triggers Lux Mark for the first time, gains 1 stack of Starwish.";
    const segments = formatPotentialSegments(descTemplate, ['15%'], 1);

    assert.deepEqual(segments, [
      { text: "Increases the squad's HP by ", kind: 'text' },
      { text: '15%', kind: 'percent' },
      { text: '. After the Main Trekker triggers ', kind: 'text' },
      { text: 'Lux Mark', kind: 'mark', element: 'Lux' },
      { text: ' for the first time, gains 1 stack of Starwish.', kind: 'text' },
    ]);
  });

  it('underlines element marks with subtitle and ignores Mark DMG', () => {
    const descTemplate =
      'Sniper Operation (Main Skill) can trigger Ignis Mark and generate Conflagration: deals &Param1& of ATK as Ignis Mark DMG.';
    const segments = formatPotentialSegments(descTemplate, ['97.2%'], 1);

    assert.deepEqual(segments, [
      { text: 'Sniper Operation (Main Skill) can trigger ', kind: 'text' },
      { text: 'Ignis Mark', kind: 'mark', element: 'Ignis' },
      { text: ' and generate Conflagration: deals ', kind: 'text' },
      { text: '97.2%', kind: 'percent' },
      { text: ' of ATK as Ignis Mark DMG.', kind: 'text' },
    ]);
  });

  it('underlines generic mark and plural marks with default element', () => {
    const descTemplate =
      'When the Mark is triggered, consumes all Sweep Marks and grants max stacks of Sweep Mark buffs.';
    const segments = formatPotentialSegments(descTemplate, [], 1, 'Aqua');

    assert.deepEqual(segments, [
      { text: 'When the ', kind: 'text' },
      { text: 'Mark', kind: 'mark', element: 'Aqua' },
      { text: ' is triggered, consumes all ', kind: 'text' },
      { text: 'Sweep Marks', kind: 'mark', element: 'Aqua' },
      { text: ' and grants max stacks of ', kind: 'text' },
      { text: 'Sweep Mark', kind: 'mark', element: 'Aqua' },
      { text: ' buffs.', kind: 'text' },
    ]);
  });
});

describe('formatDiscSkillSegments', () => {
  it('underlines element marks and associates element in disc select', () => {
    const desc =
      'Increases HP by <color=#ec6d21>{1}</color>.\u000bAfter triggers ##Lux Mark#1015#, gains Starwish.\u000bWhen triggers the Mark to generate ##Lucent#4028#, increases Crit Rate by <color=#ec6d21>{2}</color>.';
    const segments = formatDiscSkillSegments(desc, '15%,15%', 1, 'Lux');

    assert.deepEqual(segments, [
      { text: 'Increases HP by ', kind: 'text' },
      { text: '15%', kind: 'value' },
      { text: '.\nAfter triggers ', kind: 'text' },
      { text: 'Lux Mark', kind: 'mark', element: 'Lux' },
      { text: ', gains Starwish.\nWhen triggers the ', kind: 'text' },
      { text: 'Mark', kind: 'mark', element: 'Lux' },
      { text: ' to generate ', kind: 'text' },
      { text: 'Lucent', kind: 'term' },
      { text: ', increases Crit Rate by ', kind: 'text' },
      { text: '15%', kind: 'value' },
      { text: '.', kind: 'text' },
    ]);
  });
});
