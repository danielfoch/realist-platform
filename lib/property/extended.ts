import { loadSnapshot, type LoadedSnapshot } from "./snapshots";
import { cityKey, civicStreetKey, layer, number, text, type Layer, type Location, type Row, type Source } from "./model";
import { provinceKey } from "./geocode";
import { haversineMeters } from "@/lib/geo/geometry";
import { isWithinToronto, mtm10ToLatLng } from "./ingest/torontoMtm";

export const TORONTO_HERITAGE: Source = { id: "toronto:heritage", name: "Toronto Heritage Register", url: "https://open.toronto.ca/dataset/heritage-register/", licence: "Open Government Licence – Toronto", attribution: "Contains information licensed under the Open Government Licence – Toronto. Source: City of Toronto." };
export const TORONTO_DEVELOPMENT: Source = { ...TORONTO_HERITAGE, id: "toronto:development", name: "Toronto development applications", url: "https://open.toronto.ca/dataset/development-applications/" };
export function publishedDate(v: unknown): string | null {
  const t = text(v); if (!t || !/^\d{8}$/.test(t)) return null;
  const value = `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
  const parsed = new Date(value); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null;
}
function dated(status: Layer["status"], data: unknown, source: Source, s: LoadedSnapshot, note: string) {
  const result = layer(status, data, source, `${note} Source release ${s.sourceRelease ?? "not labelled"}; snapshot ${s.retrievedAt}; ${s.delivery}.`, s.sourceUpdatedAt);
  result.retrievedAt = s.retrievedAt; return result;
}
export async function torontoHeritage(address: string | null, city: string | null, province: string | null): Promise<Layer> {
  if (cityKey(city ?? "") !== "toronto" || provinceKey(province ?? "") !== "ontario") return layer("not_supported", null, TORONTO_HERITAGE);
  if (!address) return layer("skipped", null, TORONTO_HERITAGE);
  const s = await loadSnapshot("toronto-heritage"); if (!s) return layer("unavailable", null, TORONTO_HERITAGE);
  const rows = s.records.filter(r => typeof r.ADDRESS === "string" && civicStreetKey(r.ADDRESS) === civicStreetKey(address));
  const result = dated(rows.length ? "available" : "no_match", { scope: "published_heritage_register", matchMethod: "exact_normalized_civic_address", records: rows.slice(0, 25).map(r => ({ recordId: String(r.OBJECTID), address: r.ADDRESS, publishedStatus: r.STATUS, statusMeaning: ({ PartIV: "individual_designation", PartV: "heritage_conservation_district_designation", Listed: "listed_non_designated" } as Record<string, string>)[String(r.STATUS).replace(/\s/g, "")] ?? "unknown", listedDate: publishedDate(r.LISTED), designatedDate: publishedDate(r.DESIGNATED), bylawNumber: text(r.BYLAW_NO), heritageConservationDistrict: text(r.HTG_CONSER), publishedConstructionYear: text(r.CONSTRUCTI), buildingType: text(r.BUILDING_T), description: text(r.DESCRIPTIO), publishedDemolitionYear: text(r.YEAR_DEMOL) })) }, TORONTO_HERITAGE, s, "Part IV, Part V and non-designated listings are distinct. This is the current published register snapshot, not a complete history of removals. Confirm current bylaws, district requirements and alteration permissions with the City; no match does not establish absence of heritage restrictions.");
  result.truncated = rows.length > 25; return result;
}
export function developmentStage(status: unknown): string {
  const value = String(status ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const stages: Record<string, string> = { appealreceived: "appealed", appealed: "appealed", closed: "closed", cancelled: "cancelled", withdrawn: "withdrawn", refused: "refused", rejected: "refused", approved: "approved", finalapprovalcomplete: "approved", conditionalapproval: "conditionally_approved", applicationreceived: "submitted", received: "submitted", underreview: "in_review", applicationunderreview: "in_review", noticeofapprovalconditions: "conditions_notice_issued", noacissued: "conditions_notice_issued", councilapproved: "approved", draftplanapproved: "draft_plan_approved", finalapprovalcompleted: "approved", circulated: "in_review", ombappeal: "appealed", ombapproved: "approved", ombpartiallyapproved: "partially_approved", ombrefused: "refused" };
  return stages[value] ?? "unknown";
}
export function nearbyApplications(records: Row[], lat: number, lng: number, now = new Date()) {
  const cutoff = new Date(now); cutoff.setUTCMonth(cutoff.getUTCMonth() - 36);
  const groups = new Map<string, { r: Row; distance: number; addresses: Set<string> }>();
  let ungeocodedRecords = 0;
  for (const r of records) {
    const x = number(r.X), y = number(r.Y); if (x === null || y === null) { ungeocodedRecords++; continue; }
    const point = mtm10ToLatLng(x, y); if (!isWithinToronto(point)) { ungeocodedRecords++; continue; }
    const distance = haversineMeters(lat, lng, point.lat, point.lng); if (distance > 800) continue;
    const stage = developmentStage(r.STATUS);
    const submitted = typeof r.DATE_SUBMITTED === "string" ? Date.parse(r.DATE_SUBMITTED) : NaN;
    // Known active stages survive the date window. Unknown stages survive too, rather than guessing inactivity.
    if (["closed", "cancelled", "withdrawn", "refused"].includes(stage) && Number.isFinite(submitted) && submitted < cutoff.getTime()) continue;
    const application = text(r["APPLICATION#"]); if (!application) continue;
    const address = [r.STREET_NUM, r.STREET_NAME, r.STREET_TYPE, r.STREET_DIRECTION].filter(v => v !== null && v !== undefined && String(v).trim()).join(" ");
    const group = groups.get(application);
    if (group) { group.addresses.add(address); if (distance < group.distance) { group.r = r; group.distance = distance; } }
    else groups.set(application, { r, distance, addresses: new Set([address]) });
  }
  const all = [...groups.entries()].sort((a, b) => a[1].distance - b[1].distance);
  return { radiusM: 800, inactiveHistoryWindowMonths: 36, olderNonClosedApplicationsIncluded: true, totalNearbyApplications: all.length, sourceRecordsWithoutUsableCoordinates: ungeocodedRecords, distanceBasis: "approximate source application-site point; straight-line distance, not lot-boundary distance", applications: all.slice(0, 25).map(([applicationNumber, { r, distance, addresses }]) => ({ applicationNumber, address: [r.STREET_NUM, r.STREET_NAME, r.STREET_TYPE, r.STREET_DIRECTION].filter(v => v !== null && v !== undefined && String(v).trim()).join(" "), nearbyAddresses: [...addresses], publishedStatus: text(r.STATUS), stage: developmentStage(r.STATUS), applicationType: text(r.APPLICATION_TYPE), description: text(r.DESCRIPTION), dateSubmitted: text(r.DATE_SUBMITTED), distanceM: Math.round(distance), applicationUrl: safeApplicationUrl(r.APPLICATION_URL) })) };
}
function safeApplicationUrl(v: unknown): string | null { try { const u = new URL(String(v)); return u.protocol === "https:" && ["www.toronto.ca", "secure.toronto.ca"].includes(u.hostname) ? u.href : null; } catch { return null; } }
export async function nearbyDevelopment(location: Location | null): Promise<Layer> {
  if (!location || location.latitude === null || location.longitude === null) return layer("skipped", null, TORONTO_DEVELOPMENT);
  if (cityKey(location.city ?? "") !== "toronto" || provinceKey(location.province ?? "") !== "ontario") return layer("not_supported", null, TORONTO_DEVELOPMENT);
  const s = await loadSnapshot("toronto-development"); if (!s) return layer("unavailable", null, TORONTO_DEVELOPMENT);
  const data = nearbyApplications(s.records, location.latitude, location.longitude);
  const result = dated(data.applications.length ? "available" : "no_match", data, TORONTO_DEVELOPMENT, s, "Nearby proposals are neighbourhood context, not approvals on this property. Closed is not completed or built; a non-closed status is not proof a proposal remains active. Unknown stages remain unknown. Distances use approximate reprojected application points; no unlocated proposal is inferred absent. Records sharing an application number are grouped by the nearest site.");
  result.truncated = data.totalNearbyApplications > 25; return result;
}
export async function extendedCoverage() {
  return Promise.all((["toronto-heritage", "toronto-development"] as const).map(async key => {
    const s = await loadSnapshot(key); return { layer: key === "toronto-heritage" ? "heritage" : "development", geography: "Toronto, ON", source: key === "toronto-heritage" ? TORONTO_HERITAGE : TORONTO_DEVELOPMENT, delivery: s?.delivery ?? "unavailable", status: s ? "loaded" : "unavailable", records: s?.rowCount ?? null, retrievedAt: s?.retrievedAt ?? null, sourceUpdatedAt: s?.sourceUpdatedAt ?? null, sourceRelease: s?.sourceRelease ?? null, refresh: "daily scheduled refresh; last good snapshot retained on failure" };
  }));
}
