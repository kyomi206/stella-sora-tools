import rawCharacterData from '../../data/stelladb-character.json' with { type: 'json' };

export interface SkillRankRange {
  current: number; // 1-10
  target: number;  // 1-10
}

export interface CalculationParams {
  characterId: string;
  startLevel: number; // 1-90
  targetLevel: number; // 1-90
  skills: {
    combat: SkillRankRange;
    support: SkillRankRange;
    ultimate: SkillRankRange;
    normal: SkillRankRange;
  };
}

export interface MaterialItem {
  name: string;
  count: number;
}

export interface MaterialTally {
  dorra: number;
  breakthroughDorra: number;
  skillDorra: number;
  breakthroughItems: MaterialItem[];
  skillItems: MaterialItem[];
  allMaterials: { name: string; count: number; category: 'breakthrough' | 'skill' }[];
}

export interface CharacterUpgradeInfo {
  id: number;
  name: string;
  element: string;
  class: string;
  attackType?: string;
  star: number;
  upgrade: Record<string, number>[];
  skillUpgrade: Record<string, number>[];
  normalAtk?: { name: string; description?: string; icon?: string };
  skill?: { name: string; description?: string; icon?: string };
  supportSkill?: { name: string; description?: string; icon?: string };
  ultimate?: { name: string; description?: string; icon?: string };
}

// 8 Breakthrough tier breakpoints:
// Tier 1 is required to break past Lv 10 (allows 11-20)
// Tier 2 is required to break past Lv 20 (allows 21-30)
// ...
// Tier 8 is required to break past Lv 80 (allows 81-90)
const BREAKTHROUGH_THRESHOLDS = [10, 20, 30, 40, 50, 60, 70, 80];

export function getBreakthroughTiers(startLevel: number, targetLevel: number): number[] {
  const start = Math.max(1, Math.min(90, startLevel));
  const target = Math.max(1, Math.min(90, targetLevel));

  if (target <= start) {
    return [];
  }

  const tiers: number[] = [];
  BREAKTHROUGH_THRESHOLDS.forEach((threshold, index) => {
    // If our current level is <= threshold and target is > threshold, this tier is required.
    if (start <= threshold && target > threshold) {
      tiers.push(index + 1); // 1-indexed (1 to 8)
    }
  });

  return tiers;
}

export function getSkillTiers(currentRank: number, targetRank: number): number[] {
  const current = Math.max(1, Math.min(10, currentRank));
  const target = Math.max(1, Math.min(10, targetRank));

  if (target <= current) {
    return [];
  }

  const tiers: number[] = [];
  // 1-indexed tier i upgrades rank i to rank i+1 (e.g. tier 1 is Rank 1 -> 2, which is index 0 in skillUpgrade)
  for (let rank = current; rank < target; rank++) {
    tiers.push(rank); // 1 to 9
  }
  return tiers;
}

export function getCharacterData(characterId: string): CharacterUpgradeInfo | null {
  const charMap = rawCharacterData as Record<string, any>;
  const char = charMap[characterId];
  if (!char) return null;

  return {
    id: char.id,
    name: typeof char.name === 'object' ? (char.name.EN || Object.values(char.name)[0]) : char.name,
    element: char.element,
    class: char.class,
    attackType: char.attackType || 'Ranged',
    star: char.star,
    upgrade: Array.isArray(char.upgrade) ? char.upgrade : [],
    skillUpgrade: Array.isArray(char.skillUpgrade) ? char.skillUpgrade : [],
    normalAtk: char.normalAtk ? { name: char.normalAtk.name, description: char.normalAtk.desc, icon: char.normalAtk.icon } : undefined,
    skill: char.skill ? { name: char.skill.name, description: char.skill.desc, icon: char.skill.icon } : undefined,
    supportSkill: char.supportSkill ? { name: char.supportSkill.name, description: char.supportSkill.desc, icon: char.supportSkill.icon } : undefined,
    ultimate: char.ultimate ? { name: char.ultimate.name, description: char.ultimate.desc, icon: char.ultimate.icon } : undefined,
  };
}

export function getAllCharacters(): {
  id: string;
  name: string;
  element: string;
  class: string;
  attackType: string;
  star: number;
}[] {
  const charMap = rawCharacterData as Record<string, any>;
  return Object.keys(charMap).map((id) => {
    const char = charMap[id];
    return {
      id,
      name: typeof char.name === 'object' ? (char.name.EN || Object.values(char.name)[0]) : char.name,
      element: char.element || 'Ignis',
      class: char.class || 'Vanguard',
      attackType: char.attackType || 'Ranged',
      star: char.star || 4,
    };
  });
}

export function calculateTrekkerCosts(params: CalculationParams): MaterialTally {
  const char = getCharacterData(params.characterId);
  const result: MaterialTally = {
    dorra: 0,
    breakthroughDorra: 0,
    skillDorra: 0,
    breakthroughItems: [],
    skillItems: [],
    allMaterials: [],
  };

  if (!char) {
    return result;
  }

  const breakthroughTiers = getBreakthroughTiers(params.startLevel, params.targetLevel);
  const breakthroughMap = new Map<string, number>();

  for (const tier of breakthroughTiers) {
    const tierData = char.upgrade[tier - 1]; // 0-indexed
    if (!tierData) continue;

    for (const [key, value] of Object.entries(tierData)) {
      if (typeof value !== 'number') continue;
      if (key === 'Dorra') {
        result.breakthroughDorra += value;
        result.dorra += value;
      } else {
        breakthroughMap.set(key, (breakthroughMap.get(key) || 0) + value);
      }
    }
  }

  // Calculate skills across all 4 tracks
  const skillMap = new Map<string, number>();
  const skillTracks: SkillRankRange[] = [
    params.skills.combat,
    params.skills.support,
    params.skills.ultimate,
    params.skills.normal,
  ];

  for (const track of skillTracks) {
    if (!track) continue;
    const tiers = getSkillTiers(track.current, track.target);
    for (const tier of tiers) {
      const tierData = char.skillUpgrade[tier - 1]; // 0-indexed: tier 1 is index 0
      if (!tierData) continue;

      for (const [key, value] of Object.entries(tierData)) {
        if (typeof value !== 'number') continue;
        if (key === 'Dorra') {
          result.skillDorra += value;
          result.dorra += value;
        } else {
          skillMap.set(key, (skillMap.get(key) || 0) + value);
        }
      }
    }
  }

  // Sort and format items
  result.breakthroughItems = Array.from(breakthroughMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  result.skillItems = Array.from(skillMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  result.allMaterials = [
    ...result.breakthroughItems.map((item) => ({ ...item, category: 'breakthrough' as const })),
    ...result.skillItems.map((item) => ({ ...item, category: 'skill' as const })),
  ];

  return result;
}
