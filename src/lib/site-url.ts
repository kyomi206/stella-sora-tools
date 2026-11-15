/**
 * Resolve the canonical production site URL for metadata, robots.txt, and sitemap.xml.
 * Uses NEXT_PUBLIC_SITE_URL if set, otherwise falls back to Vercel's production URL or kiyostella.vercel.app.
 */
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return 'https://kiyostella.vercel.app';
}
