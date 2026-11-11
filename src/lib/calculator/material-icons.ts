export interface MaterialMetadata {
  id: number;
  rarity: number; // 1 (SSR/Gold), 2 (SR/Purple), 3 (R/Blue), 4 (N/Green)
}

export const MATERIAL_DATA: Record<string, MaterialMetadata> = {
  "Count's Rewards": { id: 20081, rarity: 4 },
  "Dorra": { id: 1, rarity: 3 },
  "Count's Cellaring": { id: 20082, rarity: 3 },
  "Count's Gift": { id: 20083, rarity: 2 },
  "Shooter Game Cartridge": { id: 32011, rarity: 4 },
  "Chess Piece of Skill": { id: 32000, rarity: 4 },
  "Barrage Game Cartridge": { id: 32012, rarity: 3 },
  "Demon Bee Game Cartridge": { id: 32013, rarity: 2 },
  "Wrath Beauty": { id: 20043, rarity: 1 },
  "Tapping Game Cartridge": { id: 32001, rarity: 4 },
  "Rhythm Game Cartridge": { id: 32002, rarity: 3 },
  "Magic Sound Game Cartridge": { id: 32003, rarity: 2 },
  "Radiant Crown Essence": { id: 21053, rarity: 1 },
  "Backstage Ragged Hat": { id: 20071, rarity: 4 },
  "Spotlight Bowler": { id: 20072, rarity: 3 },
  "Exeunt Bowler": { id: 20073, rarity: 2 },
  "Kung Fu Game Cartridge": { id: 32021, rarity: 4 },
  "Fighting Game Cartridge": { id: 32022, rarity: 3 },
  "Phantom Game Cartridge": { id: 32023, rarity: 2 },
  "Colossus Essence": { id: 21023, rarity: 1 },
  "Faint Wick": { id: 20091, rarity: 4 },
  "Lumen Essence": { id: 20092, rarity: 3 },
  "Eternal Gloom Core": { id: 20093, rarity: 2 },
  "Crimson Tempter": { id: 20013, rarity: 1 },
  "Nightlit Haven": { id: 20063, rarity: 1 },
  "Wind Essence": { id: 21043, rarity: 1 },
  "Tidal Essence": { id: 21063, rarity: 1 },
  "Colossus Core": { id: 20023, rarity: 1 },
  "Forest Elf Fang": { id: 20003, rarity: 1 },
  "Evil Bloom Essence": { id: 21013, rarity: 1 },
  "Forest Elf Essence": { id: 21003, rarity: 1 },
  "Radiant Feather Crown": { id: 20053, rarity: 1 },
};

const CDN_BASE = 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon';

export function getMaterialIconUrl(materialName: string): string | null {
  const meta = MATERIAL_DATA[materialName];
  if (!meta) return null;
  return `${CDN_BASE}/item/item_${meta.id}.webp`;
}

export function getSkillIconUrl(iconName?: string): string | null {
  if (!iconName) return null;
  return `${CDN_BASE}/skill/${iconName}.webp`;
}

export function getMaterialRarityStyle(rarity?: number): { border: string; bg: string; text: string } {
  switch (rarity) {
    case 1: // Gold / Apex Boss Drop
      return {
        border: 'border-amber-500/50',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
      };
    case 2: // Purple / High Tier
      return {
        border: 'border-purple-500/50',
        bg: 'bg-purple-50',
        text: 'text-purple-700',
      };
    case 3: // Blue / Mid Tier
      return {
        border: 'border-sky-500/50',
        bg: 'bg-sky-50',
        text: 'text-sky-700',
      };
    case 4: // Green / Common Tier
    default:
      return {
        border: 'border-emerald-500/50',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
      };
  }
}
