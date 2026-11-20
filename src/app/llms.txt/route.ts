import charactersData from '../../data/characters.json' with { type: 'json' };
import { getAllDiscs, getDiscSlug } from '../../lib/discs.ts';
import { getSiteUrl } from '../../lib/site-url.ts';

export async function GET() {
  const siteUrl = getSiteUrl();
  const characters = Object.values(charactersData).sort((a, b) =>
    a.name.EN.localeCompare(b.name.EN)
  );
  const allDiscs = getAllDiscs();
  const fiveStarDiscs = allDiscs.filter((disc) => disc.star >= 5);
  const fourStarCount = allDiscs.filter((disc) => disc.star === 4).length;
  const threeStarCount = allDiscs.filter((disc) => disc.star === 3).length;

  const trekkerLines = characters.map((char) => {
    const encoded = encodeURIComponent(char.name.EN);
    return `- [${char.name.EN}](${siteUrl}/trekkers/${encoded}): ${char.star}★ ${char.element} ${char.class} (${char.attackType})`;
  });

  const fiveStarDiscLines = fiveStarDiscs.map((disc) => {
    const slug = getDiscSlug(disc.name);
    const elementLabel = disc.element === 'None' ? 'Neutral' : disc.element;
    const melody = disc.mainSkill?.name ? ` — Melody: ${disc.mainSkill.name}` : '';
    return `- [${disc.name}](${siteUrl}/discs/${slug}): 5★ ${elementLabel} Runic Disc${melody}`;
  });

  const body = [
    '# KiyoStella',
    '',
    `> KiyoStella (also known as Stella Sora Tools / SSTT) is an unofficial web companion and utility database for the action RPG *Stella Sora* (by Yostar, Inc.). Canonical site: ${siteUrl}/`,
    '',
    'All calculators, builders, timelines, and encyclopedias run client-side on curated game data with no login required.',
    '',
    '## Tools & Utilities',
    '',
    `- [Preset Visualizer & Squad Builder](${siteUrl}/builder): Build 3-Trekker squads (Vanguard, Versatile, Support), pick Core and Normal Potentials, import/export in-game 36-character preset codes, save local squad bookmarks, and export shareable build cards.`,
    `- [Advanced Preset Visualizer](${siteUrl}/builder/advanced): Configure full squad presets including 3 Main Runic Discs, 3 Support Runic Discs, Musical Notes harmony requirements, and SST1 advanced preset codes.`,
    `- [Affinity Calculator](${siteUrl}/bond): Plan Heartlink/Affinity leveling using loved (+50% EXP) vs. neutral gifts, auto-fill optimal gift allocations, and calculate the days needed under the 10 gifts/day mail limit.`,
    `- [Resource Calculator](${siteUrl}/calculator): Calculate exact Dorra, level-up EXP, class breakthrough materials, and skill cartridge costs for any Trekker from level 1–90 and skill ranks 1–10.`,
    `- [Events Roadmap & Banner Schedule](${siteUrl}/roadmap): Track active and upcoming character recruitment banners, Runic Disc banners, Boss Blitz seasons, story events, and Cataclysm Survivor schedules.`,
    `- [Trekker Encyclopedia](${siteUrl}/trekkers): Browse and filter all ${characters.length} playable Trekkers by Element, Style, Class, Rarity, Combat Type, and Faction.`,
    `- [Runic Disc Encyclopedia](${siteUrl}/discs): Browse and filter all ${allDiscs.length} Runic Discs by Element, Rarity, Tags, Support Notes, and Harmony Notes.`,
    '',
    '## Stella Sora Terminology',
    '',
    '- **Trekker**: Playable characters deployed in 3-member squads across **Vanguard**, **Versatile**, and **Support** slots.',
    '- **Elements**: Six elemental affinities — **Ignis**, **Aqua**, **Terra**, **Ventus**, **Lux**, and **Umbra** (plus **Neutral** for elementless Runic Discs).',
    '- **Potentials**: Character-specific run upgrades split into **Core** (pink/prism) and **Normal** / **Common** potentials across Main and Support roles.',
    '- **Talents**: Five passive resonance tiers (**T1–T5**) unlocked per Trekker.',
    '- **Runic Discs**: Equipment cards (3★, 4★, 5★) providing ATK/stat bonuses, a **Melody Skill** scaling with **Crescendo (C1–C6)**, up to two **Harmony Skills** unlocked via **Musical Notes**, and **Starting Support Notes** scaling across **Phases (P1–P9)**.',
    '- **Affinity (Heartlink)**: Character bond progression boosted by gifting items from a Trekker’s preferred gift families (+50% EXP bonus for loved gifts).',
    '- **Preset Codes**: In-game 36-character Base64 squad potential codes and KiyoStella `SST1` extended codes covering discs and target Musical Notes.',
    '- **Boss Blitz & Cataclysm Survivor**: Recurring end-game combat events and seasonal modes tracked on the Events Roadmap.',
    '',
    `## Trekker Encyclopedia (${characters.length} Trekkers)`,
    '',
    ...trekkerLines,
    '',
    `## Runic Disc Encyclopedia (${allDiscs.length} Discs: ${fiveStarDiscs.length} × 5★, ${fourStarCount} × 4★, ${threeStarCount} × 3★)`,
    '',
    `Full filterable catalog: [Runic Discs](${siteUrl}/discs). All ${allDiscs.length} individual disc entries are also indexed in [sitemap.xml](${siteUrl}/sitemap.xml). Highlighted 5★ Runic Discs:`,
    '',
    ...fiveStarDiscLines,
    '',
    '## Credits & Attribution',
    '',
    `- [Credits & Attributions](${siteUrl}/credits): Community data sources, fair-use notice for Yostar assets, and tech stack details.`,
    `- [Source Repository](${'https://github.com/kyomi206/stella-sora-tools'}): Open-source repository for Stella Sora Tools / KiyoStella.`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
