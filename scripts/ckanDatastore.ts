/**
 * Toronto CKAN Datastore API helper — shared by the Tier-1 importers.
 *
 * The open-data portal exposes each dataset's rows via
 *   GET /api/3/action/datastore_search?resource_id=..&limit=..&offset=..
 * Geometry (where present) arrives as a GeoJSON *string* in the `geometry`
 * field, which we JSON.parse. This paginates with a constant-memory callback
 * so a 600k-row parcel file never lands in memory at once.
 */

const CKAN_BASE = process.env.TORONTO_CKAN_BASE
  || "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action";

export type CkanRecord = Record<string, unknown>;

/** Resolve a package's first datastore-active resource id (or a named one). */
export async function resolveResourceId(packageId: string, resourceName?: string): Promise<string | null> {
  const resp = await fetch(`${CKAN_BASE}/package_show?id=${encodeURIComponent(packageId)}`, {
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) throw new Error(`package_show ${packageId} HTTP ${resp.status}`);
  const data = (await resp.json()) as { success?: boolean; result?: { resources?: Array<Record<string, any>> }; error?: unknown };
  if (data.success === false || !data.result) {
    throw new Error(`package_show ${packageId} CKAN error: ${JSON.stringify(data.error ?? "no result")}`);
  }
  const resources = data.result.resources ?? [];
  if (resourceName) {
    const named = resources.find((r) => r.name === resourceName);
    if (named) return named.id as string;
  }
  const active = resources.find((r) => r.datastore_active === true);
  return active ? (active.id as string) : null;
}

/**
 * Page through every record of a datastore resource, invoking `onBatch` per
 * page. Returns the total rows seen. `filters` maps to CKAN's filters= param.
 */
export async function eachDatastoreBatch(
  resourceId: string,
  onBatch: (records: CkanRecord[]) => Promise<void>,
  opts: { pageSize?: number; filters?: Record<string, string>; fields?: string[] } = {},
): Promise<number> {
  const pageSize = opts.pageSize ?? 5000;
  let offset = 0;
  let total = 0;
  for (;;) {
    const params = new URLSearchParams({
      resource_id: resourceId,
      limit: String(pageSize),
      offset: String(offset),
      // Stable ordering on the auto-generated _id column: without it CKAN's
      // offset paging has undefined order across pages, which can silently skip
      // or double-count rows.
      sort: "_id",
    });
    if (opts.filters) params.set("filters", JSON.stringify(opts.filters));
    if (opts.fields) params.set("fields", opts.fields.join(","));
    const resp = await fetch(`${CKAN_BASE}/datastore_search?${params}`, {
      signal: AbortSignal.timeout(60000),
    });
    if (!resp.ok) throw new Error(`datastore_search HTTP ${resp.status} @ offset ${offset}`);
    // CKAN returns HTTP 200 with { success:false, error } on server-side errors;
    // treating that as an empty result would silently truncate the import.
    const data = (await resp.json()) as { success?: boolean; result?: { records?: CkanRecord[] }; error?: unknown };
    if (data.success === false || !data.result) {
      throw new Error(`datastore_search CKAN error @ offset ${offset}: ${JSON.stringify(data.error ?? "no result")}`);
    }
    const records = data.result.records ?? [];
    if (!records.length) break;
    await onBatch(records);
    total += records.length;
    offset += records.length;
    if (records.length < pageSize) break;
  }
  return total;
}

/** Parse a CKAN `geometry` field (GeoJSON string or object) → object or null. */
export function parseCkanGeometry(value: unknown): any | null {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

/** Stream a (possibly large) GeoJSON FeatureCollection file resource. */
export async function fetchGeoJsonFile(url: string): Promise<{ features: any[] }> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!resp.ok) throw new Error(`GeoJSON file HTTP ${resp.status}`);
  return (await resp.json()) as { features: any[] };
}
