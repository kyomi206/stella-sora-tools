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

  it('does not format standalone Mark or non-element marks', () => {
    const descTemplate =
      'When the Mark is triggered, consumes all Sweep Marks and grants max stacks of Sweep Mark buffs.';
    const segments = formatPotentialSegments(descTemplate, [], 1, 'Aqua');

    assert.deepEqual(segments, [
      {
        text: 'When the Mark is triggered, consumes all Sweep Marks and grants max stacks of Sweep Mark buffs.',
        kind: 'text',
      },
    ]);
  });
});

describe('formatDiscSkillSegments', () => {
  it('underlines {element} Mark with icon and keeps standalone Mark as plain text', () => {
    const desc =
      'Increases HP by <color=#ec6d21>{1}</color>.\u000bAfter triggers ##Lux Mark#1015#, gains Starwish.\u000bWhen triggers the Mark to generate ##Lucent#4028#, increases Crit Rate by <color=#ec6d21>{2}</color>.';
    const segments = formatDiscSkillSegments(desc, '15%,15%', 1, 'Lux');

    assert.deepEqual(segments, [
      { text: 'Increases HP by ', kind: 'text' },
      { text: '15%', kind: 'value' },
      { text: '.\nAfter triggers ', kind: 'text' },
      { text: 'Lux Mark', kind: 'mark', element: 'Lux' },
      {
        text: ', gains Starwish.\nWhen triggers the Mark to generate ',
        kind: 'text',
      },
      { text: 'Lucent', kind: 'term' },
      { text: ', increases Crit Rate by ', kind: 'text' },
      { text: '15%', kind: 'value' },
      { text: '.', kind: 'text' },
    ]);
  });
});

describe('character combat skills and potential brief descriptions', () => {
  it('all 41 characters have cooldowns and ultimate energy in character-combat.json', async () => {
    const combat = (await import('../../data/character-combat.json', { with: { type: 'json' } })).default as Record<string, any>;
    const ids = Object.keys(combat);
    assert.strictEqual(ids.length, 41);

    for (const id of ids) {
      const c = combat[id];
      assert.ok(c.skill?.cooldown, `Character ${id} (${c.name}) missing skill cooldown`);
      assert.ok(c.supportSkill?.cooldown, `Character ${id} (${c.name}) missing supportSkill cooldown`);
      assert.ok(c.ultimate?.cooldown, `Character ${id} (${c.name}) missing ultimate cooldown`);
      assert.ok(typeof c.ultimate?.energy === 'number', `Character ${id} (${c.name}) missing ultimate energy`);
    }
  });

  it('all 41 characters have briefDesc on potentials in potentials-db.json', async () => {
    const potentialsDb = (await import('../../data/potentials-db.json', { with: { type: 'json' } })).default as Record<string, any[]>;
    const ids = Object.keys(potentialsDb);
    assert.strictEqual(ids.length, 41);

    for (const id of ids) {
      const pots = potentialsDb[id];
      assert.ok(pots.length > 0, `Character ${id} has no potentials`);
      for (const pot of pots) {
        assert.ok(pot.briefDesc, `Potential ${pot.id} (${pot.name}) missing briefDesc`);
        assert.ok(pot.briefDesc.length > 5, `Potential ${pot.id} briefDesc too short: ${pot.briefDesc}`);
      }
    }
  });
});

