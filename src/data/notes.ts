import type { ElementType, NoteName, SSDisc, SSDiscSecondarySkill, SelectedMainDisc, SelectedSupportDisc } from '../types/index.ts';

export interface MusicalNoteMeta {
  id: number;
  name: NoteName;
  shortName: string;
  statLabel: string;
  statKey:
    | 'atkPct'
    | 'critRate'
    | 'critDmg'
    | 'hpPct'
    | 'autoAtkDmg'
    | 'skillDmg'
    | 'ultDmg'
    | 'aquaDmg'
    | 'ignisDmg'
    | 'ventusDmg'
    | 'terraDmg'
    | 'luxDmg'
    | 'umbraDmg';
  perLevelPct: number;
  element?: ElementType;
  category: 'combat' | 'elemental';
}

const SSASSETS_ICON_BASE =
  'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon';

export const MUSICAL_NOTES: MusicalNoteMeta[] = [
  {
    id: 90011,
    name: 'Melody of Pummel',
    shortName: 'Pummel',
    statLabel: 'ATK +0.3%/lv',
    statKey: 'atkPct',
    perLevelPct: 0.3,
    category: 'combat',
  },
  {
    id: 90012,
    name: 'Melody of Luck',
    shortName: 'Luck',
    statLabel: 'Crit Rate +0.1%/lv',
    statKey: 'critRate',
    perLevelPct: 0.1,
    category: 'combat',
  },
  {
    id: 90013,
    name: 'Melody of Burst',
    shortName: 'Burst',
    statLabel: 'Crit DMG +0.46%/lv',
    statKey: 'critDmg',
    perLevelPct: 0.46,
    category: 'combat',
  },
  {
    id: 90014,
    name: 'Melody of Stamina',
    shortName: 'Stamina',
    statLabel: 'Max HP +0.3%/lv',
    statKey: 'hpPct',
    perLevelPct: 0.3,
    category: 'combat',
  },
  {
    id: 90015,
    name: 'Melody of Focus',
    shortName: 'Focus',
    statLabel: 'Auto Attack DMG +1.2%/lv',
    statKey: 'autoAtkDmg',
    perLevelPct: 1.2,
    category: 'combat',
  },
  {
    id: 90016,
    name: 'Melody of Skill',
    shortName: 'Skill',
    statLabel: 'Skill DMG +0.46%/lv',
    statKey: 'skillDmg',
    perLevelPct: 0.46,
    category: 'combat',
  },
  {
    id: 90017,
    name: 'Melody of Ultimate',
    shortName: 'Ultimate',
    statLabel: 'Ultimate DMG +1.0%/lv',
    statKey: 'ultDmg',
    perLevelPct: 1.0,
    category: 'combat',
  },
  {
    id: 90019,
    name: 'Melody of Ignis',
    shortName: 'Ignis',
    statLabel: 'Ignis DMG +0.3%/lv',
    statKey: 'ignisDmg',
    perLevelPct: 0.3,
    element: 'Ignis',
    category: 'elemental',
  },
  {
    id: 90018,
    name: 'Melody of Aqua',
    shortName: 'Aqua',
    statLabel: 'Aqua DMG +0.3%/lv',
    statKey: 'aquaDmg',
    perLevelPct: 0.3,
    element: 'Aqua',
    category: 'elemental',
  },
  {
    id: 90021,
    name: 'Melody of Terra',
    shortName: 'Terra',
    statLabel: 'Terra DMG +0.3%/lv',
    statKey: 'terraDmg',
    perLevelPct: 0.3,
    element: 'Terra',
    category: 'elemental',
  },
  {
    id: 90020,
    name: 'Melody of Ventus',
    shortName: 'Ventus',
    statLabel: 'Ventus DMG +0.3%/lv',
    statKey: 'ventusDmg',
    perLevelPct: 0.3,
    element: 'Ventus',
    category: 'elemental',
  },
  {
    id: 90022,
    name: 'Melody of Lux',
    shortName: 'Lux',
    statLabel: 'Lux DMG +0.3%/lv',
    statKey: 'luxDmg',
    perLevelPct: 0.3,
    element: 'Lux',
    category: 'elemental',
  },
  {
    id: 90023,
    name: 'Melody of Umbra',
    shortName: 'Umbra',
    statLabel: 'Umbra DMG +0.3%/lv',
    statKey: 'umbraDmg',
    perLevelPct: 0.3,
    element: 'Umbra',
    category: 'elemental',
  },
];

export const NOTE_BY_NAME: Record<NoteName, MusicalNoteMeta> = Object.fromEntries(
  MUSICAL_NOTES.map((n) => [n.name, n])
) as Record<NoteName, MusicalNoteMeta>;

export function getNoteIconUrl(noteIdOrName: number | NoteName): string {
  const id = typeof noteIdOrName === 'number' ? noteIdOrName : NOTE_BY_NAME[noteIdOrName]?.id;
  if (!id) return '';
  return `${SSASSETS_ICON_BASE}/note/note_${id}_S.webp`;
}

export function getDiscOutfitIconUrl(discId: number, variant: 'a' | 'b' | 'd' | 'full' = 'full'): string {
  const outfitNum = discId > 210000 ? discId - 210000 : discId;
  if (outfitNum <= 0) return '';
  const suffix = variant === 'full' ? '' : `_${variant}`;
  return `${SSASSETS_ICON_BASE}/outfit/outfit_${outfitNum}${suffix}.webp`;
}

export function getDiscSkillIconUrl(iconName?: string): string {
  if (!iconName) return '';
  return `${SSASSETS_ICON_BASE}/discskill/${iconName}.webp`;
}

export interface DiscSkillSegment {
  text: string;
  kind: 'text' | 'value' | 'term' | 'mark';
  element?: ElementType;
}

const DISC_MARK_REGEX =
  /(?:(?:Ignis|Aqua|Ventus|Terra|Lux|Umbra)\s+Mark(?::\s*(?:Sacred\s+Flame|Torrent\/Chill\/Freeze|Torrent\/Chill|Torrent|Breeze|Earth\s+Vein|Radiance|Gloom))?|(?:Butterfly|Bubble|Cat\s+Eye|Sweep|Dark|bite|claw)\s+Marks?|\bmarks?\b)(?!\s+DMG\b)/i;

const DISC_MARK_SPLIT_REGEX = new RegExp(`(${DISC_MARK_REGEX.source})`, 'gi');

export function getDiscMarkElement(text: string, fallback?: ElementType | 'None'): ElementType | undefined {
  if (/Ignis/i.test(text)) return 'Ignis';
  if (/Aqua/i.test(text)) return 'Aqua';
  if (/Ventus/i.test(text)) return 'Ventus';
  if (/Terra/i.test(text)) return 'Terra';
  if (/Lux/i.test(text)) return 'Lux';
  if (/Umbra|Dark/i.test(text)) return 'Umbra';
  return fallback && fallback !== 'None' ? fallback : undefined;
}

/**
 * Same substitution as {@link formatDiscSkillDesc}, but keeps the game's colour
 * markers: `{n}` values become `value` segments and `##Term#id#` cross-references
 * become `term` segments so callers can render them with distinct styling.
 */
export function formatDiscSkillSegments(
  desc: string,
  paramsStr: string,
  level = 1,
  discElement?: ElementType | 'None'
): DiscSkillSegment[] {
  if (!desc) return [];

  const tiers = (paramsStr || '').split('/');
  const tierIdx = Math.max(0, Math.min(tiers.length - 1, level - 1));
  const values = (tiers[tierIdx] || '').split(',');

  // Sentinels: \u0001/\u0002 wrap coloured values, \u0003/\u0004 wrap cross-references.
  let formatted = desc
    .replace(/<color=[^>]+>/gi, '\u0001')
    .replace(/<\/color>/gi, '\u0002')
    .replace(/##([^#]+)#\d+#/g, '\u0003$1\u0004')
    .replace(/\u000b/g, '\n');

  values.forEach((val, idx) => {
    formatted = formatted.split(`{${idx + 1}}`).join(val.trim());
  });

  const rawSegments: DiscSkillSegment[] = [];
  let kind: DiscSkillSegment['kind'] = 'text';

  for (const part of formatted.split(/([\u0001-\u0004])/)) {
    if (!part) continue;
    if (part === '\u0001') {
      kind = 'value';
      continue;
    }
    if (part === '\u0003') {
      kind = 'term';
      continue;
    }
    if (part === '\u0002' || part === '\u0004') {
      kind = 'text';
      continue;
    }
    rawSegments.push({ text: part, kind });
  }

  const segments: DiscSkillSegment[] = [];
  for (const seg of rawSegments) {
    if (seg.kind === 'value') {
      segments.push(seg);
    } else if (seg.kind === 'term') {
      if (DISC_MARK_REGEX.test(seg.text)) {
        segments.push({
          text: seg.text,
          kind: 'mark',
          element: getDiscMarkElement(seg.text, discElement),
        });
      } else {
        segments.push(seg);
      }
    } else {
      const parts = seg.text.split(DISC_MARK_SPLIT_REGEX);
      for (const part of parts) {
        if (!part) continue;
        if (DISC_MARK_REGEX.test(part)) {
          segments.push({
            text: part,
            kind: 'mark',
            element: getDiscMarkElement(part, discElement),
          });
        } else {
          segments.push({ text: part, kind: 'text' });
        }
      }
    }
  }

  return segments;
}

export function formatDiscSkillDesc(desc: string, paramsStr: string, level = 1): string {
  if (!desc) return '';
  const tiers = (paramsStr || '').split('/');
  const tierIdx = Math.max(0, Math.min(tiers.length - 1, level - 1));
  const values = (tiers[tierIdx] || '').split(',');

  let formatted = desc.replace(/<color=[^>]+>/gi, '').replace(/<\/color>/gi, '').replace(/\u000b/g, ' ');
  // Game text marks cross-references as "##Term#1234#" — show just the term.
  formatted = formatted.replace(/##([^#]+)#\d+#/g, '$1');
  values.forEach((val, idx) => {
    const token = new RegExp(`\\{${idx + 1}\\}`, 'g');
    formatted = formatted.replace(token, val.trim());
  });
  return formatted;
}

export function calculateSupportStartingNotes(
  supportDiscs: SelectedSupportDisc[],
  discsMap: Record<string, SSDisc>
): Record<NoteName, number> {
  const totals = Object.fromEntries(MUSICAL_NOTES.map((n) => [n.name, 0])) as Record<NoteName, number>;
  for (const slot of supportDiscs) {
    if (!slot.discId) continue;
    const disc = discsMap[String(slot.discId)];
    if (!disc || !disc.supportNote?.length) continue;
    const phaseIdx = Math.max(0, Math.min(disc.supportNote.length - 1, slot.phase));
    const tierNotes = disc.supportNote[phaseIdx] || {};
    for (const [noteKey, count] of Object.entries(tierNotes)) {
      if (noteKey in totals) {
        totals[noteKey as NoteName] += Number(count) || 0;
      }
    }
  }
  return totals;
}

export function calculateRequiredHarmonyNotes(
  mainDiscs: SelectedMainDisc[],
  discsMap: Record<string, SSDisc>,
  harmonyTargetTier = 5 // 1 to 5
): Record<NoteName, number> {
  const required = Object.fromEntries(MUSICAL_NOTES.map((n) => [n.name, 0])) as Record<NoteName, number>;
  const reqIdx = Math.max(0, Math.min(4, harmonyTargetTier - 1));

  for (const slot of mainDiscs) {
    if (!slot.discId) continue;
    const disc = discsMap[String(slot.discId)];
    if (!disc) continue;

    for (const sec of [disc.secondarySkill1, disc.secondarySkill2]) {
      if (!sec || !sec.requirements?.length) continue;
      const tierReq = sec.requirements[Math.min(reqIdx, sec.requirements.length - 1)] || {};
      for (const [noteKey, val] of Object.entries(tierReq)) {
        if (noteKey in required) {
          // Wait: in Stella Sora, notes are NOT consumed when unlocking Harmony skills;
          // your total collected notes unlock all Main Discs simultaneously!
          //Wait OR do some players sum or take max? Taking MAX across all Main Disc requirements
          // satisfies every single Main Disc's threshold simultaneously!
          required[noteKey as NoteName] = Math.max(required[noteKey as NoteName], Number(val) || 0);
        }
      }
    }
  }
  return required;
}

export function getHarmonyActivationLevel(
  skill: SSDiscSecondarySkill | undefined,
  totalNotes: Partial<Record<NoteName, number>>
): number {
  if (!skill || !skill.requirements?.length) return 0;
  let activeLv = 0;
  for (let i = 0; i < skill.requirements.length; i++) {
    const req = skill.requirements[i];
    const satisfied = Object.entries(req).every(
      ([noteName, needed]) => (totalNotes[noteName as NoteName] || 0) >= needed
    );
    if (satisfied) {
      activeLv = i + 1;
    } else {
      break;
    }
  }
  return activeLv;
}
