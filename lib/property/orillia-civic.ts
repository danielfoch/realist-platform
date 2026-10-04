import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { load } from "cheerio/slim";
import { z } from "zod";
import { fetchText } from "./http";
import { provinceKey } from "./geocode";
import { civicStreetKey, hasUnit, layer, streetNumber, type Layer, type PropertyRequest, type Source } from "./model";
import { orilliaMarket, orilliaMatchAddress, orilliaPolicyHash } from "./orillia";
import { ORILLIA_GUIDANCE, ORILLIA_POLICY, ORILLIA_POLICY_HASH } from "./orillia-sources";

export const ORILLIA_DECISION_HASH = "06237e08332041137238a68c5073046ccee7bfef1f90aae8e88b8da8efbe4124";
export const ORILLIA_CIVIC_SOURCES: Record<"heritage" | "decisions", Source> = {
  heritage: { id: "orillia:published-designated-table", name: "Orillia City website designated-property references", url: ORILLIA_GUIDANCE.heritage, licence: "City of Orillia website Content standards — public web-information distribution permission", licenceUrl: ORILLIA_POLICY, attribution: "Source: City of Orillia Municipal Heritage Committee web table. Selected factual references renamed by Homies / Realist; no City endorsement. Website permission does not extend to interactive GIS or third-party repositories." },
  decisions: { id: "orillia:selected-coa-decision-headers-2026", name: "Orillia selected 2026 Committee of Adjustment decision observations", url: ORILLIA_GUIDANCE.adjustment, licence: "City of Orillia website Content standards — public web-information distribution permission", licenceUrl: ORILLIA_POLICY, attribution: "Source: City of Orillia original Committee of Adjustment page and selected City decision PDFs. Selected factual headers renamed by Homies / Realist; no City endorsement. Website permission does not extend to interactive GIS or third-party repositories." },
};
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const headers = ["Property Name", "Location", "Designation By-law and Detail(s)"];
export function orilliaCivicAddress(raw: string): string | null {
  const a = clean(raw).replace(/\((North|South|East|West)\)$/i, "$1");
  if (/\band\b|[,&]|\d\s*[-–]\s*\d/i.test(a)) return null;
  return orilliaMatchAddress(a, false);
}
function cityPage(html: string, title: string) {
  const $ = load(html);
  if ($("#site-content").length !== 1 || $("#site-content h1").length !== 1 || clean($("#site-content h1").text()) !== title) throw Error("Orillia original City page changed");
  return $;
}
export function parseOrilliaHeritage(html: string) {
  const $ = cityPage(html, "Municipal Heritage Committee");
  const heading = $("#site-content h2").filter((_, e) => clean($(e).text()) === "Municipal Register of Designated Properties");
  if (heading.length !== 1) throw Error("Orillia original heritage table heading changed");
  const tables = heading.parent(".info").children(".text").find("table");
  if (tables.length !== 1) throw Error("Orillia original heritage table changed");
  const rows = tables.find("tr").toArray();
  if (rows.length < 2 || rows.length > 251 || JSON.stringify($(rows[0]).find("th,td").toArray().map(e => clean($(e).text()))) !== JSON.stringify(headers)) throw Error("Orillia heritage table schema changed");
  const records = rows.slice(1).map((r, i) => {
    const cells = $(r).find("td");
    if (cells.length !== 3 || cells.find("a,table,input,script,style").length) throw Error("Orillia heritage table cell changed");
    const [publishedPropertyName, publishedLocation, publishedDesignationBylaw] = cells.toArray().map(e => clean($(e).text()));
    if (!publishedPropertyName || publishedPropertyName.length > 240 || publishedLocation.length > 240 || !/^\d{4}-\d{1,5}(?:, as amended)?$/.test(publishedDesignationBylaw)) throw Error("Orillia heritage reference fields changed");
    const address = orilliaCivicAddress(publishedLocation);
    return { recordId: `web-row-${i + 1}`, publishedPropertyName, publishedLocation: publishedLocation || null, publishedDesignationBylaw, address, addressExcludedReason: address ? null : publishedLocation ? "multiple_or_incomplete_civic_address" : "no_published_civic_address", publishedSection: "Municipal Register of Designated Properties" };
  });
  if (new Set(records.map(r => JSON.stringify([r.publishedPropertyName, r.publishedLocation, r.publishedDesignationBylaw]))).size !== records.length) throw Error("Orillia heritage observations duplicated");
  return records;
}
function cityPDF(raw: string) {
  const u = new URL(raw);
  if (u.protocol !== "https:" || u.hostname !== "media-001-ca.cdn.govstack.com" || !/^\/orilliarecreation-004-ca\/media\/[a-z0-9]+\/[a-z0-9-]+\.pdf$/.test(u.pathname) || u.hash || u.search || u.username || u.password) throw Error("Orillia original decision PDF binding changed");
  return u.href;
}
export function parseOrilliaDecisionOffers(html: string) {
  const $ = cityPage(html, "Committee of Adjustment");
  const offers: { fileNumber: string; caseLabel: string; context: string; url: string }[] = [];
  $("#site-content a").each((_, a) => {
    const label = clean($(a).text());
    const direct = /^([AB]\d{2}-\d{2}) - (.+)$/.test(label);
    if (!direct && label !== "Decision") return;
    const list = $(a).closest("ul"), caseLabel = direct ? label : clean(list.prev("p").text());
    const context = direct ? clean(list.prev("p").text()) : clean($(a).closest(".info").prev("p.tab").find("a").text());
    if (!/^([AB]\d{2}-\d{2}) - .+$/.test(caseLabel) || caseLabel.length > 300 || !context || context.length > 160 || !$(a).attr("href")) throw Error("Orillia complete decision label changed");
    offers.push({ fileNumber: caseLabel.split(" - ")[0], caseLabel, context, url: cityPDF($(a).attr("href")!) });
  });
  if (!offers.length || offers.length > 200 || new Set(offers.map(o => JSON.stringify(o))).size !== offers.length) throw Error("Orillia decision offer incomplete or duplicated");
  return offers;
}
const referenceSchema = z.object({ fileNumber: z.string().regex(/^[AB]\d{2}-\d{2}$/), caseLabel: z.string().min(1).max(300), context: z.string().min(1).max(160) }).strict();
const recordSchema = z.object({
  documentFileNumber: z.string().regex(/^[AB]\d{2}-26$/), documentPublishedAddress: z.string().min(1).max(240),
  publishedDecisionDate: z.string().min(1).max(40), publishedDecisionCalendarDate: z.string().regex(/^2026-\d{2}-\d{2}$/),
  publishedOutcome: z.enum(["Approved", "Approved with conditions", "Denied", "Deferred"]), sourcePage: z.literal(1), sourcePDFPages: z.number().int().min(1).max(30),
  sourceUrl: z.string().url(), sourceFileSha256: z.string().regex(/^[a-f0-9]{64}$/), sourceFileBytes: z.number().int().min(1).max(10_000_000), pageReferences: z.array(referenceSchema).min(1).max(3),
}).strict();
const snapshotSchema = z.object({ dataset: z.literal("orillia-selected-decision-headers"), parserVersion: z.literal("orillia-decision-header-v1"), retrievedAt: z.string().refine(s => Number.isFinite(Date.parse(s))), sourceUpdatedAt: z.null(), records: z.array(recordSchema).length(16) }).strict();
function pageAddress(label: string) { return clean(label.split(" - ")[1] ?? "").replace(/ \((?:Variance|Consent(?: - .*)?)\)$/, ""); }
export function validateOrilliaDecisions(raw: string) {
  if (createHash("sha256").update(raw).digest("hex") !== ORILLIA_DECISION_HASH) throw Error("Orillia reviewed decision snapshot changed");
  const s = snapshotSchema.parse(JSON.parse(raw));
  if (new Set(s.records.map(r => r.documentFileNumber)).size !== s.records.length || new Set(s.records.map(r => r.sourceUrl)).size !== s.records.length) throw Error("Orillia decision documents duplicated");
  for (const r of s.records) {
    cityPDF(r.sourceUrl);
    if (r.pageReferences.some(o => !o.caseLabel.startsWith(`${o.fileNumber} - `))) throw Error("Orillia original case label invalid");
  }
  return { ...s, records: s.records.map(r => {
    const address = orilliaCivicAddress(r.documentPublishedAddress);
    const conflicts = r.pageReferences.flatMap(o => [
      ...(o.fileNumber !== r.documentFileNumber ? ["page_file_number_differs_from_document"] : []),
      ...(orilliaCivicAddress(pageAddress(o.caseLabel)) && civicStreetKey(pageAddress(o.caseLabel)) !== civicStreetKey(r.documentPublishedAddress) ? ["page_address_differs_from_document"] : []),
    ]);
    return { ...r, recordId: r.documentFileNumber, documentType: r.documentFileNumber.startsWith("A") ? "minor_variance" : "consent", address, addressExcludedReason: address ? null : "multiple_or_incomplete_civic_address", sourceLabelConflicts: [...new Set(conflicts)], documentIdentityConflict: conflicts.length > 0 };
  }) };
}
let compiled: ReturnType<typeof validateOrilliaDecisions> | undefined;
async function snapshot() { return compiled ??= validateOrilliaDecisions(await readFile(join(process.cwd(), "lib/property/data/orillia-planning-decisions.json"), "utf8")); }
async function permission() {
  if (orilliaPolicyHash(await fetchText(new URL(ORILLIA_POLICY))) !== ORILLIA_POLICY_HASH) throw Error("Orillia full current website permission changed");
}
async function heritage() { await permission(); return parseOrilliaHeritage(await fetchText(new URL(ORILLIA_GUIDANCE.heritage))); }
async function decisions() {
  await permission();
  const s = await snapshot(), offered = parseOrilliaDecisionOffers(await fetchText(new URL(ORILLIA_GUIDANCE.adjustment)));
  const selected = s.records.flatMap(r => r.pageReferences.map(o => ({ ...o, url: r.sourceUrl })));
  if (!selected.every(o => offered.filter(f => JSON.stringify(f) === JSON.stringify(o)).length === 1)) throw Error("Orillia audited City decision binding changed");
  return { ...s, pendingDecisionReferences: offered.filter(o => !selected.some(f => JSON.stringify(f) === JSON.stringify(o))) };
}
const heritageNote = "Exact civic references from the City's published designated-property web table. The table has no published observation/update date; full current statutory register, listed properties, districts, designation/amending/repeal instruments and alteration obligations remain unverified. By-law numbers are references, not designation/effective dates. Blank/range/multiple addresses are excluded without guesses; no-match does not establish absence. Third-party register repositories and interactive GIS remain separate.";
const decisionNote = "Selected dated City decision-header observations from 16 original 2026 PDFs, not complete planning history. Outcomes are read from the checked decision field, not the page section, filename or application proposal. Preserve separate variance/consent records and source-label conflicts; never swap the City's links or add an omitted direction. Conditions, approved plans, compliance, registration, expiry, appeals and current operative permission are unverified. Multi-address documents are excluded without parcel allocation. No owners, agents, legal descriptions, signatures or source graphics are returned. Current PDF bytes are unverified; manual source/layout re-audit is required. No-match does not establish absence.";
export async function orilliaCivicLayers(input: PropertyRequest): Promise<Record<string, Layer>> {
  const parts = input.address?.split(",").map(s => s.trim()), city = input.city ?? parts?.[1] ?? null, province = input.province ?? parts?.[2] ?? "ON";
  if (!orilliaMarket(city, province)) return {};
  const address = parts?.[0], conflict = Boolean(parts?.[1] && !orilliaMarket(parts[1], "ON") || parts?.[2] && provinceKey(parts[2]) !== "ontario");
  const specs = [{ key: "orilliaDesignatedHeritageReference", kind: "heritage" as const, note: heritageNote }, { key: "orilliaDecisionObservations", kind: "decisions" as const, note: decisionNote }];
  if (!address || !streetNumber(address) || hasUnit(address) || !orilliaCivicAddress(address) || conflict) return Object.fromEntries(specs.map(v => [v.key, layer(conflict ? "ambiguous" : "skipped", null, ORILLIA_CIVIC_SOURCES[v.kind], "A consistent complete Orillia/Ontario building civic address is required; no unit, coordinate-only or conflicting-identity assignment.")]));
  return Object.fromEntries(await Promise.all(specs.map(async spec => {
    try {
      const common = { scope: "building_civic_reference", coverageComplete: false, absenceEstablished: false, sourcePointGeometryReused: false, legalUnitsVerified: false, currentOperativePermissionVerified: false };
      if (spec.kind === "heritage") {
        const all = await heritage(), matched = all.filter(r => r.address && civicStreetKey(r.address) === civicStreetKey(address));
        const v = layer(matched.length ? "available" : "no_match", { ...common, records: matched.slice(0, 50), matchedObservations: matched.length, delivery: "bounded_live_city_web_table", observedTableRows: all.length, excludedAddressObservations: all.filter(r => !r.address).length, sourceObservationDate: null, fullStatutoryRegisterVerified: false, designationInstrumentsVerified: false, referenceRowIdsStable: false }, ORILLIA_CIVIC_SOURCES.heritage, spec.note);
        v.truncated = matched.length > 50; return [spec.key, v];
      }
      const s = await decisions(), matched = s.records.filter(r => r.address && civicStreetKey(r.address) === civicStreetKey(address) || r.documentIdentityConflict && r.pageReferences.some(o => orilliaCivicAddress(pageAddress(o.caseLabel)) && civicStreetKey(pageAddress(o.caseLabel)) === civicStreetKey(address)));
      const ambiguous = matched.some(r => r.documentIdentityConflict);
      const v = layer(ambiguous ? "ambiguous" : matched.length ? "available" : "no_match", { ...common, records: matched.slice(0, 50), matchedObservations: matched.length, documentIdentityResolved: !ambiguous, delivery: "reviewed_compiled_decision_headers", selectedPDFDocuments: s.records.length, excludedMultiAddressDocuments: s.records.filter(r => !r.address).length, sourceLabelConflictDocuments: s.records.filter(r => r.documentIdentityConflict).length, pendingDecisionReferences: s.pendingDecisionReferences, currentPDFBytesVerified: false, conditionsSatisfiedVerified: false, consentRegistrationVerified: false, expiryVerified: false, appealOutcomesVerified: false, completePlanningHistorySearched: false, refresh: "Manual original-source and PDF-layout re-audit required; no automatic refresh configured." }, ORILLIA_CIVIC_SOURCES.decisions, spec.note);
      v.retrievedAt = s.retrievedAt; v.truncated = matched.length > 50; return [spec.key, v];
    } catch { return [spec.key, layer("unavailable", null, ORILLIA_CIVIC_SOURCES[spec.kind], spec.note + " Current permission, original source binding, schema or reviewed asset could not be verified; records and counts are withheld.")]; }
  })));
}
export async function orilliaCivicCoverage() {
  const datasets = await Promise.all((["heritage", "decisions"] as const).map(async kind => {
    try {
      const rows = kind === "heritage" ? await heritage() : (await decisions()).records;
      return { market: "Orillia", layer: kind === "heritage" ? "orilliaDesignatedHeritageReference" : "orilliaDecisionObservations", source: ORILLIA_CIVIC_SOURCES[kind], status: "verified", records: rows.length, matchableAddressObservations: rows.filter(r => r.address).length, sourceUpdatedAt: null, countMeaning: kind === "heritage" ? "Published web-table rows; not a verified complete statutory register." : "Sixteen selected decision PDF header observations; not case-link observations or complete planning history.", note: kind === "heritage" ? heritageNote : decisionNote };
    } catch { return { market: "Orillia", layer: kind === "heritage" ? "orilliaDesignatedHeritageReference" : "orilliaDecisionObservations", source: ORILLIA_CIVIC_SOURCES[kind], status: "unavailable", records: null, sourceUpdatedAt: null, note: "Current permission, original source binding, schema or reviewed asset could not be verified." }; }
  }));
  return { cities: ["Orillia"], complete: false, datasets, cacheSeconds: 3600, currentLegalPermissionVerified: false, note: "Separate City web-table references and dated reviewed decision headers. The six-month decision-page scope is not complete history; native Homies reports retain conflicts and request current full instruments." };
}
