import React from 'react';
import { ImageResponse } from 'next/og.js';
import { NextRequest, NextResponse } from 'next/server.js';
import characterCombatData from '../data/character-combat.json' with { type: 'json' };
import charactersData from '../data/characters.json' with { type: 'json' };
import discsData from '../data/discs.json' with { type: 'json' };
import { getDiscOutfitIconUrl } from '../data/notes.ts';
import trekkerLoreData from '../data/trekker-lore.json' with { type: 'json' };
import { getCachedCommunityBuildById } from './community-builds/store.ts';
import {
  COMMUNITY_MODE_LABELS,
  type ResolvedCommunityPreset,
} from './community-presets.ts';
import { getDiscBySlugOrId, getExclusiveBannerByDiscId } from './discs.ts';
import { localWebpToPngDataUrl, remoteWebpToPngDataUrl } from './og-image.ts';
import type { ElementType, SSCharacter, SSDisc } from '../types/index.ts';

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

const OG_CACHE_CONTROL =
  'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400';

// Deep KiyoStella night-sky palette matching globals.css (.dark)
const SURFACE_BG = '#0a1628';
const SURFACE_PANEL = '#112338';
const SURFACE_WELL = '#0d1d33';
const BORDER_HAIRLINE = 'rgba(184, 217, 232, 0.16)';
const BORDER_SUBTLE = 'rgba(184, 217, 232, 0.11)';
const TEXT_PRIMARY = '#f8fcff';
const TEXT_SECONDARY = '#d4e7f0';
const TEXT_MUTED = '#8dacc4';

interface AccentTheme {
  hex: string;
  ink: string;
  softBg: string;
  border: string;
  label: string;
}

const ELEMENT_ACCENTS: Record<ElementType | 'None', AccentTheme> = {
  Ignis: {
    hex: '#ef4444',
    ink: '#fca5a5',
    softBg: 'rgba(239, 68, 68, 0.16)',
    border: 'rgba(239, 68, 68, 0.44)',
    label: 'Ignis',
  },
  Aqua: {
    hex: '#38bdf8',
    ink: '#7dd3fc',
    softBg: 'rgba(56, 189, 248, 0.16)',
    border: 'rgba(56, 189, 248, 0.42)',
    label: 'Aqua',
  },
  Terra: {
    hex: '#d97745',
    ink: '#f0ab7e',
    softBg: 'rgba(217, 119, 69, 0.18)',
    border: 'rgba(217, 119, 69, 0.46)',
    label: 'Terra',
  },
  Ventus: {
    hex: '#4ade80',
    ink: '#86efac',
    softBg: 'rgba(74, 222, 128, 0.16)',
    border: 'rgba(74, 222, 128, 0.42)',
    label: 'Ventus',
  },
  Lux: {
    hex: '#facc15',
    ink: '#fde047',
    softBg: 'rgba(250, 204, 21, 0.16)',
    border: 'rgba(250, 204, 21, 0.44)',
    label: 'Lux',
  },
  Umbra: {
    hex: '#c084fc',
    ink: '#d8b4fe',
    softBg: 'rgba(192, 132, 252, 0.16)',
    border: 'rgba(192, 132, 252, 0.44)',
    label: 'Umbra',
  },
  None: {
    hex: '#94a3b8',
    ink: '#cbd5e1',
    softBg: 'rgba(148, 163, 184, 0.16)',
    border: 'rgba(148, 163, 184, 0.36)',
    label: 'Neutral',
  },
};

// Deployment slots in Stella Sora (advData.slots keys map to 1 Main + 2 Support deployment slots)
const DEPLOYMENT_SLOTS = [
  {
    key: 'vanguard',
    label: 'MAIN',
    color: '#fda4af',
    bg: 'rgba(255, 42, 112, 0.18)',
    border: 'rgba(255, 42, 112, 0.46)',
  },
  {
    key: 'versatile',
    label: 'SUPPORT',
    color: '#a5b4fc',
    bg: 'rgba(99, 102, 241, 0.18)',
    border: 'rgba(99, 102, 241, 0.44)',
  },
  {
    key: 'support',
    label: 'SUPPORT',
    color: '#a5b4fc',
    bg: 'rgba(99, 102, 241, 0.18)',
    border: 'rgba(99, 102, 241, 0.44)',
  },
] as const;

const TIER_LABELS: Record<string, string> = {
  f2p: 'F2P',
  standard: 'Standard',
  premium: 'Premium',
};

const el = React.createElement;

function flex(
  style: React.CSSProperties,
  ...children: React.ReactNode[]
): React.ReactElement {
  return el('div', { style: { display: 'flex', ...style } }, ...children);
}

function truncateText(text: string, maxLen: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  const slice = normalized.slice(0, maxLen - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const trimmed = lastSpace > Math.floor(maxLen * 0.55) ? slice.slice(0, lastSpace) : slice;
  return `${trimmed.trimEnd().replace(/[.…,:;\-]+$/, '')}…`;
}

function renderStarSvg(filled: boolean, key: number, size: number = 19): React.ReactElement {
  return el(
    'svg',
    {
      key,
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: filled ? '#fbbf24' : 'none',
      stroke: filled ? 'none' : 'currentColor',
      strokeWidth: filled ? 0 : 2,
    },
    el('polygon', {
      points:
        '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2',
    })
  );
}

function renderInlineSymbolSvg(
  symbol: string,
  size: number,
  color: string,
  key: number
): React.ReactElement {
  const iconSize = Math.max(12, Math.round(size * 0.78));
  if (symbol === '♥') {
    return el(
      'svg',
      {
        key,
        width: iconSize,
        height: iconSize,
        viewBox: '0 0 24 24',
        fill: color,
        style: { marginLeft: 3, marginRight: 3 },
      },
      el('path', {
        d: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
      })
    );
  }
  const filled = symbol === '★';
  return el(
    'svg',
    {
      key,
      width: iconSize,
      height: iconSize,
      viewBox: '0 0 24 24',
      fill: filled ? color : 'none',
      stroke: filled ? 'none' : color,
      strokeWidth: filled ? 0 : 2.1,
      style: { marginLeft: 2, marginRight: 2 },
    },
    el('polygon', {
      points:
        '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2',
    })
  );
}

/**
 * Replaces symbols missing from Satori's bundled Geist-Regular font (★, ☆, ♥)
 * with crisp inline SVGs so cards never trigger failed Google Font fetches or tofu glyphs.
 */
function renderSafeText(
  text: string,
  fontSize: number,
  color: string,
  style?: React.CSSProperties
): React.ReactElement {
  if (!/[★☆♥]/.test(text)) {
    return el('span', { style: { fontSize, color, ...style } }, text);
  }

  const parts = text.split(/([★☆♥])/g).filter(Boolean);
  return flex(
    { alignItems: 'center', flexWrap: 'wrap', fontSize, color, ...style },
    ...parts.map((part, idx) =>
      part === '★' || part === '☆' || part === '♥'
        ? renderInlineSymbolSvg(part, fontSize, color, idx)
        : el('span', { key: idx }, part)
    )
  );
}

function renderDiscMonogramSvg(accentHex: string): React.ReactElement {
  return el(
    'svg',
    { width: 108, height: 108, viewBox: '0 0 72 72', fill: 'none' },
    el('circle', {
      cx: 36,
      cy: 36,
      r: 31,
      stroke: accentHex,
      strokeWidth: 2,
      strokeOpacity: 0.85,
    }),
    el('circle', {
      cx: 36,
      cy: 36,
      r: 22,
      stroke: accentHex,
      strokeWidth: 1.25,
      strokeOpacity: 0.4,
    }),
    el('circle', {
      cx: 36,
      cy: 36,
      r: 13,
      stroke: accentHex,
      strokeWidth: 1.25,
      strokeOpacity: 0.25,
    }),
    el('circle', { cx: 36, cy: 36, r: 5.5, fill: accentHex })
  );
}

function renderCelestialCornerMotif(accentHex: string): React.ReactElement {
  return el(
    'svg',
    {
      width: 360,
      height: 360,
      viewBox: '0 0 360 360',
      fill: 'none',
      style: {
        position: 'absolute',
        top: 0,
        right: 0,
      },
    },
    el('circle', {
      cx: 340,
      cy: 20,
      r: 220,
      stroke: accentHex,
      strokeWidth: 1,
      strokeOpacity: 0.14,
    }),
    el('circle', {
      cx: 340,
      cy: 20,
      r: 310,
      stroke: '#8dacc4',
      strokeWidth: 1,
      strokeOpacity: 0.08,
    })
  );
}

function renderCardShell(
  accent: AccentTheme,
  categoryLabel: string,
  elementIconUrl: string | null,
  brandIconUrl: string | null,
  bodyNode: React.ReactNode,
  footerText: string
): React.ReactElement {
  return flex(
    {
      position: 'relative',
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      backgroundColor: SURFACE_BG,
      backgroundImage: `linear-gradient(160deg, ${SURFACE_BG} 0%, #0d1d34 62%, #0a1628 100%)`,
      color: TEXT_PRIMARY,
      fontFamily: 'sans-serif',
      flexDirection: 'column',
      overflow: 'hidden',
    },
    // Full-bleed crisp 4px element signature bar along top edge
    flex({
      width: '100%',
      height: 5,
      backgroundColor: accent.hex,
      flexShrink: 0,
    }),
    renderCelestialCornerMotif(accent.hex),
    flex(
      {
        position: 'relative',
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '28px 48px 26px 48px',
      },
      // Header bar: Element identity + Category eyebrow on left, KiyoStella mark on right
      flex(
        {
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          paddingBottom: 18,
          borderBottom: `1px solid ${BORDER_SUBTLE}`,
        },
        flex(
          { alignItems: 'center', gap: 14 },
          flex(
            {
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 8,
              backgroundColor: accent.softBg,
              border: `1px solid ${accent.border}`,
              fontSize: 17,
              color: accent.ink,
            },
            elementIconUrl
              ? el('img', {
                  src: elementIconUrl,
                  width: 20,
                  height: 20,
                })
              : null,
            el('span', null, accent.label)
          ),
          el('span', { style: { color: 'rgba(141, 172, 196, 0.35)', fontSize: 16 } }, '/'),
          el(
            'span',
            {
              style: {
                fontSize: 15,
                letterSpacing: '0.14em',
                color: TEXT_MUTED,
              },
            },
            categoryLabel
          )
        ),
        flex(
          { alignItems: 'center', gap: 11 },
          brandIconUrl
            ? el('img', {
                src: brandIconUrl,
                width: 34,
                height: 34,
                style: { borderRadius: 8 },
              })
            : null,
          flex(
            { flexDirection: 'column', alignItems: 'flex-start' },
            el(
              'span',
              {
                style: {
                  fontSize: 19,
                  color: TEXT_PRIMARY,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.1,
                },
              },
              'KiyoStella'
            ),
            el(
              'span',
              { style: { fontSize: 12, color: TEXT_MUTED, lineHeight: 1.25 } },
              'Stella Sora Tools'
            )
          )
        )
      ),
      bodyNode,
      // Clean footer strip
      flex(
        {
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: `1px solid ${BORDER_SUBTLE}`,
          paddingTop: 14,
          fontSize: 16,
          color: TEXT_MUTED,
        },
        el('span', null, footerText),
        el(
          'span',
          { style: { color: accent.ink, letterSpacing: '0.01em' } },
          'kiyostella.vercel.app'
        )
      )
    )
  );
}

function pngImageResponse(element: React.ReactElement): ImageResponse {
  return new ImageResponse(element, {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    headers: {
      'Cache-Control': OG_CACHE_CONTROL,
    },
  });
}

function findCharacterByParam(rawId: string): SSCharacter | null {
  const chars = charactersData as Record<string, SSCharacter>;
  let decoded = rawId;
  try {
    decoded = decodeURIComponent(rawId);
  } catch {
    return null;
  }
  const trimmed = decoded.trim();
  if (!trimmed) return null;
  if (chars[trimmed]) return chars[trimmed];
  const lower = trimmed.toLowerCase();
  return Object.values(chars).find((c) => c.name.EN.toLowerCase() === lower) ?? null;
}

async function renderTrekkerOgResponse(char: SSCharacter): Promise<ImageResponse> {
  const accent = ELEMENT_ACCENTS[char.element] ?? ELEMENT_ACCENTS.None;
  const charId = String(char.id);
  const loreMap = trekkerLoreData as Record<string, { faction?: string }>;
  const lore = loreMap[charId] || loreMap[char.name.EN] || null;
  const combatMap = characterCombatData as Record<
    string,
    {
      normalAtk?: { name?: string };
      skill?: { name?: string };
      supportSkill?: { name?: string };
      ultimate?: { name?: string };
    }
  >;
  const combat = combatMap[charId] || null;

  // Raw trekker sprites (304x404) carry transparent padding around a 286x368 (0.777) card
  const [portraitUrl, elementIconUrl, brandIconUrl] = await Promise.all([
    localWebpToPngDataUrl(`trekkers/${char.id}.webp`, 292, 376, { trim: true }),
    localWebpToPngDataUrl(`ss-element/${char.element}.webp`, 48),
    localWebpToPngDataUrl('favicon-48x48.png', 48),
  ]);

  const skillChips = [
    { slot: 'Normal', name: combat?.normalAtk?.name },
    { slot: 'Main Skill', name: combat?.skill?.name },
    { slot: 'Support', name: combat?.supportSkill?.name },
    { slot: 'Ultimate', name: combat?.ultimate?.name },
  ].filter((item): item is { slot: string; name: string } => Boolean(item.name));

  const nameFontSize = char.name.EN.length > 16 ? 48 : char.name.EN.length > 12 ? 54 : 60;

  const bodyNode = flex(
    {
      flex: 1,
      alignItems: 'center',
      gap: 40,
      padding: '20px 0',
    },
    flex(
      {
        width: 292,
        height: 376,
        borderRadius: 16,
        backgroundColor: SURFACE_WELL,
        border: `1.5px solid ${accent.border}`,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      },
      portraitUrl
        ? el('img', {
            src: portraitUrl,
            width: 292,
            height: 376,
            style: { objectFit: 'cover', objectPosition: 'top center' },
          })
        : el(
            'span',
            { style: { fontSize: 64, color: accent.ink } },
            char.name.EN.slice(0, 2).toUpperCase()
          )
    ),
    flex(
      {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 14,
      },
      flex(
        { alignItems: 'center', gap: 14, flexWrap: 'wrap' },
        flex(
          { alignItems: 'center', gap: 4 },
          ...Array.from({ length: char.star }, (_, idx) => renderStarSvg(true, idx, 20))
        ),
        lore?.faction
          ? flex(
              {
                alignItems: 'center',
                gap: 10,
                fontSize: 16,
                color: TEXT_SECONDARY,
              },
              el('span', { style: { color: 'rgba(141, 172, 196, 0.4)' } }, '·'),
              el('span', null, lore.faction)
            )
          : null
      ),
      flex(
        { flexDirection: 'column', gap: 6 },
        renderSafeText(char.name.EN, nameFontSize, TEXT_PRIMARY, {
          lineHeight: 1.05,
          letterSpacing: '-0.025em',
        }),
        el(
          'span',
          {
            style: {
              fontSize: 22,
              color: accent.ink,
              letterSpacing: '0.01em',
            },
          },
          `${char.element}  ·  ${char.class}  ·  ${char.attackType}`
        )
      ),
      skillChips.length > 0
        ? flex(
            {
              flexDirection: 'column',
              gap: 10,
              marginTop: 10,
              width: '100%',
            },
            ...[0, 2]
              .map((rowStart) => skillChips.slice(rowStart, rowStart + 2))
              .filter((row) => row.length > 0)
              .map((row, rowIdx) =>
                el(
                  'div',
                  { key: rowIdx, style: { display: 'flex', gap: 12, width: '100%' } },
                  ...row.map((sk) =>
                    el(
                      'div',
                      {
                        key: sk.slot,
                        style: {
                          display: 'flex',
                          flex: 1,
                          flexDirection: 'column',
                          padding: '12px 16px',
                          borderRadius: 12,
                          backgroundColor: SURFACE_PANEL,
                          border: `1px solid ${BORDER_HAIRLINE}`,
                        },
                      },
                      el(
                        'span',
                        {
                          style: {
                            fontSize: 11,
                            letterSpacing: '0.1em',
                            color: TEXT_MUTED,
                            textTransform: 'uppercase',
                          },
                        },
                        sk.slot
                      ),
                      renderSafeText(truncateText(sk.name, 28), 18, TEXT_PRIMARY, {
                        marginTop: 4,
                        lineHeight: 1.2,
                      })
                    )
                  )
                )
              )
          )
        : null
    )
  );

  return pngImageResponse(
    renderCardShell(
      accent,
      'TREKKER PROFILE',
      elementIconUrl,
      brandIconUrl,
      bodyNode,
      'Lv.1–90 Stats · Potentials · T1–T5 Talents · Loved Gifts'
    )
  );
}

async function renderDiscOgResponse(disc: SSDisc): Promise<ImageResponse> {
  const accent = ELEMENT_ACCENTS[disc.element] ?? ELEMENT_ACCENTS.None;
  const exclusive = getExclusiveBannerByDiscId(disc.id);
  const outfitUrl = getDiscOutfitIconUrl(disc.id, 'full');

  const [discArtUrl, elementIconUrl, brandIconUrl] = await Promise.all([
    outfitUrl ? remoteWebpToPngDataUrl(outfitUrl, 340, 340) : Promise.resolve(null),
    disc.element !== 'None'
      ? localWebpToPngDataUrl(`ss-element/${disc.element}.webp`, 48)
      : Promise.resolve(null),
    localWebpToPngDataUrl('favicon-48x48.png', 48),
  ]);

  const lv90Atk = disc.stats?.lv90?.ATK ?? disc.stats?.lv80?.ATK ?? 0;
  const secondaryStatEntry = Object.entries(disc.stats?.lv90 || {}).find(
    ([key]) => key !== 'ATK'
  );
  const harmonySkills = [disc.secondarySkill1?.name, disc.secondarySkill2?.name].filter(
    (name): name is string => Boolean(name)
  );

  const titleFontSize = disc.name.length > 24 ? 42 : disc.name.length > 18 ? 46 : 52;

  const bodyNode = flex(
    {
      flex: 1,
      alignItems: 'center',
      gap: 40,
      padding: '20px 0',
    },
    flex(
      {
        width: 336,
        height: 336,
        borderRadius: 18,
        backgroundColor: SURFACE_WELL,
        border: `1.5px solid ${accent.border}`,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      },
      discArtUrl
        ? el('img', {
            src: discArtUrl,
            width: 336,
            height: 336,
            style: { objectFit: 'cover' },
          })
        : flex(
            {
              width: '100%',
              height: '100%',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              backgroundColor: SURFACE_PANEL,
            },
            renderDiscMonogramSvg(accent.hex),
            flex(
              { alignItems: 'center', gap: 6 },
              el(
                'span',
                {
                  style: {
                    fontSize: 20,
                    color: TEXT_SECONDARY,
                    letterSpacing: '0.08em',
                  },
                },
                String(disc.star)
              ),
              renderStarSvg(true, 0, 18),
              el(
                'span',
                {
                  style: {
                    fontSize: 20,
                    color: accent.ink,
                    letterSpacing: '0.08em',
                  },
                },
                accent.label.toUpperCase()
              )
            )
          )
    ),
    flex(
      {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 16,
      },
      flex(
        { alignItems: 'center', gap: 14, flexWrap: 'wrap' },
        flex(
          { alignItems: 'center', gap: 4 },
          ...Array.from({ length: disc.star }, (_, idx) => renderStarSvg(true, idx, 20))
        ),
        exclusive
          ? flex(
              {
                padding: '4px 12px',
                borderRadius: 6,
                backgroundColor: accent.softBg,
                border: `1px solid ${accent.border}`,
                fontSize: 15,
                color: accent.ink,
              },
              `Featured: ${exclusive.trekkerName}`
            )
          : null
      ),
      renderSafeText(disc.name, titleFontSize, TEXT_PRIMARY, {
        lineHeight: 1.08,
        letterSpacing: '-0.025em',
      }),
      flex(
        { alignItems: 'center', gap: 12, flexWrap: 'wrap' },
        lv90Atk
          ? flex(
              {
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                borderRadius: 10,
                backgroundColor: SURFACE_PANEL,
                border: `1px solid ${BORDER_HAIRLINE}`,
                fontSize: 17,
              },
              el('span', { style: { color: TEXT_MUTED, fontSize: 14 } }, 'LV.90 ATK'),
              el('span', { style: { color: TEXT_PRIMARY } }, String(lv90Atk))
            )
          : null,
        secondaryStatEntry
          ? flex(
              {
                padding: '8px 14px',
                borderRadius: 10,
                backgroundColor: SURFACE_PANEL,
                border: `1px solid ${accent.border}`,
                fontSize: 17,
                color: accent.ink,
              },
              `${secondaryStatEntry[0]} ${secondaryStatEntry[1]}`
            )
          : null
      ),
      flex(
        {
          flexDirection: 'column',
          gap: 10,
          marginTop: 4,
          padding: '14px 18px',
          borderRadius: 12,
          backgroundColor: SURFACE_PANEL,
          border: `1px solid ${BORDER_HAIRLINE}`,
        },
        disc.mainSkill?.name
          ? flex(
              { alignItems: 'flex-start', gap: 14 },
              el(
                'span',
                {
                  style: {
                    color: TEXT_MUTED,
                    fontSize: 12,
                    letterSpacing: '0.1em',
                    minWidth: 88,
                    paddingTop: 5,
                  },
                },
                'MELODY'
              ),
              flex(
                { flex: 1 },
                renderSafeText(disc.mainSkill.name, 18, TEXT_PRIMARY, { lineHeight: 1.3 })
              )
            )
          : null,
        harmonySkills.length > 0
          ? flex(
              {
                alignItems: 'flex-start',
                gap: 14,
                paddingTop: disc.mainSkill?.name ? 10 : 0,
                borderTop: disc.mainSkill?.name ? `1px solid ${BORDER_SUBTLE}` : 'none',
              },
              el(
                'span',
                {
                  style: {
                    color: TEXT_MUTED,
                    fontSize: 12,
                    letterSpacing: '0.1em',
                    minWidth: 88,
                    paddingTop: 5,
                  },
                },
                'HARMONY'
              ),
              flex(
                { flex: 1 },
                renderSafeText(harmonySkills.join('  ·  '), 18, TEXT_SECONDARY, {
                  lineHeight: 1.3,
                })
              )
            )
          : null
      )
    )
  );

  return pngImageResponse(
    renderCardShell(
      accent,
      'RUNIC DISC',
      elementIconUrl,
      brandIconUrl,
      bodyNode,
      'Crescendo C1–C6 · Harmony Requirements · Support Notes'
    )
  );
}

export async function renderBuildOgResponse(
  preset: ResolvedCommunityPreset
): Promise<ImageResponse> {
  const accent = ELEMENT_ACCENTS[preset.element] ?? ELEMENT_ACCENTS.None;
  const charsMap = charactersData as Record<string, SSCharacter>;
  const discsMap = discsData as Record<string, SSDisc>;

  const slotEntries = DEPLOYMENT_SLOTS.map((slotMeta) => {
    const slotData = preset.advData.slots[slotMeta.key];
    const char = slotData?.characterId ? charsMap[String(slotData.characterId)] : null;
    return { slotMeta, char };
  });

  // Main Runic Discs are shared squad-wide (3 discs per run, not equipped 1-per-Trekker)
  const sharedMainDiscs = preset.advData.mainDiscs
    .slice(0, 3)
    .map((entry) => (entry?.discId ? discsMap[String(entry.discId)] ?? null : null))
    .filter((d): d is SSDisc => Boolean(d));

  const [elementIconUrl, brandIconUrl, ...portraitUrls] = await Promise.all([
    localWebpToPngDataUrl(`ss-element/${preset.element}.webp`, 48),
    localWebpToPngDataUrl('favicon-48x48.png', 48),
    ...slotEntries.map(({ char }) =>
      char
        ? localWebpToPngDataUrl(`trekkers/${char.id}.webp`, 180, 232, { trim: true })
        : Promise.resolve(null)
    ),
  ]);

  const author = truncateText(
    preset.authorName || preset.sources[0]?.author || 'Anonymous',
    28
  );
  const tierLabel = TIER_LABELS[preset.tier] || 'Standard';
  const modeLabels = preset.modes
    .slice(0, 3)
    .map((m) => COMMUNITY_MODE_LABELS[m] || m);

  const displayTitle = truncateText(preset.title, 72);
  const titleFontSize = displayTitle.length > 42 ? 36 : displayTitle.length > 28 ? 42 : 46;

  const bodyNode = flex(
    {
      flex: 1,
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 16,
      padding: '12px 0',
    },
    flex(
      { flexDirection: 'column', gap: 10 },
      flex(
        { alignItems: 'center', justifyContent: 'space-between', gap: 16 },
        flex(
          { alignItems: 'center', gap: 12 },
          flex(
            {
              padding: '4px 11px',
              borderRadius: 6,
              backgroundColor: accent.softBg,
              border: `1px solid ${accent.border}`,
              fontSize: 14,
              color: accent.ink,
              letterSpacing: '0.03em',
            },
            tierLabel
          ),
          modeLabels.length > 0
            ? el(
                'span',
                { style: { fontSize: 16, color: TEXT_SECONDARY } },
                modeLabels.join('  ·  ')
              )
            : null
        ),
        el(
          'span',
          { style: { fontSize: 16, color: TEXT_MUTED, flexShrink: 0 } },
          `by ${author}`
        )
      ),
      renderSafeText(displayTitle, titleFontSize, TEXT_PRIMARY, {
        lineHeight: 1.12,
        letterSpacing: '-0.025em',
      })
    ),
    flex(
      {
        gap: 16,
        width: '100%',
      },
      ...slotEntries.map(({ slotMeta, char }, idx) => {
        const portraitUrl = portraitUrls[idx];
        const charName = char ? char.name.EN : 'Empty Slot';
        const charFontSize = charName.length > 14 ? 19 : 22;
        const charAccent = char ? ELEMENT_ACCENTS[char.element] ?? accent : accent;

        return flex(
          {
            flex: 1,
            gap: 16,
            alignItems: 'center',
            padding: '14px 16px',
            borderRadius: 14,
            backgroundColor: SURFACE_PANEL,
            border: `1px solid ${BORDER_HAIRLINE}`,
          },
          flex(
            {
              width: 84,
              height: 108,
              borderRadius: 10,
              backgroundColor: SURFACE_WELL,
              border: `1px solid ${charAccent.border}`,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
            },
            portraitUrl
              ? el('img', {
                  src: portraitUrl,
                  width: 84,
                  height: 108,
                  style: { objectFit: 'cover', objectPosition: 'top center' },
                })
              : el(
                  'span',
                  { style: { fontSize: 22, color: TEXT_MUTED } },
                  char ? char.name.EN.slice(0, 2).toUpperCase() : '--'
                )
          ),
          flex(
            {
              flex: 1,
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 6,
            },
            flex(
              {
                padding: '3px 9px',
                borderRadius: 5,
                backgroundColor: slotMeta.bg,
                border: `1px solid ${slotMeta.border}`,
                fontSize: 11,
                letterSpacing: '0.1em',
                color: slotMeta.color,
              },
              slotMeta.label
            ),
            renderSafeText(charName, charFontSize, TEXT_PRIMARY, {
              lineHeight: 1.15,
              letterSpacing: '-0.015em',
            }),
            char
              ? flex(
                  { alignItems: 'center', gap: 5, fontSize: 14, color: TEXT_MUTED },
                  el('span', { style: { color: '#fbbf24' } }, String(char.star)),
                  renderStarSvg(true, idx, 13),
                  el('span', { style: { color: charAccent.ink } }, char.element),
                  el('span', { style: { color: 'rgba(141, 172, 196, 0.45)' } }, '·'),
                  el('span', { style: { color: TEXT_SECONDARY } }, char.class)
                )
              : el('span', { style: { fontSize: 14, color: TEXT_MUTED } }, 'Unassigned')
          )
        );
      })
    ),
    // Shared squad-wide Main Runic Discs strip
    flex(
      {
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '12px 18px',
        borderRadius: 12,
        backgroundColor: SURFACE_WELL,
        border: `1px solid ${BORDER_HAIRLINE}`,
      },
      el(
        'span',
        {
          style: {
            fontSize: 11,
            letterSpacing: '0.12em',
            color: TEXT_MUTED,
            flexShrink: 0,
          },
        },
        'MAIN DISCS'
      ),
      el('span', { style: { color: 'rgba(141, 172, 196, 0.35)', fontSize: 14 } }, '|'),
      sharedMainDiscs.length > 0
        ? flex(
            { flex: 1, alignItems: 'center', gap: 10 },
            ...sharedMainDiscs.map((disc, idx) => {
              const discAccent = ELEMENT_ACCENTS[disc.element] ?? ELEMENT_ACCENTS.None;
              return el(
                'div',
                {
                  key: `${disc.id}-${idx}`,
                  style: {
                    display: 'flex',
                    flex: 1,
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 8,
                    backgroundColor: SURFACE_PANEL,
                    border: `1px solid ${BORDER_SUBTLE}`,
                  },
                },
                flex({
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  backgroundColor: discAccent.hex,
                  flexShrink: 0,
                }),
                renderSafeText(truncateText(disc.name, 26), 15, TEXT_PRIMARY, {
                  lineHeight: 1.2,
                })
              );
            })
          )
        : el(
            'span',
            { style: { fontSize: 15, color: TEXT_MUTED } },
            'No Main Discs assigned'
          )
    )
  );

  const summaryFooter = preset.summary
    ? truncateText(preset.summary, 86)
    : 'Squad Potentials · Runic Discs · Musical Notes · Damage Breakdown';

  return pngImageResponse(
    renderCardShell(
      accent,
      'SQUAD BUILD',
      elementIconUrl,
      brandIconUrl,
      bodyNode,
      summaryFooter
    )
  );
}

function redirectToFallback(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL('/kiyostella.png', request.url), 302);
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const type = searchParams.get('type')?.trim();
  const id = searchParams.get('id')?.trim();

  if (!type || !id) {
    return redirectToFallback(request);
  }

  if (type === 'trekker') {
    const char = findCharacterByParam(id);
    if (!char) return redirectToFallback(request);
    return renderTrekkerOgResponse(char);
  }

  if (type === 'disc') {
    const disc = getDiscBySlugOrId(id);
    if (!disc) return redirectToFallback(request);
    return renderDiscOgResponse(disc);
  }

  if (type === 'build') {
    const preset = await getCachedCommunityBuildById(id);
    if (!preset) return redirectToFallback(request);
    return renderBuildOgResponse(preset);
  }

  return redirectToFallback(request);
}
