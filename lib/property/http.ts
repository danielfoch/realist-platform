/** Only fixed, government/open-data providers are called. Never fetch a caller-supplied URL. */
const HOSTS = new Set(["geolocator.api.geo.ca", "data.calgary.ca", "data.winnipeg.ca", "data.edmonton.ca", "www.thedatazone.ca", "opendata.vancouver.ca", "ckan0.cf.opendata.inter.prod-toronto.ca", "gis.lsrca.on.ca", "services1.arcgis.com", "services.arcgis.com", "services6.arcgis.com", "services5.arcgis.com", "maps.london.ca", "maps.ottawa.ca", "map.oshawa.ca", "maps.durham.ca", "ww8.yorkmaps.ca", "utility.arcgis.com", "api.milton.ca", "mapping.burlington.ca", "maps.oakville.ca", "www.haltonhills.ca", "map.haltonhills.ca", "www.arcgis.com", "ws.lioservices.lrc.gov.on.ca", "api.cityofkingston.ca", "www.cityofkingston.ca", "www.cambridge.ca", "www.regionofwaterloo.ca", "gismaps.guelph.ca", "services9.arcgis.com", "niagaraopendata.ca", "www.ontario.ca", "data.ontario.ca", "files.ontario.ca", "arcgisweb.welland.ca", "mappmycity.ca", "opendata.citywindsor.ca", "gispublic.barrie.ca", "opengis.simcoe.ca", "maps.simcoe.ca", "www.barrie.ca", "maps1.brampton.ca", "services3.arcgis.com", "www.brantford.ca", "quintewest.maps.arcgis.com", "www.greatersudbury.ca", "www.thunderbay.ca", "www.sarnia.ca", "www.cornwall.ca", "www.orillia.ca", "services2.arcgis.com", "media-003-ca.cdn.govstack.com", "geohub.lio.gov.on.ca", "gis.grey.ca"]);
export async function fetchBytes(url: URL, timeoutMs = 8000, cacheSeconds = 3600, publisherFileRedirect?: { origin: string; pathname: string }): Promise<Uint8Array> {
  if (url.protocol !== "https:" || !HOSTS.has(url.hostname)) throw new Error("Unsupported provider");
  const options = {
    redirect: "error" as const,
    headers: { Accept: "application/json, text/csv, application/xml, text/xml, text/html, application/octet-stream", "User-Agent": "Homies property enrichment / Realist (hello@realist.ca)" },
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: cacheSeconds },
  };
  let response = await fetch(url, { ...options, redirect: publisherFileRedirect ? "manual" : "error" });
  if (publisherFileRedirect && response.status === 302) {
    const location = response.headers.get("location"); await response.body?.cancel();
    if (!location) throw new Error("Missing publisher file redirect");
    const target = new URL(location, url);
    // One exact publisher file path only; never follow arbitrary redirects or log signed queries.
    if (target.protocol !== "https:" || !HOSTS.has(target.hostname) || target.origin !== publisherFileRedirect.origin || target.pathname !== publisherFileRedirect.pathname || target.username || target.password || target.hash) throw new Error("Unsupported publisher file redirect");
    response = await fetch(target, options);
  }
  if (!response.ok || !response.body) throw new Error(`Source unavailable (HTTP ${response.status})`);
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
  return Buffer.concat(chunks);
}
export async function fetchText(url: URL, timeoutMs = 8000, cacheSeconds = 3600): Promise<string> { return new TextDecoder("utf-8", { fatal:true }).decode(await fetchBytes(url,timeoutMs,cacheSeconds)); }
export async function fetchJson(url: URL, timeoutMs = 8000, cacheSeconds = 3600): Promise<unknown> { return JSON.parse(await fetchText(url,timeoutMs,cacheSeconds)); }
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
