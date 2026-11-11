import type { RoadmapItem, UnreleasedTrekker, RawGachaItem, RawUnreleasedItem, RawBlitzBoss } from './types.ts';
import { transformGachaBanners, transformUnreleasedTrekkers } from './banner-transformer.ts';
import { ROADMAP_ITEMS as STATIC_ROADMAP_ITEMS } from '../../data/roadmap.ts';

// Import datamined JSON datasets
import rawBannersJson from '../../data/datamined-banners.json' with { type: 'json' };
import rawUnreleasedJson from '../../data/datamined-unreleased.json' with { type: 'json' };
import rawBlitzJson from '../../data/datamined-blitz.json' with { type: 'json' };

const rawBanners = rawBannersJson as Record<string, RawGachaItem>;
const rawUnreleased = rawUnreleasedJson as Record<string, RawUnreleasedItem>;
const rawBlitz = rawBlitzJson as Record<string, RawBlitzBoss>;

let cachedMergedItems: RoadmapItem[] | null = null;
let cachedUnreleasedTrekkers: UnreleasedTrekker[] | null = null;

// Invalidate cache on hot reload
cachedMergedItems = null;
cachedUnreleasedTrekkers = null;

export function getDataminedUnreleasedTrekkers(): UnreleasedTrekker[] {
  if (cachedUnreleasedTrekkers) return cachedUnreleasedTrekkers;
  cachedUnreleasedTrekkers = transformUnreleasedTrekkers(rawUnreleased);
  return cachedUnreleasedTrekkers;
}

export function getMergedRoadmapItems(): RoadmapItem[] {
  if (cachedMergedItems) return cachedMergedItems;

  // 1. Transform datamined gacha banners
  const dataminedBanners = transformGachaBanners(rawBanners);

  // 2. Extract non-banner items from static roadmap data (events, mainStory, cataclysm, bossBlitz)
  // And enrich bossBlitz items with datamined mechanics & weaknesses if matching boss name
  const blitzBossList = Object.values(rawBlitz);

  const nonBannerItems: RoadmapItem[] = STATIC_ROADMAP_ITEMS
    .filter((item) => item.category !== 'banners')
    .map((item) => {
      if (item.category === 'bossBlitz') {
        const matchBoss = blitzBossList.find(
          (b) =>
            b.name.toLowerCase() === item.title.toLowerCase() ||
            (item.subtitle && b.name.toLowerCase().includes(item.subtitle.toLowerCase()))
        );
        if (matchBoss) {
          return {
            ...item,
            bossResist: matchBoss.resistTo,
            mechanics: matchBoss.mechanic?.filter((m) => m.name !== '!NONEED!').map((m) => ({
              name: m.name,
              desc: m.desc,
              descCN: m.descCN,
              descJP: m.descJP,
              icon: m.icon,
            })),
          };
        }
      }
      return item as RoadmapItem;
    });

  // 3. Combine both collections
  const merged = [...dataminedBanners, ...nonBannerItems];

  // 4. Sort chronologically by start date
  merged.sort((a, b) => {
    const timeA = new Date(a.startDate).getTime();
    const timeB = new Date(b.startDate).getTime();
    if (timeA !== timeB) return timeA - timeB;
    return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
  });

  cachedMergedItems = merged;
  return cachedMergedItems;
}
