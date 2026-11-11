import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import LZString from 'lz-string';
import type { TeamBuild, AdvancedTeamBuild } from '../types/index.ts';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function createEmptyAdvancedBuild(): AdvancedTeamBuild {
  return {
    id: 'advanced-default',
    name: 'New Advanced Preset',
    // Stable value so server and client render the same compressed share link.
    createdAt: 0,
    slots: {
      vanguard: { characterId: null, potentials: [] },
      versatile: { characterId: null, potentials: [] },
      support: { characterId: null, potentials: [] },
    },
    mainDiscs: [
      { discId: null, crescendo: 1, level: 90 },
      { discId: null, crescendo: 1, level: 90 },
      { discId: null, crescendo: 1, level: 90 },
    ],
    supportDiscs: [
      { discId: null, phase: 8, level: 80, crescendo: 1 },
      { discId: null, phase: 8, level: 80, crescendo: 1 },
      { discId: null, phase: 8, level: 80, crescendo: 1 },
    ],
    targetNotes: {},
  };
}

export function compressBuild(build: TeamBuild): string {
  try {
    const json = JSON.stringify(build);
    return LZString.compressToEncodedURIComponent(json);
  } catch (err) {
    console.error('Failed to compress build', err);
    return '';
  }
}

export function compressAdvancedBuild(build: AdvancedTeamBuild): string {
  try {
    const json = JSON.stringify(build);
    return LZString.compressToEncodedURIComponent(json);
  } catch (err) {
    console.error('Failed to compress advanced build', err);
    return '';
  }
}
