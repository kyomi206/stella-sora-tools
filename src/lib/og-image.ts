import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT_PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const ALLOWED_SSASSETS_PREFIX = 'https://raw.githubusercontent.com/AutumnVN/ssassets/';
const REMOTE_FETCH_TIMEOUT_MS = 3500;
const MAX_REMOTE_IMAGE_BYTES = 5 * 1024 * 1024;

async function convertBufferToPngDataUrl(
  buf: Buffer,
  width: number,
  height: number = width,
  options?: { trim?: boolean }
): Promise<string> {
  let pipeline = sharp(buf);
  if (options?.trim) {
    pipeline = pipeline.trim({ threshold: 10 });
  }
  const pngBuffer = await pipeline
    .resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();

  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}

/**
 * Safely converts a local image under `public/` (e.g. `trekkers/137.webp`)
 * into an inline PNG data URL compatible with Satori (`next/og`).
 */
export async function localWebpToPngDataUrl(
  publicRelPath: string,
  width: number = 256,
  height: number = width,
  options?: { trim?: boolean }
): Promise<string | null> {
  const cleaned = String(publicRelPath || '').trim().replace(/^[/\\]+/, '');
  if (
    !cleaned ||
    cleaned.includes('\0') ||
    cleaned.includes('\\') ||
    path.isAbsolute(cleaned)
  ) {
    return null;
  }

  const resolved = path.resolve(ROOT_PUBLIC_DIR, cleaned);
  if (!resolved.startsWith(ROOT_PUBLIC_DIR + path.sep)) {
    return null;
  }

  try {
    const fileBuf = await fs.readFile(resolved);
    return await convertBufferToPngDataUrl(fileBuf, width, height, options);
  } catch {
    return null;
  }
}

/**
 * Safely fetches an allowlisted `AutumnVN/ssassets` `.webp` asset with a strict
 * SSRF guard and 3.5s timeout, returning a PNG data URL or `null` on failure.
 */
export async function remoteWebpToPngDataUrl(
  rawUrl: string,
  width: number = 320,
  height: number = width
): Promise<string | null> {
  const urlStr = String(rawUrl || '').trim();
  if (!urlStr.startsWith(ALLOWED_SSASSETS_PREFIX)) {
    return null;
  }

  let parsed: URL;
  let decodedPath: string;
  try {
    parsed = new URL(urlStr);
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'raw.githubusercontent.com' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !parsed.pathname.startsWith('/AutumnVN/ssassets/') ||
    !decodedPath.startsWith('/AutumnVN/ssassets/') ||
    decodedPath.includes('..') ||
    decodedPath.includes('\\') ||
    decodedPath.includes('\0')
  ) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: 'error',
    });
    if (!res.ok) return null;
    const contentLength = Number(res.headers.get('content-length') || '0');
    if (contentLength > MAX_REMOTE_IMAGE_BYTES) return null;
    const arrayBuf = await res.arrayBuffer();
    if (!arrayBuf.byteLength || arrayBuf.byteLength > MAX_REMOTE_IMAGE_BYTES) return null;
    return await convertBufferToPngDataUrl(Buffer.from(arrayBuf), width, height);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
