import { cityKey, civicStreetKey, hasUnit, layer, streetNumber, type Layer, type Location, type Row } from "./model";
import { loadSnapshot, type LoadedSnapshot } from "./snapshots";
import { OTTAWA_PERMIT_SOURCE, OTTAWA_LICENCE_POLICY } from "./ottawa-permit-sources";

const note = "Monthly permit-report observations from the selected 2024–2026 files, not complete property history or verified current permit status. A report may repeat a permit at multiple addresses or contain an older/cancelled/revised permit; preserve its description, reporting period and published issued date separately. Do not add values or unit figures across repeated permit/address observations. Dwelling-unit figures are reported work measures, not the property's legal unit count. Work values are CAD construction/demolition estimates, not property values. Work area units are explicit per record. Malformed published measures remain null with original text in unparsedMeasures. Unpublished communities, missing civic addresses and unit/lot-only addresses are excluded from property matching; blanks are never filled down. Contractor fields are excluded. Issuance does not prove final inspection, occupancy or unit legality. No-match does not prove absence.";
let cached: { vintage: string; index: Map<string, Row[]> } | undefined;
function matches(snapshot: LoadedSnapshot, address: string): Row[] {
  if (cached?.vintage !== snapshot.retrievedAt) {
    const index = new Map<string, Row[]>();
    for (const r of snapshot.records) {
      if (typeof r.address !== "string" || !r.community) continue;
      const lines = r.address.split("\n");
      if (!lines.every(a => streetNumber(a) && !hasUnit(a))) continue;
      for (const address of new Set(lines)) {
        const key = civicStreetKey(address.replace(/,\s*(?=(?:BOUL|BLVD|RD|ST|AVE)\b)/gi, " "));
        const list = index.get(key) ?? []; list.push(r); index.set(key, list);
      }
    }
    cached = { vintage: snapshot.retrievedAt, index };
  }
  return cached.index.get(civicStreetKey(address)) ?? [];
}
function result(snapshot: LoadedSnapshot | null, status: Layer["status"], data: unknown = null, extra = ""): Layer {
  const value = layer(status, data, OTTAWA_PERMIT_SOURCE, note + (snapshot ? ` Snapshot retrieved ${snapshot.retrievedAt.slice(0, 10)}; delivery: ${snapshot.delivery}.` : " Source snapshot unavailable.") + (snapshot && Date.now() - Date.parse(snapshot.retrievedAt) > 31 * 86_400_000 ? " Snapshot is over 31 days old; verify current source records." : "") + (extra ? " " + extra : ""), snapshot?.sourceUpdatedAt ?? null);
  value.retrievedAt = snapshot?.retrievedAt ?? null;
  return value;
}
export async function ottawaPermits(address: string | null, city: string | null, location: Location | null): Promise<Layer> {
  if (!address || !streetNumber(address) || hasUnit(address)) return result(null, "skipped", null, "A building civic address is required; unit-specific lookup is unsupported.");
  const snapshot = await loadSnapshot("ottawa-permits");
  if (!snapshot) return result(null, "unavailable");
  let all = matches(snapshot, address);
  const resolved = location?.provider === "ottawa:addresses" ? cityKey(location.municipalAddress?.community ?? "") : "";
  const requested = cityKey(city ?? "");
  const community = resolved || (requested !== "ottawa" ? requested : "");
  if (community) all = all.filter(r => cityKey(String(r.community)) === community);
  if (!community && new Set(all.map(r => cityKey(String(r.community)))).size > 1) return result(snapshot, "ambiguous", null, "This civic address appears in multiple former municipalities. Supply the community or use a verified municipal address match; no community was guessed.");
  all = [...all].sort((a, b) => String(b.reportingPeriodStart).localeCompare(String(a.reportingPeriodStart)) || String(b.publishedIssuedDate).localeCompare(String(a.publishedIssuedDate)) || String(a.OBJECTID).localeCompare(String(b.OBJECTID)));
  const value = result(snapshot, all.length ? "available" : "no_match", {
    records: all.slice(0, 50).map(r => { const { OBJECTID, ...fields } = r; return { recordId: OBJECTID, ...fields, sourceUrl: `https://open.ottawa.ca/documents/${r.sourceItemId}/about` }; }),
    matchMethod: "exact_normalized_civic_address", scope: "building_level", resolvedFormerMunicipality: community || null,
    matchedObservations: all.length, distinctMatchedPermitNumbers: new Set(all.map(r => r.permitNumber)).size,
    reportingPeriods: snapshot.reportingPeriods, sourceFiles: snapshot.sourceFiles,
    selectedReportFilesComplete: true, coverageComplete: false, historyBefore2024Searched: false, currentPermitStatusVerified: false, absenceEstablished: false,
  }, all.length ? "" : "No exact civic-address observation was returned by the selected report files.");
  value.truncated = all.length > 50;
  return value;
}
export async function ottawaPermitCoverage() {
  const snapshot = await loadSnapshot("ottawa-permits");
  return { layer: "permits", geography: "Ottawa, ON", source: OTTAWA_PERMIT_SOURCE, licencePolicyUrl: OTTAWA_LICENCE_POLICY, status: snapshot ? "loaded" : "unavailable", delivery: snapshot?.delivery ?? "unavailable", records: snapshot?.rowCount ?? null, retrievedAt: snapshot?.retrievedAt ?? null, sourceUpdatedAt: snapshot?.sourceUpdatedAt ?? null, reportingPeriods: snapshot?.reportingPeriods ?? [], sourceFiles: snapshot?.sourceFiles ?? [], missingAddressObservations: snapshot?.records.filter(r => !r.address).length ?? null, missingCommunityObservations: snapshot?.records.filter(r => !r.community).length ?? null, unparsedMeasureObservations: snapshot?.records.filter(r => Object.keys(r.unparsedMeasures as Row).length > 0).length ?? null, countMeaning: "Permit/address report observations, not distinct permits or properties.", refresh: "daily scheduled refresh with last-good retention; source reports are released monthly", coverageComplete: false, historyBefore2024Searched: false, note };
}
