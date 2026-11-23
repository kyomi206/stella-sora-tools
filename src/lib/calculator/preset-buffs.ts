import type { AdvancedTeamBuild, SSPotentialFull } from '../../types/index.ts';
import { getPotentialById } from '../potentials.ts';
import {
  extractPotentialPresetBuffs as extractPotentialPresetBuffsCore,
  type PresetBuffItem,
  type PresetBuffRosterSlot,
} from './preset-buffs-core.ts';

export * from './preset-buffs-core.ts';

export function extractPotentialPresetBuffs(
  build: AdvancedTeamBuild,
  roster: PresetBuffRosterSlot[],
  options?: {
    bonusLevels?: Record<string, 0 | 1 | 2 | 3>;
    levelOverrides?: Record<string, number>;
    disabledIds?: Record<string, boolean>;
    potentialLookup?: (characterId: number | null, potentialId: number) => SSPotentialFull | undefined;
  }
): PresetBuffItem[] {
  return extractPotentialPresetBuffsCore(build, roster, {
    ...options,
    potentialLookup: options?.potentialLookup ?? getPotentialById,
  });
}
