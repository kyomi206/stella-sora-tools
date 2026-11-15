/**
 * Canonical mapping and URL generator for Stella Sora Trekker portraits and WikiTide illustrations.
 * Portraits are self-hosted locally under /trekkers/{id}.webp.
 */

export function getTrekkerImageUrl(characterId: number | string): string {
  return `/trekkers/${characterId}.webp`;
}

/**
 * Pure-JS MD5 implementation for computing MediaWiki/WikiTide file path hashes offline.
 */
export function md5Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLen = bytes.length * 8;
  const padLen = ((bytes.length + 8) >> 6) * 64 + 64;
  const buf = new Uint8Array(padLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(padLen - 8, bitLen >>> 0, true);
  view.setUint32(padLen - 4, Math.floor(bitLen / 0x100000000), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const s = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0;
  }

  for (let offset = 0; offset < padLen; offset += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = view.getUint32(offset + j * 4, true);
    }

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i++) {
      let F = 0;
      let g = 0;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }

      const temp = D;
      D = C;
      C = B;
      const sum = (A + F + K[i] + M[g]) >>> 0;
      B = (B + ((sum << s[i]) | (sum >>> (32 - s[i])))) >>> 0;
      A = temp;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const toHex = (n: number) =>
    [0, 8, 16, 24].map((shift) => ((n >>> shift) & 0xff).toString(16).padStart(2, '0')).join('');

  return `${toHex(a0)}${toHex(b0)}${toHex(c0)}${toHex(d0)}`;
}

/**
 * Resolves a WikiTide filename (e.g. "Chaton_a_02.png") to its direct static CDN URL.
 */
export function getWikiTideFileUrl(filename: string): string {
  const clean = filename.trim().replace(/ /g, '_');
  const hash = md5Hex(clean);
  return `https://static.wikitide.net/stellasorawiki/${hash[0]}/${hash.slice(0, 2)}/${encodeURIComponent(clean)}`;
}

/**
 * Formats a human-readable label for a Trekker illustration filename.
 */
export function formatIllustrationVariantLabel(filename: string, characterName?: string): string {
  let stem = filename.replace(/\.[^.]+$/, '').replace(/_02$/, '');
  if (characterName) {
    const normalizedPrefix = `${characterName.trim().replace(/ /g, '_')}_`;
    if (stem.toLowerCase().startsWith(normalizedPrefix.toLowerCase())) {
      stem = stem.slice(normalizedPrefix.length);
    }
  } else {
    const firstUnderscore = stem.indexOf('_');
    if (firstUnderscore !== -1) {
      stem = stem.slice(firstUnderscore + 1);
    }
  }

  if (/^[a-z]$/i.test(stem)) {
    return `Pose ${stem.toUpperCase()}`;
  }
  if (/^awakened$/i.test(stem)) {
    return 'Awakened';
  }
  if (/^skin(\d+)$/i.test(stem)) {
    return stem.replace(/^skin(\d+)$/i, 'Skin $1');
  }
  return stem
    .split('_')
    .filter(Boolean)
    .map((part) => (/^[a-z]$/i.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

/**
 * @deprecated Legacy WikiTide Trekker URL generator stub retained for unrouted trekker-detail-client.
 */
export function getWikiTideTrekkerUrl(_characterIdOrName?: number | string): string | null {
  return null;
}

