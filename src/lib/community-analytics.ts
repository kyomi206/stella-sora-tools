import communityBuildAnalyticsData from '../data/community-build-analytics.json' with { type: 'json' };
export {
  getHeatmapStyle,
  type CommunityBuildAnalytics,
  type DiscDupeLabel,
  type DiscRankRow,
  type DiscRankingsData,
  type EmblemColumn,
  type EmblemStatRow,
  type HeatmapPalette,
  type PotPlus3Row,
  type PotRankRow,
  type SkillHighlightTone,
  type SkillPlus3Cell,
  type SkillPlus3Row,
  type SkillPlus3Variant,
  type TalentTierRow,
  type TalentTrekkerTable,
} from './community-analytics-utils.ts';
import type { CommunityBuildAnalytics } from './community-analytics-utils.ts';

const ANALYTICS_MAP =
  communityBuildAnalyticsData as unknown as Record<string, CommunityBuildAnalytics>;

export function getCommunityBuildAnalytics(presetId: string): CommunityBuildAnalytics | null {
  if (!presetId) return null;
  return Object.prototype.hasOwnProperty.call(ANALYTICS_MAP, presetId)
    ? ANALYTICS_MAP[presetId]
    : null;
}

export function getPresetIdsWithAnalytics(): string[] {
  return Object.keys(ANALYTICS_MAP);
}
