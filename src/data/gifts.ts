export type GiftFamily =
  | 'Flame'
  | 'Ceramic'
  | 'Astral'
  | 'Dessert'
  | 'Photo'
  | 'Wind'
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
  fallbackUrl: string;
}

export const GIFT_FAMILIES: Record<
  GiftFamily,
  { label: string; icon: string; description: string; lovedCharIds: number[] }
> = {
  Flame: {
    label: 'Flame & Candle',
    icon: 'Flame',
    description: 'Aromatic candles, blazing honeypots, and warm thermal wings.',
    lovedCharIds: [108, 110, 112, 114, 115, 116, 118, 120, 126, 140, 141, 144, 145, 147, 157, 159, 162],
  },
  Ceramic: {
    label: 'Ceramic & Potion',
    icon: 'Coffee',
    description: 'Blossom porcelain cups, gilded bowls, and mystic alchemy kettles.',
    lovedCharIds: [108, 110, 111, 113, 116, 117, 118, 125, 130, 132, 133, 134, 135, 137, 142, 144, 145, 149, 150, 156, 157, 159],
  },
  Astral: {
    label: 'Astral & Celestial',
    icon: 'Moon',
    description: 'Moonlit companions, starlight eclipses, and miniature cosmic spheres.',
    lovedCharIds: [111, 112, 115, 117, 125, 126, 132, 134, 135, 142, 143, 155, 160, 162],
  },
  Dessert: {
    label: 'Dessert & Ice',
    icon: 'IceCream',
    description: 'Sweet Ice Furry, fragrant iced delights, and shaved glacial fruits.',
    lovedCharIds: [111, 112, 113, 114, 119, 133, 139, 143, 147, 158, 160, 162],
  },
  Photo: {
    label: 'Photo & Media',
    icon: 'Camera',
    description: 'Card photo capturers, reflective twin mirrors, and precision lenses.',
    lovedCharIds: [103, 123, 127, 130, 134],
  },
  Wind: {
    label: 'Wind & Mechanism',
    icon: 'Wind',
    description: 'Whimsical wind spinners, cooling turbines, and deluxe air blowers.',
    lovedCharIds: [107, 110, 119, 120, 125, 127, 130, 133, 137, 144, 149, 150, 155, 156, 158, 160],
  },
  Star: {
    label: 'Star & Stage',
    icon: 'Sparkles',
    description: 'Stage badges, emerging broadcast awards, and shining trophies.',
    lovedCharIds: [103, 107, 114, 115, 123, 140, 141, 158],
  },
};

export const STELLA_SORA_GIFTS: GiftItem[] = [
  // ==========================================
  // 5★ DELUXE GIFTS (EXQUISITE - BASE 2,000 EXP)
  // Loved: 3,000 EXP (+50%) • Hated: 1,600 EXP (-20%)
  // ==========================================
  {
    id: 'sweet-ice-furry',
    name: 'Sweet Ice Furry',
    itemId: 33073,
    rarity: 5,
    family: 'Dessert',
    familyName: 'Dessert & Ice',
    baseExp: 2000,
    description: "I've finally asked you out. The 'Buy One, Get One Half Off' deal was just my excuse. My favorite flavor? Same as yours!",
    lovedByCharacterIds: [111, 112, 114, 115, 116, 117, 119, 123, 130, 133, 139, 141, 142, 143, 147, 158, 162],
    hatedByCharacterIds: [155],
    imageUrl: '/gifts/item_33073.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33073.webp',
  },
  {
    id: 'mystic-potion-kettle',
    name: 'Mystic Potion Kettle',
    itemId: 33083,
    rarity: 5,
    family: 'Ceramic',
    familyName: 'Ceramic & Potion',
    baseExp: 2000,
    description: 'This kettle pulses with enigmatic energy, robust enough to withstand harsh environments. Whether antidote or poison is up to the maker.',
    lovedByCharacterIds: [108, 110, 113, 117, 119, 125, 133, 134, 137, 139, 140, 144, 145, 150, 156, 159, 160],
    hatedByCharacterIds: [114, 141, 142],
    imageUrl: '/gifts/item_33083.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33083.webp',
  },
  {
    id: 'fiery-honeypot',
    name: 'Fiery Honeypot',
    itemId: 33013,
    rarity: 5,
    family: 'Flame',
    familyName: 'Flame & Candle',
    baseExp: 2000,
    description: 'Warm blazing honey sealed in an enchanted pot. Emits soothing warmth and the gentle aroma of roasted amber nectar.',
    lovedByCharacterIds: [108, 110, 112, 114, 120, 126, 127, 132, 143, 144, 149, 156, 162],
    hatedByCharacterIds: [125, 134, 137, 157],
    imageUrl: '/gifts/item_33013.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33013.webp',
  },
  {
    id: 'cosmic-form',
    name: 'Cosmic Form',
    itemId: 33063,
    rarity: 5,
    family: 'Astral',
    familyName: 'Astral & Celestial',
    baseExp: 2000,
    description: 'A miniature celestial sphere capturing the orbit of ancient constellations. Gazing inside feels like floating across the stars.',
    lovedByCharacterIds: [111, 113, 115, 123, 125, 126, 132, 134, 140, 155, 159, 162],
    hatedByCharacterIds: [135, 158],
    imageUrl: '/gifts/item_33063.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33063.webp',
  },
  {
    id: 'ultra-precision-photo-capturer',
    name: 'Ultra-Precision Photo Capturer',
    itemId: 33023,
    rarity: 5,
    family: 'Photo',
    familyName: 'Photo & Media',
    baseExp: 2000,
    description: 'Top-tier optical lens Artifact engineered to freeze transient moments into eternal memory discs with lifelike fidelity.',
    lovedByCharacterIds: [103, 115, 118, 132, 134, 135, 137, 141, 142, 156, 157, 159],
    hatedByCharacterIds: [133, 143],
    imageUrl: '/gifts/item_33023.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33023.webp',
  },
  {
    id: 'deluxe-blower',
    name: 'Deluxe Blower',
    itemId: 33033,
    rarity: 5,
    family: 'Wind',
    familyName: 'Wind & Mechanism',
    baseExp: 2000,
    description: 'Advanced aerofoil turbine spinning at blinding speeds. Blows away heavy dust and creates breezy refreshing drafts.',
    lovedByCharacterIds: [110, 116, 120, 125, 130, 135, 137, 139, 145, 155, 157, 158, 160],
    hatedByCharacterIds: [115, 132, 149, 159, 162],
    imageUrl: '/gifts/item_33033.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33033.webp',
  },
  {
    id: 'shining-star',
    name: 'Shining Star',
    itemId: 33053,
    rarity: 5,
    family: 'Star',
    familyName: 'Star & Stage',
    baseExp: 2000,
    description: 'A brilliant stage trophy awarded to top performers. Gleams with the dazzling aspirations of dreams fulfilled.',
    lovedByCharacterIds: [103, 107, 114, 135, 140, 141, 142, 145, 147, 149, 158],
    hatedByCharacterIds: [110, 119, 130, 139, 144],
    imageUrl: '/gifts/item_33053.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33053.webp',
  },

  // ==========================================
  // 4★ RARE GIFTS (RARE - BASE 500 EXP)
  // Loved: 750 EXP (+50%) • Hated: 400 EXP (-20%)
  // ==========================================
  {
    id: 'porcelain-cup',
    name: 'Blossom Porcelain Cup',
    itemId: 33082,
    rarity: 4,
    family: 'Ceramic',
    familyName: 'Ceramic & Potion',
    baseExp: 500,
    description: 'A treasured heirloom passed down through generations, delicately crafted with azure blossoms on pristine white glaze.',
    lovedByCharacterIds: [108, 110, 113, 117, 119, 125, 133, 134, 137, 139, 140, 144, 145, 150, 156, 159, 160],
    hatedByCharacterIds: [114, 141, 142],
    imageUrl: '/gifts/item_33082.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33082.webp',
  },
  {
    id: 'moonlit-companion',
    name: 'Moonlit Companion',
    itemId: 33062,
    rarity: 4,
    family: 'Astral',
    familyName: 'Astral & Celestial',
    baseExp: 500,
    description: 'Display a moon at home to keep you company. The mysterious ruler of the night, mirroring both the day and our souls.',
    lovedByCharacterIds: [111, 113, 115, 123, 125, 126, 132, 134, 140, 155, 159, 162],
    hatedByCharacterIds: [135, 158],
    imageUrl: '/gifts/item_33062.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33062.webp',
  },
  {
    id: 'blazing-wings',
    name: 'Blazing Wings',
    itemId: 33012,
    rarity: 4,
    family: 'Flame',
    familyName: 'Flame & Candle',
    baseExp: 500,
    description: 'Mechanical avian wings crafted from heat-tempered alloy. Radiant plumes flicker with fiery illumination.',
    lovedByCharacterIds: [108, 110, 112, 114, 120, 126, 127, 132, 143, 144, 149, 156, 162],
    hatedByCharacterIds: [125, 134, 137, 157],
    imageUrl: '/gifts/item_33012.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33012.webp',
  },
  {
    id: 'fragrant-ice-delight',
    name: 'Fragrant Ice Delight',
    itemId: 33072,
    rarity: 4,
    family: 'Dessert',
    familyName: 'Dessert & Ice',
    baseExp: 500,
    description: 'A chilled dessert bowl topped with sweet cream and seasonal berries. Melts delicately on the tongue.',
    lovedByCharacterIds: [111, 112, 114, 115, 116, 117, 119, 123, 130, 133, 139, 141, 142, 143, 147, 158, 162],
    hatedByCharacterIds: [155],
    imageUrl: '/gifts/item_33072.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33072.webp',
  },
  {
    id: 'reflective-photo-capturer',
    name: 'Reflective Photo Capturer',
    itemId: 33022,
    rarity: 4,
    family: 'Photo',
    familyName: 'Photo & Media',
    baseExp: 500,
    description: 'A precision handheld camera Artifact with twin reflex mirrors, favored by documentarians and guild scouts.',
    lovedByCharacterIds: [103, 115, 118, 132, 134, 135, 137, 141, 142, 156, 157, 159],
    hatedByCharacterIds: [133, 143],
    imageUrl: '/gifts/item_33022.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33022.webp',
  },
  {
    id: 'exquisite-blower',
    name: 'Exquisite Blower',
    itemId: 33032,
    rarity: 4,
    family: 'Wind',
    familyName: 'Wind & Mechanism',
    baseExp: 500,
    description: 'Compact mechanical turbine that generates gentle cooling breezes at the touch of a bronze toggle.',
    lovedByCharacterIds: [110, 116, 120, 125, 130, 135, 137, 139, 145, 155, 157, 158, 160],
    hatedByCharacterIds: [115, 132, 149, 159, 162],
    imageUrl: '/gifts/item_33032.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33032.webp',
  },
  {
    id: 'emerging-talent',
    name: 'Emerging Talent',
    itemId: 33052,
    rarity: 4,
    family: 'Star',
    familyName: 'Star & Stage',
    baseExp: 500,
    description: "A stylish emblem recognizing rising stage icons across Nova's broadcast arenas.",
    lovedByCharacterIds: [103, 107, 114, 135, 140, 141, 142, 145, 147, 149, 158],
    hatedByCharacterIds: [110, 119, 130, 139, 144],
    imageUrl: '/gifts/item_33052.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33052.webp',
  },

  // ==========================================
  // 3★ COMMON GIFTS (COMMON - BASE 150 EXP)
  // Loved: 225 EXP (+50%) • Hated: 120 EXP (-20%)
  // ==========================================
  {
    id: 'love-candle',
    name: 'Love Candle',
    itemId: 33011,
    rarity: 3,
    family: 'Flame',
    familyName: 'Flame & Candle',
    baseExp: 150,
    description: 'A sweet scented candle handcrafted with aromatic herbs. Fills the room with calming warmth and tranquil light.',
    lovedByCharacterIds: [108, 110, 112, 114, 120, 126, 127, 132, 143, 144, 149, 156, 162],
    hatedByCharacterIds: [125, 134, 137, 157],
    imageUrl: '/gifts/item_33011.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33011.webp',
  },
  {
    id: 'gilded-ceramic-bowl',
    name: 'Gilded Ceramic Bowl',
    itemId: 33081,
    rarity: 3,
    family: 'Ceramic',
    familyName: 'Ceramic & Potion',
    baseExp: 150,
    description: 'A sturdy ceramic bowl bordered with fine gold foil. Practical yet elegant for everyday soups and tea.',
    lovedByCharacterIds: [108, 110, 113, 117, 119, 125, 133, 134, 137, 139, 140, 144, 145, 150, 156, 159, 160],
    hatedByCharacterIds: [114, 141, 142],
    imageUrl: '/gifts/item_33081.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33081.webp',
  },
  {
    id: 'star-eclipse',
    name: 'Star Eclipse',
    itemId: 33061,
    rarity: 3,
    family: 'Astral',
    familyName: 'Astral & Celestial',
    baseExp: 150,
    description: 'Placing it beside your bed is said to summon stars into your dreams. A gentle nightlight for deep sleep.',
    lovedByCharacterIds: [111, 113, 115, 123, 125, 126, 132, 134, 140, 155, 159, 162],
    hatedByCharacterIds: [135, 158],
    imageUrl: '/gifts/item_33061.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33061.webp',
  },
  {
    id: 'chill-crushed-ice',
    name: 'Chill Crushed Ice',
    itemId: 33071,
    rarity: 3,
    family: 'Dessert',
    familyName: 'Dessert & Ice',
    baseExp: 150,
    description: 'Finely shaved glacial ice drizzled with sugary fruit syrup. The ultimate cooling treat after a long expedition.',
    lovedByCharacterIds: [111, 112, 114, 115, 116, 117, 119, 123, 130, 133, 139, 141, 142, 143, 147, 158, 162],
    hatedByCharacterIds: [155],
    imageUrl: '/gifts/item_33071.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33071.webp',
  },
  {
    id: 'card-capturer',
    name: 'Card Capturer',
    itemId: 33021,
    rarity: 3,
    family: 'Photo',
    familyName: 'Photo & Media',
    baseExp: 150,
    description: 'An early-model snapshot Artifact. Produces miniature photographic cards of cherished memories in seconds.',
    lovedByCharacterIds: [103, 115, 118, 132, 134, 135, 137, 141, 142, 156, 157, 159],
    hatedByCharacterIds: [133, 143],
    imageUrl: '/gifts/item_33021.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33021.webp',
  },
  {
    id: 'whisper-wind-spinner',
    name: 'Whisper Wind Spinner',
    itemId: 33041,
    rarity: 3,
    family: 'Wind',
    familyName: 'Wind & Mechanism',
    baseExp: 150,
    description: 'A whimsical hand-cranked pinwheel. Catches even the faintest draft to spin with a cheerful hum.',
    lovedByCharacterIds: [107, 112, 118, 119, 127, 130, 133, 143, 144, 149, 150, 155, 157, 160],
    hatedByCharacterIds: [140, 145, 156],
    imageUrl: '/gifts/item_33041.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33041.webp',
  },
  {
    id: 'rising-star',
    name: 'Rising Star',
    itemId: 33051,
    rarity: 3,
    family: 'Star',
    familyName: 'Star & Stage',
    baseExp: 150,
    description: 'A glittering brass badge pinned by aspiring apprentices taking their first steps onto the stage.',
    lovedByCharacterIds: [103, 107, 114, 135, 140, 141, 142, 145, 147, 149, 158],
    hatedByCharacterIds: [110, 119, 130, 139, 144],
    imageUrl: '/gifts/item_33051.webp',
    fallbackUrl: 'https://raw.githubusercontent.com/AutumnVN/ssassets/refs/heads/main/export/assets/assetbundles/icon/item/item_33051.webp',
  },
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
