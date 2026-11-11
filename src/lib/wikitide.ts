/**
 * Canonical mapping and URL generators for Stella Sora Trekker portraits.
 * Portraits are self-hosted locally under /trekkers/{id}.webp.
 */

export function getTrekkerImageUrl(characterId: number | string): string {
  return `/trekkers/${characterId}.webp`;
}

/**
 * @deprecated Legacy WikiTide Trekker URL generator stub retained for unrouted trekker-detail-client.
 */
export function getWikiTideTrekkerUrl(_characterIdOrName?: number | string): string | null {
  return null;
}
