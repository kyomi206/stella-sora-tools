import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildCharacterStats,
  calculateAbilityDamage,
  calculateDefAmend,
  calculateResAmend,
  createEmptyStatBlock,
  getAffinityBonuses,
} from '../src/lib/calculator/damage-engine.ts';
import {
  MUSICAL_NOTES,
  calculateSupportStartingNotes,
  calculateRequiredHarmonyNotes,
  getHarmonyActivationLevel,
} from '../src/data/notes.ts';

test('Standard Preset Visualizer links to Advanced Visualizer while keeping standard functionality', () => {
  const stdBuilder = fs.readFileSync('src/app/builder/page.tsx', 'utf8');
  assert.ok(
    stdBuilder.includes('/builder/advanced') && stdBuilder.includes('Advanced Visualizer'),
    'Standard builder must include redirect link to Advanced Visualizer'
  );
  assert.ok(
    stdBuilder.includes('BuildCardExport') && stdBuilder.includes('TrekkerCard'),
    'Standard builder must keep original visualizer components intact'
  );
});

test('Advanced Preset Visualizer includes Characters, Discs, Notes, Export, and Theoretical Damage Calculator', () => {
  assert.ok(
    fs.existsSync('src/app/builder/advanced/page.tsx'),
    'Advanced visualizer page must exist at src/app/builder/advanced/page.tsx'
  );
  const advPage = fs.readFileSync('src/app/builder/advanced/page.tsx', 'utf8');
  assert.ok(advPage.includes('TrekkerCard'), 'Advanced page must render Trekker cards');
  assert.ok(advPage.includes('DiscsAndNotesSection'), 'Advanced page must render Discs and Notes section');
  assert.ok(advPage.includes('AdvancedBuildCardExport'), 'Advanced page must render Advanced Build Card Export');

  const damagePage = fs.readFileSync('src/app/damage/page.tsx', 'utf8');
  assert.ok(damagePage.includes('TheoreticalDamageCalculator'), '/damage must render Theoretical Damage Calculator');
  const calculator = fs.readFileSync(
    'src/components/builder/theoretical-damage-calculator.tsx',
    'utf8'
  );
  assert.ok(calculator.includes('id="damage-calculator"'), 'Calculator must expose the damage-calculator anchor');
});

test('Discs and Musical Notes data and synergy helpers work accurately', () => {
  const discs = JSON.parse(fs.readFileSync('src/data/discs.json', 'utf8'));
  assert.equal(Object.keys(discs).length, 104, 'Must include all 104 Runic Discs');
  assert.equal(MUSICAL_NOTES.length, 13, 'Must include all 13 Musical Notes');

  // Test Support Disc starting notes (214001 Meowing Cat God at Phase 8 gives Luck +3, Ignis +11)
  const startNotes = calculateSupportStartingNotes(
    [{ discId: 214001, phase: 8, level: 80 }],
    discs
  );
  assert.equal(startNotes['Melody of Luck'], 3);
  assert.equal(startNotes['Melody of Ignis'], 11);

  // Test Main Disc required Harmony notes & activation level (214001 Secondary 1 requires Skill 70, Secondary 2 requires Burst 75)
  const reqLv5 = calculateRequiredHarmonyNotes(
    [{ discId: 214001, crescendo: 1, level: 90 }],
    discs,
    5
  );
  assert.equal(reqLv5['Melody of Burst'], 75);
  assert.equal(reqLv5['Melody of Skill'], 70);

  const catGod = discs['214001'];
  assert.equal(
    getHarmonyActivationLevel(catGod.secondarySkill1, {
      'Melody of Burst': 40,
      'Melody of Skill': 40,
    }),
    3
  );
});

test('Damage engine matches Google Doc, AutumnVN Gist, and Spreadsheet reference values', () => {
  // 1. Affinity Lv 30 -> 864 Base ATK and 24% ATK%
  const aff30 = getAffinityBonuses(30);
  assert.equal(aff30.baseAtk, 864);
  assert.equal(aff30.atkPct, 24);

  // 2. DEF Amend formula verification
  const def500 = calculateDefAmend(500, 0, 0, 0);
  assert.equal(def500.defAmend, 0.5);

  const def350 = calculateDefAmend(500, 150, 0, 0); // Corrosive Vines Lv6 (-150 DEF)
  assert.ok(Math.abs(def350.defAmend - 0.602272727) < 1e-6);

  // 3. RES Amend formula verification
  const resWeak = calculateResAmend(250, 0, 0, 0);
  assert.equal(resWeak.erAmend, 0.75);

  const resNeutral = calculateResAmend(750, 0, 0, 0);
  assert.equal(resNeutral.erAmend, 0.4);

  const resResistant = calculateResAmend(2000, 0, 0, 0);
  assert.ok(Math.abs(resResistant.erAmend - 0.01) < 1e-6);

  const resRaid = calculateResAmend(570, 0, 0, 0);
  assert.ok(Math.abs(resRaid.erAmend - 0.54783073) < 1e-6);

  // VUL Suppress formula when Effective RES <= 0 (160 RES - 220 PEN = -60, 5% VUL -> 1.032)
  const resVul = calculateResAmend(160, 220, 5, 0);
  assert.equal(resVul.effectiveRes, -60);
  assert.ok(Math.abs(resVul.erAmend - 1.032) < 1e-6);

  // 4. End-to-end theoretical damage calculation
  const bonuses = createEmptyStatBlock();
  bonuses.atkPct = 26;
  bonuses.elementDmgPct = 50;
  bonuses.typeDmgPct.Ultimate = 50;
  // Engine base values are 5% crit rate and 150% crit DMG.
  bonuses.critRatePct = 45;
  bonuses.critDmgPct = 50;

  const stats = buildCharacterStats({
    characterBaseAtk: 7542,
    affinityLevel: 30,
    recordLevel: 31,
    squadDiscBaseAtk: 3000,
    element: 'Ignis',
    bonuses,
  });

  // BaseATK = 7542 + 864 + 3136 + 3000 = 14542
  assert.equal(stats.baseAtk, 14542);
  // TotalATK% = 24% + 26% = 50% -> FinalATK = 14542 * 1.5 = 21813
  assert.equal(stats.finalAtk, 21813);

  const calc = calculateAbilityDamage(
    stats,
    {
      name: 'Reference ultimate',
      motionValuePct: 200,
      hits: 1,
      casts: 1,
      damageType: 'Ultimate',
    },
    { def: 500, res: 250, resilienceBroken: false }
  );

  assert.equal(calc.nonCritDamage, 36809);
  assert.equal(calc.critDamage, 73619);
});
