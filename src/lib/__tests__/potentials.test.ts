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

  it('does not format standalone Mark as element mark and styles Sweep Mark as effect', () => {
    const descTemplate =
      'When the Mark is triggered, consumes all Sweep Marks and grants max stacks of Sweep Mark buffs.';
    const segments = formatPotentialSegments(descTemplate, [], 1, 'Aqua');

    assert.deepEqual(segments, [
      { text: 'When the Mark is triggered, consumes all ', kind: 'text' },
      { text: 'Sweep Marks', kind: 'effect' },
      { text: ' and grants max stacks of ', kind: 'text' },
      { text: 'Sweep Mark', kind: 'effect' },
      { text: ' buffs.', kind: 'text' },
    ]);
  });

  it('strips ##Title#ID# glossary wrappers and formats plural element Marks cleanly', () => {
    const descTemplate =
      'Terrain Mapping (Ultimate) can trigger ##Terra Marks#1020# without consuming ##Resource Markers#4056#.';
    const segments = formatPotentialSegments(descTemplate, [], 1, 'Terra');

    assert.deepEqual(segments, [
      { text: 'Terrain Mapping (Ultimate) can trigger ', kind: 'text' },
      { text: 'Terra Marks', kind: 'mark', element: 'Terra' },
      { text: ' without consuming ', kind: 'text' },
      { text: 'Resource Markers', kind: 'effect' },
      { text: '.', kind: 'text' },
    ]);
  });

  it('highlights special effects and skills across characters without false-matching compound labels or lowercase words', () => {
    const mistique = formatPotentialSegments(
      'Summons one Pumpka Phantom and Lanterna Phantom, triggering Umbra Mark and inflicting Dark Burn.',
      [],
      1,
      'Umbra'
    );
    assert.deepEqual(mistique, [
      { text: 'Summons one ', kind: 'text' },
      { text: 'Pumpka Phantom', kind: 'effect' },
      { text: ' and ', kind: 'text' },
      { text: 'Lanterna Phantom', kind: 'effect' },
      { text: ', triggering ', kind: 'text' },
      { text: 'Umbra Mark', kind: 'mark', element: 'Umbra' },
      { text: ' and inflicting ', kind: 'text' },
      { text: 'Dark Burn', kind: 'effect' },
      { text: '.', kind: 'text' },
    ]);

    const sparkla = formatPotentialSegments(
      'Tap or hold to transform. Tap Enters Bunny Jaws Mode. Hold Enters Bunny Rapid Fire Mode. Both trigger Terra Mark.',
      [],
      1,
      'Terra'
    );
    assert.deepEqual(sparkla, [
      { text: 'Tap or hold to transform. ', kind: 'text' },
      { text: 'Tap', kind: 'effect' },
      { text: ' Enters ', kind: 'text' },
      { text: 'Bunny Jaws Mode', kind: 'effect' },
      { text: '. ', kind: 'text' },
      { text: 'Hold', kind: 'effect' },
      { text: ' Enters ', kind: 'text' },
      { text: 'Bunny Rapid Fire Mode', kind: 'effect' },
      { text: '. Both trigger ', kind: 'text' },
      { text: 'Terra Mark', kind: 'mark', element: 'Terra' },
      { text: '.', kind: 'text' },
    ]);

    const firefly = formatPotentialSegments(
      'Enters Artillery Form, transforming 4 Avalanches into Avalanche: Floating Cannons to trigger Lux Mark and generate Lucent with Glimmer.',
      [],
      1,
      'Lux'
    );
    assert.deepEqual(firefly, [
      { text: 'Enters ', kind: 'text' },
      { text: 'Artillery Form', kind: 'effect' },
      { text: ', transforming 4 ', kind: 'text' },
      { text: 'Avalanches', kind: 'effect' },
      { text: ' into Avalanche: Floating Cannons to trigger ', kind: 'text' },
      { text: 'Lux Mark', kind: 'mark', element: 'Lux' },
      { text: ' and generate ', kind: 'text' },
      { text: 'Lucent', kind: 'effect' },
      { text: ' with ', kind: 'text' },
      { text: 'Glimmer', kind: 'effect' },
      { text: '.', kind: 'text' },
    ]);

    const lowercase = formatPotentialSegments(
      'Each bubble deals DMG, inflicts burn, stays agile, and lets flames ignite after a thunderbolt.',
      [],
      1,
      'Aqua'
    );
    assert.deepEqual(lowercase, [
      {
        text: 'Each bubble deals DMG, inflicts burn, stays agile, and lets flames ignite after a thunderbolt.',
        kind: 'text',
      },
    ]);
  });

  it('highlights Vortex Energy, Shatter, Meteor, Allure, Observation Point(s) while skipping skill/compound names like Frozen Path, Tide Threader, Sentry Deployment, Bubble Bath, and summon a Thunderbolt', () => {
    assert.deepEqual(
      formatPotentialSegments('Frozen Path (Main Skill) inflicts Chill.', [], 1, 'Aqua'),
      [
        { text: 'Frozen Path (Main Skill) inflicts ', kind: 'text' },
        { text: 'Chill', kind: 'effect' },
        { text: '.', kind: 'text' },
      ]
    );

    assert.deepEqual(
      formatPotentialSegments(
        'When Tide Threader deals DMG, billow past Billowing Tide and generate Tide.',
        [],
        1,
        'Aqua'
      ),
      [
        {
          text: 'When Tide Threader deals DMG, billow past Billowing Tide and generate ',
          kind: 'text',
        },
        { text: 'Tide', kind: 'effect' },
        { text: '.', kind: 'text' },
      ]
    );

    assert.deepEqual(
      formatPotentialSegments(
        'Sentry Deployment deploys 1 Sentry and 2 Sentries.',
        [],
        1,
        'Ventus'
      ),
      [
        { text: 'Sentry Deployment deploys 1 ', kind: 'text' },
        { text: 'Sentry', kind: 'effect' },
        { text: ' and 2 ', kind: 'text' },
        { text: 'Sentries', kind: 'effect' },
        { text: '.', kind: 'text' },
      ]
    );

    assert.deepEqual(
      formatPotentialSegments(
        'Summons a Thunderbolt vs generates Thunderbolt.',
        [],
        1,
        'Lux'
      ),
      [
        { text: 'Summons a Thunderbolt vs generates ', kind: 'text' },
        { text: 'Thunderbolt', kind: 'effect' },
        { text: '.', kind: 'text' },
      ]
    );

    assert.deepEqual(
      formatPotentialSegments(
        'Generates a Bubble Bath for Bubble Frog, plus Bubble and Bubble Mark.',
        [],
        1,
        'Aqua'
      ),
      [
        { text: 'Generates a Bubble Bath for Bubble Frog, plus ', kind: 'text' },
        { text: 'Bubble', kind: 'effect' },
        { text: ' and ', kind: 'text' },
        { text: 'Bubble Mark', kind: 'effect' },
        { text: '.', kind: 'text' },
      ]
    );

    assert.deepEqual(
      formatPotentialSegments(
        'Consumes Vortex Energy to trigger Shatter, summon a Meteor, inflict Allure, and gain 1 Observation Point or 2 Observation Points.',
        [],
        1,
        'Terra'
      ),
      [
        { text: 'Consumes ', kind: 'text' },
        { text: 'Vortex Energy', kind: 'effect' },
        { text: ' to trigger ', kind: 'text' },
        { text: 'Shatter', kind: 'effect' },
        { text: ', summon a ', kind: 'text' },
        { text: 'Meteor', kind: 'effect' },
        { text: ', inflict ', kind: 'text' },
        { text: 'Allure', kind: 'effect' },
        { text: ', and gain 1 ', kind: 'text' },
        { text: 'Observation Point', kind: 'effect' },
        { text: ' or 2 ', kind: 'text' },
        { text: 'Observation Points', kind: 'effect' },
        { text: '.', kind: 'text' },
      ]
    );
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
    assert.strictEqual(ids.length, 42);

    for (const id of ids) {
      const c = combat[id];
      assert.ok(c.skill?.cooldown, `Character ${id} (${c.name}) missing skill cooldown`);
      assert.ok(c.supportSkill?.cooldown, `Character ${id} (${c.name}) missing supportSkill cooldown`);
      assert.ok(c.ultimate?.cooldown, `Character ${id} (${c.name}) missing ultimate cooldown`);
      assert.ok(typeof c.ultimate?.energy === 'number', `Character ${id} (${c.name}) missing ultimate energy`);
    }

    assert.strictEqual(combat['162']?.stats?.['90']?.def, 0);
    assert.strictEqual(combat['161']?.stats?.['90']?.def, 190);
    assert.match(combat['115'].supportSkill.desc, /for 16s, during which/);
    assert.match(combat['139'].skill.desc, /##Tide#4053#/);
    assert.match(combat['140'].skill.desc, /<color=#0abec5>Tap:<\/color> Enters ##Bunny Jaws Mode#4033#/);
    assert.match(combat['140'].skill.desc, /<color=#0abec5>Hold:<\/color> Enters ##Bunny Rapid Fire Mode#4034#/);
    assert.match(combat['143'].supportSkill.desc, /##Ventus Mark#1017#/);

    for (const id of ids) {
      const c = combat[id];
      for (const k of ['normalAtk', 'skill', 'supportSkill', 'ultimate']) {
        assert.doesNotMatch(
          c[k]?.desc ?? '',
          /(?:Hidden)?Param\d+:/i,
          `Character ${id} ${k} still has raw parameter debug text`
        );
      }
    }
  });

  it('all 41 characters have briefDesc on potentials in potentials-db.json', async () => {
    const potentialsDb = (await import('../../data/potentials-db.json', { with: { type: 'json' } })).default as Record<string, any[]>;
    const ids = Object.keys(potentialsDb);
    assert.strictEqual(ids.length, 42);

    for (const id of ids) {
      const pots = potentialsDb[id];
      assert.ok(pots.length > 0, `Character ${id} has no potentials`);
      for (const pot of pots) {
        assert.ok(pot.briefDesc, `Potential ${pot.id} (${pot.name}) missing briefDesc`);
        assert.ok(pot.briefDesc.length > 5, `Potential ${pot.id} briefDesc too short: ${pot.briefDesc}`);
        assert.doesNotMatch(
          `${pot.descTemplate ?? ''} ${pot.briefDesc ?? ''}`,
          /(?:Hidden)?Param\d+:/i,
          `Potential ${pot.id} (${pot.name}) still has raw parameter debug text`
        );
      }
    }
  });
});

