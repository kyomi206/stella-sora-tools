import assert from 'node:assert/strict';
import { calculateTrekkerCosts, getBreakthroughTiers } from '../src/lib/calculator/resource-engine.ts';

console.log('Testing getBreakthroughTiers...');
assert.deepEqual(getBreakthroughTiers(1, 10), []);
assert.deepEqual(getBreakthroughTiers(1, 20), [1]);
assert.deepEqual(getBreakthroughTiers(1, 40), [1, 2, 3]);
assert.deepEqual(getBreakthroughTiers(40, 80), [4, 5, 6, 7]);
assert.deepEqual(getBreakthroughTiers(80, 90), [8]);
assert.deepEqual(getBreakthroughTiers(90, 1), []);

console.log('Testing calculateTrekkerCosts for Amber (103)...');
// Amber (103):
// Upgrade 1: { "Count's Rewards": 5, Dorra: 7900 }
// Upgrade 2: { "Count's Rewards": 5, "Count's Cellaring": 10, Dorra: 19800 }
// Upgrade 3: { "Count's Rewards": 10, "Count's Cellaring": 15, Dorra: 44400 }
// Total Lv 1 -> 40 (Tiers 1, 2, 3):
// Dorra: 72,100
// "Count's Rewards": 20
// "Count's Cellaring": 25

const amberLevelOnly = calculateTrekkerCosts({
  characterId: '103',
  startLevel: 1,
  targetLevel: 40,
  skills: {
    combat: { current: 1, target: 1 },
    support: { current: 1, target: 1 },
    ultimate: { current: 1, target: 1 },
    normal: { current: 1, target: 1 },
  },
});

assert.equal(amberLevelOnly.dorra, 72100);
assert.equal(amberLevelOnly.breakthroughDorra, 72100);
assert.equal(amberLevelOnly.skillDorra, 0);

const rewardsItem = amberLevelOnly.breakthroughItems.find(i => i.name === "Count's Rewards");
assert.ok(rewardsItem, "Count's Rewards must be present");
assert.equal(rewardsItem.count, 20);

const cellaringItem = amberLevelOnly.breakthroughItems.find(i => i.name === "Count's Cellaring");
assert.ok(cellaringItem, "Count's Cellaring must be present");
assert.equal(cellaringItem.count, 25);

// Test Skills:
// Skill Tier 1 (Lv 1 -> 2): { 'Shooter Game Cartridge': 6, 'Chess Piece of Skill': 2, Dorra: 13300 }
// Skill Tier 2 (Lv 2 -> 3): { 'Shooter Game Cartridge': 12, 'Chess Piece of Skill': 6, Dorra: 17600 }
// Total Rank 1 -> 3:
// Dorra: 30,900
// 'Shooter Game Cartridge': 18
// 'Chess Piece of Skill': 8

const amberSkillOnly = calculateTrekkerCosts({
  characterId: '103',
  startLevel: 1,
  targetLevel: 1,
  skills: {
    combat: { current: 1, target: 3 },
    support: { current: 1, target: 1 },
    ultimate: { current: 1, target: 1 },
    normal: { current: 1, target: 1 },
  },
});

assert.equal(amberSkillOnly.dorra, 30900);
assert.equal(amberSkillOnly.skillDorra, 30900);
assert.equal(amberSkillOnly.breakthroughDorra, 0);

const shooterItem = amberSkillOnly.skillItems.find(i => i.name === 'Shooter Game Cartridge');
assert.ok(shooterItem, 'Shooter Game Cartridge must be present');
assert.equal(shooterItem.count, 18);

// Edge Cases:
console.log('Testing edge cases...');
const zeroDelta = calculateTrekkerCosts({
  characterId: '103',
  startLevel: 50,
  targetLevel: 30,
  skills: {
    combat: { current: 5, target: 2 },
    support: { current: 1, target: 1 },
    ultimate: { current: 1, target: 1 },
    normal: { current: 1, target: 1 },
  },
});
assert.equal(zeroDelta.dorra, 0);
assert.equal(zeroDelta.breakthroughItems.length, 0);
assert.equal(zeroDelta.skillItems.length, 0);

console.log('✓ All resource engine tests passed');
