import type {
  AdvancedTeamBuild,
  ElementType,
  NoteName,
  SSCharacter,
  SSDisc,
  SSDiscSecondarySkill,
  SSPotentialFull,
  SelectedMainDisc,
} from '../../types/index.ts';
import type { BuffStatKey, DamageType, ScalingStat } from './damage-engine.ts';
import type { BuffTarget, FighterInput, SlotKey } from './fighter-calc.ts';
import { getEmblemSkillLevelBonuses } from './talent-emblem.ts';

export type PresetBuffOrigin = 'melody' | 'harmony' | 'potential' | 'skill';

export interface PresetBuffRosterSlot {
  slot: SlotKey;
  character: SSCharacter | null;
}

export interface PresetBuffItem {
  id: string;
  origin: PresetBuffOrigin;
  sourceName: string;
  skillName: string;
  description: string;
  target: BuffTarget;
  stat: BuffStatKey;
  value: number;
  baseValue: number;
  stacks?: number;
  elementScope?: ElementType;
  harmonyLevel?: number;
  crescendo?: number;
  potentialId?: number;
  slot?: SlotKey;
  level?: number;
  maxLevel?: number;
  emblemBonusLevel?: 0 | 1 | 2 | 3;
  isCore?: boolean;
  realisticUptime?: number;
  enabled: boolean;
}

export interface DiscBuffEvaluationContext {
  /** Enforce trigger-subject prerequisites such as "When the <Element> Main Trekker..." */
  enforceTriggers?: boolean;
  /** Single-target Boss Blitz (0 kills) vs Multi-target mobbing (kill stacks active) */
  fightMode?: 'single' | 'multi';
  /** Realistic scales short-duration/Ultimate/ramp triggers; ideal keeps 100% max uptime */
  uptimeMode?: 'realistic' | 'ideal';
  /** Override Destiny Card stack count (defaults to skill max stacks when omitted) */
  destinyCards?: number;
  /** Override Harmony activation level (1..5) instead of computing from effectiveNotes */
  forceHarmonyLevel?: number;
}

export interface ParsedBuffEffect {
  stat: BuffStatKey;
  baseValue: number;
  stacks?: number;
  value: number;
  elementScope?: ElementType;
  excludeElement?: ElementType;
  includesOwnWithExcluded?: boolean;
  targetHint: 'enemy' | 'main' | 'versatile' | 'supportClass' | 'supportSlots' | 'squad' | 'own';
  durationSec?: number;
  clause: string;
}

const ELEMENTS: ElementType[] = ['Ignis', 'Aqua', 'Terra', 'Ventus', 'Lux', 'Umbra'];

function cleanRichText(str: string): string {
  return (str || '')
    .replace(/(?:\s|\u000b)*\b(?:Hidden)?Param\d+:\s*(?:&(?:Hidden)?Param\d+&|\S+)\s*\([^)]*\)/gi, '')
    .replace(/##([^#]+)#\d+#/g, '$1')
    .replace(/<color=#[0-9a-fA-F]{6}>(.*?)<\/color>/g, '$1')
    .replace(/<color=#[0-9a-fA-F]{6}>/g, '')
    .replace(/<\/color>/g, '')
    .replace(/\u000b/g, '\n')
    .trim();
}

export function renderDiscSkillDesc(desc: string, paramsStr: string, tierIndex: number): string {
  const tiers = (paramsStr || '').split('/');
  const safeIdx = Math.min(Math.max(0, tierIndex), Math.max(0, tiers.length - 1));
  const tier = tiers[safeIdx] || '';
  const vals = tier.split(',');
  const substituted = (desc || '').replace(/\{(\d+)\}/g, (_, n: string) => {
    const idx = Number(n) - 1;
    return vals[idx] !== undefined ? vals[idx].trim() : `{${n}}`;
  });
  return cleanRichText(substituted);
}

export function renderPotentialAtLevel(
  descTemplate: string,
  params: (string | number)[],
  level: number
): string {
  let desc = descTemplate || '';
  (params || []).forEach((paramSet, index) => {
    const parts = String(paramSet).split('/');
    let val = parts[0] ?? '';
    if (parts.length > 1) {
      const idx = Math.min(Math.max(level, 1), parts.length) - 1;
      val = parts[idx] ?? parts[0] ?? '';
    }
    desc = desc.replaceAll(new RegExp(`&Param${index + 1}(?:_.*?)?&`, 'g'), String(val));
  });
  return cleanRichText(desc);
}

export function getHarmonyActiveLevel(
  requirements: Record<string, number>[] | undefined,
  effectiveNotes: Partial<Record<NoteName, number>>
): number {
  if (!requirements || requirements.length === 0) return 0;
  let active = 0;
  for (let i = 0; i < requirements.length; i++) {
    const req = requirements[i];
    if (!req) continue;
    const entries = Object.entries(req);
    if (entries.length === 0) continue;
    const met = entries.every(
      ([noteName, needed]) => (effectiveNotes[noteName as NoteName] || 0) >= needed
    );
    if (met) active = i + 1;
    else break;
  }
  return active;
}

function detectNegatedElement(str: string): ElementType | undefined {
  const m = str.match(/\bnon-(Ignis|Aqua|Terra|Ventus|Lux|Umbra)\b/i);
  if (!m) return undefined;
  return ELEMENTS.find((el) => el.toLowerCase() === m[1].toLowerCase());
}

function detectElement(str: string): ElementType | undefined {
  const stripped = str.replace(/\bnon-(?:Ignis|Aqua|Terra|Ventus|Lux|Umbra)\b/gi, '');
  for (const el of ELEMENTS) {
    if (new RegExp(`\\b${el}\\b`, 'i').test(stripped)) return el;
  }
  return undefined;
}

function stripNonStatLeading(subj: string): string {
  let s = subj.replace(/\bwithin\s+(?:the\s+|its\s+)?(?:Attack|Impact)\s+Range\b/gi, '').trim();
  const compoundNonStat =
    /^.*?\b(?:Attack\s+Range|Attack\s+Interval|Duration|Max\s+Limit|Cooldown|Attack\s+Speed|ATK\s+SPD|Movement\s+(?:Speed|SPD)|Resilience\s+Break\s+Efficiency)\b[^.;]*?(?:,\s*as\s+well\s+as|\s+and)\s+(?:its\s+|their\s+|her\s+|his\s+)?/i;
  if (compoundNonStat.test(s)) {
    s = s.replace(compoundNonStat, '').trim();
  }
  return s;
}

function isNonDamageStatSubject(subj: string): boolean {
  const core = stripNonStatLeading(subj);
  const hasCombatWord = /\b(?:DMG|damage|ATK|Crit|DEF|PEN|HP)\b/i.test(core);
  if (!hasCombatWord) return true;
  if (
    /\b(?:ATK\s+SPD|Attack\s+Speed|Movement\s+(?:SPD|Speed)|Attack\s+Range|Attack\s+Interval|Skill\s+Cooldown|Cooldown|Resilience\s+Break\s+Efficiency|Shield\s+Strength|HP\s+recovery)\b/i.test(
      core
    )
  ) {
    return true;
  }
  return false;
}

function detectTargetHint(
  subj: string,
  clause: string,
  isEnemyTaken: boolean,
  defaultTarget: 'squad' | 'own'
): ParsedBuffEffect['targetHint'] {
  if (isEnemyTaken) return 'enemy';

  const checkText = subj;
  if (
    /\b(?:squad|squadmates|teammates|all\s+(?:other\s+)?friendly\s+units|friendly\s+units|a\s+random\s+ally|an\s+ally|allies)\b/i.test(
      checkText
    )
  ) {
    return 'squad';
  }
  if (/\bVersatile\s+(?:[A-Za-z]+\s+)?Trekkers?\b/i.test(checkText)) {
    return 'versatile';
  }
  if (/\bMain\s+(?:[A-Za-z]+\s+)?Trekker\b(?!'s\s+target\b)/i.test(checkText)) {
    return 'main';
  }
  if (/\bSupport\s+(?:[A-Za-z]+\s+)?Trekkers?\b/i.test(checkText)) {
    // e.g. "Support Terra Trekkers" -> Support class; "Support Trekkers" -> assist slots
    return detectElement(checkText) ? 'supportClass' : 'supportSlots';
  }
  // Plural "[Element] Trekkers" (e.g. "Ignis Trekkers", "Lux Trekkers' Crit Rate") -> matching element squad slots
  if (/\b(?:Ignis|Aqua|Terra|Ventus|Lux|Umbra)\s+Trekkers\b/i.test(checkText)) {
    return 'squad';
  }
  const triggerPrefix = clause.split(/\b(?:increas(?:es?|ing)|boost(?:s|ing)?|deals?)\b/i)[0] || clause;
  if (
    /\b(?:their|her|his)\b/i.test(checkText) &&
    /\bMain\s+(?:(?:Ignis|Aqua|Terra|Ventus|Lux|Umbra)\s+)?Trekker\b/i.test(triggerPrefix) &&
    !/\b(?:Squad|Versatile|Support)\b/i.test(triggerPrefix)
  ) {
    return 'main';
  }
  if (/\b(?:own|self|her|his)\b/i.test(checkText)) {
    return defaultTarget === 'own' ? 'own' : 'main';
  }

  // Fallback to clause action portion (after "increases"/"boosts")
  if (/\b(?:squad|squadmates|teammates|friendly\s+units)\b/i.test(clause)) {
    // Only if not preceded by "When any ... in the squad" alone
    const afterIncreases = clause.replace(/^.*?\b(?:increas(?:es?|ing)|boost(?:s|ing)?|deals?)\b/i, '');
    if (/\b(?:squad|squadmates|teammates|friendly\s+units|a\s+random\s+ally|an\s+ally|allies)\b/i.test(afterIncreases)) return 'squad';
  }

  return defaultTarget;
}

interface StatMatch {
  stat: BuffStatKey;
  elementScope?: ElementType;
}

function parseStatPhrase(
  phrase: string,
  isEnemyTaken: boolean,
  scopeContext = ''
): StatMatch[] {
  const stats: StatMatch[] = [];
  // Ignore trailing "when ..." condition inside subject (e.g. "ATK when a Bouncing Bomb deals DMG")
  const cleanPhrase = phrase.replace(/\bwhen\s+[^,.;]+$/i, '').trim() || phrase;
  const elInPhrase = detectElement(cleanPhrase);

  if (isEnemyTaken) {
    let matchedSpecific = false;
    if (/\b(?:Auto\s*Attack|Auto\s*ATK|Normal\s*Attack)\s+DMG\b/i.test(cleanPhrase)) {
      stats.push({ stat: 'aaTaken', elementScope: elInPhrase });
      matchedSpecific = true;
    }
    if (/\bSkill\s+DMG\b/i.test(cleanPhrase)) {
      stats.push({ stat: 'skillTaken', elementScope: elInPhrase });
      matchedSpecific = true;
    }
    if (/\bUltimate\s+DMG\b/i.test(cleanPhrase)) {
      stats.push({ stat: 'ultTaken', elementScope: elInPhrase });
      matchedSpecific = true;
    }
    if (/\bMark\s+DMG\b/i.test(cleanPhrase)) {
      stats.push({ stat: 'markTaken', elementScope: elInPhrase });
      matchedSpecific = true;
    }
    if (/\bMinion\s+DMG\b/i.test(cleanPhrase)) {
      stats.push({ stat: 'minionTaken', elementScope: elInPhrase });
      matchedSpecific = true;
    }
    if (!matchedSpecific) {
      if (
        /\bDMG\s+Taken\s+of\s+all\s+Elements\b|\ball\s+Elements?\s+DMG\s+Taken\b|\bof\s+all\s+Elements\b/i.test(
          cleanPhrase
        )
      ) {
        stats.push({ stat: 'elementTaken' });
      } else if (elInPhrase) {
        stats.push({ stat: 'elementTaken', elementScope: elInPhrase });
      } else if (/\bDMG\b/i.test(cleanPhrase)) {
        stats.push({ stat: 'dmgTaken' });
      }
    }
    return stats;
  }

  if (/\bMark\s+DMG\s+Multiplier\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'markDmg', elementScope: elInPhrase });
    return stats;
  }
  if (/\b(?:Auto\s*Attack|Auto\s*ATK|Normal\s*Attack)\s+DMG\s+Multiplier\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'aaDmg', elementScope: elInPhrase });
    return stats;
  }
  if (/\bUltimate\s+DMG\s+Multiplier\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'ultDmg', elementScope: elInPhrase });
    return stats;
  }
  if (/\bMinion\s+DMG\s+Multiplier\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'minionDmg', elementScope: elInPhrase });
    return stats;
  }
  if (/\bDMG\s+Multiplier\b/i.test(cleanPhrase)) {
    if (/\(Ultimate[^)]*\)|\bUltimate(?:\s+Phase\s+\d+)?'?s?\b/i.test(cleanPhrase)) {
      stats.push({ stat: 'ultSkillIntensity' });
    } else if (/\((?:Main|Support)\s+Skill\)|\b(?:Main|Support|next)\s+Skill\b/i.test(cleanPhrase)) {
      stats.push({ stat: 'skillSkillIntensity' });
    } else if (/\(Auto\s*Attack\)|\bAuto\s*Attacks?(?:'s)?\b/i.test(cleanPhrase)) {
      stats.push({ stat: 'aaSkillIntensity' });
    } else if (/\b(?:its|their)\s+DMG\s+multiplier\b|^DMG\s+multiplier\b/i.test(cleanPhrase)) {
      if (/\(Ultimate[^)]*\)/i.test(scopeContext)) {
        stats.push({ stat: 'ultSkillIntensity' });
      } else if (/\(Auto\s*Attack\)/i.test(scopeContext)) {
        stats.push({ stat: 'aaSkillIntensity' });
      } else if (/\((?:Main|Support)\s+Skill\)/i.test(scopeContext)) {
        stats.push({ stat: 'skillSkillIntensity' });
      } else {
        stats.push({ stat: 'skillIntensity' });
      }
    } else {
      stats.push({ stat: 'skillIntensity' });
    }
    return stats;
  }

  const hasCritRate = /\bCrit\s+Rate\b/i.test(cleanPhrase);
  const hasCritDmg = /\bCrit\s+DMG\b/i.test(cleanPhrase);
  if (hasCritRate || hasCritDmg) {
    let matchedCritType = false;
    const critMap: Array<[RegExp, BuffStatKey, BuffStatKey]> = [
      [/\b(?:Auto\s*Attack|Auto\s*ATK|Normal\s*Attack)\s+Crit\b/i, 'aaCritRate', 'aaCritDmg'],
      [/\bSkill\s+Crit\b/i, 'skillCritRate', 'skillCritDmg'],
      [/\bUltimate\s+Crit\b/i, 'ultCritRate', 'ultCritDmg'],
      [/\bMark\s+Crit\b/i, 'markCritRate', 'markCritDmg'],
      [/\bMinion\s+Crit\b/i, 'minionCritRate', 'minionCritDmg'],
    ];
    for (const [re, rKey, dKey] of critMap) {
      if (re.test(cleanPhrase)) {
        if (hasCritRate) stats.push({ stat: rKey, elementScope: elInPhrase });
        if (hasCritDmg) stats.push({ stat: dKey, elementScope: elInPhrase });
        matchedCritType = true;
      }
    }
    if (!matchedCritType) {
      if (hasCritRate) stats.push({ stat: 'critRate', elementScope: elInPhrase });
      if (hasCritDmg) stats.push({ stat: 'critDmg', elementScope: elInPhrase });
    }
    return stats;
  }

  let matchedType = false;
  if (/\b(?:Auto\s*Attack|Auto\s*ATK|Normal\s*Attack)\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'aaDmg', elementScope: elInPhrase });
    matchedType = true;
  }
  if (/\b(?:Main\s+Skill|Support\s+Skill|Skill)\b/i.test(cleanPhrase) && !/\bSkill\s+Cooldown\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'skillDmg', elementScope: elInPhrase });
    matchedType = true;
  }
  if (/\bUltimate\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'ultDmg', elementScope: elInPhrase });
    matchedType = true;
  }
  if (/\bMark\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'markDmg', elementScope: elInPhrase });
    matchedType = true;
  }
  if (/\bMinions?(?:'s)?\b/i.test(cleanPhrase) && /\b(?:DMG|damage)\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'minionDmg', elementScope: elInPhrase });
    matchedType = true;
  }
  if (matchedType) return stats;

  if (/\bElemental\s+DMG\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'elementDmg' });
    return stats;
  }
  if (elInPhrase && /\b(?:DMG|damage)\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'elementDmg', elementScope: elInPhrase });
    return stats;
  }
  if (/\b(?:DMG|damage)\b/i.test(cleanPhrase)) {
    return [];
  }

  if (/\bATK\b/i.test(cleanPhrase) && !/\bATK\s+SPD\b/i.test(cleanPhrase) && !/\bAttack\s+Speed\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'atkPct', elementScope: elInPhrase });
    return stats;
  }
  if (/\b(?:Max\s+)?HP\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'hpPct', elementScope: elInPhrase });
    return stats;
  }
  if (/\bDEF\s+PEN\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'defPen', elementScope: elInPhrase });
    return stats;
  }
  if (/\bDEF\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'defPct', elementScope: elInPhrase });
    return stats;
  }
  if (/\b(?:RES\s+)?PEN\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'resPen', elementScope: elInPhrase });
    return stats;
  }

  return stats;
}

function splitCompoundSubClause(clause: string): string[] {
  return clause
    .split(/(?<=\d%?|\d+(?:\.\d+)?s)\s*(?:,\s*(?:and\s+)?|\s+and\s+|\s*,?\s*as\s+well\s+as\s+)/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseClauseStats(
  clause: string,
  rememberedStackCap: number | null,
  clauseContext: string,
  rememberedBaseStatDesc: ParsedBuffEffect[] | null,
  defaultTarget: 'squad' | 'own'
): ParsedBuffEffect[] {
  const out: ParsedBuffEffect[] = [];

  const defRedMatch = clause.match(/\breduces?\s+(?:the\s+)?target'?s?\s+DEF\s+by\s+(-?\d+(?:\.\d+)?)(%?)/i);
  if (defRedMatch) {
    const raw = Math.abs(parseFloat(defRedMatch[1]));
    let stacks = 1;
    const sm = clause.match(/(?:stacking\s+up\s+to|up\s+to)\s+(\d+)\s+(?:times|stacks)/i);
    if (sm) stacks = Number(sm[1]);
    if (!defRedMatch[2] && raw > 0) {
      out.push({
        stat: 'defReduction',
        baseValue: raw,
        stacks: stacks > 1 ? stacks : undefined,
        value: +(raw * stacks).toFixed(4),
        targetHint: 'enemy',
        clause,
      });
    }
    return out;
  }

  if (/\b(?:reduces?|decreases?)\s+(?:the\s+)?DMG\s+taken\s+by\b/i.test(clause)) return out;
  if (
    !/\b(?:increas|boost|more\s+\w+|DMG\s*\+|ATK\s*\+|gains?\s+[+-]?\d|reduces?\s+[^.;]*?\bCrit\s+Rate)/i.test(
      clause
    )
  ) {
    return out;
  }

  let stacks = 1;
  const localStack =
    clause.match(/(?:stacking\s+up\s+to|up\s+to)\s+(\d+)\s+(?:times|stacks)/i) ??
    clause.match(/(?:max\s+stack\s+limit\s+of\s+[^,.;]+?\s+is\s+)?increased\s+to\s+(\d+)\s+stacks/i) ??
    clause.match(/\bgains?\s+(\d+)\s+stacks?\s+of\b[\s\S]{0,40}?\beach\s+increas(?:es?|ing)\b/i);
  if (localStack) {
    stacks = Number(localStack[1]);
  } else if (/\bEach\s+Mindflare\s+Butterfly\b/i.test(clause) && !/\bchance\s+to\b/i.test(clause)) {
    stacks = 4;
  } else if (/\beach\s+stack\b|\bevery\s+stack\b|\bper\s+stack\b|\beach\s+tier\b/i.test(clause) && rememberedStackCap) {
    stacks = rememberedStackCap;
  }
  const clauseStacks = stacks;

  const chanceMatch = clause.match(/\bthere\s+is\s+a\s+(\d+(?:\.\d+)?)%\s+chance\s+to\b/i);
  const chancePct = chanceMatch ? parseFloat(chanceMatch[1]) : null;
  const isRapidOnHitRefresh =
    /\bWhen\b[^.;]*?\bdeals?\s+(?:[^.;]{0,30}\s+)?DMG\b/i.test(clause) &&
    /\bfor\s+([5-9]|\d{2,})(?:\.\d+)?\s*s\b/i.test(clause) &&
    !/\(Ultimate\)/i.test(clause);

  const multStackMatch = clause.match(
    /\b(?:increas(?:es?|ing)|boosts?)\s+([^.;]+?)\s+by\s+the\s+number\s+of\s+.*?\s+stacks\s*x\s*(\d+(?:\.\d+)?)%/i
  );
  if (multStackMatch && rememberedStackCap) {
    const subj = stripNonStatLeading(multStackMatch[1]);
    const val = parseFloat(multStackMatch[2]);
    const stats = parseStatPhrase(subj, false);
    const targetHint = detectTargetHint(subj, clause, false, defaultTarget);
    for (const s of stats) {
      out.push({
        ...s,
        baseValue: val,
        stacks: rememberedStackCap,
        value: +(val * rememberedStackCap).toFixed(4),
        targetHint,
        clause,
      });
    }
    if (out.length) return out;
  }

  const convMatch = clause.match(
    /\bevery\s+1\.3%\s+increase\s+in\s+Auto\s+Attack\s+DMG\s+additionally\s+increases\s+[^,.;]*?\bMark\s+DMG\s+by\s+1%,\s*up\s+to\s+(\d+(?:\.\d+)?)%/i
  );
  if (convMatch) {
    const cap = parseFloat(convMatch[1]);
    if (Number.isFinite(cap) && cap > 0) {
      out.push({
        stat: 'aaToMarkRatio77',
        baseValue: cap,
        value: cap,
        targetHint: 'own',
        clause,
      });
    }
    return out;
  }

  const subParts = splitCompoundSubClause(clause);
  let lastVerb = 'increases';
  let lastSubjContext = clauseContext || '';
  let lastTargetHint: ParsedBuffEffect['targetHint'] | null = null;
  let lastElementScope: ElementType | undefined = undefined;

  for (let idx = 0; idx < subParts.length; idx++) {
    let part = subParts[idx];
    if (idx === 0 && /\b(?:When|If|While|Each\s+time|After)\b/i.test(part)) {
      lastSubjContext = part;
    }

    if (
      idx > 0 &&
      !/\b(?:increas(?:es?|ing)|boost(?:s|ing)?|takes?|deals?|grants?)\b/i.test(part) &&
      /\bby\s+[+-]?\d/i.test(part)
    ) {
      part = `${lastVerb} ${part}`;
    } else {
      const vm = part.match(/\b(increas(?:es?|ing)|boost(?:s|ing)?)\b/i);
      if (vm) lastVerb = vm[1];
    }

    const laterJoined = subParts.slice(idx + 1).join(', ');
    const stackOnlyInLaterGrant =
      !/(?:stacking\s+up\s+to|up\s+to|increased\s+to)\s+\d+\s+(?:times|stacks)/i.test(part) &&
      /\bgrants?\s+\d+\s+stacks?\s+of\b[\s\S]*?(?:stacking\s+up\s+to|up\s+to)\s+\d+\s+(?:times|stacks)/i.test(laterJoined);
    const stackOnlyInLaterEnemyDebuff =
      idx === 0 &&
      !/\b(?:When|Whenever|If|Each\s+time|After|Casting)\b/i.test(part) &&
      !/\bfor\s+\d+(?:\.\d+)?s\b/i.test(part) &&
      !/(?:stacking\s+up\s+to|up\s+to)\s+\d+\s+(?:times|stacks)/i.test(part) &&
      /\btaken\b[\s\S]*?\bfor\s+\d+(?:\.\d+)?s\b[\s\S]*?(?:stacking\s+up\s+to|up\s+to)\s+\d+\s+(?:times|stacks)/i.test(laterJoined);
    stacks = (stackOnlyInLaterGrant || stackOnlyInLaterEnemyDebuff) ? 1 : clauseStacks;

    const redCritMatch = part.match(
      /\breduces?\s+([^,.;]+?\bCrit\s+Rate)\s+by\s+-?(\d+(?:\.\d+)?)%/i
    );
    if (redCritMatch) {
      const critSubj = redCritMatch[1].trim();
      const val = -Math.abs(parseFloat(redCritMatch[2]));
      const stats = parseStatPhrase(critSubj, false);
      const targetHint = detectTargetHint(critSubj, clause, false, defaultTarget);
      for (const s of stats) {
        out.push({
          stat: s.stat,
          elementScope: s.elementScope,
          baseValue: val,
          value: val,
          targetHint,
          clause,
        });
      }
    }

    const grantDefMatch = part.match(/\bgrants?\s+(\d+(?:\.\d+)?)\s+DEF\b/i);
    if (grantDefMatch) {
      const val = parseFloat(grantDefMatch[1]);
      out.push({
        stat: 'baseDef',
        baseValue: val,
        stacks: stacks > 1 ? stacks : undefined,
        value: +(val * stacks).toFixed(4),
        targetHint: detectTargetHint(part, clause, false, defaultTarget),
        clause,
      });
    }

    const reA =
      /\b(?:increas(?:es?|ing)|boost(?:s|ing)?)\s+([^.;]+?)\s+by\s+(?:an\s+additional\s+)?([+-]?\d+(?:\.\d+)?%(?:\s*\/\s*[+-]?\d+(?:\.\d+)?%)*|\d+(?:\.\d+)?)(?=\s|$|[.,;]|s(?:\s|$|[.,;]))/gi;
    let m: RegExpExecArray | null;
    while ((m = reA.exec(part)) !== null) {
      const rawSubj = m[1].trim();
      const rawVal = m[2].trim();
      const isPct = rawVal.includes('%');
      if (/\breceived\s+this\s+time\b/i.test(rawSubj)) continue;
      if (isNonDamageStatSubject(rawSubj)) continue;
      const subj = stripNonStatLeading(rawSubj);
      if (!isPct && !/\b(?:DEF|PEN|HP|ATK)\b/i.test(subj)) continue;

      const slashParts = rawVal.split('/').map((x) => parseFloat(x));
      const baseVal = slashParts[slashParts.length - 1];
      if (!Number.isFinite(baseVal) || baseVal === 0) continue;

      const isEnemyTaken = /\btaken\b/i.test(subj) || /\btarget(?:s)?\s+takes?\b/i.test(part);
      let stats = parseStatPhrase(subj, isEnemyTaken, `${clause} ${lastSubjContext} ${clauseContext}`);

      if (stats.length === 0 && /\b(?:DMG|damage)\b/i.test(subj)) {
        stats = parseStatPhrase(`${lastSubjContext} ${subj}`, isEnemyTaken);
      }
      if (stats.length === 0 && /\bDMG\s+of\s+this\s+hit\b/i.test(subj) && rememberedBaseStatDesc?.length) {
        stats = rememberedBaseStatDesc.map((r) => ({ stat: r.stat, elementScope: r.elementScope }));
      }

      const includesMinions =
        /\band\s+(?:their\s+|all\s+)?(?:minions|toys|pumpka\s+phantom)\b/i.test(subj) ||
        /\band\s+minions\b/i.test(subj);
      let targetHint = detectTargetHint(subj, clause, isEnemyTaken, defaultTarget);
      const excludeElement = detectNegatedElement(subj);
      const includesOwnWithExcluded =
        excludeElement !== undefined &&
        /\bown\s+and\s+non-(?:Ignis|Aqua|Terra|Ventus|Lux|Umbra)\b/i.test(subj);

      const hasExplicitNamedOwner =
        /\b(?!Squad's\b|Trekker's\b|Trekkers'\b|Target's\b|Targets'\b)[A-Z][a-z]+(?:'s|s')\b/.test(subj);
      const hasExplicitScope =
        targetHint !== defaultTarget ||
        hasExplicitNamedOwner ||
        stats.some((s) => s.elementScope !== undefined);
      if (
        idx > 0 &&
        !isEnemyTaken &&
        !hasExplicitNamedOwner &&
        targetHint === defaultTarget &&
        lastTargetHint &&
        lastTargetHint !== 'enemy'
      ) {
        targetHint = lastTargetHint;
      } else if (hasExplicitScope) {
        lastTargetHint = targetHint;
      }

      const firstElScope = stats.find((s) => s.elementScope !== undefined)?.elementScope;
      if (firstElScope !== undefined) {
        lastElementScope = firstElScope;
      }

      for (const s of stats) {
        let finalStat = s.stat;
        if (!isPct) {
          if (finalStat === 'hpPct') finalStat = 'baseHp';
          else if (finalStat === 'defPct') finalStat = 'baseDef';
          else if (finalStat === 'atkPct') finalStat = 'baseAtk';
        }
        if (finalStat === 'atkPct' && includesMinions) finalStat = 'atkPctPerma';
        const effStacks = slashParts.length > 1 ? 1 : stacks;
        const resolvedElScope =
          s.elementScope ??
          (idx > 0 && !isEnemyTaken && targetHint === lastTargetHint ? lastElementScope : undefined);
        out.push({
          stat: finalStat,
          elementScope: resolvedElScope,
          ...(excludeElement ? { excludeElement } : {}),
          ...(includesOwnWithExcluded ? { includesOwnWithExcluded: true } : {}),
          baseValue: baseVal,
          stacks: effStacks > 1 ? effStacks : undefined,
          value: +(baseVal * effStacks).toFixed(4),
          targetHint,
          clause,
        });
      }
    }

    const reIncNoBy = /\bincreasing\s+([+-]?\d+(?:\.\d+)?)%/gi;
    while ((m = reIncNoBy.exec(part)) !== null && out.length === 0) {
      const baseVal = parseFloat(m[1]);
      const prefix = part.slice(0, m.index);
      const stats = parseStatPhrase(prefix, false);
      const targetHint = detectTargetHint(prefix, clause, false, defaultTarget);
      for (const s of stats) {
        out.push({
          stat: s.stat,
          elementScope: s.elementScope,
          baseValue: baseVal,
          stacks: stacks > 1 ? stacks : undefined,
          value: +(baseVal * stacks).toFixed(4),
          targetHint,
          clause,
        });
      }
    }

    const reA2 = /\bdeals?\s+increased\s+([^.;]+?)\s+by\s+([+-]?\d+(?:\.\d+)?)%/gi;
    while ((m = reA2.exec(part)) !== null) {
      const subj = stripNonStatLeading(m[1].trim());
      const baseVal = parseFloat(m[2]);
      if (isNonDamageStatSubject(subj)) continue;
      let stats = parseStatPhrase(subj, false);
      if (stats.length === 0 && /\bDMG\b/i.test(subj)) {
        stats = parseStatPhrase(`${lastSubjContext} ${subj}`, false);
      }
      const targetHint = detectTargetHint(clause, clause, false, defaultTarget);
      for (const s of stats) {
        out.push({
          stat: s.stat,
          elementScope: s.elementScope,
          baseValue: baseVal,
          stacks: stacks > 1 ? stacks : undefined,
          value: +(baseVal * stacks).toFixed(4),
          targetHint,
          clause,
        });
      }
    }

    const reB =
      /\b(?:the\s+)?target(?:s)?\s+takes?\s+([+-]?\d+(?:\.\d+)?)%\s+(?:more|increased)\s+([^.;,]+?)(?=\s+for\s|\s+from\s|[.,;]|$)/gi;
    while ((m = reB.exec(part)) !== null) {
      const baseVal = parseFloat(m[1]);
      const subj = m[2].trim();
      const stats = parseStatPhrase(subj, true);
      for (const s of stats) {
        out.push({
          stat: s.stat,
          elementScope: s.elementScope,
          baseValue: baseVal,
          stacks: stacks > 1 ? stacks : undefined,
          value: +(baseVal * stacks).toFixed(4),
          targetHint: 'enemy',
          clause,
        });
      }
    }

    const reC =
      /\bdeals?\s+([+-]?\d+(?:\.\d+)?)%\s+(?:more|increased)\s+([^.;,]+?)(?=\s+to\s|\s+for\s|[.,;]|$)/gi;
    while ((m = reC.exec(part)) !== null) {
      const baseVal = parseFloat(m[1]);
      const subj = m[2].trim();
      const stats = parseStatPhrase(subj, false);
      const targetHint = detectTargetHint(part.slice(0, m.index), clause, false, defaultTarget);
      for (const s of stats) {
        out.push({
          stat: s.stat,
          elementScope: s.elementScope,
          baseValue: baseVal,
          stacks: stacks > 1 ? stacks : undefined,
          value: +(baseVal * stacks).toFixed(4),
          targetHint,
          clause,
        });
      }
    }

    const reD = /\b((?:Auto\s*Attack|Skill|Ultimate|Mark|Minion)\s+DMG)\s*\+\s*([+-]?\d+(?:\.\d+)?)%/gi;
    while ((m = reD.exec(part)) !== null) {
      const subj = m[1].trim();
      const baseVal = parseFloat(m[2]);
      const stats = parseStatPhrase(subj, false);
      const targetHint = detectTargetHint(part, clause, false, defaultTarget);
      for (const s of stats) {
        out.push({
          stat: s.stat,
          elementScope: s.elementScope,
          baseValue: baseVal,
          stacks: stacks > 1 ? stacks : undefined,
          value: +(baseVal * stacks).toFixed(4),
          targetHint,
          clause,
        });
      }
    }

    const reGain =
      /\bgains?\s+([+-]?\d+(?:\.\d+)?%(?:\s*\/\s*[+-]?\d+(?:\.\d+)?%)*)\s+(?:(?:additional|increased)\s+)?([^.;,]+?)(?=\s+and\s+(?:restores?|recovers?|gains?|increases?|boosts?|reduces?|deals?|grants?|becomes?|is\s+|are\s+)|\s+for\s|\s+every\s|\s+with\s|[.,;]|$)/gi;
    while ((m = reGain.exec(part)) !== null) {
      const slashParts = m[1].split('/').map((x) => parseFloat(x));
      const baseVal = slashParts[slashParts.length - 1];
      if (!Number.isFinite(baseVal) || baseVal === 0) continue;
      const rawSubj = m[2].trim();
      if (isNonDamageStatSubject(rawSubj)) continue;
      const subj = stripNonStatLeading(rawSubj);
      const stats = parseStatPhrase(subj, false);
      const targetHint = detectTargetHint(part, clause, false, defaultTarget);
      const effStacks = slashParts.length > 1 ? 1 : stacks;
      for (const s of stats) {
        out.push({
          stat: s.stat,
          elementScope: s.elementScope,
          baseValue: baseVal,
          stacks: effStacks > 1 ? effStacks : undefined,
          value: +(baseVal * effStacks).toFixed(4),
          targetHint,
          clause,
        });
      }
    }

    const rePassive =
      /([^.;]+?)\s+(?:is|are)\s+increased\s+by\s+(?:an\s+additional\s+)?([+-]?\d+(?:\.\d+)?%(?:\s*\/\s*[+-]?\d+(?:\.\d+)?%)*|\d+(?:\.\d+)?)(?=\s|$|[.,;])/gi;
    while ((m = rePassive.exec(part)) !== null) {
      let rawSubj = m[1].trim();
      const rawVal = m[2].trim();
      const isPct = rawVal.includes('%');
      const commaIdx = rawSubj.lastIndexOf(',');
      if (commaIdx !== -1) {
        const afterComma = rawSubj.slice(commaIdx + 1).trim();
        if (afterComma) rawSubj = afterComma;
      }
      const andParts = rawSubj.split(/\s+and\s+/i);
      if (andParts.length > 1) {
        const rhs = andParts[andParts.length - 1].trim();
        const lhs = andParts.slice(0, -1).join(' and ');
        if (
          parseStatPhrase(rhs, /\btaken\b/i.test(rhs)).length > 0 &&
          (isNonDamageStatSubject(lhs) ||
            /\b(?:unleashes?|deals?|fires?|casts?|strikes?|triggers?|requires?|generates?|gains?|becomes?|can\s+\w+)\b/i.test(lhs))
        ) {
          rawSubj = rhs;
        }
      }
      if (isNonDamageStatSubject(rawSubj)) continue;
      const subj = stripNonStatLeading(rawSubj);
      if (!isPct && !/\b(?:DEF|PEN|HP|ATK)\b/i.test(subj)) continue;

      const slashParts = rawVal.split('/').map((x) => parseFloat(x));
      const baseVal = slashParts[slashParts.length - 1];
      if (!Number.isFinite(baseVal) || baseVal === 0) continue;

      const isEnemyTaken = /\btaken\b/i.test(subj) || /\btarget(?:s)?\s+takes?\b/i.test(part);
      let stats = parseStatPhrase(subj, isEnemyTaken, `${clause} ${lastSubjContext} ${clauseContext}`);
      if (stats.length === 0 && /\b(?:DMG|damage)\b/i.test(subj)) {
        stats = parseStatPhrase(`${lastSubjContext} ${subj}`, isEnemyTaken);
      }
      const targetHint = detectTargetHint(subj, clause, isEnemyTaken, defaultTarget);
      const effStacks = slashParts.length > 1 ? 1 : stacks;
      for (const s of stats) {
        let finalStat = s.stat;
        if (!isPct) {
          if (finalStat === 'hpPct') finalStat = 'baseHp';
          else if (finalStat === 'defPct') finalStat = 'baseDef';
          else if (finalStat === 'atkPct') finalStat = 'baseAtk';
        }
        out.push({
          stat: finalStat,
          elementScope: s.elementScope,
          baseValue: baseVal,
          stacks: effStacks > 1 ? effStacks : undefined,
          value: +(baseVal * effStacks).toFixed(4),
          targetHint,
          clause,
        });
      }
    }
  }

  if (chancePct !== null && !isRapidOnHitRefresh && !/\bfor\s+each\b/i.test(clause)) {
    for (const e of out) {
      if ((e.stacks ?? 1) < 4) {
        e.baseValue = +(e.baseValue * (chancePct / 100)).toFixed(4);
        e.value = +(e.value * (chancePct / 100)).toFixed(4);
      }
    }
  }

  return out;
}

interface NamedStackInfo {
  cap: number;
  ownerHint?: 'main' | 'versatile' | 'supportClass' | 'supportSlots';
}

function cleanStackName(raw: string): string {
  return raw
    .replace(/\s+(?:per\s+second|to\s+the\s+squad|on\s+the\s+target)$/i, '')
    .trim();
}

function detectStackOwnerHint(
  clause: string
): NamedStackInfo['ownerHint'] {
  if (/\bVersatile\s+Trekkers?\s+(?:gains?|has|have)\b/i.test(clause)) return 'versatile';
  if (/\bSupport\s+Trekkers?\s+(?:gains?|has|have)\b/i.test(clause)) return 'supportClass';
  if (/\bMain\s+(?:(?:Ignis|Aqua|Terra|Ventus|Lux|Umbra)\s+)?Trekker\s+(?:gains?|has|have)\b/i.test(clause)) {
    return 'main';
  }
  if (/\bgrants?\s+[^,.]*?\bon\s+the\s+Main\s+Trekker\b/i.test(clause)) return 'main';
  if (/\bgrants?\s+the\s+Main\s+Trekker\b/i.test(clause)) return 'main';
  return undefined;
}

function extractNamedStacksFromSkills(
  skillTexts: string[],
  roster: PresetBuffRosterSlot[],
  enforceTriggers: boolean,
  blockedStacks: Set<string>
): Map<string, NamedStackInfo> {
  const stacks = new Map<string, NamedStackInfo>();
  const singleGrantCounts = new Map<string, number>();

  for (const text of skillTexts) {
    if (!text) continue;
    const clauses = text
      .split(/(?:\n+|(?<=[.!?])\s+)/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const clause of clauses) {
      const blocked = enforceTriggers && isClauseTriggerBlocked(clause, roster, blockedStacks);
      const ownerHint = detectStackOwnerHint(clause);

      // Pattern A: intro + explicit cap ("gains 1 stack of X ... up to N times/stacks")
      const reA =
        /(?:gains?|grants?|inflicts?)\s+(?:\d+\s+stacks?\s+of\s+)?([A-Z][A-Za-z' -]{2,26}?)\s+(?:on\s+[^,.]+?\s+)?(?:for\s+\d+(?:\.\d+)?s(?:,\s*|\s+after\s+[^,]+?,\s*)|,\s*)(?:stacking\s+)?up\s+to\s+(\d+)\s+(?:times|stacks)/gi;
      let m: RegExpExecArray | null;
      while ((m = reA.exec(clause)) !== null) {
        const name = cleanStackName(m[1]).toLowerCase();
        const cap = Number(m[2]);
        if (name.length >= 3 && cap > 1) {
          if (blocked) {
            blockedStacks.add(name);
          } else {
            const prev = stacks.get(name);
            stacks.set(name, {
              cap: Math.max(prev?.cap ?? 0, cap),
              ownerHint: prev?.ownerHint ?? ownerHint,
            });
          }
        }
      }

      // Pattern B: cap upgrade ("Eternity can stack up to 20 times", "Assembly can stack up to 3 times")
      const reB = /([A-Z][A-Za-z' -]{2,26}?)\s+can\s+stack\s+up\s+to\s+(\d+)\s+(?:times|stacks)/gi;
      while ((m = reB.exec(clause)) !== null) {
        const name = cleanStackName(m[1]).toLowerCase();
        const cap = Number(m[2]);
        if (name.length >= 3 && cap > 1 && !blocked) {
          const prev = stacks.get(name);
          stacks.set(name, {
            cap: Math.max(prev?.cap ?? 0, cap),
            ownerHint: prev?.ownerHint ?? ownerHint,
          });
        }
      }

      // Pattern C: split-source additive single-stack grants ("gains 1 stack of Starwish")
      const reC =
        /(?:gains?|grants?\s+(?:the\s+)?(?:Main\s+Trekker\s+)?)\s*1\s+stack\s+of\s+([A-Z][A-Za-z' -]{2,24}?)(?=\s+for|\s+on|\s+per|\s+to|,|\.|$)/gi;
      while ((m = reC.exec(clause)) !== null) {
        const name = cleanStackName(m[1]).toLowerCase();
        if (name.length >= 3 && !blocked) {
          singleGrantCounts.set(name, (singleGrantCounts.get(name) || 0) + 1);
          const prev = stacks.get(name);
          if (!prev) {
            stacks.set(name, { cap: 1, ownerHint });
          } else if (!prev.ownerHint && ownerHint) {
            stacks.set(name, { ...prev, ownerHint });
          }
        }
      }
    }
  }

  // For stacks without an explicit "up to N" cap (e.g. Starwish: +1 in M, +1 in H1, +1 in H2),
  // use the count of active non-blocked stack grants across M/H1/H2.
  for (const [name, grantCount] of singleGrantCounts.entries()) {
    const info = stacks.get(name);
    if (info && info.cap <= 1 && grantCount > 1) {
      stacks.set(name, { ...info, cap: grantCount });
    }
  }

  return stacks;
}

function isClauseTriggerBlocked(
  clause: string,
  roster: PresetBuffRosterSlot[],
  blockedStacks: Set<string>
): boolean {
  const populated = roster.filter((r) => r.character !== null);
  const vanguardEl = roster.find((r) => r.slot === 'vanguard')?.character?.element;

  // Check named stacks whose introducing mainSkill trigger was already blocked
  const lower = clause.toLowerCase();
  for (const stackName of blockedStacks) {
    if (lower.includes(stackName)) return true;
  }

  // Trigger prerequisite: "When/After the/any <Element> Main Trekker..." or "Main <Element> Trekker..."
  const mainElMatch = clause.match(
    /\b(?:When|After)\s+(?:the|any|a)\s+(?:(Ignis|Aqua|Terra|Ventus|Lux|Umbra)\s+Main\s+Trekker|Main\s+(Ignis|Aqua|Terra|Ventus|Lux|Umbra)\s+Trekker)\b/i
  );
  if (mainElMatch) {
    const reqEl = (mainElMatch[1] || mainElMatch[2]) as ElementType;
    if (!vanguardEl || vanguardEl.toLowerCase() !== reqEl.toLowerCase()) return true;
  }

  // Trigger prerequisite: "When/After a/any <Element> Versatile Trekker..." or "Versatile Trekker ... <Element> Mark"
  const versatileElMatch = clause.match(
    /\b(?:When|After)\s+(?:the|any|a)\s+(Ignis|Aqua|Terra|Ventus|Lux|Umbra)\s+Versatile\s+Trekker\b/i
  );
  if (versatileElMatch) {
    const reqEl = versatileElMatch[1].toLowerCase();
    const hasMatch = populated.some(
      (r) => r.character?.class === 'Versatile' && r.character.element.toLowerCase() === reqEl
    );
    if (!hasMatch) return true;
  }
  const versatileMarkMatch = clause.match(
    /\b(?:When|After)\s+(?:the|any|a)\s+Versatile\s+Trekker\s+[^,.]*?\b(Ignis|Aqua|Terra|Ventus|Lux|Umbra)\s+Mark\b/i
  );
  if (versatileMarkMatch) {
    const reqEl = versatileMarkMatch[1].toLowerCase();
    const hasMatch = populated.some(
      (r) => r.character?.class === 'Versatile' && r.character.element.toLowerCase() === reqEl
    );
    if (!hasMatch) return true;
  }

  // Trigger prerequisite: "When/After a/any <Element> Support Trekker..." or "Support Trekker ... <Element> Mark"
  const supportElMatch = clause.match(
    /\b(?:When|After)\s+(?:the|any|a)\s+(?:(Ignis|Aqua|Terra|Ventus|Lux|Umbra)\s+Support\s+Trekker|Support\s+(Ignis|Aqua|Terra|Ventus|Lux|Umbra)\s+Trekker)\b/i
  );
  if (supportElMatch) {
    const reqEl = (supportElMatch[1] || supportElMatch[2]).toLowerCase();
    const hasMatch = populated.some(
      (r) =>
        (r.slot === 'versatile' || r.slot === 'support' || r.character?.class === 'Support') &&
        r.character?.element.toLowerCase() === reqEl
    );
    if (!hasMatch) return true;
  }
  const supportMarkMatch = clause.match(
    /\b(?:When|After)\s+(?:the|any|a)\s+Support\s+Trekker\s+[^,.]*?\b(Ignis|Aqua|Terra|Ventus|Lux|Umbra)\s+Mark\b/i
  );
  if (supportMarkMatch) {
    const reqEl = supportMarkMatch[1].toLowerCase();
    const hasMatch = populated.some(
      (r) =>
        (r.slot === 'versatile' || r.slot === 'support' || r.character?.class === 'Support') &&
        r.character?.element.toLowerCase() === reqEl
    );
    if (!hasMatch) return true;
  }

  return false;
}

function getContextualEffectScale(
  eff: ParsedBuffEffect,
  context: DiscBuffEvaluationContext
): number {
  const clause = eff.clause;

  // Single-target Boss Blitz has 0 kills
  if (
    context.fightMode === 'single' &&
    /\b(?:for\s+each\s+target\s+killed|targets?\s+killed|kills?\s+a\s+target|defeat(?:s|ed|ing)?\s+(?:a\s+|an\s+)?(?:target|enemy))\b/i.test(
      clause
    )
  ) {
    return 0;
  }

  let scale = 1;

  // Destiny Card scaling (e.g. 0..10 cards)
  if (
    context.destinyCards !== undefined &&
    /\bfor\s+every\s+Destiny\s+Card\s+owned\b/i.test(clause)
  ) {
    const cap = eff.stacks || 10;
    const cards = Math.max(0, Math.min(cap, context.destinyCards));
    scale *= cards / cap;
  }

  // Realistic trigger uptime scaling for short-duration / Ultimate / hit triggers
  if (context.uptimeMode === 'realistic') {
    const durMatch = clause.match(/\bfor\s+(\d+(?:\.\d+)?)\s*(?:s|sec)\b/i);
    const triggerPrefix = clause.split(',')[0] || '';
    if (durMatch && /\b(?:When|After)\b/i.test(triggerPrefix)) {
      const dur = parseFloat(durMatch[1]);
      if (/\bUltimate\b/i.test(triggerPrefix)) {
        scale *= Math.min(1, dur / 24);
      } else if (/\bis\s+hit\b/i.test(triggerPrefix)) {
        scale *= Math.min(1, dur / 16);
      } else if (dur < 6 && !/\bdeals?\s+(?:(?:Auto\s*Attack|Skill)\s+)?DMG\b/i.test(triggerPrefix)) {
        scale *= Math.min(1, dur / 7);
      }
    }
    // Ramp discount for effects gated behind >=5 stacks / max stacks or high-stack short-duration buffs
    if (
      /\b(?:with\s+(?:[5-9]|\d{2,})\s+stacks\s+or\s+more|at\s+max\s+stacks)\b/i.test(clause) ||
      ((eff.stacks || 1) >= 8 &&
        durMatch &&
        parseFloat(durMatch[1]) <= 8 &&
        !/Destiny\s+Card/i.test(clause))
    ) {
      scale *= 0.85;
    }
  }

  return scale;
}

export function extractEffectsFromText(
  text: string,
  defaultTarget: 'squad' | 'own' = 'squad',
  namedStacks?: Map<string, NamedStackInfo>
): ParsedBuffEffect[] {
  const clauses = text
    .split(/(?:\n+|(?<=[.!?])\s+)/)
    .map((s) => s.trim())
    .filter(Boolean);

  const results: ParsedBuffEffect[] = [];
  let rememberedBaseStatDesc: ParsedBuffEffect[] | null = null;
  let rememberedStackCap: number | null = null;
  let lastEffectStartIdx = 0;
  let clauseContext = '';

  for (const clause of clauses) {
    let clauseOwnerHint: NamedStackInfo['ownerHint'] = detectStackOwnerHint(clause);
    let matchedNamedCap: number | null = null;

    if (namedStacks && namedStacks.size > 0) {
      const lowerClause = clause.toLowerCase();
      for (const [stackName, info] of namedStacks.entries()) {
        if (lowerClause.includes(stackName)) {
          if (info.cap > 1) matchedNamedCap = info.cap;
          if (!clauseOwnerHint && info.ownerHint) clauseOwnerHint = info.ownerHint;
          break;
        }
      }
    }

    const stackCapMatch =
      clause.match(/(?:stacking\s+up\s+to|up\s+to|can\s+stack\s+up\s+to|increased\s+to)\s+(\d+)\s+(?:times|stacks)/i) ??
      clause.match(/\bgains?\s+(\d+)\s+stacks?\s+of\b[\s\S]{0,40}?\beach\s+increas(?:es?|ing)\b/i);
    if (stackCapMatch) {
      const localCap = Number(stackCapMatch[1]);
      rememberedStackCap = matchedNamedCap ? Math.max(localCap, matchedNamedCap) : localCap;
    } else if (matchedNamedCap) {
      rememberedStackCap = matchedNamedCap;
    }
    if (/\b(?:Main\s+Skill|Support\s+Skill|Auto\s+Attack|Ultimate|Mark|Minion|Shadow\s+Clone)\b/i.test(clause)) {
      clauseContext = clause;
    }

    const additionalMatch = clause.match(
      /\bincreas(?:es?|ing)\s+(?:this|the)\s+effect\s+by\s+(?:an\s+)?additional\s+([+-]?\d+(?:\.\d+)?)%/i
    );
    if (additionalMatch && rememberedBaseStatDesc) {
      const val = parseFloat(additionalMatch[1]);
      let stacks = 1;
      const localStack = clause.match(/(?:stacking\s+up\s+to|up\s+to)\s+(\d+)\s+(?:times|stacks)/i);
      if (localStack) stacks = Number(localStack[1]);
      for (const prev of rememberedBaseStatDesc) {
        results.push({
          ...prev,
          baseValue: val,
          stacks: stacks > 1 ? stacks : undefined,
          value: +(val * stacks).toFixed(4),
          clause,
        });
      }
      continue;
    }

    const foundInClause = parseClauseStats(
      clause,
      rememberedStackCap,
      clauseContext,
      rememberedBaseStatDesc,
      defaultTarget
    );

    if (foundInClause.length > 0) {
      // Apply stack owner role (e.g. Sync Rate / Light Particle belong to Versatile Trekkers,
      // so "their Lux DMG" or "own Crit DMG" targets versatile instead of leaking onto team/main).
      const afterVerb = clause.replace(/^.*?\b(?:increas(?:es?|ing)|boost(?:s|ing)?)\b/i, '');
      const hasExplicitSquadOrMain =
        /\b(?:squad|squadmates|teammates|all\s+(?:other\s+)?friendly\s+units|friendly\s+units|Main\s+(?:[A-Za-z]+\s+)?Trekker)\b/i.test(
          afterVerb
        );
      const hasPronounRef = /\b(?:their|own|self|her|his)\b/i.test(afterVerb);

      const refined = foundInClause.map((eff) => {
        if (
          clauseOwnerHint &&
          eff.targetHint !== 'enemy' &&
          !hasExplicitSquadOrMain &&
          hasPronounRef
        ) {
          return { ...eff, targetHint: clauseOwnerHint };
        }
        return eff;
      });

      if (!/^Additionally\b/i.test(clause)) {
        lastEffectStartIdx = results.length;
      }
      results.push(...refined);
      rememberedBaseStatDesc = refined;
    } else {
      const trailingStackMatch = clause.match(
        /^This\s+effect\s+(?:(?:lasts\s+([^,]+),\s*)|(?:is\s+permanent\s+and\s+))?(?:stacking\s+up\s+to|stacks?\s+up\s+to|can\s+stack\s+up\s+to)\s+(\d+)\s+(?:times|stacks)/i
      );
      if (trailingStackMatch && results.length > lastEffectStartIdx) {
        const durText = trailingStackMatch[1] || '';
        const durMatch = durText.match(/(\d+(?:\.\d+)?)\s*(?:s|sec)/i);
        const trailingDur = durMatch ? parseFloat(durMatch[1]) : undefined;
        const cap = Number(trailingStackMatch[2]);
        if (cap > 1) {
          for (let i = lastEffectStartIdx; i < results.length; i++) {
            const r = results[i];
            if (!r.stacks) {
              r.stacks = cap;
              r.value = +(r.baseValue * cap).toFixed(4);
            }
            if (trailingDur !== undefined && r.durationSec === undefined) {
              r.durationSec = trailingDur;
            }
            if (
              i > lastEffectStartIdx &&
              /\bEach\s+time\b[^.;]*\bbounces?\b/i.test(results[lastEffectStartIdx].clause) &&
              !/\bbounces?\b/i.test(r.clause)
            ) {
              r.clause = `${results[lastEffectStartIdx].clause} ${r.clause}`;
            }
          }
        }
      }
    }
  }

  return results;
}

export function resolveTargetsForEffect(
  effect: ParsedBuffEffect,
  roster: PresetBuffRosterSlot[],
  ownerSlot?: SlotKey
): BuffTarget[] {
  const populated = roster.filter((r) => r.character !== null);
  const elFilter = effect.elementScope;
  const matchesElement = (r: PresetBuffRosterSlot) =>
    !elFilter || r.character?.element === elFilter;

  if (effect.targetHint === 'own') {
    if (!ownerSlot) return ['vanguard'];
    const owner = roster.find((r) => r.slot === ownerSlot);
    if (elFilter && owner?.character && owner.character.element !== elFilter) return [];
    return [ownerSlot];
  }

  if (effect.targetHint === 'main') {
    const vanguard = roster.find((r) => r.slot === 'vanguard');
    if (elFilter && vanguard?.character && vanguard.character.element !== elFilter) return [];
    if (elFilter && !vanguard?.character) return [];
    return ['vanguard'];
  }

  if (effect.targetHint === 'versatile') {
    const matches = populated.filter(
      (r) => r.character?.class === 'Versatile' && matchesElement(r)
    );
    if (matches.length > 0) return matches.map((r) => r.slot);
    if (elFilter) return [];
    return ['versatile'];
  }

  if (effect.targetHint === 'supportClass') {
    const matches = populated.filter(
      (r) => r.character?.class === 'Support' && matchesElement(r)
    );
    if (matches.length > 0) return matches.map((r) => r.slot);
    // Fallback to assist slots if element matches
    const assistMatches = populated.filter(
      (r) => (r.slot === 'versatile' || r.slot === 'support') && matchesElement(r)
    );
    return assistMatches.map((r) => r.slot);
  }

  if (effect.targetHint === 'supportSlots') {
    const matches = populated.filter(
      (r) => (r.slot === 'versatile' || r.slot === 'support') && matchesElement(r)
    );
    if (matches.length > 0) return matches.map((r) => r.slot);
    return elFilter ? [] : ['versatile', 'support'];
  }

  // 'enemy' or 'squad'
  if (effect.excludeElement) {
    if (populated.length === 0) return [];
    const matching = populated.filter(
      (r) =>
        matchesElement(r) &&
        (r.character?.element !== effect.excludeElement ||
          (effect.includesOwnWithExcluded && ownerSlot && r.slot === ownerSlot))
    );
    if (matching.length === 0) return [];
    if (matching.length === populated.length) return ['team'];
    return matching.map((r) => r.slot);
  }
  if (!elFilter) return ['team'];
  if (populated.length === 0) return [];
  const matching = populated.filter(matchesElement);
  if (matching.length === 0) return [];
  if (matching.length === populated.length) return ['team'];
  return matching.map((r) => r.slot);
}

export function extractDiscPresetBuffs(
  mainDiscs: SelectedMainDisc[],
  effectiveNotes: Partial<Record<NoteName, number>>,
  discsMap: Record<string, SSDisc>,
  roster: PresetBuffRosterSlot[],
  disabledIds?: Record<string, boolean>,
  context?: DiscBuffEvaluationContext
): PresetBuffItem[] {
  const items: PresetBuffItem[] = [];

  mainDiscs.forEach((selected, discIndex) => {
    if (!selected.discId) return;
    const disc = discsMap[String(selected.discId)];
    if (!disc) return;

    const crescendo = Math.min(6, Math.max(1, Math.round(Number(selected.crescendo) || 1)));
    const blockedStacks = new Set<string>();

    const mainRendered = disc.mainSkill
      ? renderDiscSkillDesc(disc.mainSkill.desc, disc.mainSkill.params, crescendo - 1)
      : '';

    const secSpecs: Array<{
      secKey: string;
      sk: SSDiscSecondarySkill;
      harmonyLevel: number;
      rendered: string;
    }> = [];

    const secSkills: Array<[string, SSDiscSecondarySkill | undefined]> = [
      ['sec1', disc.secondarySkill1],
      ['sec2', disc.secondarySkill2],
    ];
    for (const [secKey, sk] of secSkills) {
      if (!sk) continue;
      const maxHarmony = sk.requirements?.length || 5;
      const harmonyLevel =
        context?.forceHarmonyLevel !== undefined
          ? Math.min(maxHarmony, Math.max(0, context.forceHarmonyLevel))
          : getHarmonyActiveLevel(sk.requirements, effectiveNotes);
      if (harmonyLevel <= 0) continue;
      secSpecs.push({
        secKey,
        sk,
        harmonyLevel,
        rendered: renderDiscSkillDesc(sk.desc, sk.params, harmonyLevel - 1),
      });
    }

    const namedStacks = extractNamedStacksFromSkills(
      [mainRendered, ...secSpecs.map((s) => s.rendered)],
      roster,
      Boolean(context?.enforceTriggers),
      blockedStacks
    );

    if (disc.mainSkill && mainRendered) {
      const effects = extractEffectsFromText(mainRendered, 'squad', namedStacks);
      effects.forEach((eff, effIdx) => {
        if (context?.enforceTriggers && isClauseTriggerBlocked(eff.clause, roster, blockedStacks)) {
          return;
        }
        const scale = context ? getContextualEffectScale(eff, context) : 1;
        if (scale <= 0) return;

        const scaledValue = +(eff.value * scale).toFixed(4);
        const targets = resolveTargetsForEffect(eff, roster);
        targets.forEach((target) => {
          const id = `disc-main-${discIndex}-${disc.id}-${effIdx}-${target}`;
          items.push({
            id,
            origin: 'melody',
            sourceName: disc.name,
            skillName: disc.mainSkill!.name,
            description: eff.clause,
            target,
            stat: eff.stat,
            value: scaledValue,
            baseValue: eff.baseValue,
            stacks: eff.stacks,
            elementScope: eff.elementScope,
            crescendo,
            enabled: !(disabledIds?.[id] ?? false),
          });
        });
      });
    }

    for (const { secKey, sk, harmonyLevel, rendered } of secSpecs) {
      const effects = extractEffectsFromText(rendered, 'squad', namedStacks);
      effects.forEach((eff, effIdx) => {
        if (context?.enforceTriggers && isClauseTriggerBlocked(eff.clause, roster, blockedStacks)) {
          return;
        }
        const scale = context ? getContextualEffectScale(eff, context) : 1;
        if (scale <= 0) return;

        const scaledValue = +(eff.value * scale).toFixed(4);
        const targets = resolveTargetsForEffect(eff, roster);
        targets.forEach((target) => {
          const id = `disc-${secKey}-${discIndex}-${disc.id}-${effIdx}-${target}`;
          items.push({
            id,
            origin: 'harmony',
            sourceName: disc.name,
            skillName: sk.name,
            description: eff.clause,
            target,
            stat: eff.stat,
            value: scaledValue,
            baseValue: eff.baseValue,
            stacks: eff.stacks,
            elementScope: eff.elementScope,
            harmonyLevel,
            enabled: !(disabledIds?.[id] ?? false),
          });
        });
      });
    }
  });

  return items;
}

function getMaxTierLength(pot: SSPotentialFull): number {
  let maxLen = 1;
  for (const p of pot.params || []) {
    const len = String(p).split('/').length;
    if (len > maxLen) maxLen = len;
  }
  return maxLen;
}


export interface PotentialExtraHitSpec {
  mvPct: number;
  hits: number;
  scalingStat: ScalingStat;
  damageType: DamageType;
  icdSec?: number;
  isMarkReaction?: boolean;
  perStackBonusPct?: number;
}

export function extractPotentialExtraHitSpecs(
  renderedDesc: string,
  defaultScalingStat: ScalingStat = 'ATK'
): PotentialExtraHitSpec[] {
  const specs: PotentialExtraHitSpec[] = [];
  const text = (renderedDesc || '').replace(/\s+/g, ' ').trim();
  if (!text) return specs;

  const icdMatch = text.match(/\btriggered\s+once\s+(?:every|per)\s+(\d+(?:\.\d+)?)\s*s\b/i);
  const icdSec = icdMatch ? parseFloat(icdMatch[1]) : undefined;
  const isMarkReaction =
    icdSec !== undefined && /\bWhen\s+a\s+target\b[^.]*?\bMark\s+triggered\b/i.test(text);
  const perStackMatch = text.match(
    /\bFor\s+each\s+stack\s+of\s+[^,]+?,\s*increases\s+the\s+[^,]+?\s+received\s+this\s+time\s+by\s+(\d+(?:\.\d+)?)%/i
  );
  const perStackBonusPct = perStackMatch ? parseFloat(perStackMatch[1]) : undefined;

  const re =
    /(?:(?:(\d+)\s+[A-Za-z][A-Za-z'\s-]{1,28}?\s+that\s+each\s+deal\s+|(?:shoots?|fires?)\s+(\d+)\s+times,\s*each\s+dealing\s+)|deals?(?:ing)?\s+(?:an\s+additional\s+)?|receives?\s+(?:an\s+additional\s+)?)?(\d+(?:\.\d+)?)%\s*(?:x\s*(\d+))?\s*of\s+(?:[A-Z][A-Za-z\s'-]{0,24}?(?:'s)?\s+)?(?:Base\s+)?(?:Max\s+)?(ATK|HP|DEF)(?:\s*x\s*(\d+))?\s+as\s+([^.;,]+?\bDMG\b)/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const mvPct = parseFloat(m[3]);
    if (!Number.isFinite(mvPct) || mvPct <= 0) continue;

    // Verify the surrounding context actually deals damage (skip shield/heal ratios if any)
    const explicitHitCount = m[1] || m[2];
    const before = text.slice(Math.max(0, m.index - 45), m.index);
    if (
      !explicitHitCount &&
      !/\b(?:deals?|dealing|hits?|strikes?|receives?)\b/i.test(before) &&
      !/^(?:deals?|receives?)/i.test(m[0])
    ) {
      continue;
    }

    let hits = explicitHitCount ? Math.max(1, parseInt(explicitHitCount, 10)) : 1;
    if (m[4]) hits *= Math.max(1, parseInt(m[4], 10));
    if (m[6]) hits *= Math.max(1, parseInt(m[6], 10));

    const statWord = m[5].toUpperCase();
    const scalingStat: ScalingStat =
      statWord === 'HP' ? 'HP' : statWord === 'DEF' ? 'DEF' : statWord === 'ATK' ? 'ATK' : defaultScalingStat;

    const dmgPhrase = m[7];
    let damageType: DamageType = 'Skill';
    if (/\b(?:Auto\s*Attack|Auto\s*ATK|Normal\s*Attack)\b/i.test(dmgPhrase)) {
      damageType = 'Auto Attack';
    } else if (/\bUltimate\b/i.test(dmgPhrase)) {
      damageType = 'Ultimate';
    } else if (/\bMark\b/i.test(dmgPhrase)) {
      damageType = 'Mark';
    } else if (/\bMinion\b/i.test(dmgPhrase)) {
      damageType = 'Minion';
    } else if (/\bSkill\b/i.test(dmgPhrase)) {
      damageType = 'Skill';
    }

    specs.push({
      mvPct,
      hits,
      scalingStat,
      damageType,
      ...(icdSec !== undefined ? { icdSec } : {}),
      ...(isMarkReaction ? { isMarkReaction: true } : {}),
      ...(perStackBonusPct !== undefined ? { perStackBonusPct } : {}),
    });
  }

  return specs;
}

export function isPotentialSquadConditionBlocked(
  clause: string,
  roster: PresetBuffRosterSlot[]
): boolean {
  const populated = roster.filter((r) => r.character !== null);

  const allElMatch = clause.match(
    /\b(?:In\s+an\s+all-|When\s+the\s+squad\s+contains\s+only\s+)(Ignis|Aqua|Terra|Ventus|Lux|Umbra)\b/i
  );
  if (allElMatch) {
    const reqEl = allElMatch[1].toLowerCase();
    if (populated.length === 0) return true;
    if (populated.some((r) => r.character?.element?.toLowerCase() !== reqEl)) return true;
  }

  const onlyOneMatch = clause.match(
    /\bIf\s+there\s+is\s+only\s+1\s+(Ignis|Aqua|Terra|Ventus|Lux|Umbra)\s+Trekker\b/i
  );
  if (onlyOneMatch) {
    const reqEl = onlyOneMatch[1].toLowerCase();
    const count = populated.filter((r) => r.character?.element?.toLowerCase() === reqEl).length;
    if (count !== 1) return true;
  }

  const nOrMoreMatch = clause.match(
    /\bIf\s+there\s+are\s+(\d+)\s+or\s+more\s+(Ignis|Aqua|Terra|Ventus|Lux|Umbra)\s+Trekkers?\b/i
  );
  if (nOrMoreMatch) {
    const minCount = Number(nOrMoreMatch[1]);
    const reqEl = nOrMoreMatch[2].toLowerCase();
    const count = populated.filter((r) => r.character?.element?.toLowerCase() === reqEl).length;
    if (count < minCount) return true;
  }

  return false;
}

export function estimatePotentialRealisticUptime(
  clause: string,
  stacks?: number,
  durationSec?: number
): number {
  const durMatch = clause.match(/\b(?:for|lasts)\s+(-?\d+(?:\.\d+)?)\s*(?:s|sec)\b/i);
  const dur = durationSec ?? (durMatch ? parseFloat(durMatch[1]) : undefined);

  if (
    /\bremoves?\s+1\s+stack\b[\s\S]{0,25}?\bper\s+second\b/i.test(clause) &&
    stacks !== undefined &&
    stacks > 1
  ) {
    return +((stacks + 1) / (2 * stacks)).toFixed(4);
  }

  if (/\bfor\s+-1s\b/i.test(clause) && stacks !== undefined && stacks >= 6) {
    return 0.55;
  }

  if (
    /\(Ultimate\)/i.test(clause) &&
    stacks !== undefined &&
    stacks >= 5 &&
    dur !== undefined &&
    dur >= 8 &&
    dur <= 15 &&
    !/\bhits?\s+a\s+different\s+target\b/i.test(clause)
  ) {
    return 0.65;
  }

  if (
    !/\(Ultimate\)|\bcasts?\s+(?:her|his|their)?\s*Ultimate\b/i.test(clause) &&
    /\b(?:inflicts?|triggers?)\b[^.;]*\bMark\b/i.test(clause) &&
    /\bMark\s+DMG\s+taken\b/i.test(clause) &&
    dur !== undefined &&
    dur > 0 &&
    dur <= 6 &&
    !stacks
  ) {
    return 0.45;
  }

  if (
    /\bthere\s+is\s+a\s+\d+(?:\.\d+)?%\s+chance\s+to\b/i.test(clause) &&
    stacks !== undefined &&
    stacks >= 4 &&
    /\(Ultimate\)|\bcasts?\s+(?:her|his|their)?\s*Ultimate\b/i.test(clause)
  ) {
    const base = dur !== undefined && dur > 0 && dur <= 15 ? Math.max(0.18, Math.min(0.38, dur / 45)) : 1;
    return +(base * 0.7).toFixed(4);
  }

  if (
    /\(Ultimate\)|\bcasts?\s+(?:her|his|their)?\s*Ultimate\b/i.test(clause) &&
    dur !== undefined &&
    dur > 0 &&
    dur <= 15
  ) {
    return +Math.max(0.18, Math.min(0.38, dur / 45)).toFixed(4);
  }

  if (
    stacks !== undefined &&
    stacks >= 6 &&
    dur !== undefined &&
    dur > 0 &&
    dur <= 3 &&
    !/\bEach\s+time\b[^.;]*\bbounces?\b/i.test(clause)
  ) {
    return 0.4;
  }

  if (stacks !== undefined && stacks >= 15) {
    return 0.78;
  }

  if (stacks !== undefined && stacks >= 10 && /\beach time this effect deals DMG\b/i.test(clause)) {
    return 0.42;
  }

  return 1;
}

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
  const items: PresetBuffItem[] = [];
  const lookup = options?.potentialLookup;
  if (!lookup) return items;
  const slots: SlotKey[] = ['vanguard', 'versatile', 'support'];

  for (const slot of slots) {
    const slotData = build.slots[slot];
    if (!slotData?.characterId || !slotData.potentials?.length) continue;

    const char = roster.find((r) => r.slot === slot)?.character ?? null;
    const charName = char?.name?.EN ?? `Slot ${slot}`;

    for (const sel of slotData.potentials) {
      const pot = lookup(slotData.characterId, sel.id);
      if (!pot) continue;

      const potKey = `${slot}:${pot.id}`;
      const tierCap = pot.isCore ? 1 : Math.min(9, Math.max(pot.maxLevel || 1, getMaxTierLength(pot)));
      const rawBase = options?.levelOverrides?.[potKey] ?? (Number(sel.level) || (pot.isCore ? 1 : 6));
      const baseLevel = pot.isCore ? 1 : Math.min(tierCap, Math.max(1, Math.round(rawBase)));
      const emblemBonusLevel: 0 | 1 | 2 | 3 = pot.isCore
        ? 0
        : (options?.bonusLevels?.[potKey] ?? 0);
      const effectiveLevel = pot.isCore
        ? 1
        : Math.min(tierCap, Math.max(1, baseLevel + emblemBonusLevel));

      const rendered = renderPotentialAtLevel(pot.descTemplate, pot.params, effectiveLevel);
      const effects = extractEffectsFromText(rendered, 'own');

      effects.forEach((eff, effIdx) => {
        if (isPotentialSquadConditionBlocked(eff.clause, roster)) return;
        const perElMatch = eff.clause.match(
          /(?:for\s+)?each\s+(Ignis|Aqua|Terra|Ventus|Lux|Umbra)\s+Trekker\s+(?:in|on)\s+the\s+squad/i
        );
        if (perElMatch && !eff.stacks) {
          const elName = perElMatch[1].toLowerCase();
          const count = Math.max(
            1,
            roster.filter((r) => r.character?.element?.toLowerCase() === elName).length
          );
          if (count > 1) {
            eff.stacks = count;
            eff.value = +(eff.value * count).toFixed(4);
          }
        }
        const realisticUptime = estimatePotentialRealisticUptime(
          eff.clause,
          eff.stacks,
          eff.durationSec
        );
        const targets = resolveTargetsForEffect(eff, roster, slot);
        targets.forEach((target) => {
          const id = `pot-${slot}-${pot.id}-${effIdx}-${target}`;
          items.push({
            id,
            origin: 'potential',
            sourceName: charName,
            skillName: pot.name,
            description: eff.clause,
            target,
            stat: eff.stat,
            value: eff.value,
            baseValue: eff.baseValue,
            stacks: eff.stacks,
            elementScope: eff.elementScope,
            potentialId: pot.id,
            slot,
            level: baseLevel,
            maxLevel: tierCap,
            emblemBonusLevel,
            isCore: pot.isCore,
            ...(realisticUptime < 1 ? { realisticUptime } : {}),
            enabled: !(options?.disabledIds?.[id] ?? false),
          });
        });
      });
    }
  }

  return items;
}

export function extractSkillKitPresetBuffs(
  fighters: FighterInput[],
  roster: PresetBuffRosterSlot[],
  disabledIds?: Record<string, boolean>
): PresetBuffItem[] {
  const items: PresetBuffItem[] = [];

  for (const fighter of fighters) {
    const { state, character, combat } = fighter;
    if (!character || !combat) continue;

    const slot = state.slot;
    const charName = character.name.EN;
    const skillKeys =
      slot === 'vanguard'
        ? (['normalAtk', 'skill', 'ultimate'] as const)
        : (['supportSkill', 'ultimate'] as const);
    const emblemSkillBonuses = getEmblemSkillLevelBonuses(state.emblems);

    for (const skillKey of skillKeys) {
      const skill = combat[skillKey];
      if (!skill?.desc) continue;

      const effectiveLevel = Math.min(
        13,
        Math.max(1, (state.skillLevel || 1) + (emblemSkillBonuses[skillKey] || 0))
      );
      const rendered = renderPotentialAtLevel(skill.desc, skill.params ?? [], effectiveLevel);
      const effects = extractEffectsFromText(rendered, 'own');

      effects.forEach((eff, effIdx) => {
        if (isPotentialSquadConditionBlocked(eff.clause, roster)) return;
        if (/Safety\s+Alert:\s*\d+%/i.test(eff.clause)) return;
        if (Math.abs(eff.value) > 500 && !eff.stacks) return;

        const realisticUptime = estimatePotentialRealisticUptime(
          eff.clause,
          eff.stacks,
          eff.durationSec
        );
        const targets = resolveTargetsForEffect(eff, roster, slot);
        targets.forEach((target) => {
          const id = `skill-${slot}-${skillKey}-${effIdx}-${target}`;
          items.push({
            id,
            origin: 'skill',
            sourceName: charName,
            skillName: `${skill.name} (Lv.${effectiveLevel})`,
            description: eff.clause,
            target,
            stat: eff.stat,
            value: eff.value,
            baseValue: eff.baseValue,
            stacks: eff.stacks,
            elementScope: eff.elementScope,
            slot,
            level: effectiveLevel,
            ...(realisticUptime < 1 ? { realisticUptime } : {}),
            enabled: !(disabledIds?.[id] ?? false),
          });
        });
      });
    }
  }

  return items;
}
