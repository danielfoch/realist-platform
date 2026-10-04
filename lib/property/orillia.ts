import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { load } from "cheerio/slim";
import { z } from "zod";
import { fetchText } from "./http";
import { provinceKey } from "./geocode";
import { civicStreetKey, cityKey, hasUnit, layer, streetNumber, type Layer, type PropertyRequest } from "./model";
import { ORILLIA_FILES, ORILLIA_GUIDANCE, ORILLIA_OFFER, ORILLIA_POLICY, ORILLIA_POLICY_HASH, ORILLIA_REPORT_SOURCES, ORILLIA_SNAPSHOT_HASH, ORILLIA_WITHHELD } from "./orillia-sources";

type Kind = "permits" | "inspections";
const kinds: Kind[] = ["permits", "inspections"];
const keys = { permits: "orilliaPermitObservations", inspections: "orilliaInspectionObservations" };
const nullable = z.string().min(1).max(300).nullable();
const common = {
  recordId: z.string().regex(/^202[456]-\d{2}:\d+:\d+$/), reportingPeriod: z.string().regex(/^202[456]-\d{2}$/), sourcePage: z.number().int().min(1).max(30),
  permitNumber: z.string().regex(/^PRM-\d{4}-\d{4}$/), publishedAddress: nullable, address: nullable,
  addressExcludedReason: z.enum(["column_edge_or_clipped", "missing_or_non_civic_address", "unit_or_civic_range", "incomplete_or_unsupported_street_suffix"]).nullable(),
  possiblyClippedFields: z.array(z.enum(["publishedAddress", "publishedPermitClass", "publishedConstructionType", "publishedPermitType", "publishedWorkMeasure", "publishedOBCClass"])).max(6),
  publishedPermitType: nullable, publishedIssuedDate: nullable, publishedIssuedCalendarDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
};
const permitSchema = z.object({ ...common, publishedPermitClass: nullable, publishedConstructionType: nullable, publishedStatus: nullable, publishedProjectValue: nullable, publishedWorkMeasure: nullable, publishedOBCClass: nullable }).strict();
const inspectionSchema = z.object({ ...common, inspectionNumber: z.string().regex(/^INSP-\d+$/), publishedInspectionDate: nullable, publishedSection: z.enum(["FINAL INSPECTIONS", "OCCUPANCY INSPECTIONS"]) }).strict();
const countSchema = z.object({ permits: z.number().int().min(0).max(500), inspections: z.number().int().min(0).max(500) }).strict();
const snapshotSchema = z.object({
  dataset: z.literal("orillia-monthly-reports"), parserVersion: z.literal("orillia-columns-v1"), retrievedAt: z.string().refine(v => Number.isFinite(Date.parse(v))), sourceUpdatedAt: z.null(),
  reportingPeriods: z.array(z.string()).length(30), sourceFiles: z.array(z.object({ period: z.string(), url: z.string(), sha256: z.string(), bytes: z.number().int(), rows: countSchema, excludedAddressRows: countSchema }).strict()).length(30),
  permits: z.array(permitSchema).min(1).max(10_000), inspections: z.array(inspectionSchema).min(1).max(10_000),
}).strict();
type Snapshot = z.infer<typeof snapshotSchema>;

export const orilliaMarket = (city: string | null, province: string | null) => cityKey(city ?? "") === "orillia" && provinceKey(province ?? "") === "ontario";
export function orilliaMatchAddress(raw: string | null, clipped: boolean): string | null {
  if (!raw || clipped) return null;
  const a = raw.replace(/,\s*Orillia,\s*(?:ON|Ontario),\s*Canada$/i, "");
  if (!/^\d+[a-z]? [a-z][a-z0-9 .'’&-]*$/i.test(a) || hasUnit(a)) return null;
  return /\b(?:ST|STREET|AVE|AVENUE|RD|ROAD|DR|DRIVE|BLVD|BOULEVARD|CRES|CRESCENT|CRT|CT|COURT|LANE|LN|PL|PLACE|WAY|TRAIL|PKY|PKWY|PARKWAY|LINE|SIDEROAD|HTS|HEIGHTS|COVE)\.?(?: (?:N|S|E|W|NORTH|SOUTH|EAST|WEST))?$/i.test(a) ? a : null;
}
export function validateOrilliaSnapshot(raw: string): Snapshot {
  if (createHash("sha256").update(raw).digest("hex") !== ORILLIA_SNAPSHOT_HASH) throw Error("Orillia audited immutable snapshot changed");
  const s = snapshotSchema.parse(JSON.parse(raw));
  if (JSON.stringify(s.reportingPeriods) !== JSON.stringify(ORILLIA_FILES.map(f => f.period))) throw Error("Orillia selected periods changed");
  for (const file of ORILLIA_FILES) {
    const candidates = s.sourceFiles.filter(f => f.period === file.period);
    if (candidates.length !== 1 || JSON.stringify(candidates[0]) !== JSON.stringify(file)) throw Error("Orillia selected file identity changed");
    for (const kind of kinds) {
      const records = s[kind].filter(r => r.reportingPeriod === file.period);
      if (records.length !== file.rows[kind] || records.filter(r => !r.address).length !== file.excludedAddressRows[kind]) throw Error("Orillia observation counts changed");
    }
  }
  for (const kind of kinds) {
    if (new Set(s[kind].map(r => r.recordId)).size !== s[kind].length) throw Error("Orillia observation identity duplicated");
    for (const r of s[kind]) if (!s.reportingPeriods.includes(r.reportingPeriod) || !r.recordId.startsWith(`${r.reportingPeriod}:${r.sourcePage}:`) || r.address !== orilliaMatchAddress(r.publishedAddress, r.possiblyClippedFields.includes("publishedAddress")) || Boolean(r.address) === Boolean(r.addressExcludedReason)) throw Error("Orillia civic observation invalid");
  }
  return s;
}
let asset: Promise<Snapshot> | undefined;
function snapshot() { return asset ??= readFile(join(process.cwd(), "lib/property/data/orillia-monthly-reports.json"), "utf8").then(validateOrilliaSnapshot); }

export function orilliaPolicyHash(html: string): string {
  const $ = load(html), regions = $("#site-content .text").filter((_, e) => $(e).find("h2").toArray().some(h => $(h).text().trim() === "Content standards"));
  if ($("#site-content h1").length !== 1 || $("#site-content h1").text().trim() !== "Privacy" || regions.length !== 1) throw Error("Orillia complete City policy region changed");
  const region = regions.clone(); region.find("script,style").remove();
  return createHash("sha256").update(JSON.stringify({ text: region.text().replace(/\s+/g, " ").trim(), links: region.find("a").toArray().map(a => $(a).attr("href") ?? "") })).digest("hex");
}
export function orilliaReportOffer(html: string): { period: string; url: string }[] {
  const $ = load(html), months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], files: { period: string; url: string }[] = [];
  if ($("#site-content h1").length !== 1 || $("#site-content h1").text().trim() !== "Permits and Inspections") throw Error("Orillia original report offer changed");
  const headings = $("#site-content p.heading").filter((_, e) => /^\d{4} Permit Reports$/.test($(e).text().trim()));
  if (headings.length < 3 || headings.length > 10) throw Error("Orillia report offer incomplete");
  headings.each((_, h) => {
    const year = Number($(h).text().slice(0, 4));
    $(h).parent(".info").find("a").each((_, a) => {
      const month = months.indexOf($(a).text().trim()), href = $(a).attr("href");
      if (month < 0 || !href) throw Error("Orillia original month binding changed");
      const u = new URL(href);
      if (u.protocol !== "https:" || u.hostname !== "media-001-ca.cdn.govstack.com" || !/^\/orilliarecreation-004-ca\/media\/[a-z0-9]+\/[a-z0-9-]+\.pdf$/.test(u.pathname) || u.search || u.hash || u.username || u.password) throw Error("Orillia City publisher path changed");
      files.push({ period: `${year}-${String(month + 1).padStart(2, "0")}`, url: u.href });
    });
  });
  if (new Set(files.map(f => f.period)).size !== files.length || !ORILLIA_FILES.every(f => files.filter(x => x.period === f.period && x.url === f.url).length === 1)) throw Error("Orillia selected City report offer changed");
  return files;
}
async function read() {
  const [policy, offer, s] = await Promise.all([fetchText(new URL(ORILLIA_POLICY)), fetchText(new URL(ORILLIA_OFFER)), snapshot()]);
  if (orilliaPolicyHash(policy) !== ORILLIA_POLICY_HASH) throw Error("Orillia full current permission changed");
  const offered = orilliaReportOffer(offer);
  return { s, pendingReportingPeriods: offered.filter(f => !s.reportingPeriods.includes(f.period)).map(f => f.period).sort() };
}
const note = "Selected monthly City report observations, not complete property history. Reporting month and published issue/inspection date are separate; raw timestamps have no verified timezone. Column-edge or incomplete civic addresses, civic ranges and units are excluded without guessing or filling blanks down. Possibly clipped labels/measures remain raw, not expanded or converted; old ft/m labels are not recast as area. Construction values are published dollar work values, not property valuation, and repeated observations must not be added. FINAL INSPECTIONS and OCCUPANCY INSPECTIONS are publisher list headings, not passed outcomes, occupancy certificates or legal unit counts. No owners, contractors, roll/assessment identifiers or source graphics are redistributed. The source bytes were audited at snapshot retrieval; current PDF bytes/status/results and full history are unverified. No-match does not establish absence.";
function gap(): Layer {
  const v = layer("unavailable", { coverageComplete: false, propertyFilesQueried: false, interactiveCityGISQueried: false, gaps: ORILLIA_WITHHELD, guidance: ORILLIA_GUIDANCE }, null, "City monthly observations are separate from current complete property files and interactive GIS rights. Request current instruments, decisions, unit identity, inspection outcomes and occupancy through the appropriate authorized municipal process.");
  return v;
}
export async function orilliaLayers(input: PropertyRequest): Promise<Record<string, Layer>> {
  const parts = input.address?.split(",").map(x => x.trim()), city = input.city ?? parts?.[1] ?? null, province = input.province ?? parts?.[2] ?? "ON";
  if (!orilliaMarket(city, province)) return {};
  const address = parts?.[0] ?? null;
  const identityConflict = Boolean(parts?.[1] && !orilliaMarket(parts[1], "ON") || parts?.[2] && provinceKey(parts[2]) !== "ontario");
  const result: Record<string, Layer> = { orilliaPropertyFiles: gap() };
  if (!address || !streetNumber(address) || hasUnit(address) || identityConflict) {
    for (const kind of kinds) result[keys[kind]] = layer(identityConflict ? "ambiguous" : "skipped", null, ORILLIA_REPORT_SOURCES[kind], "A consistent Orillia building civic address is required. Coordinate-only, unit-specific and conflicting-identity lookups do not select report observations.");
    return result;
  }
  try {
    const { s, pendingReportingPeriods } = await read();
    for (const kind of kinds) {
      const all = s[kind].filter(r => r.address && civicStreetKey(r.address) === civicStreetKey(address)).sort((a, b) => b.reportingPeriod.localeCompare(a.reportingPeriod) || (b.publishedIssuedCalendarDate ?? "").localeCompare(a.publishedIssuedCalendarDate ?? "") || a.recordId.localeCompare(b.recordId));
      const records = all.slice(0, 50).map(r => { const f = ORILLIA_FILES.find(f => f.period === r.reportingPeriod)!; return { ...r, sourceUrl: f.url, sourceFileSha256: f.sha256 }; });
      const v = layer(all.length ? "available" : "no_match", {
        records, matchedObservations: all.length, distinctMatchedPermitNumbers: new Set(all.map(r => r.permitNumber)).size,
        ...(kind === "inspections" ? { distinctMatchedInspectionNumbers: new Set(all.map(r => "inspectionNumber" in r ? r.inspectionNumber : null)).size } : {}),
        scope: "building_level", matchMethod: "exact_normalized_published_civic_address", reportingPeriods: s.reportingPeriods, pendingReportingPeriods,
        delivery: "reviewed_compiled_snapshot", refresh: "Manual source and PDF-layout re-audit required; no automatic refresh is configured.", sourceFiles: s.sourceFiles,
        selectedReportObservationsComplete: true, selectedFiles: s.sourceFiles.length, excludedAddressObservations: s[kind].filter(r => !r.address).length,
        coverageComplete: false, historyBeforeMarch2024Searched: false, unlinkedJanuaryFebruary2024Searched: false, currentPDFBytesVerified: false,
        currentPermitStatusVerified: false, inspectionOutcomeVerified: false, occupancyPermissionVerified: false, legalUnitsVerified: false, absenceEstablished: false, sourcePointGeometryReused: false,
      }, ORILLIA_REPORT_SOURCES[kind], note);
      v.retrievedAt = s.retrievedAt; v.truncated = all.length > 50; result[keys[kind]] = v;
    }
  } catch {
    for (const kind of kinds) result[keys[kind]] = layer("unavailable", null, ORILLIA_REPORT_SOURCES[kind], note + " Current complete City permission, original monthly offer or immutable snapshot validation failed; no stored observations are returned.");
  }
  return result;
}
export async function orilliaCoverage() {
  let current: Awaited<ReturnType<typeof read>> | null = null;
  try { current = await read(); } catch { /* Do not publish snapshot counts after a rights/lineage failure. */ }
  return {
    cities: ["Orillia"], delivery: "reviewed_compiled_snapshot", complete: false,
    datasets: kinds.map(kind => ({ market: "Orillia", layer: keys[kind], source: ORILLIA_REPORT_SOURCES[kind], status: current ? "verified" : "unavailable", records: current?.s[kind].length ?? null, matchableAddressObservations: current?.s[kind].filter(r => r.address).length ?? null, excludedAddressObservations: current?.s[kind].filter(r => !r.address).length ?? null, retrievedAt: current?.s.retrievedAt ?? null, sourceUpdatedAt: null, countMeaning: "Selected detailed report observations, not distinct permits, inspections or properties; cover/aggregate tables are excluded.", note })),
    sourceFiles: current?.s.sourceFiles ?? [], reportingPeriods: current?.s.reportingPeriods ?? [], pendingReportingPeriods: current?.pendingReportingPeriods ?? [],
    sourceFileCountMeaning: "Thirty monthly PDFs supply two observation layers; they are not thirty separate feeds or a complete permit/inspection archive.",
    currentPDFBytesVerified: false, refresh: "Manual source and PDF-layout re-audit required; no automatic refresh is configured.", gaps: ORILLIA_WITHHELD,
  };
}
