import type {
  RoadmapItem,
  RawGachaItem,
  RawUnreleasedItem,
  UnreleasedTrekker,
  ColorTheme,
  ElementType,
} from './types.ts';

export function cleanCharacterName(rawName: string, id: number): string {
  if (!rawName) return `Upcoming Trekker #${id}`;
  const trimmed = rawName.trim();
  if (trimmed.includes('***') || /^\d+\s*$/.test(trimmed)) {
    return `Upcoming Trekker #${id}`;
  }
  return trimmed;
}

export function mapElementToColor(element?: string): ColorTheme {
  switch (element) {
    case 'Ignis':
      return 'rose';
    case 'Aqua':
      return 'blue';
    case 'Terra':
      return 'orange';
    case 'Ventus':
      return 'emerald';
    case 'Umbra':
      return 'purple';
    case 'Lux':
      return 'amber';
    default:
      return 'blue';
  }
}

export const DISC_NAME_BY_ID: Record<number, string> = {
  213003: "Scorching Night's End",
  213004: 'Twin Moon Mischief',
  213005: '★Bam Bam Girl★',
  213006: 'Good Night',
  213007: 'Emerald Dream',
  213008: 'Tranquil Retreat',
  213009: 'Rainy Tune',
  213010: 'Steam Syndrome',
  213011: 'Meow Rhythm',
  213012: 'Starry Night Ode',
  213013: 'Leaf Her to Me',
  213014: "The Knight's Smith",
  213015: 'Unknown Fragrance',
  213016: 'Cage of Roses',
  213017: '★Rolling Life★',
  213018: 'Soda Shopping',
  213019: 'Delusion',
  213020: 'The Shining',
  214004: 'Wisteria Dream',
  214005: 'Sunlit Blossom',
  214006: "Witch's Swing",
  214007: 'Midnight Mayhem',
  214008: 'Soaring Blue',
  214015: "Deer's Song",
  214016: 'Chronicles of Spring',
  214017: 'Fireworks',
  214026: 'Sword Against Stream',
  214027: 'Mystic Brushstrokes',
  214028: 'Daylight Garden',
  214029: "The Cat's Treasure",
  214036: 'The Lost Pilgrim',
  214037: 'Claw the Claw',
  214038: 'Ripples of Nostalgia',
  214044: 'Veiled Dawn of Spring',
  214045: 'Petals of Blooming Mirage',
  214048: 'Snowy Night Surprise',
  214051: 'Stellar Destination',
  214054: 'Little Paradise',
  214055: 'Fleeting Glimmers',
  214057: 'Ride the Waves With Me',
  214059: 'Fly, O Caged Bird',
  214061: 'Bedtime Story',
  214066: 'My Guiding Star',
};

export function formatDiscWikiName(name: string): string {
  return name.trim().replace(/\s+/g, '_');
}

/**
 * Computes MD5 hash in pure TypeScript (compatible with both Node.js SSR and client bundle)
 */
function md5(str: string): string {
  function safeAdd(x: number, y: number) {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
  }
  function bitRotateLeft(num: number, cnt: number) {
    return (num << cnt) | (num >>> (32 - cnt));
  }
  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  function binlMD5(x: number[], len: number) {
    x[len >> 5] |= 0x80 << (len % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;

    let a = 1732584193;
    let b = -271733879;
    let c = -1732584194;
    let d = 271733878;

    for (let i = 0; i < x.length; i += 16) {
      const olda = a;
      const oldb = b;
      const oldc = c;
      const oldd = d;

      a = md5ff(a, b, c, d, x[i], 7, -680876936);
      d = md5ff(d, a, b, c, x[i + 1], 12, -389564586);
      c = md5ff(c, d, a, b, x[i + 2], 17, 606105819);
      b = md5ff(b, c, d, a, x[i + 3], 22, -1044525330);
      a = md5ff(a, b, c, d, x[i + 4], 7, -176418897);
      d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426);
      c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341);
      b = md5ff(b, c, d, a, x[i + 7], 22, -45705983);
      a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416);
      d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417);
      c = md5ff(c, d, a, b, x[i + 10], 17, -42063);
      b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162);
      a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682);
      d = md5ff(d, a, b, c, x[i + 13], 12, -40341101);
      c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290);
      b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329);

      a = md5gg(a, b, c, d, x[i + 1], 5, -165796510);
      d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632);
      c = md5gg(c, d, a, b, x[i + 11], 14, 643717713);
      b = md5gg(b, c, d, a, x[i], 20, -373897302);
      a = md5gg(a, b, c, d, x[i + 5], 5, -701558691);
      d = md5gg(d, a, b, c, x[i + 10], 9, 38016083);
      c = md5gg(c, d, a, b, x[i + 15], 14, -660478335);
      b = md5gg(b, c, d, a, x[i + 4], 20, -405537848);
      a = md5gg(a, b, c, d, x[i + 9], 5, 568446438);
      d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690);
      c = md5gg(c, d, a, b, x[i + 3], 14, -187363961);
      b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501);
      a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467);
      d = md5gg(d, a, b, c, x[i + 2], 9, -51403784);
      c = md5gg(c, d, a, b, x[i + 7], 14, 1735328473);
      b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734);

      a = md5hh(a, b, c, d, x[i + 5], 4, -378558);
      d = md5hh(d, a, b, c, x[i + 8], 11, -2022574463);
      c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562);
      b = md5hh(b, c, d, a, x[i + 14], 23, -35309556);
      a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060);
      d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353);
      c = md5hh(c, d, a, b, x[i + 7], 16, -155497632);
      b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640);
      a = md5hh(a, b, c, d, x[i + 13], 4, 681279174);
      d = md5hh(d, a, b, c, x[i], 11, -358537222);
      c = md5hh(c, d, a, b, x[i + 3], 16, -722521979);
      b = md5hh(b, c, d, a, x[i + 6], 23, 76029189);
      a = md5hh(a, b, c, d, x[i + 9], 4, -640364487);
      d = md5hh(d, a, b, c, x[i + 12], 11, -421815835);
      c = md5hh(c, d, a, b, x[i + 15], 16, 530742520);
      b = md5hh(b, c, d, a, x[i + 2], 23, -995338651);

      a = md5ii(a, b, c, d, x[i], 6, -198630844);
      d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415);
      c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905);
      b = md5ii(b, c, d, a, x[i + 5], 21, -57434055);
      a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571);
      d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606);
      c = md5ii(c, d, a, b, x[i + 10], 15, -1051523);
      b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799);
      a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359);
      d = md5ii(d, a, b, c, x[i + 15], 10, -30611744);
      c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380);
      b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649);
      a = md5ii(a, b, c, d, x[i + 4], 6, -145523070);
      d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379);
      c = md5ii(c, d, a, b, x[i + 2], 15, 718787259);
      b = md5ii(b, c, d, a, x[i + 9], 21, -343485551);

      a = safeAdd(a, olda);
      b = safeAdd(b, oldb);
      c = safeAdd(c, oldc);
      d = safeAdd(d, oldd);
    }
    return [a, b, c, d];
  }

  function rstr2binl(input: string) {
    const output: number[] = [];
    output[(input.length >> 2) - 1] = undefined as unknown as number;
    for (let i = 0; i < output.length; i += 1) output[i] = 0;
    const length8 = input.length * 8;
    for (let i = 0; i < length8; i += 8) {
      output[i >> 5] |= (input.charCodeAt(i / 8) & 0xff) << (i % 32);
    }
    return output;
  }

  function binl2hex(binarray: number[]) {
    const hexTab = '0123456789abcdef';
    let str = '';
    for (let i = 0; i < binarray.length * 4; i += 1) {
      str += hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8 + 4)) & 0x0f) +
             hexTab.charAt((binarray[i >> 2] >> ((i % 4) * 8)) & 0x0f);
    }
    return str;
  }

  const utf8 = unescape(encodeURIComponent(str));
  return binl2hex(binlMD5(rstr2binl(utf8), utf8.length * 8));
}

/**
 * Direct static CDN URL generator for WikiTide (e.g. https://static.wikitide.net/stellasorawiki/6/69/Disc_icon_Stellar_Destination.png)
 */
export function getWikiTideAssetUrl(filename: string): string {
  const clean = filename.trim().replace(/\s+/g, '_');
  const hash = md5(clean);
  const a = hash[0];
  const ab = hash.slice(0, 2);
  return `https://static.wikitide.net/stellasorawiki/${a}/${ab}/${clean}`;
}

const SSASSETS = 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles';

/**
 * Returns the direct static WikiTide CDN URL for a disc's icon.
 * (e.g. https://static.wikitide.net/stellasorawiki/6/69/Disc_icon_Stellar_Destination.png)
 */
export function getDiscIconUrl(discIdentifier?: string | number): string {
  if (!discIdentifier) return '';
  let discName = '';
  if (typeof discIdentifier === 'string') {
    discName = discIdentifier;
  } else {
    const normId = discIdentifier >= 220000 ? discIdentifier - 10000 : discIdentifier;
    discName = DISC_NAME_BY_ID[normId] || '';
  }
  if (!discName) return '';
  return getWikiTideAssetUrl(`Disc_icon_${formatDiscWikiName(discName)}.png`);
}

/**
 * Returns the direct static WikiTide CDN URL for a disc's full illustration artwork.
 * (e.g. https://static.wikitide.net/stellasorawiki/.../Disc_Stellar_Destination.png)
 */
export function getDiscArtworkUrl(discIdentifier?: string | number): string {
  if (!discIdentifier) return '';
  let discName = '';
  if (typeof discIdentifier === 'string') {
    discName = discIdentifier;
  } else {
    const normId = discIdentifier >= 220000 ? discIdentifier - 10000 : discIdentifier;
    discName = DISC_NAME_BY_ID[normId] || '';
  }
  if (!discName) return '';
  return getWikiTideAssetUrl(`Disc_${formatDiscWikiName(discName)}.png`);
}

export function getUnitAssetUrl(unitId?: number, isDisc?: boolean, unitName?: string): string {
  if (isDisc || (unitId && unitId >= 200000)) {
    return getDiscIconUrl(unitName || unitId);
  }
  if (!unitId) return '';
  return `${SSASSETS}/icon/head/head_${unitId}01_L.webp`;
}

export function getGachaBannerTabUrl(icon?: string): string {
  if (!icon) return '';
  return `${SSASSETS}/icon/gacha/${icon}.webp`;
}

export function getElementBadgeColor(element?: string): string {
  switch (element) {
    case 'Ignis':
      return 'bg-rose-500/20 text-rose-600 border-rose-500/30';
    case 'Aqua':
      return 'bg-sky-500/20 text-sky-700 border-sky-500/30';
    case 'Terra':
      return 'bg-amber-500/20 text-amber-700 border-amber-500/30';
    case 'Ventus':
      return 'bg-emerald-500/20 text-emerald-700 border-emerald-500/30';
    case 'Umbra':
      return 'bg-purple-500/20 text-purple-700 border-purple-500/30';
    case 'Lux':
      return 'bg-amber-400/20 text-yellow-700 border-yellow-400/30';
    default:
      return 'bg-slate-500/20 text-slate-700 border-slate-500/30';
  }
}

export function formatRoadmapRemainingTime(
  targetDate: Date,
  now: Date,
  status: 'upcoming' | 'ongoing' | 'ended'
): string {
  if (status === 'ended') return 'Ended';

  const diffMs = targetDate.getTime() - now.getTime();
  const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

  if (status === 'upcoming') {
    return diffDays === 1 ? 'Starts in 1 day' : `Starts in ${diffDays} days`;
  }

  return diffDays === 1 ? '1 day left' : `${diffDays} days left`;
}

export function transformGachaBanners(rawGacha: Record<string, RawGachaItem>): RoadmapItem[] {
  const gachaList = Object.values(rawGacha);
  
  // Index disc banners by "startTime_endTime" to match companion discs to character banners
  const discsByTime = new Map<string, RawGachaItem>();
  for (const item of gachaList) {
    if (item.type === 'disc') {
      discsByTime.set(`${item.startTime}_${item.endTime}`, item);
    }
  }

  const items: RoadmapItem[] = [];

  for (const item of gachaList) {
    const isChar = item.type === 'character';
    const primary5Star = item.rateUp5Star?.[0];
    const characterId = isChar ? primary5Star?.id : undefined;
    const characterName = isChar && primary5Star ? cleanCharacterName(primary5Star.name, primary5Star.id) : undefined;
    const element = primary5Star?.element as ElementType | undefined;
    const colorTheme = mapElementToColor(element);

    let pairedDisc: RoadmapItem['pairedDisc'] | undefined;
    if (isChar) {
      const matchDisc = discsByTime.get(`${item.startTime}_${item.endTime}`);
      if (matchDisc) {
        const disc5Star = matchDisc.rateUp5Star?.[0];
        const discName = disc5Star?.name;
        const discTabUrl = matchDisc.icon ? getGachaBannerTabUrl(matchDisc.icon) : undefined;
        const discIconUrl = getDiscIconUrl(discName || disc5Star?.id);
        const discArtworkUrl = getDiscArtworkUrl(discName || disc5Star?.id) || discTabUrl;
        pairedDisc = {
          id: matchDisc.id,
          name: matchDisc.name,
          discName,
          element: disc5Star?.element,
          imageUrl: discIconUrl || discTabUrl,
          artworkUrl: discArtworkUrl,
          bannerTabUrl: discTabUrl,
        };
      }
    }

    const disc5Star = !isChar ? primary5Star : undefined;
    const discId = disc5Star?.id;
    const discName = disc5Star?.name;
    const bannerTabUrl = item.icon ? getGachaBannerTabUrl(item.icon) : undefined;

    const imageUrl = isChar
      ? (characterId
          ? `${SSASSETS}/icon/head/head_${characterId}01_L.webp`
          : undefined)
      : (getDiscIconUrl(discName || discId) || bannerTabUrl);

    const artworkUrl = !isChar
      ? (getDiscArtworkUrl(discName || discId) || bannerTabUrl)
      : undefined;

    const title = isChar
      ? (characterName ? `${characterName} - ${item.name}` : item.name)
      : (discName ? `${discName} - ${item.name}` : `[Disc] ${item.name}`);

    const subtitle = isChar
      ? (primary5Star ? `5★ ${primary5Star.element || 'Featured'} Trekker Recruitment` : 'Recruitment Pool')
      : (disc5Star ? `5★ ${disc5Star.element || 'Featured'} Signature Disc Recruitment` : 'Featured 5★ Runic Disc Pool');

    const badge = isChar ? 'RATE UP' : 'RUNIC DISC';

    const rateUp4Star = item.rateUp4Star?.map((u) => ({
      ...u,
      imageUrl: getUnitAssetUrl(u.id, !isChar, u.name),
    }));

    const rewards: string[] = [];
    if (primary5Star) {
      rewards.push(`Featured 5★ ${primary5Star.name}`);
    }
    if (rateUp4Star && rateUp4Star.length > 0) {
      rewards.push(`Rate-Up 4★: ${rateUp4Star.map((u) => u.name).join(', ')}`);
    }
    if (pairedDisc?.discName) {
      rewards.push(`Signature Disc: ${pairedDisc.discName}`);
    }
    rewards.push('Hard Pity: 160 Pulls');

    items.push({
      id: `banner-gacha-${item.id}`,
      category: 'banners',
      title,
      subtitle,
      startDate: item.startTime,
      endDate: item.endTime,
      badge,
      colorTheme,
      characterId,
      characterName,
      discId,
      discName,
      element,
      description: isChar
        ? `Official limited recruitment banner for 5★ ${characterName || 'Trekker'}. Includes guaranteed 5★ spark at 160 pulls and featured 4★ rate-up Trekkers.`
        : `Featured Runic Disc recruitment banner featuring 5★ "${discName || item.name}". Includes rate-up pull rates and companion pity.`,
      rewards,
      rateUp4Star,
      pairedDisc,
      bannerType: item.type === 'disc' ? 'disc' : 'character',
      isDatamined: true,
      imageUrl,
      artworkUrl,
      bannerTabUrl,
    });
  }

  return items;
}

export function transformUnreleasedTrekkers(
  rawUnreleased: Record<string, RawUnreleasedItem>
): UnreleasedTrekker[] {
  return Object.values(rawUnreleased)
    .filter((raw) => raw.id)
    .map((raw) => {
      const displayName = cleanCharacterName(raw.name, raw.id);
      return {
        id: raw.id,
        rawName: raw.name,
        displayName,
        element: (raw.element || 'Unknown') as ElementType | string,
        class: raw.class || 'Trekker',
        star: raw.star || 5,
        avatarUrl: `https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/head/head_${raw.id}01_L.webp`,
        isDatamined: true,
      };
    })
    .sort((a, b) => a.id - b.id);
}

export type { RawGachaItem, RawUnreleasedItem };
