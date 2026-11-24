import type { Metadata } from 'next';
import type { SSCharacter, SSDisc } from '../types/index.ts';
import { getSiteUrl } from './site-url.ts';

export const SITE_NAME = 'KiyoStella';
export const SITE_ALTERNATE_NAMES = ['Stella Sora Tools', 'SSTT'] as const;
export const DEFAULT_OG_IMAGE = '/kiyostella.png';
export const DEFAULT_OG_WIDTH = 1200;
export const DEFAULT_OG_HEIGHT = 630;
export const DEFAULT_OG_ALT = 'KiyoStella — a Stella Sora utility web';
export const SITE_REPO_URL = 'https://github.com/kyomi206/stella-sora-tools';
export const CONTENT_LAST_MODIFIED = '2026-11-24';

export function normalizeCanonicalPath(path: string): string {
  if (!path || path === '/') return '/';
  const withLeadingSlash = path.startsWith('/') ? path : `/${path}`;
  return withLeadingSlash.replace(/\/+$/, '') || '/';
}

export function toAbsoluteUrl(path: string): string {
  const siteUrl = getSiteUrl();
  const normalized = normalizeCanonicalPath(path);
  return normalized === '/' ? `${siteUrl}/` : `${siteUrl}${normalized}`;
}

export interface OgImageOptions {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface PageMetadataOptions {
  title: string;
  absoluteTitle?: boolean;
  description: string;
  path: string;
  noIndex?: boolean;
  type?: 'website' | 'article';
  keywords?: string[];
  ogImage?: OgImageOptions;
}

export function buildPageMetadata(opts: PageMetadataOptions): Metadata {
  const canonicalPath = normalizeCanonicalPath(opts.path);
  const fullTitle = opts.absoluteTitle ? opts.title : `${opts.title} | kiyostella`;
  const ogImageUrl = opts.ogImage?.url ?? DEFAULT_OG_IMAGE;
  const ogImageWidth = opts.ogImage?.width ?? DEFAULT_OG_WIDTH;
  const ogImageHeight = opts.ogImage?.height ?? DEFAULT_OG_HEIGHT;
  const ogImageAlt = opts.ogImage?.alt ?? DEFAULT_OG_ALT;

  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    ...(opts.keywords ? { keywords: opts.keywords } : {}),
    alternates: {
      canonical: canonicalPath,
    },
    robots: opts.noIndex
      ? {
          index: false,
          follow: true,
          googleBot: {
            index: false,
            follow: true,
          },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
    openGraph: {
      type: opts.type ?? 'website',
      siteName: SITE_NAME,
      locale: 'en_US',
      url: canonicalPath,
      title: fullTitle,
      description: opts.description,
      images: [
        {
          url: ogImageUrl,
          width: ogImageWidth,
          height: ogImageHeight,
          alt: ogImageAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: opts.description,
      images: [ogImageUrl],
    },
  };
}

const MAX_META_DESCRIPTION_LENGTH = 160;

function joinSentencesWithinLimit(
  base: string,
  candidates: string[],
  maxLen: number = MAX_META_DESCRIPTION_LENGTH
): string {
  let out = base;
  for (const part of candidates) {
    if (!part) continue;
    const next = `${out} ${part}`;
    if (next.length <= maxLen) {
      out = next;
    }
  }
  return out;
}

export function buildTrekkerDescription(
  char: SSCharacter,
  lore: { faction?: string | null } | null,
  combat: {
    normalAtk?: { name?: string };
    skill?: { name?: string };
    supportSkill?: { name?: string };
    ultimate?: { name?: string };
  } | null
): string {
  const base = `${char.name.EN}: ${char.star}★ ${char.element} ${char.class} (${char.attackType}) in Stella Sora.`;
  const tail = 'Lv.1–90 stats, potentials, T1–T5 talents & gifts.';
  const budgetBeforeTail = MAX_META_DESCRIPTION_LENGTH - tail.length - 1;

  const extras: string[] = [];
  if (lore?.faction) {
    const factionPart = `Faction: ${lore.faction}.`;
    if (`${base} ${factionPart}`.length <= budgetBeforeTail) {
      extras.push(factionPart);
    }
  }

  const skillNames = [
    combat?.skill?.name,
    combat?.ultimate?.name,
    combat?.normalAtk?.name,
    combat?.supportSkill?.name,
  ].filter((name): name is string => Boolean(name));

  let prefix = joinSentencesWithinLimit(base, extras, budgetBeforeTail);
  if (skillNames.length > 0) {
    const chosen: string[] = [];
    for (const skill of skillNames) {
      const candidate = `Skills: ${[...chosen, skill].join(', ')}.`;
      if (`${prefix} ${candidate}`.length <= budgetBeforeTail) {
        chosen.push(skill);
      } else {
        break;
      }
    }
    if (chosen.length > 0) {
      prefix = `${prefix} Skills: ${chosen.join(', ')}.`;
    }
  }

  return `${prefix} ${tail}`.length <= MAX_META_DESCRIPTION_LENGTH
    ? `${prefix} ${tail}`
    : base;
}

export function buildDiscDescription(
  disc: SSDisc,
  exclusiveTrekkerName?: string | null
): string {
  const elementLabel = disc.element === 'None' ? 'Neutral' : disc.element;
  const base = `${disc.name}: ${disc.star}★ ${elementLabel} Runic Disc in Stella Sora.`;
  const lv90Atk = disc.stats?.lv90?.ATK ?? disc.stats?.lv80?.ATK;
  const harmonyNames = [disc.secondarySkill1?.name, disc.secondarySkill2?.name].filter(
    (name): name is string => Boolean(name)
  );

  const candidates: string[] = [];
  if (lv90Atk) candidates.push(`Lv.90 ATK ${lv90Atk}.`);
  if (exclusiveTrekkerName) candidates.push(`Featured Trekker: ${exclusiveTrekkerName}.`);
  if (disc.mainSkill?.name) candidates.push(`Melody: ${disc.mainSkill.name}.`);

  let desc = joinSentencesWithinLimit(base, candidates, MAX_META_DESCRIPTION_LENGTH);

  if (harmonyNames.length > 0) {
    const both = `Harmony: ${harmonyNames.join(', ')}.`;
    const firstOnly = `Harmony: ${harmonyNames[0]}.`;
    if (`${desc} ${both}`.length <= MAX_META_DESCRIPTION_LENGTH) {
      desc = `${desc} ${both}`;
    } else if (`${desc} ${firstOnly}`.length <= MAX_META_DESCRIPTION_LENGTH) {
      desc = `${desc} ${firstOnly}`;
    }
  }

  if (desc.length < 60) {
    desc = joinSentencesWithinLimit(
      desc,
      ['Stats, notes & skills on KiyoStella.'],
      MAX_META_DESCRIPTION_LENGTH
    );
  }

  return desc;
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function buildBreadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
  options: { includeContext?: boolean } = {}
) {
  const includeContext = options.includeContext ?? true;
  return {
    ...(includeContext ? { '@context': 'https://schema.org' } : {}),
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: toAbsoluteUrl(item.path),
    })),
  };
}

export function buildWebApplicationJsonLd(
  opts: {
    name: string;
    description: string;
    path: string;
    featureList: string[];
  },
  options: { includeContext?: boolean } = {}
) {
  const includeContext = options.includeContext ?? true;
  return {
    ...(includeContext ? { '@context': 'https://schema.org' } : {}),
    '@type': 'WebApplication',
    name: opts.name,
    description: opts.description,
    url: toAbsoluteUrl(opts.path),
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any (Web Browser)',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: opts.featureList,
    about: {
      '@type': 'VideoGame',
      name: 'Stella Sora',
      publisher: {
        '@type': 'Organization',
        name: 'Yostar',
      },
    },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: toAbsoluteUrl('/'),
    },
  };
}
