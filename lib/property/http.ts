/** Only fixed, government/open-data providers are called. Never fetch a caller-supplied URL. */
const HOSTS = new Set(["geolocator.api.geo.ca", "data.calgary.ca", "data.winnipeg.ca", "data.edmonton.ca", "www.thedatazone.ca", "opendata.vancouver.ca", "ckan0.cf.opendata.inter.prod-toronto.ca", "gis.lsrca.on.ca", "services1.arcgis.com", "services.arcgis.com", "services6.arcgis.com", "services5.arcgis.com", "maps.london.ca", "maps.ottawa.ca", "map.oshawa.ca", "maps.durham.ca", "ww8.yorkmaps.ca", "utility.arcgis.com", "api.milton.ca", "mapping.burlington.ca", "maps.oakville.ca", "www.haltonhills.ca", "map.haltonhills.ca", "www.arcgis.com", "ws.lioservices.lrc.gov.on.ca"]);
export async function fetchText(url: URL, timeoutMs = 8000): Promise<string> {
  if (url.protocol !== "https:" || !HOSTS.has(url.hostname)) throw new Error("Unsupported provider");
  const response = await fetch(url, {
    redirect: "error",
    headers: { Accept: "application/json, text/csv, application/octet-stream", "User-Agent": "Homies property enrichment / Realist (hello@realist.ca)" },
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 3600 },
  });
  if (!response.ok || !response.body) throw new Error("Source unavailable");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1_000_000) throw new Error("Source response too large");
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return new TextDecoder("utf-8", { fatal:true }).decode(Buffer.concat(chunks));
}
export async function fetchJson(url: URL, timeoutMs = 8000): Promise<unknown> { return JSON.parse(await fetchText(url,timeoutMs)); }
export function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some(v => !v || typeof v !== "object" || Array.isArray(v))) throw new Error("Invalid source response");
  return value;
}
export const literal = (v: string): string => `'${v.replace(/'/g, "''")}'`;
export async function socrata(host: string, id: string, where: string, order?: string): Promise<Record<string, unknown>[]> {
  const url = new URL(`https://${host}/resource/${id}.json`);
  url.searchParams.set("$where", where);
  url.searchParams.set("$limit", "51");
  if (order) url.searchParams.set("$order", order);
  return rows(await fetchJson(url));
}
