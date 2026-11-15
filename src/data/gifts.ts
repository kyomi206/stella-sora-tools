export type GiftFamily =
  | 'Flame'
  | 'Ceramic'
  | 'Astral'
  | 'Dessert'
  | 'Photo'
  | 'Wind'
  | 'Spinner'
  | 'Star';

export type GiftAffinityMood = 'loved' | 'neutral' | 'disliked';

export interface GiftItem {
  id: string;
  name: string;
  itemId: number;
  rarity: 3 | 4 | 5;
  family: GiftFamily;
  familyName: string;
  baseExp: number;
  description: string;
  lovedByCharacterIds: number[];
  hatedByCharacterIds: number[];
  imageUrl: string;
  fallbackUrl?: any;
}

export const GIFT_FAMILIES: Record<
  GiftFamily,
  {
    label: string;
    icon: string;
    description: string;
    lovedCharIds: number[];
    hatedCharIds: number[];
  }
> = {
  Flame: {
    label: 'Flame & Candle',
    icon: 'Flame',
    description: 'Aromatic candles, blazing honeypots, and warm thermal wings.',
    lovedCharIds: [108, 110, 112, 114, 120, 126, 127, 132, 143, 144, 149, 156, 161, 162],
    hatedCharIds: [125, 134, 137, 157],
  },
  Ceramic: {
    label: 'Ceramic & Potion',
    icon: 'Coffee',
    description: 'Blossom porcelain cups, gilded bowls, and mystic alchemy kettles.',
    lovedCharIds: [108, 110, 113, 117, 119, 125, 133, 134, 137, 139, 140, 144, 145, 150, 156, 159, 160],
    hatedCharIds: [114, 141, 142],
  },
  Astral: {
    label: 'Astral & Celestial',
    icon: 'Moon',
    description: 'Moonlit companions, starlight eclipses, and miniature cosmic spheres.',
    lovedCharIds: [111, 113, 115, 123, 125, 126, 132, 134, 140, 155, 159, 161, 162],
    hatedCharIds: [135, 158],
  },
  Dessert: {
    label: 'Dessert & Ice',
    icon: 'IceCream',
    description: 'Sweet Ice Furry, fragrant iced delights, and shaved glacial fruits.',
    lovedCharIds: [111, 114, 115, 116, 117, 119, 123, 130, 133, 139, 141, 142, 143, 147, 158, 162],
    hatedCharIds: [155],
  },
  Photo: {
    label: 'Photo & Media',
    icon: 'Camera',
    description: 'Card photo capturers, reflective twin mirrors, and precision lenses.',
    lovedCharIds: [103, 115, 118, 132, 134, 135, 137, 141, 142, 156, 157, 159, 161],
    hatedCharIds: [133, 143],
  },
  Wind: {
    label: 'Wind & Blower',
    icon: 'Wind',
    description: 'Portable, exquisite, and deluxe turbine blowers for refreshing drafts.',
    lovedCharIds: [110, 116, 120, 125, 130, 135, 137, 139, 145, 155, 157, 158, 160],
    hatedCharIds: [115, 132, 149, 159, 162],
  },
  Spinner: {
    label: 'Wind Spinner',
    icon: 'Fan',
    description: 'Whispering, chilling, and blazing wind spinners for beating the heat.',
    lovedCharIds: [107, 112, 118, 119, 127, 130, 133, 143, 144, 149, 150, 155, 157, 160],
    hatedCharIds: [140, 145, 156, 161],
  },
  Star: {
    label: 'Star & Stage',
    icon: 'Sparkles',
    description: 'Stage badges, emerging broadcast awards, and shining trophies.',
    lovedCharIds: [103, 107, 114, 135, 140, 141, 142, 145, 147, 149, 158],
    hatedCharIds: [110, 119, 130, 139, 144],
  },
};

function makeGift(
  id: string,
  name: string,
  itemId: number,
  rarity: 3 | 4 | 5,
  family: GiftFamily,
  description: string
): GiftItem {
  const baseExp = rarity === 5 ? 2000 : rarity === 4 ? 500 : 150;
  const meta = GIFT_FAMILIES[family];
  return {
    id,
    name,
    itemId,
    rarity,
    family,
    familyName: meta.label,
    baseExp,
    description,
    lovedByCharacterIds: meta.lovedCharIds,
    hatedByCharacterIds: meta.hatedCharIds,
    imageUrl: `/gifts/item_${itemId}.webp`,
  };
}

export const STELLA_SORA_GIFTS: GiftItem[] = [
  // ==========================================
  // 5★ DELUXE GIFTS (EXQUISITE - BASE 2,000 EXP)
  // Loved: 3,000 EXP (+50%) • Hated: 1,600 EXP (-20%)
  // ==========================================
  makeGift(
    'sweet-ice-furry',
    'Sweet Ice Furry',
    33073,
    5,
    'Dessert',
    "I've finally asked you out. The 'Buy One, Get One Half Off' deal was just my excuse. My favorite flavor? Same as yours!"
  ),
  makeGift(
    'mystic-potion-kettle',
    'Mystic Potion Kettle',
    33083,
    5,
    'Ceramic',
    'This kettle pulses with enigmatic energy, robust enough to withstand harsh environments. Whether antidote or poison is up to the maker.'
  ),
  makeGift(
    'fiery-honeypot',
    'Fiery Honeypot',
    33013,
    5,
    'Flame',
    'Warm blazing honey sealed in an enchanted pot. Emits soothing warmth and the gentle aroma of roasted amber nectar.'
  ),
  makeGift(
    'cosmic-form',
    'Cosmic Form',
    33063,
    5,
    'Astral',
    'A miniature celestial sphere capturing the orbit of ancient constellations. Gazing inside feels like floating across the stars.'
  ),
  makeGift(
    'ultra-precision-photo-capturer',
    'Ultra-Precision Photo Capturer',
    33023,
    5,
    'Photo',
    'Top-tier optical lens Artifact engineered to freeze transient moments into eternal memory discs with lifelike fidelity.'
  ),
  makeGift(
    'deluxe-blower',
    'Deluxe Blower',
    33033,
    5,
    'Wind',
    'Advanced aerofoil turbine spinning at blinding speeds. Blows away heavy dust and creates breezy refreshing drafts.'
  ),
  makeGift(
    'blazing-wind-spinner',
    'Blazing Wind Spinner',
    33043,
    5,
    'Spinner',
    'An Artifact hailed as the ultimate savior against scorching heat, boasting a pivoting function that spreads coolness far and wide.'
  ),
  makeGift(
    'shining-star',
    'Shining Star',
    33053,
    5,
    'Star',
    'A brilliant stage trophy awarded to top performers. Gleams with the dazzling aspirations of dreams fulfilled.'
  ),

  // ==========================================
  // 4★ RARE GIFTS (RARE - BASE 500 EXP)
  // Loved: 750 EXP (+50%) • Hated: 400 EXP (-20%)
  // ==========================================
  makeGift(
    'porcelain-cup',
    'Blossom Porcelain Cup',
    33082,
    4,
    'Ceramic',
    'A treasured heirloom passed down through generations, delicately crafted with azure blossoms on pristine white glaze.'
  ),
  makeGift(
    'moonlit-companion',
    'Moonlit Companion',
    33062,
    4,
    'Astral',
    'Display a moon at home to keep you company. The mysterious ruler of the night, mirroring both the day and our souls.'
  ),
  makeGift(
    'blazing-wings',
    'Blazing Wings',
    33012,
    4,
    'Flame',
    'Mechanical avian wings crafted from heat-tempered alloy. Radiant plumes flicker with fiery illumination.'
  ),
  makeGift(
    'fragrant-ice-delight',
    'Fragrant Ice Delight',
    33072,
    4,
    'Dessert',
    'A chilled dessert bowl topped with sweet cream and seasonal berries. Melts delicately on the tongue.'
  ),
  makeGift(
    'reflective-photo-capturer',
    'Reflective Photo Capturer',
    33022,
    4,
    'Photo',
    'A precision handheld camera Artifact with twin reflex mirrors, favored by documentarians and guild scouts.'
  ),
  makeGift(
    'exquisite-blower',
    'Exquisite Blower',
    33032,
    4,
    'Wind',
    'Compact mechanical turbine that generates gentle cooling breezes at the touch of a bronze toggle.'
  ),
  makeGift(
    'chilling-wind-spinner',
    'Chilling Wind Spinner',
    33042,
    4,
    'Spinner',
    'A cooling artifact that really makes a splash—less portable, yet a potent weapon against summer heat and irritability.'
  ),
  makeGift(
    'emerging-talent',
    'Emerging Talent',
    33052,
    4,
    'Star',
    "A stylish emblem recognizing rising stage icons across Nova's broadcast arenas."
  ),

  // ==========================================
  // 3★ COMMON GIFTS (COMMON - BASE 150 EXP)
  // Loved: 225 EXP (+50%) • Hated: 120 EXP (-20%)
  // ==========================================
  makeGift(
    'love-candle',
    'Love Candle',
    33011,
    3,
    'Flame',
    'A sweet scented candle handcrafted with aromatic herbs. Fills the room with calming warmth and tranquil light.'
  ),
  makeGift(
    'gilded-ceramic-bowl',
    'Gilded Ceramic Bowl',
    33081,
    3,
    'Ceramic',
    'A sturdy ceramic bowl bordered with fine gold foil. Practical yet elegant for everyday soups and tea.'
  ),
  makeGift(
    'star-eclipse',
    'Star Eclipse',
    33061,
    3,
    'Astral',
    'Placing it beside your bed is said to summon stars into your dreams. A gentle nightlight for deep sleep.'
  ),
  makeGift(
    'chill-crushed-ice',
    'Chill Crushed Ice',
    33071,
    3,
    'Dessert',
    'Finely shaved glacial ice drizzled with sugary fruit syrup. The ultimate cooling treat after a long expedition.'
  ),
  makeGift(
    'card-capturer',
    'Card Capturer',
    33021,
    3,
    'Photo',
    'An early-model snapshot Artifact. Produces miniature photographic cards of cherished memories in seconds.'
  ),
  makeGift(
    'portable-blower',
    'Portable Blower',
    33031,
    3,
    'Wind',
    'One of the most popular daily Artifacts in the shop, and a handy essential for drying hair or freshening up on expeditions.'
  ),
  makeGift(
    'whisper-wind-spinner',
    'Whisper Wind Spinner',
    33041,
    3,
    'Spinner',
    'A whimsical hand-cranked pinwheel. Catches even the faintest draft to spin with a cheerful hum.'
  ),
  makeGift(
    'rising-star',
    'Rising Star',
    33051,
    3,
    'Star',
    'A glittering brass badge pinned by aspiring apprentices taking their first steps onto the stage.'
  ),
];

/**
 * Checks if a gift is loved by a given Trekker character ID
 */
export function isGiftLovedBy(gift: GiftItem, characterId: number): boolean {
  return gift.lovedByCharacterIds.includes(characterId);
}

/**
 * Checks if a gift is hated/disliked by a given Trekker character ID
 */
export function isGiftHatedBy(gift: GiftItem, characterId: number): boolean {
  return gift.hatedByCharacterIds.includes(characterId);
}

/**
 * Gets the affinity mood for a gift and character:
 * - 'loved': +50% EXP (Yellow smiling face)
 * - 'disliked': -20% EXP (Gray face)
 * - 'neutral': Standard 1x EXP (Green face)
 */
export function getGiftAffinityMood(
  gift: GiftItem,
  characterId: number
): GiftAffinityMood {
  if (isGiftLovedBy(gift, characterId)) return 'loved';
  if (isGiftHatedBy(gift, characterId)) return 'disliked';
  return 'neutral';
}

/**
 * Gets effective affinity EXP for a gift considering character preference and loved override
 */
export function getGiftEffectiveExp(
  gift: GiftItem,
  characterId: number,
  forceLoved = false
): number {
  if (forceLoved || isGiftLovedBy(gift, characterId)) {
    return Math.round(gift.baseExp * 1.5);
  }
  if (isGiftHatedBy(gift, characterId)) {
    return Math.round(gift.baseExp * 0.8);
  }
  return gift.baseExp;
}

/**
 * Returns the favorite gift families for a given Trekker
 */
export function getCharacterFavoriteFamilies(characterId: number): GiftFamily[] {
  const families: GiftFamily[] = [];
  for (const [familyKey, data] of Object.entries(GIFT_FAMILIES)) {
    if (data.lovedCharIds.includes(characterId)) {
      families.push(familyKey as GiftFamily);
    }
  }
  return families;
}
