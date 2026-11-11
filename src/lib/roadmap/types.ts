export type RoadmapCategoryKey =
  | 'banners'
  | 'bossBlitz'
  | 'events'
  | 'mainStory'
  | 'cataclysm';

export type ElementType = 'Ignis' | 'Aqua' | 'Terra' | 'Ventus' | 'Umbra' | 'Lux';
export type ColorTheme = 'purple' | 'amber' | 'blue' | 'rose' | 'emerald' | 'orange' | 'indigo';

export interface RateUpUnit {
  id: number;
  name: string;
  element?: string;
  imageUrl?: string;
}

export interface PairedDisc {
  id: number;
  name: string;
  discName?: string;
  element?: string;
  imageUrl?: string;
  artworkUrl?: string;
  bannerTabUrl?: string;
}

export interface BossMechanic {
  name: string;
  desc: string;
  descCN?: string;
  descJP?: string;
  icon?: string;
}

export interface RoadmapItem {
  id: string;
  category: RoadmapCategoryKey;
  title: string;
  subtitle?: string;
  startDate: string; // ISO 8601 string
  endDate: string;   // ISO 8601 string
  badge?: string;    // e.g. "LIMITED", "FESTIVAL", "DEBUT UP", "RATE UP", "RUNIC DISC"
  colorTheme: ColorTheme;
  characterId?: number;
  characterName?: string;
  discId?: number;
  discName?: string;
  element?: ElementType;
  bossName?: string;
  bossWeakness?: ElementType[];
  bossResist?: string;
  mechanics?: BossMechanic[];
  description?: string;
  rewards?: string[];
  wikiUrl?: string;
  imageUrl?: string;
  artworkUrl?: string;
  bannerTabUrl?: string;
  rateUp4Star?: RateUpUnit[];
  pairedDisc?: PairedDisc;
  bannerType?: 'character' | 'disc';
  isDatamined?: boolean;
}

export interface RawGachaItem {
  id: number;
  type: 'character' | 'disc' | string;
  name: string;
  icon?: string;
  rateUp5Star?: RateUpUnit[];
  rateUp4Star?: RateUpUnit[];
  startTime: string;
  endTime: string;
}

export interface RawUnreleasedItem {
  id: number;
  name: string;
  element?: string;
  class?: string;
  star?: number;
  desc?: string;
}

export interface RawBlitzMechanic {
  name: string;
  desc: string;
  descCN?: string;
  descJP?: string;
  descKR?: string;
  icon?: string;
}

export interface RawBlitzBoss {
  id: number;
  name: string;
  season?: number;
  icon?: string;
  type?: string;
  mechanic?: RawBlitzMechanic[];
  weakTo?: string[];
  resistTo?: string;
  damagePerScore?: number;
}

export interface UnreleasedTrekker {
  id: number;
  rawName: string;
  displayName: string;
  element: ElementType | string;
  class: string;
  star: number;
  avatarUrl: string;
  isDatamined: boolean;
}
