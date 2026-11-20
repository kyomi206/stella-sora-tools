import type { DamageType } from './damage-engine.ts';

export type AbilitySource = 'normalAtk' | 'skill' | 'supportSkill' | 'ultimate';

export interface CombatSkillParams {
  name: string;
  desc?: string;
  params: (string | number)[];
  icon?: string;
}

export interface ParsedAbilityPart {
  id: string;
  paramIndex: number;
  label: string;
  mvPct: number;
  hits: number;
  scalingStat: 'ATK' | 'HP' | 'DEF';
  damageType: DamageType;
}

function cleanDescription(raw: string | undefined): string {
  return String(raw ?? '')
    .replace(/<color=[^>]*>|<\/color>/gi, '')
    .replace(/##([^#]+)#\d+#/g, '$1')
    .replace(/\u000b/g, '\n');
}

export function evaluateTierPercent(raw: string | number | undefined, skillLevel: number): number | null {
  if (raw === undefined || raw === null) return null;
  const text = String(raw).trim();
  if (!text || !text.includes('%')) return null;
  if (!/^\d+(?:\.\d+)?%(?:\/\d+(?:\.\d+)?%)*$/.test(text)) return null;

  const tiers = text.split('/');
  const index = Math.max(0, Math.min(tiers.length - 1, Math.floor(skillLevel) - 1));
  const value = Number.parseFloat(tiers[index]);
  return Number.isFinite(value) ? value : null;
}

function inferDamageType(snippet: string, source: AbilitySource): DamageType {
  if (/Minion(?:'s)?(?:\s+AoE)?\s+DMG/i.test(snippet)) return 'Minion';
  if (/Mark(?:'s)?(?:\s+AoE)?\s+DMG/i.test(snippet)) return 'Mark';
  if (/Ultimate(?:\s+AoE)?\s+DMG/i.test(snippet)) return 'Ultimate';
  if (/Auto(?:\s|-)?(?:Attack|ATK)(?:\s+AoE)?\s+DMG/i.test(snippet)) return 'Auto Attack';
  if (/Skill(?:\s+AoE)?\s+DMG/i.test(snippet)) return 'Skill';
  if (source === 'normalAtk') return 'Auto Attack';
  if (source === 'ultimate') return 'Ultimate';
  return 'Skill';
}

function inferScalingStat(snippet: string): 'ATK' | 'HP' | 'DEF' {
  if (/\bof\s+(?:Base\s+|Max\s+)?HP\b/i.test(snippet)) return 'HP';
  if (/\bof\s+(?:Base\s+)?DEF\b/i.test(snippet)) return 'DEF';
  return 'ATK';
}

function defaultDamageType(source: AbilitySource): DamageType {
  if (source === 'normalAtk') return 'Auto Attack';
  if (source === 'ultimate') return 'Ultimate';
  return 'Skill';
}

function buildPartLabel(
  clause: string,
  skillName: string,
  damageType: DamageType,
  source: AbilitySource
): string {
  const prefixMatch = clause.match(/^([^:]{1,28}):/);
  if (prefixMatch) {
    const prefix = prefixMatch[1].trim();
    if (prefix && !/^deals?$/i.test(prefix)) {
      return prefix;
    }
  }
  if (damageType === 'Mark') return `${skillName} (Mark)`;
  if (damageType === 'Minion') return `${skillName} (Minion)`;
  if (damageType !== defaultDamageType(source)) return `${skillName} (${damageType})`;
  return skillName;
}

/**
 * Parse a combat skill's description and parameter table into structured damage
 * parts at the given skill level. Filters out buff/shield/heal/duration params
 * and extracts hit counts, HP/DEF/ATK scaling, and Auto/Skill/Ult/Mark/Minion type.
 */
export function parseSkillParts(
  skill: CombatSkillParams | undefined,
  source: AbilitySource,
  skillLevel = 10
): ParsedAbilityPart[] {
  if (!skill?.params?.length) return [];

  const desc = cleanDescription(skill.desc);
  if (!desc) {
    for (let index = 0; index < skill.params.length; index++) {
      const mvPct = evaluateTierPercent(skill.params[index], skillLevel);
      if (mvPct !== null) {
        return [
          {
            id: `param-${index + 1}`,
            paramIndex: index + 1,
            label: skill.name,
            mvPct,
            hits: 1,
            scalingStat: 'ATK',
            damageType: defaultDamageType(source),
          },
        ];
      }
    }
    return [];
  }

  const clauses = desc
    .split(/\n|(?<!\d)\.(?!\d)\s*/)
    .map((line) => line.trim())
    .filter(Boolean);

  const rawParts: ParsedAbilityPart[] = [];

  for (const clause of clauses) {
    if (!/\bDMG\b/i.test(clause)) continue;

    const matches = [...clause.matchAll(/&Param(\d+)&/g)];
    if (matches.length === 0) continue;

    for (let mIndex = 0; mIndex < matches.length; mIndex++) {
      const match = matches[mIndex];
      const paramIndex = Number(match[1]);
      const mvPct = evaluateTierPercent(skill.params[paramIndex - 1], skillLevel);
      if (mvPct === null) continue;

      const start = match.index + match[0].length;
      const prevEnd = mIndex > 0 ? matches[mIndex - 1].index + matches[mIndex - 1][0].length : 0;
      const nextStart = mIndex + 1 < matches.length ? matches[mIndex + 1].index : clause.length;

      const before = clause.slice(prevEnd, match.index);
      const afterImmediate = clause.slice(start, nextStart);

      // Exclude durations ("&Param6&s"), stack thresholds, shields/heals, and buff percentages.
      if (/^\s*(?:s|sec|seconds|stacks?)\b/i.test(afterImmediate)) continue;
      if (
        /\b(?:shield|heals?|restores?|recovers?|HP\s+below|HP\s+above|chance\s+to)\b[^&]*$/i.test(
          before
        ) &&
        !/\b(?:dealing|deals?|Strike\s*\d+:)\b/i.test(before)
      ) {
        continue;
      }
      if (
        /\b(?:increases?|boosts?|raises?|reduces?)\b[\s\S]{0,80}\b(?:DMG|ATK|DEF|HP|Crit|Speed|Rate)\b[\s\S]{0,20}\bby\s*$/i.test(
          before
        )
      ) {
        continue;
      }

      const restOfClause = clause.slice(start);
      const dmgForward = restOfClause.match(/^[\s\S]*?\bDMG\b/i)?.[0];
      const dmgEqualBackward = before.match(
        /(?:deals?|dealing)\b[\s\S]{0,80}\bDMG\s+equal\s+to\s*$/i
      )?.[0];
      if (!dmgForward && !dmgEqualBackward) continue;

      const contextSnippet = dmgEqualBackward
        ? `${dmgEqualBackward} ${afterImmediate}`
        : `${dmgForward} ${afterImmediate}`;

      const hitMatch = afterImmediate.match(
        /^\s*(?:of\s+(?:Max\s+|Base\s+)?(?:ATK|HP|DEF)\s*)?(?:x|×|\*)\s*(\d+)/i
      );
      const hits = hitMatch ? Math.max(1, Number(hitMatch[1])) : 1;
      const scalingStat = inferScalingStat(`${afterImmediate} ${contextSnippet}`);
      const damageType = inferDamageType(contextSnippet, source);
      const label = buildPartLabel(clause, skill.name, damageType, source);

      rawParts.push({
        id: `param-${paramIndex}`,
        paramIndex,
        label,
        mvPct,
        hits,
        scalingStat,
        damageType,
      });
    }
  }

  // Disambiguate duplicate labels within the same skill (e.g. Strike 4 hit 1/2 or multi-phase Ults).
  const labelCounts = new Map<string, number>();
  for (const part of rawParts) {
    labelCounts.set(part.label, (labelCounts.get(part.label) ?? 0) + 1);
  }
  const seenCounts = new Map<string, number>();
  return rawParts.map((part) => {
    const total = labelCounts.get(part.label) ?? 0;
    if (total <= 1) return part;
    const next = (seenCounts.get(part.label) ?? 0) + 1;
    seenCounts.set(part.label, next);
    return { ...part, label: `${part.label} #${next}` };
  });
}

export function parsePrimarySkillPart(
  skill: CombatSkillParams | undefined,
  source: AbilitySource,
  skillLevel = 10
): ParsedAbilityPart | null {
  const parts = parseSkillParts(skill, source, skillLevel);
  return parts[0] ?? null;
}

export function parseMotionValue(
  skill: CombatSkillParams | undefined,
  source: AbilitySource,
  skillLevel = 10
): number | null {
  return parsePrimarySkillPart(skill, source, skillLevel)?.mvPct ?? null;
}
