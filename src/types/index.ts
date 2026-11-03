export type ElementType = 'Ignis' | 'Aqua' | 'Terra' | 'Ventus' | 'Umbra' | 'Lux';
export type ClassType = 'Vanguard' | 'Versatile' | 'Support';
export type AttackType = 'Melee' | 'Ranged';
export type SlotType = 'vanguard' | 'versatile' | 'support';

export interface SSCharacter {
  id: number;
  name: {
    EN: string;
    KR?: string;
    JP?: string;
    CN?: string;
    TW?: string;
  };
  star: number;
  element: ElementType;
  class: ClassType;
  attackType: AttackType;
  avatarUrl?: string;
  description?: string;
}

export interface SSPotential {
  id: number;
  name: {
    EN: string;
    KR?: string;
    JP?: string;
    CN?: string;
    TW?: string;
  };
  briefDesc: {
    EN: string;
    KR?: string;
    JP?: string;
    CN?: string;
    TW?: string;
  };
  type: 'main' | 'common' | 'support';
  rarity: 0 | 1 | 2; // 0 = Core (gold), 1 = Rare (purple), 2 = Common (blue)
  imgId: string;
  subIcon?: 'Diamond' | 'Common' | 'Round';
}

export interface SSPotentialFull {
  id: number;
  characterId: number;
  name: string;
  nameCN?: string;
  nameJP?: string;
  nameKR?: string;
  group: 'mainCore' | 'mainNormal' | 'supportCore' | 'supportNormal' | 'common';
  slot: 'vanguard' | 'assist' | 'both';
  isCore: boolean;
  rarity: 'core' | 'rare' | 'common';
  rarityNum: 0 | 1 | 2;
  icon: string;
  descTemplate: string;
  params: (string | number)[];
  maxLevel: number;
  effectType?: string[];
  damageType?: string[];
}

export type PotentialPriority = 'Core' | 'Medium' | 'Optional' | 'Low';

export interface SelectedPotential {
  id: number;
  rarity: 0 | 1 | 2;
  level?: number | string;
  priority?: PotentialPriority;
}

export interface TeamSlotState {
  characterId: number | null;
  potentials: SelectedPotential[];
}

export interface TeamBuild {
  id: string;
  name: string;
  createdAt: number;
  slots: {
    vanguard: TeamSlotState;
    versatile: TeamSlotState;
    support: TeamSlotState;
  };
}

export interface AffinityLevelData {
  level: number;
  needExp: number;
  totalExpToLevel: number;
  isKey: boolean;
  stage: number;
}

export type NoteName =
  | 'Melody of Pummel'
  | 'Melody of Luck'
  | 'Melody of Burst'
  | 'Melody of Stamina'
  | 'Melody of Focus'
  | 'Melody of Skill'
  | 'Melody of Ultimate'
  | 'Melody of Aqua'
  | 'Melody of Ignis'
  | 'Melody of Ventus'
  | 'Melody of Terra'
  | 'Melody of Lux'
  | 'Melody of Umbra';

export interface SSDiscMainSkill {
  id: number;
  name: string;
  desc: string;
  params: string;
  icon: string;
  effectType: string[];
}

export interface SSDiscSecondarySkill {
  id: number;
  name: string;
  desc: string;
  params: string;
  requirements: Record<string, number>[];
  icon: string;
  effectType: string[];
}

export interface SSDisc {
  id: number;
  name: string;
  star: number;
  element: ElementType | 'None';
  tag: string[];
  char: string[];
  mainSkill?: SSDiscMainSkill;
  secondarySkill1?: SSDiscSecondarySkill;
  secondarySkill2?: SSDiscSecondarySkill;
  supportNote: Record<string, number>[];
  stats: {
    lv1: Record<string, number | string>;
    lv80: Record<string, number | string>;
    lv90: Record<string, number | string>;
  };
  dupeAtk: number[];
}

export interface SelectedMainDisc {
  discId: number | null;
  crescendo: number; // 1 to 6 (1 = C0 base, 6 = C5 max dupe)
  level: 1 | 80 | 90;
}

export interface SelectedSupportDisc {
  discId: number | null;
  phase: number; // 0 to 8 (index into supportNote array, 0 = Lv1, 8 = Lv80+)
  level: 1 | 80 | 90;
  crescendo?: number; // 1 to 6 (1 = C0 base, 6 = C5 max dupe)
}

export interface AdvancedTeamBuild extends TeamBuild {
  mainDiscs: [SelectedMainDisc, SelectedMainDisc, SelectedMainDisc];
  supportDiscs: [SelectedSupportDisc, SelectedSupportDisc, SelectedSupportDisc];
  targetNotes: Partial<Record<NoteName, number>>;
}
