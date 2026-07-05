import type { Request } from 'express';

const STATIC_PATH_PREFIXES = ['/assets/', '/icons/'];

const STATIC_EXACT_PATHS = new Set([
  '/sw.js',
  '/manifest.webmanifest',
  '/favicon.png',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
]);

const STATIC_EXT_RE = /\.(js|mjs|css|map|png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|webmanifest)$/i;

export function isStaticAssetRequest(req: Pick<Request, 'method' | 'path'>): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  const path = req.path;
  if (STATIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) return true;
  if (STATIC_EXACT_PATHS.has(path)) return true;

  return STATIC_EXT_RE.test(path);
}
