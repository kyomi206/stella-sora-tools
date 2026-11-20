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
import type { BuffStatKey } from './damage-engine.ts';
import type { BuffTarget, SlotKey } from './fighter-calc.ts';
import { getPotentialById } from '../potentials.ts';

export type PresetBuffOrigin = 'melody' | 'harmony' | 'potential';

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
  enabled: boolean;
}

export interface ParsedBuffEffect {
  stat: BuffStatKey;
  baseValue: number;
  stacks?: number;
  value: number;
  elementScope?: ElementType;
  targetHint: 'enemy' | 'main' | 'versatile' | 'supportClass' | 'supportSlots' | 'squad' | 'own';
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

function detectElement(str: string): ElementType | undefined {
  for (const el of ELEMENTS) {
    if (new RegExp(`\\b${el}\\b`, 'i').test(str)) return el;
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
  if (/\b(?:squad|squadmates|all\s+(?:other\s+)?friendly\s+units|friendly\s+units)\b/i.test(checkText)) {
    return 'squad';
  }
  if (/\bVersatile\s+(?:[A-Za-z]+\s+)?Trekkers?\b/i.test(checkText)) {
    return 'versatile';
  }
  if (/\bMain\s+(?:[A-Za-z]+\s+)?Trekker\b/i.test(checkText)) {
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
  if (/\b(?:own|self|her|his)\b/i.test(checkText)) {
    return defaultTarget === 'own' ? 'own' : 'main';
  }

  // Fallback to clause action portion (after "increases"/"boosts")
  if (/\b(?:squad|squadmates|friendly\s+units)\b/i.test(clause)) {
    // Only if not preceded by "When any ... in the squad" alone
    const afterIncreases = clause.replace(/^.*?\b(?:increas(?:es?|ing)|boost(?:s|ing)?|deals?)\b/i, '');
    if (/\b(?:squad|squadmates|friendly\s+units)\b/i.test(afterIncreases)) return 'squad';
  }

  return defaultTarget;
}

interface StatMatch {
  stat: BuffStatKey;
  elementScope?: ElementType;
}

function parseStatPhrase(phrase: string, isEnemyTaken: boolean): StatMatch[] {
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
      if (elInPhrase) {
        stats.push({ stat: 'elementTaken', elementScope: elInPhrase });
      } else if (/\bDMG\b/i.test(cleanPhrase)) {
        stats.push({ stat: 'dmgTaken' });
      }
    }
    return stats;
  }

  if (/\bDMG\s+Multiplier\b/i.test(cleanPhrase)) {
    stats.push({ stat: 'skillIntensity' });
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
  if (/\bMinion(?:'s)?\b/i.test(cleanPhrase)) {
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
  if (!/\b(?:increas|boost|more\s+\w+|DMG\s*\+|ATK\s*\+)/i.test(clause)) return out;

  let stacks = 1;
  const localStack = clause.match(/(?:stacking\s+up\s+to|up\s+to)\s+(\d+)\s+(?:times|stacks)/i);
  if (localStack) {
    stacks = Number(localStack[1]);
  } else if (/\beach\s+stack\b|\bevery\s+stack\b|\bper\s+stack\b|\beach\s+tier\b/i.test(clause) && rememberedStackCap) {
    stacks = rememberedStackCap;
  }

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

  const subParts = splitCompoundSubClause(clause);
  let lastVerb = 'increases';
  let lastSubjContext = clauseContext || '';

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
      if (isNonDamageStatSubject(rawSubj)) continue;
      const subj = stripNonStatLeading(rawSubj);
      if (!isPct && !/\b(?:DEF|PEN|HP|ATK)\b/i.test(subj)) continue;

      const slashParts = rawVal.split('/').map((x) => parseFloat(x));
      const baseVal = slashParts[slashParts.length - 1];
      if (!Number.isFinite(baseVal) || baseVal === 0) continue;

      const isEnemyTaken = /\btaken\b/i.test(subj) || /\btarget(?:s)?\s+takes?\b/i.test(part);
      let stats = parseStatPhrase(subj, isEnemyTaken);

      if (stats.length === 0 && /\b(?:DMG|damage)\b/i.test(subj)) {
        stats = parseStatPhrase(`${lastSubjContext} ${subj}`, isEnemyTaken);
      }
      if (stats.length === 0 && /\bDMG\s+of\s+this\s+hit\b/i.test(subj) && rememberedBaseStatDesc?.length) {
        stats = rememberedBaseStatDesc.map((r) => ({ stat: r.stat, elementScope: r.elementScope }));
      }

      const includesMinions =
        /\band\s+(?:their\s+|all\s+)?(?:minions|toys|pumpka\s+phantom)\b/i.test(subj) ||
        /\band\s+minions\b/i.test(subj);
      const targetHint = detectTargetHint(subj, clause, isEnemyTaken, defaultTarget);

      for (const s of stats) {
        let finalStat = s.stat;
        if (!isPct) {
          if (finalStat === 'hpPct') finalStat = 'baseHp';
          else if (finalStat === 'defPct') finalStat = 'baseDef';
          else if (finalStat === 'atkPct') finalStat = 'baseAtk';
        }
        if (finalStat === 'atkPct' && includesMinions) finalStat = 'atkPctPerma';
        const effStacks = slashParts.length > 1 ? 1 : stacks;
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
  }

  return out;
}

export function extractEffectsFromText(
  text: string,
  defaultTarget: 'squad' | 'own' = 'squad'
): ParsedBuffEffect[] {
  const clauses = text
    .split(/(?:\n+|(?<=[.!?])\s+)/)
    .map((s) => s.trim())
    .filter(Boolean);

  const results: ParsedBuffEffect[] = [];
  let rememberedBaseStatDesc: ParsedBuffEffect[] | null = null;
  let rememberedStackCap: number | null = null;
  let clauseContext = '';

  for (const clause of clauses) {
    const stackCapMatch = clause.match(
      /(?:stacking\s+up\s+to|up\s+to|can\s+stack\s+up\s+to)\s+(\d+)\s+(?:times|stacks)/i
    );
    if (stackCapMatch) {
      rememberedStackCap = Number(stackCapMatch[1]);
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
      results.push(...foundInClause);
      rememberedBaseStatDesc = foundInClause;
    }
  }

  return results;
}

function resolveTargetsForEffect(
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
  disabledIds?: Record<string, boolean>
): PresetBuffItem[] {
  const items: PresetBuffItem[] = [];

  mainDiscs.forEach((selected, discIndex) => {
    if (!selected.discId) return;
    const disc = discsMap[String(selected.discId)];
    if (!disc) return;

    const crescendo = Math.min(6, Math.max(1, Math.round(Number(selected.crescendo) || 1)));

    if (disc.mainSkill) {
      const rendered = renderDiscSkillDesc(disc.mainSkill.desc, disc.mainSkill.params, crescendo - 1);
      const effects = extractEffectsFromText(rendered, 'squad');
      effects.forEach((eff, effIdx) => {
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
            value: eff.value,
            baseValue: eff.baseValue,
            stacks: eff.stacks,
            elementScope: eff.elementScope,
            crescendo,
            enabled: !(disabledIds?.[id] ?? false),
          });
        });
      });
    }

    const secSkills: Array<[string, SSDiscSecondarySkill | undefined]> = [
      ['sec1', disc.secondarySkill1],
      ['sec2', disc.secondarySkill2],
    ];
    for (const [secKey, sk] of secSkills) {
      if (!sk) continue;
      const harmonyLevel = getHarmonyActiveLevel(sk.requirements, effectiveNotes);
      if (harmonyLevel <= 0) continue;

      const rendered = renderDiscSkillDesc(sk.desc, sk.params, harmonyLevel - 1);
      const effects = extractEffectsFromText(rendered, 'squad');
      effects.forEach((eff, effIdx) => {
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
            value: eff.value,
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
  const lookup = options?.potentialLookup ?? getPotentialById;
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
            enabled: !(options?.disabledIds?.[id] ?? false),
          });
        });
      });
    }
  }

  return items;
}
