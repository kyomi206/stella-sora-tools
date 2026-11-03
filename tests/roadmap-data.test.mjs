import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const roadmapFilePath = existsSync('src/data/roadmap.ts')
  ? resolve('src/data/roadmap.ts')
  : resolve('blank/src/data/roadmap.ts');
const fileContent = readFileSync(roadmapFilePath, 'utf-8');

console.log('--- Testing Roadmap Data Verification ---');

// 1. Verify Character Banners were preserved and untouched
assert(fileContent.includes("id: 'banner-chitose-oct25'"), 'Chitose banner should exist');
assert(fileContent.includes("id: 'banner-noya-oct26'"), 'Noya 1st anniversary banner should exist');
assert(fileContent.includes("id: 'banner-shia-oct25'"), 'Shia banner should exist');
assert(fileContent.includes("id: 'banner-willow-jul26'"), 'Suntide Willow banner should exist');

// 2. Verify NO hallucinated/trope names exist anywhere in the file
const forbiddenHallucinations = [
  'Demon King',
  'Molten Colossus',
  'Frostwind Sovereign',
  'Abyssal Anomaly',
  'Star Sand',
  'Vestige Promotion Gift Boxes',
  'Exclusive 5★ Scorched Vestige',
  'Mirage Monolith & Corporate Syndicates',
  'Vault of the Rift',
  'Lost Voyage in the Misty Sea',
  'Dawn of the Tyrant',
];

for (const forbidden of forbiddenHallucinations) {
  assert(
    !fileContent.includes(forbidden),
    `File should not contain hallucinated term: "${forbidden}"`
  );
}

// 3. Verify Main Story Chapters adhere to canonical EN titles
const expectedMainStoryTitles = [
  'Chapter 1: Beings Without Memory',
  'Chapter 2: The Wind on Waterway Bridge',
  'Chapter 3: Guild Sweet Guild',
  'Chapter 4: Beyond the Dream',
  'Chapter 5: A Spark in the Dark',
  'Chapter 6: Miracle of a Flicker',
  'Special Chapter: Overture of a Shadowy Enigma',
  'Chapter 7: Price of the Star',
  'Chapter 8: Lingering Warmth',
  'Chapter 9: A Monolith Too Far',
  "Special Chapter: Wholeness at Reunion's Dawn",
];

for (const title of expectedMainStoryTitles) {
  assert(
    fileContent.includes(title),
    `File should include canonical EN Main Story chapter: "${title}"`
  );
}

// 4. Verify Limited-Time Events adhere to canonical EN names
const expectedEventTitles = [
  'Stellar Ascent',
  'Daring Adventure! The Ghost Ship Haunts the Deep',
  'Radiant Messenger, Holy Night Spirit',
  'Miracle of a Flicker',
  'Crackling Hint of Spring',
  'Winter Requiem and the Trigger of Dawn',
  'To My Dearest You',
  'Sunlit Breeze, Azure Seas, Checking In for A Cozy Summer~',
  'Surfing Splash: A Sparkling Holiday Adventure!',
  'Summit Show',
  "Wholeness at Reunion's Dawn",
];

for (const title of expectedEventTitles) {
  assert(
    fileContent.includes(title),
    `File should include canonical EN event: "${title}"`
  );
}

// 5. Verify Boss Blitz features authentic bosses and 49-day mechanics
const expectedBosses = [
  'Spellbound Golem',
  'Spirit of Brutality',
  'Flavor Dread',
  'Lithe Beauty',
  'Gobble Hexhorn Whale',
  'Jade Blade',
  'The Parasite Garden',
  'Furious Stomper Crab',
];

for (const boss of expectedBosses) {
  assert(fileContent.includes(boss), `File should include canon boss: "${boss}"`);
}

assert(fileContent.includes('49-day'), 'Boss Blitz should reference canonical 49-day duration');
assert(fileContent.includes('10 stars'), 'Boss Blitz should reference 10 stars maximum');
assert(fileContent.includes('Flavor Dread'), 'Boss Blitz should feature Flavor Dread');
assert(fileContent.includes('Furious Stomper Crab'), 'Boss Blitz should feature Furious Stomper Crab');

// 6. Verify Cataclysm Survivor features authentic EN mechanics and shop
assert(fileContent.includes("Defender\\'s Medals"), "Cataclysm should reference Defender's Medals");
assert(fileContent.includes('Brave Dedication'), 'Cataclysm should reference Brave Dedication shop');
assert(fileContent.includes('Destiny Cards'), 'Cataclysm should reference Destiny Cards');
assert(fileContent.includes('60-second'), 'Cataclysm should reference 60-second boss timer');

console.log('✓ All Roadmap data assertions passed successfully!');
