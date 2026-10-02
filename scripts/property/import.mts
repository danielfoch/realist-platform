/** Open-data importer for the existing Realist Neon database.
 * Explicit --write is required. Checkpoints advance only after successful writes.
 * Never reads unrelated production credentials, deletes existing records, or exports owner data.
 */
import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import type { Readable } from "node:stream";
import { neon } from "@neondatabase/serverless";
import { importedAddressKey, number, text, cityKey, streetKey, type Row } from "../../lib/property/model";
import { mapAssessment, SOURCES } from "../../lib/property/municipal";
import { extractUnits, parseRollUnit } from "../../lib/property/ingest/quebec";
import { createCsvStreamParser } from "../../lib/property/ingest/csv";
import { bboxOfGeometry, type AreaGeometry } from "../../lib/geo/geometry";
import { parseParcelRow } from "../../lib/property/ingest/parcels";
import { mtm10ToLatLng, isWithinToronto } from "../../lib/property/ingest/torontoMtm";
import { physicalAttributes } from "../../lib/property/ingest/attributes";

const args = process.argv.slice(2);
const write = args.includes("--write");
const mode = args.find(a => !a.startsWith("--")) ?? "status";
const option = (name: string, fallback: string) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const cache = option("cache", "/private/tmp/realist-open-data");
const credential = option("database-url-file", "/private/tmp/realist-import-database-url");
const refresh = args.includes("--refresh");
let activeKey: string | null = null;
const connection = process.env.DATABASE_URL ?? (await fs.readFile(credential, "utf8")).trim();
const db = neon(connection);
const query = async (statement: string, params: unknown[] = []): Promise<Row[]> => {
  for (let attempt = 0; ; attempt++) {
    try { return await db.query(statement, params) as Row[]; }
    catch (error) { if (attempt >= 4) throw error; await new Promise(r => setTimeout(r, 500 * 2 ** attempt)); }
  }
};
const UA = "realist.ca public open-data importer (hello@realist.ca)";
async function fetchSource(url: string): Promise<Response> {
  const u = new URL(url);
  if (u.protocol !== "https:" || !["data.calgary.ca", "data.winnipeg.ca", "data.edmonton.ca", "www.thedatazone.ca", "gnb.socrata.com", "opendata.vancouver.ca", "donneesouvertes.affmunqc.net", "ckan0.cf.opendata.inter.prod-toronto.ca", "donnees.montreal.ca", "geo.statcan.gc.ca", "api.statcan.gc.ca", "www12.statcan.gc.ca", "www150.statcan.gc.ca"].includes(u.hostname)) throw new Error("Source outside approved public government hosts");
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" }, signal: AbortSignal.timeout(600_000) });
      if (!response.ok) throw new Error(`Source HTTP ${response.status}`);
      return response;
    } catch (error) { if (attempt >= 4) throw error; await new Promise(r => setTimeout(r, 1000 * 2 ** attempt)); }
  }
}
async function download(url: string, file: string): Promise<string> {
  await fs.mkdir(cache, { recursive: true });
  try { const manifest = JSON.parse(await fs.readFile(`${file}.manifest.json`, "utf8")); if (!refresh && manifest.url === url) { await fs.access(file); return manifest.sha256; } } catch { /* fresh download */ }
  const response = await fetchSource(url);
  if (!response.body) throw new Error("Empty source response");
  const out = await fs.open(`${file}.partial`, "w");
  const hash = createHash("sha256"); let bytes = 0;
  const reader = response.body.getReader();
  try { for (;;) { const next = await reader.read(); if (next.done) break; await out.write(next.value); hash.update(next.value); bytes += next.value.length; } } finally { reader.releaseLock(); await out.close(); }
  const sha256 = hash.digest("hex");
  await fs.rename(`${file}.partial`, file);
  await fs.writeFile(`${file}.manifest.json`, JSON.stringify({ url, bytes, sha256, downloadedAt: new Date().toISOString(), lastModified: response.headers.get("last-modified"), etag: response.headers.get("etag") }, null, 2));
  return sha256;
}
async function upsert(table: string, records: Row[], conflict: string[], columns: string[]) {
  if (!records.length) return;
  if (table === "assessment_units") records = records.map(r => ({ ...r, attributes: r.attributes ?? {} }));
  const unique = [...new Map(records.map(r => [conflict.map(k => String(r[k])).join("|"), r])).values()];
  const update = columns.filter(c => !conflict.includes(c)).map(c => `${c}=EXCLUDED.${c}`).join(",");
  await query(`INSERT INTO ${table} (${columns.join(",")}) SELECT ${columns.join(",")} FROM jsonb_populate_recordset(NULL::${table}, $1::jsonb) ON CONFLICT (${conflict.join(",")}) DO UPDATE SET ${update}, imported_at=now()`, [JSON.stringify(unique)]);
}
const assessmentColumns = ["source", "municipality_code", "municipality_name", "province", "roll_year", "matricule", "address", "loose_address_key", "lot_number", "cubf", "frontage_m", "lot_area_m2", "storeys", "year_built", "year_built_estimated", "floor_area_m2", "dwellings", "market_ref_date", "land_value", "building_value", "total_value", "previous_roll_value", "bedrooms", "bathrooms", "land_use", "lat", "lng", "source_updated_at", "attributes"];
const permitColumns = ["source", "permit_number", "city", "province", "address", "loose_address_key", "permit_type", "work_type", "status", "description", "units", "estimated_value", "issued_date", "lat", "lng"];
const iso = (v: unknown) => text(v)?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
async function register(key: string, table: string, source: { name: string; url: string; licence: string; attribution: string }, geography: string, count: number) {
  await query("INSERT INTO data_layers(key,name,source_url,licence,attribution,geography,refresh_cadence,last_imported_at,row_count,notes) VALUES($1,$2,$3,$4,$5,$6,$9,now(),$7,$8) ON CONFLICT(key) DO UPDATE SET name=EXCLUDED.name,source_url=EXCLUDED.source_url,licence=EXCLUDED.licence,attribution=EXCLUDED.attribution,geography=EXCLUDED.geography,refresh_cadence=EXCLUDED.refresh_cadence,last_imported_at=now(),row_count=EXCLUDED.row_count,notes=EXCLUDED.notes", [key, source.name, source.url, source.licence, source.attribution, geography, count, `Hosted in ${table}. Check property_import_runs for snapshot completeness; excludes owner/contact fields.`, key.startsWith("census_") ? "manual import on Census release" : key === "national_address_register" ? "manual import of quarterly release" : "manual refresh; source cadence varies"]);
}
async function checkpoint(key: string, status: string, processed: number, rejected: number, cursor: Row, expected: number | null = null, sourceUpdatedAt: string | null = null, error: string | null = null) {
  activeKey = key;
  await query("INSERT INTO property_import_runs(key,status,processed_rows,rejected_rows,cursor,expected_rows,source_updated_at,error,completed_at) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,CASE WHEN $2='complete' THEN now() ELSE NULL END) ON CONFLICT(key) DO UPDATE SET status=EXCLUDED.status,processed_rows=EXCLUDED.processed_rows,rejected_rows=EXCLUDED.rejected_rows,cursor=EXCLUDED.cursor,expected_rows=EXCLUDED.expected_rows,source_updated_at=EXCLUDED.source_updated_at,error=EXCLUDED.error,updated_at=now(),completed_at=EXCLUDED.completed_at", [key, status, processed, rejected, JSON.stringify(cursor), expected, sourceUpdatedAt, error]);
}
const feeds: Record<string, { host: string; id: string; kind: "assessment" | "permits"; city: string; province: string; select: string }> = {
  calgary: { host: "data.calgary.ca", id: "4bsw-nn7w", kind: "assessment", city: "Calgary", province: "AB", select: "address,roll_year,roll_number,assessed_value,year_of_construction,land_size_sm,land_use_designation,mod_date,assessment_class,assessment_class_description,re_assessed_value,nr_assessed_value,fl_assessed_value,comm_code,comm_name,property_type,sub_property_use,short_legal" },
  winnipeg: { host: "data.winnipeg.ca", id: "d4mq-wa44", kind: "assessment", city: "Winnipeg", province: "MB", select: "roll_number,full_address,current_assessment_year,total_assessed_value,year_built,total_living_area,assessed_land_area,assessment_date,dwelling_units,zoning,centroid_lat,centroid_lon,building_type,basement,basement_finish,rooms,air_conditioning,fire_place,attached_garage,detached_garage,pool,number_floors_condo,property_use_code,water_frontage_measurement,sewer_frontage_measurement,property_influences,neighbourhood_area,proposed_assessment_year,total_proposed_assessment_value,proposed_assessment_date" },
  edmonton: { host: "data.edmonton.ca", id: "q7d6-ambg", kind: "assessment", city: "Edmonton", province: "AB", select: "account_number,house_number,street_name,assessed_value,tax_class,mill_class_1,latitude,longitude" },
  ns: { host: "www.thedatazone.ca", id: "a859-xvcs", kind: "assessment", city: "Nova Scotia", province: "NS", select: ":id as source_row_id,aan,address_num,address_direction,address_street,address_suffix,address_city,municipal_unit,year_built,square_foot_living_area,living_units,bedrooms,bathrooms,style,under_construction,grade,finished_basement,garage,y_coord,x_coord" },
  "calgary-permits": { host: "data.calgary.ca", id: "c2es-76ed", kind: "permits", city: "Calgary", province: "AB", select: "permitnum,issueddate,statuscurrent,permittype,workclassgroup,description,housingunits,estprojectcost,originaladdress,latitude,longitude" },
  nb: { host: "gnb.socrata.com", id: "r46k-5j2j", kind: "assessment", city: "New Brunswick", province: "NB", select: "pan,location,ta_code,ta_desc,assess_yr,assess_val,descript,tax_levy" },
};
function mapFeed(key: string, r: Row): Row | null {
  const feed = feeds[key];
  if (key === "nb") return text(r.pan) ? { source: "nb", municipality_code: text(r.ta_code) ?? "nb", municipality_name: text(r.ta_desc), province: "NB", matricule: r.pan, address: text(r.location), loose_address_key: text(r.location) ? importedAddressKey(String(r.location)) : null, roll_year: number(r.assess_yr), total_value: number(r.assess_val), attributes: physicalAttributes(key, r) } : null;
  if (feed.kind === "permits") {
    if (!text(r.permitnum)) return null;
    const address = text(r.originaladdress);
    return { source: "calgary", permit_number: r.permitnum, city: feed.city, province: feed.province, address, loose_address_key: address ? importedAddressKey(address) : null, permit_type: text(r.permittype), work_type: text(r.workclassgroup), status: text(r.statuscurrent), description: text(r.description), units: number(r.housingunits), estimated_value: number(r.estprojectcost), issued_date: iso(r.issueddate), lat: number(r.latitude), lng: number(r.longitude) };
  }
  const a = mapAssessment(key, r);
  if (!a.rollNumber) return null;
  return { source: key === "ns" ? "ns-pvsc" : key, municipality_code: key, municipality_name: a.city, province: feed.province, roll_year: a.rollYear, matricule: key === "ns" ? `${a.rollNumber}/${String(r.source_row_id)}` : a.rollNumber, address: a.address || null, loose_address_key: importedAddressKey(a.address), year_built: a.yearBuilt, year_built_estimated: false, floor_area_m2: a.floorAreaM2, lot_area_m2: a.lotAreaM2, dwellings: a.dwellingUnits, total_value: a.assessedValue, bedrooms: a.bedrooms, bathrooms: a.bathrooms, land_use: a.landUse ?? text(r.zoning) ?? text(r.tax_class) ?? text(r.mill_class_1), market_ref_date: iso(r.assessment_date), lat: number(r.centroid_lat) ?? number(r.latitude) ?? number(r.y_coord), lng: number(r.centroid_lon) ?? number(r.longitude) ?? number(r.x_coord), source_updated_at: iso(r.mod_date), attributes: physicalAttributes(key, r) };
}
async function socrataFeed(key: string) {
  const feed = feeds[key];
  if (!feed) throw new Error("Unknown feed");
  const metadata = await (await fetchSource(`https://${feed.host}/api/views/${feed.id}.json`)).json() as Row;
  const sourceUpdatedAt = number(metadata.rowsUpdatedAt) ? new Date(Number(metadata.rowsUpdatedAt) * 1000).toISOString() : null;
  const base = new URL(`https://${feed.host}/resource/${feed.id}.json`);
  base.searchParams.set("$select", "count(*) as count");
  const count = Number(((await (await fetchSource(base.href)).json()) as Row[])[0].count);
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("Unexpected empty source; existing dataset preserved");
  const state = (await query("SELECT * FROM property_import_runs WHERE key=$1", [key]))[0];
  let offset = !args.includes("--restart") && state && state.source_updated_at === sourceUpdatedAt ? Number((state.cursor as Row).offset ?? 0) : 0;
  let rejected = offset ? Number(state.rejected_rows) : 0;
  const table = feed.kind === "assessment" ? "assessment_units" : "building_permits";
  await checkpoint(key, "running", offset, rejected, { offset }, count, sourceUpdatedAt);
  while (offset < count) {
    base.searchParams.set("$select", feed.select);
    base.searchParams.set("$order", ":id"); base.searchParams.set("$limit", "5000"); base.searchParams.set("$offset", String(offset));
    const rows = await (await fetchSource(base.href)).json() as Row[];
    if (!rows.length) throw new Error(`Source ended at ${offset}, expected ${count}`);
    const batch = rows.map(r => mapFeed(key, r)).filter((r): r is Row => Boolean(r));
    rejected += rows.length - batch.length;
    await upsert(table, batch, feed.kind === "assessment" ? ["source", "municipality_code", "matricule"] : ["source", "permit_number"], feed.kind === "assessment" ? assessmentColumns : permitColumns);
    offset += rows.length;
    await checkpoint(key, "running", offset, rejected, { offset }, count, sourceUpdatedAt);
    if (offset % 25000 === 0 || offset >= count) console.log(JSON.stringify({ key, processed: offset, expected: count, rejected }));
  }
  const end = await (await fetchSource(`https://${feed.host}/api/views/${feed.id}.json`)).json() as Row;
  if (end.rowsUpdatedAt !== metadata.rowsUpdatedAt) throw new Error("Source changed during pagination; rerun to obtain a stable snapshot");
  const sourceValue = feed.kind === "assessment" ? key === "ns" ? "ns-pvsc" : key : "calgary";
  const actual = Number((await query(`SELECT count(*) AS count FROM ${table} WHERE source=$1`, [sourceValue]))[0].count);
  await register(key === "ns" ? "ns-pvsc" : key, table, SOURCES[key] ?? { name: "New Brunswick Property Assessment Map", url: "https://open.canada.ca/data/en/dataset/fefafa4a-ceb1-0109-5169-e5ac5e79979d", licence: "Open Government Licence – New Brunswick", attribution: "Contains information licensed under the Open Government Licence – New Brunswick. Source: Service New Brunswick, Property Assessment Map." }, feed.province, actual);
  await checkpoint(key, "complete", offset, rejected, { offset, hostedRows: actual }, count, sourceUpdatedAt);
  console.log(JSON.stringify({ key, status: "complete", processed: offset, hosted: actual, rejected }));
}
async function quebec() {
  const key = "qc_assessment_roll";
  const indexUrl = "https://donneesouvertes.affmunqc.net/role/indexRole2026.csv";
  const file = path.join(cache, "indexRole2026.csv");
  await download(indexUrl, file);
  const parser = createCsvStreamParser(); const cells = [...parser.push(await fs.readFile(file, "utf8")), ...parser.end()];
  const municipalities = cells.slice(1).filter(r => r[0] && r[2]).map(r => ({ code: r[0].padStart(5, "0"), name: r[1], url: r[2] }));
  const limit = Number(option("municipalities", String(municipalities.length)));
  const completed = new Set(args.includes("--restart") ? [] : (await query("SELECT file_key FROM property_import_files WHERE dataset_key=$1 AND status='complete'", [key])).map(r => String(r.file_key)));
  await checkpoint(key, "running", completed.size, 0, { completedFiles: completed.size, totalFiles: municipalities.length }, municipalities.length);
  for (const m of municipalities.slice(0, limit)) {
    if (completed.has(m.code)) continue;
    try {
      const xmlFile = path.join(cache, `RL${m.code}_2026.xml`);
      const sha256 = await download(m.url, xmlFile);
      const decoder = new TextDecoder("utf-8"); let buffer = "", batch: Row[] = [], imported = 0, rejected = 0;
      const processUnits = async (units: string[]) => {
        for (const unit of units) {
          const r = parseRollUnit(unit);
          if (!r.matricule) { rejected++; continue; }
          batch.push({ source: "qc-mamh", municipality_code: m.code, municipality_name: m.name, province: "QC", roll_year: 2026, matricule: r.matricule, address: r.address, loose_address_key: r.address ? importedAddressKey(r.address) : null, lot_number: r.lotNumber, cubf: r.cubf, frontage_m: r.frontageM, lot_area_m2: r.lotAreaM2, storeys: r.storeys, year_built: r.yearBuilt, year_built_estimated: r.yearBuiltEstimated, floor_area_m2: r.floorAreaM2, dwellings: r.dwellings, market_ref_date: r.marketRefDate, land_value: r.landValue, building_value: r.buildingValue, total_value: r.totalValue, previous_roll_value: r.previousRollValue, land_use: r.cubf });
          imported++;
          if (batch.length >= 2000) { await upsert("assessment_units", batch, ["source", "municipality_code", "matricule"], assessmentColumns); batch = []; }
        }
      };
      for await (const chunk of createReadStream(xmlFile)) { buffer += decoder.decode(chunk as Buffer, { stream: true }); const split = extractUnits(buffer); buffer = split.rest; await processUnits(split.units); if (buffer.length > 10_000_000) throw new Error("Unexpected oversized XML unit"); }
      buffer += decoder.decode(); const split = extractUnits(buffer); await processUnits(split.units);
      if (split.rest.includes("<RLUEx>") || !imported) throw new Error("Incomplete or unrecognized XML roll");
      await upsert("assessment_units", batch, ["source", "municipality_code", "matricule"], assessmentColumns);
      await query("INSERT INTO property_import_files(dataset_key,file_key,status,row_count,sha256,error) VALUES($1,$2,'complete',$3,$4,NULL) ON CONFLICT(dataset_key,file_key) DO UPDATE SET status='complete',row_count=EXCLUDED.row_count,sha256=EXCLUDED.sha256,error=NULL,updated_at=now()", [key, m.code, imported, sha256]);
      completed.add(m.code);
      await checkpoint(key, "running", completed.size, rejected, { completedFiles: completed.size, totalFiles: municipalities.length }, municipalities.length);
      console.log(JSON.stringify({ key, municipality: m.name, units: imported, rejected, completedFiles: completed.size, totalFiles: municipalities.length }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      await query("INSERT INTO property_import_files(dataset_key,file_key,status,error) VALUES($1,$2,'failed',$3) ON CONFLICT(dataset_key,file_key) DO UPDATE SET status='failed',error=EXCLUDED.error,updated_at=now()", [key, m.code, message]);
      console.error(JSON.stringify({ key, municipality: m.name, error: message }));
    }
  }
  const actual = Number((await query("SELECT count(*) AS count FROM assessment_units WHERE source='qc-mamh'"))[0].count);
  await register(key, "assessment_units", { name: "Québec 2026 public assessment rolls", url: "https://www.donneesquebec.ca/recherche/dataset/roles-d-evaluation-fonciere-du-quebec", licence: "CC-BY 4.0 Québec", attribution: "Source: Ministère des Affaires municipales et de l'Habitation (Québec), rôles d'évaluation foncière. CC-BY 4.0 Québec." }, "QC", actual);
  await checkpoint(key, completed.size === municipalities.length ? "complete" : "partial", completed.size, 0, { completedFiles: completed.size, totalFiles: municipalities.length, hostedRows: actual }, municipalities.length);
}
async function streamCsv(file: string, handle: (row: Record<string, string>) => Promise<void>) {
  const parser = createCsvStreamParser(), decoder = new TextDecoder(); let header: string[] | null = null;
  const processRows = async (rows: string[][]) => { for (const cells of rows) { if (!header) { header = cells.map(h => h.replace(/^\uFEFF/, "").trim().toLowerCase()); continue; } if (cells.length < 2) continue; const row = Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])); await handle(row); } };
  for await (const chunk of createReadStream(file)) await processRows(parser.push(decoder.decode(chunk as Buffer, { stream: true })));
  await processRows(parser.push(decoder.decode())); await processRows(parser.end());
}
const csvFeeds: Record<string, { url: string; city: string; province: string; source: string }> = {
  "vancouver-permits": { url: "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/issued-building-permits/exports/csv?delimiter=%2C", city: "Vancouver", province: "BC", source: "vancouver" },
  "montreal-permits": { url: "https://donnees.montreal.ca/dataset/d90eaf1b-2de8-43f0-923a-27a620ecdf41/resource/5232a72d-235a-48eb-ae20-bb9d501300ad/download/permis-construction.csv", city: "Montréal", province: "QC", source: "montreal" },
  "toronto-permits-active": { url: "https://ckan0.cf.opendata.inter.prod-toronto.ca/datastore/dump/6d0229af-bc54-46de-9c2b-26759b01dd05", city: "Toronto", province: "ON", source: "toronto" },
  "toronto-permits-cleared": { url: "https://ckan0.cf.opendata.inter.prod-toronto.ca/datastore/dump/a96c0ba4-3026-402b-b09d-5b1268b8f810", city: "Toronto", province: "ON", source: "toronto" },
  "toronto-coa-active": { url: "https://ckan0.cf.opendata.inter.prod-toronto.ca/datastore/dump/51fd09cd-99d6-430a-9d42-c24a937b0cb0", city: "Toronto", province: "ON", source: "toronto-coa" },
  "toronto-coa-closed": { url: "https://ckan0.cf.opendata.inter.prod-toronto.ca/datastore/dump/9c97254e-5460-4799-896f-c7823413c81c", city: "Toronto", province: "ON", source: "toronto-coa" },
};
async function csvFeed(key: string) {
  const feed = csvFeeds[key]; if (!feed) throw new Error("Unknown CSV feed");
  const file = path.join(cache, `${key}.csv`); const sha256 = await download(feed.url, file);
  const coa = key.includes("-coa-"); const table = coa ? "coa_applications" : "building_permits";
  const columns = coa ? ["source", "reference_file", "sys_id", "application_type", "sub_type", "work_type", "status", "decision", "omb_decision", "address", "loose_address_key", "ward_number", "ward_name", "zoning_review", "zoning_designation", "description", "in_date", "hearing_date", "final_date", "number_of_lots_created", "application_url"] : permitColumns;
  const conflict = coa ? ["source", "reference_file"] : ["source", "permit_number"];
  let processed = 0, rejected = 0, batch: Row[] = [];
  await checkpoint(key, "running", 0, 0, { sha256 });
  await streamCsv(file, async r => {
    processed++;
    let address = feed.source.startsWith("toronto") ? [r.street_num, r.street_name, r.street_type, r.street_direction].filter(Boolean).join(" ") : r.address ?? r.emplacement;
    address = address?.trim().replace(/\s+/g, " ") ?? "";
    let record: Row;
    if (coa) record = { source: feed.source, reference_file: text(r["reference_file#"]) ?? (r.sys_id ? `SYS:${r.sys_id}` : r._id ? `ROW:${key}:${r._id}` : null), sys_id: text(r.sys_id), application_type: text(r.application_type), sub_type: text(r.sub_type), work_type: text(r.work_type), status: text(r.statusdesc), decision: text(r.c_of_a_descision), omb_decision: text(r.omb_descision), address, loose_address_key: importedAddressKey(address), ward_number: text(r.ward_number) ?? text(r.ward), ward_name: text(r.ward_name), zoning_review: text(r.zoning_review), zoning_designation: text(r.zoning_designation), description: text(r.description), in_date: iso(r.in_date), hearing_date: iso(r.hearing_date), final_date: iso(r.finaldate), number_of_lots_created: number(r.number_of_lots_created), application_url: text(r.application_url) };
    else {
      const point = r.geo_point_2d?.split(",").map(p => Number(p.trim()));
      const permit = feed.source === "toronto" ? text(r.permit_num) ? `${r.permit_num}/${r.revision_num || "00"}` : null : text(r.permitnumber) ?? text(r.id_permis) ?? text(r.no_demande);
      record = { source: feed.source, permit_number: permit, city: feed.city, province: feed.province, address, loose_address_key: importedAddressKey(address), permit_type: text(r.permit_type) ?? text(r.propertyuse) ?? text(r.description_type_batiment), work_type: text(r.work) ?? text(r.typeofwork) ?? text(r.description_type_demande), status: text(r.status), description: text(r.description) ?? text(r.projectdescription) ?? text(r.nature_travaux), units: number(r.nb_logements), estimated_value: number(r.est_const_cost?.replace(/,/g, "")) ?? number(r.projectvalue), issued_date: iso(r.issued_date) ?? iso(r.issuedate) ?? iso(r.date_emission), lat: point?.[0] ?? number(r.latitude), lng: point?.[1] ?? number(r.longitude) };
    }
    if (!record[conflict[1]]) { rejected++; return; }
    batch.push(record);
    if (batch.length >= 2000) { await upsert(table, batch, conflict, columns); batch = []; await checkpoint(key, "running", processed, rejected, { sha256 }); if (processed % 20000 === 0) console.log(JSON.stringify({ key, processed, rejected })); }
  });
  if (!processed || rejected === processed) throw new Error("CSV schema unrecognized; no records imported");
  await upsert(table, batch, conflict, columns);
  const actual = Number((await query(`SELECT count(*) AS count FROM ${table} WHERE source=$1`, [feed.source]))[0].count);
  const source = SOURCES[`${feed.source}-permits`] ?? (coa ? SOURCES["toronto-variance"] : { name: "Montréal construction permits", url: feed.url, licence: "CC-BY 4.0", attribution: "Source: Ville de Montréal, permis de construction (CC-BY 4.0)." });
  const registry = coa ? "toronto_coa_applications" : `${feed.source}-permits`;
  await register(registry, table, source, feed.province, actual);
  await checkpoint(key, "complete", processed, rejected, { sha256, hostedRows: actual }, processed);
  console.log(JSON.stringify({ key, status: "complete", processed, rejected, hosted: actual }));
}
async function censusBoundaries() {
  const key = "census_da_boundaries", base = "https://geo.statcan.gc.ca/geo_wa/rest/services/2021/Cartographic_boundary_files/MapServer/12";
  const result = await (await fetchSource(`${base}/query?where=1%3D1&returnIdsOnly=true&f=json`)).json() as { objectIds?: number[] };
  if (!result.objectIds?.length) throw new Error("No national DA identifiers returned");
  const ids = result.objectIds.sort((a, b) => a - b);
  const state = (await query("SELECT * FROM property_import_runs WHERE key=$1", [key]))[0];
  let offset = Number((state?.cursor as Row | undefined)?.offset ?? 0), rejected = Number(state?.rejected_rows ?? 0);
  await checkpoint(key, "running", offset, rejected, { offset }, ids.length);
  let batchSize = 100, successes = 0;
  while (offset < ids.length) {
    const subset = ids.slice(offset, offset + batchSize);
    const url = new URL(`${base}/query`); url.searchParams.set("objectIds", subset.join(",")); url.searchParams.set("outFields", "DAUID,PRUID,LANDAREA"); url.searchParams.set("outSR", "4326"); url.searchParams.set("f", "geojson");
    let result: { features?: { geometry: AreaGeometry | null; properties: Row }[]; exceededTransferLimit?: boolean };
    try { result = await (await fetchSource(url.href)).json() as typeof result; }
    catch (error) { if (batchSize === 1) throw error; batchSize = Math.max(1, Math.floor(batchSize / 4)); successes = 0; console.log(JSON.stringify({ key, offset, retryBatchSize: batchSize })); continue; }
    if (!result.features || result.features.length !== subset.length || result.exceededTransferLimit) throw new Error(`Incomplete boundary batch at ${offset}`);
    const records: Row[] = [];
    for (const feature of result.features) {
      if (!feature.geometry || !["Polygon", "MultiPolygon"].includes(feature.geometry.type)) { rejected++; continue; }
      const bbox = bboxOfGeometry(feature.geometry);
      records.push({ dauid: String(feature.properties.DAUID), province_code: String(feature.properties.PRUID), land_area_km2: number(feature.properties.LANDAREA), geojson: feature.geometry, min_lng: bbox.minLng, max_lng: bbox.maxLng, min_lat: bbox.minLat, max_lat: bbox.maxLat });
    }
    await upsert("census_da_boundaries", records, ["dauid"], ["dauid", "province_code", "land_area_km2", "geojson", "min_lng", "max_lng", "min_lat", "max_lat"]);
    offset += subset.length; await checkpoint(key, "running", offset, rejected, { offset }, ids.length);
    if (++successes >= 4) { batchSize = Math.min(100, batchSize * 2); successes = 0; }
    if (offset % 2000 === 0 || offset >= ids.length) console.log(JSON.stringify({ key, processed: offset, expected: ids.length, rejected }));
  }
  const actual = Number((await query("SELECT count(*) AS count FROM census_da_boundaries"))[0].count);
  await register(key, "census_da_boundaries", { name: "Statistics Canada 2021 dissemination-area boundaries", url: base, licence: "Open Government Licence – Canada", attribution: "Source: Statistics Canada, Statistical Geomatics Centre, 2021 Census cartographic boundary files." }, "CA", actual);
  await checkpoint(key, "complete", offset, rejected, { offset, hostedRows: actual }, ids.length);
}
async function censusBoundaryArchive() {
  const key = "census_da_boundaries", file = path.join(cache, "census-da-2021.zip");
  const url = "https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/files-fichiers/lda_000b21a_e.zip";
  const sha256 = await download(url, file);
  const known = (await query("SELECT dauid FROM census_da_boundaries")).map(r => String(r.dauid));
  const knownFile = path.join(cache, "census-da-known.json"); await fs.writeFile(knownFile, JSON.stringify(known));
  await checkpoint(key, "running", known.length, 0, { archive: true, sha256 }, 57932);
  const child = spawn("python3", [path.join(import.meta.dirname, "read-census.py"), file, knownFile, cache, option("python-deps", "/private/tmp/realist-python-deps")], { stdio: ["ignore", "pipe", "inherit"] });
  const finished = new Promise<number | null>((resolve, reject) => { child.once("exit", resolve); child.once("error", reject); });
  let processed = known.length;
  try {
    for await (const line of jsonLines(child.stdout, 128_000_000)) {
      const f = JSON.parse(line) as { geometry: AreaGeometry; properties: Row; simplificationM: number }, b = bboxOfGeometry(f.geometry);
      await upsert("census_da_boundaries", [{ dauid: String(f.properties.DAUID), province_code: String(f.properties.PRUID), land_area_km2: number(f.properties.LANDAREA), simplification_m: f.simplificationM, geojson: f.geometry, min_lng: b.minLng, max_lng: b.maxLng, min_lat: b.minLat, max_lat: b.maxLat }], ["dauid"], ["dauid", "province_code", "land_area_km2", "simplification_m", "geojson", "min_lng", "max_lng", "min_lat", "max_lat"]);
      await checkpoint(key, "running", ++processed, 0, { archive: true, sha256 }, 57932);
    }
    if (await finished !== 0) throw new Error("Census archive failed CRC/geometry validation");
  } catch (error) { child.kill("SIGTERM"); throw error; }
  const actual = Number((await query("SELECT count(*) AS count FROM census_da_boundaries"))[0].count);
  if (actual !== 57932) throw new Error(`Expected 57932 DA boundaries, received ${actual}`);
  await register(key, "census_da_boundaries", { name: "Statistics Canada 2021 dissemination-area boundaries", url, licence: "Open Government Licence – Canada", attribution: "Source: Statistics Canada, Statistical Geomatics Centre, 2021 Census cartographic boundary files." }, "CA", actual);
  await checkpoint(key, "complete", actual, 0, { archive: true, sha256, hostedRows: actual }, actual);
  console.log(JSON.stringify({ key, status: "complete", hosted: actual }));
}
const censusScalars: Record<string, string> = { "1": "population", "4": "totalPrivateDwellings", "5": "dwellingsOccupiedByUsualResidents", "6": "populationDensityPerKm2", "7": "landAreaKm2", "57": "avgHouseholdSize", "243": "medianHouseholdIncome", "252": "avgHouseholdIncome", "1414": "householdsByTenureTotal", "1415": "ownerHouseholds", "1416": "renterHouseholds", "1488": "medianDwellingValue", "1489": "avgDwellingValue", "1494": "medianRentedShelterCost", "1495": "avgRentedShelterCost" };
const censusTypes: Record<string, string> = { "42": "singleDetached", "43": "semiDetached", "44": "rowHouse", "45": "duplexApartment", "46": "apartmentUnderFiveStoreys", "47": "apartmentFivePlusStoreys", "48": "otherSingleAttached", "49": "movableDwelling" };
const censusPeriods: Record<string, string> = { "1441": "1960 or before", "1442": "1961 to 1980", "1443": "1981 to 1990", "1444": "1991 to 2000", "1445": "2001 to 2005", "1446": "2006 to 2010", "1447": "2011 to 2015", "1448": "2016 to 2021" };
async function censusProfiles() {
  const key = "census_da_profiles", profiles = new Map<string, Row>();
  const fields = [...Object.keys(censusScalars), ...Object.keys(censusTypes), ...Object.keys(censusPeriods), "41", "1440"];
  // Only housing, income and population characteristics; never the entire SDMX flow.
  await checkpoint(key, "running", 0, 0, { characteristics: fields.length });
  let processed = 0, rejected = 0;
  const hashes: Row = {};
  for (let start = 0; start < fields.length; start += 3) {
    const extracts = await Promise.all(fields.slice(start, start + 3).map(async field => {
      const url = `https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest/data/STC_CP,DF_DA/A5..1.${field}.1?format=csv`;
      const file = path.join(cache, `census-2021-characteristic-${field}.csv`);
      const sha256 = await download(url, file); hashes[field] = sha256; return file;
    }));
    for (const file of extracts) await streamCsv(file, async r => {
    if (!r.ref_area?.startsWith("2021S0512") || r.gender !== "1" || r.statistic !== "1") { rejected++; return; }
    const id = r.alt_geo_code || r.ref_area.slice(9);
    if (!/^\d{8}$/.test(id)) { rejected++; return; }
    const profile = profiles.get(id) ?? Object.fromEntries([...Object.values(censusScalars).map(k => [k, null]), ["dwellingMix", {}], ["constructionPeriods", {}]]);
    const value = /^(x|f|\.\.|\.\.\.)$/i.test(r.flag) ? null : number(r.obs_value);
    if (censusScalars[r.characteristic]) profile[censusScalars[r.characteristic]] = value;
    else if (censusTypes[r.characteristic]) (profile.dwellingMix as Row)[censusTypes[r.characteristic]] = value;
    else if (censusPeriods[r.characteristic]) (profile.constructionPeriods as Row)[censusPeriods[r.characteristic]] = value;
    else if (r.characteristic === "41") profile.dwellingsByTypeTotal = value;
    else if (r.characteristic === "1440") profile.constructionPeriodsTotal = value;
    profiles.set(id, profile); processed++;
    });
    console.log(JSON.stringify({ key, characteristicsProcessed: Math.min(start + 3, fields.length), totalCharacteristics: fields.length, profiles: profiles.size, observations: processed }));
  }
  const sha256 = createHash("sha256").update(JSON.stringify(hashes)).digest("hex");
  if (profiles.size < 50_000) throw new Error(`Incomplete nationwide Census response: ${profiles.size} DAs; source retained for inspection`);
  const records = [...profiles].map(([dauid, profile]) => ({ dauid, census_year: 2021, profile }));
  for (let offset = 0; offset < records.length; offset += 1000) { await upsert("census_da_profiles", records.slice(offset, offset + 1000), ["dauid"], ["dauid", "census_year", "profile"]); await checkpoint(key, "running", Math.min(offset + 1000, records.length), rejected, { sha256, characteristics: fields.length }, records.length); }
  await register(key, "census_da_profiles", { name: "2021 Census housing, income and population profiles", url: "https://www12.statcan.gc.ca/wds-sdw/2021profile-profil2021-eng.cfm", licence: "Statistics Canada Open Licence", attribution: "Source: Statistics Canada, Census of Population, 2021. Adapted under the Statistics Canada Open Licence." }, "CA", records.length);
  await checkpoint(key, "complete", records.length, rejected, { sha256, characteristics: fields.length, sourceObservations: processed, hostedRows: records.length }, records.length);
  console.log(JSON.stringify({ key, status: "complete", profiles: records.length, characteristics: fields.length, observations: processed, rejected }));
}
const historyColumns = ["source", "account_number", "roll_year", "address", "city", "province", "land_value", "building_value", "total_value", "taxable_value"];
async function novaScotiaDetails() {
  for (const kind of ["values", "land"] as const) {
    const key = `ns-pvsc-${kind}`, id = kind === "values" ? "bt58-qu28" : "wg22-3ric";
    const base = new URL(`https://www.thedatazone.ca/resource/${id}.json`); base.searchParams.set("$select", "count(*) as count");
    const count = Number(((await (await fetchSource(base.href)).json()) as Row[])[0].count);
    base.searchParams.set("$select", "tax_year"); base.searchParams.set("$order", "tax_year DESC"); base.searchParams.set("$limit", "1");
    const latest = kind === "values" ? Number(((await (await fetchSource(base.href)).json()) as Row[])[0].tax_year) : null;
    const state = (await query("SELECT * FROM property_import_runs WHERE key=$1", [key]))[0];
    let offset = args.includes("--restart") ? 0 : Number((state?.cursor as Row | undefined)?.offset ?? 0), rejected = Number(state?.rejected_rows ?? 0);
    await checkpoint(key, "running", offset, rejected, { offset }, count);
    while (offset < count) {
      base.searchParams.set("$select", kind === "values" ? "aan,address_num,address_direction,address_street,address_suffix,address_city,tax_year,assessed_value,taxable_assessed_value,y_coord,x_coord" : "aan,land_acres,land_square_feet,y_coord,x_coord");
      base.searchParams.set("$order", ":id"); base.searchParams.set("$limit", "5000"); base.searchParams.set("$offset", String(offset));
      const rows = await (await fetchSource(base.href)).json() as Row[];
      if (!rows.length) throw new Error("Nova Scotia source ended before its published count");
      const history: Row[] = [], current: Row[] = [], land: Row[] = [];
      for (const r of rows) {
        if (!text(r.aan)) { rejected++; continue; }
        if (kind === "land") {
          const sqft = number(r.land_square_feet), acres = number(r.land_acres);
          land.push({ account_number: r.aan, lot_area_m2: sqft !== null ? Math.round(sqft / 10.7639104167 * 10) / 10 : acres !== null ? Math.round(acres * 4046.8564224 * 10) / 10 : null, lat: number(r.y_coord), lng: number(r.x_coord) });
        } else {
          const address = [r.address_num, r.address_direction, r.address_street, r.address_suffix].filter(Boolean).join(" ");
          history.push({ source: key, account_number: r.aan, roll_year: number(r.tax_year), address, city: r.address_city, province: "NS", total_value: number(r.assessed_value), taxable_value: number(r.taxable_assessed_value) });
          if (Number(r.tax_year) === latest) current.push({ source: key, municipality_code: "ns", municipality_name: r.address_city, province: "NS", roll_year: latest, matricule: r.aan, address, loose_address_key: importedAddressKey(address), total_value: number(r.assessed_value), lat: number(r.y_coord), lng: number(r.x_coord) });
        }
      }
      if (kind === "land") await upsert("ns_property_land", land, ["account_number"], ["account_number", "lot_area_m2", "lat", "lng"]);
      else { await upsert("assessment_history", history, ["source", "account_number", "roll_year"], historyColumns); await upsert("assessment_units", current, ["source", "municipality_code", "matricule"], assessmentColumns); }
      offset += rows.length; await checkpoint(key, "running", offset, rejected, { offset, latestYear: latest }, count);
      if (offset % 100000 === 0 || offset >= count) console.log(JSON.stringify({ key, processed: offset, expected: count, rejected }));
    }
    const actual = Number((await query(kind === "land" ? "SELECT count(*) AS count FROM ns_property_land" : "SELECT count(*) AS count FROM assessment_history WHERE source=$1", kind === "land" ? [] : [key]))[0].count);
    await register(key, kind === "land" ? "ns_property_land" : "assessment_history", { name: `Nova Scotia PVSC ${kind === "land" ? "property land area" : "2022–2026 assessed value history"}`, url: `https://www.thedatazone.ca/d/${id}`, licence: SOURCES.ns.licence, attribution: SOURCES.ns.attribution }, "NS", actual);
    await checkpoint(key, "complete", offset, rejected, { offset, latestYear: latest, hostedRows: actual }, count);
  }
}
async function vancouverTax() {
  const key = "vancouver-tax", url = "https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/property-tax-report/exports/csv?delimiter=%2C";
  const metadata = await (await fetchSource("https://opendata.vancouver.ca/api/explore/v2.1/catalog/datasets/property-tax-report/records?order_by=tax_assessment_year%20desc&limit=1")).json() as { results: Row[] };
  const latest = Number(metadata.results[0].tax_assessment_year); if (latest < 2020 || latest > 2100) throw new Error("Vancouver tax year not recognized");
  const file = path.join(cache, "vancouver-property-tax.csv"), sha256 = await download(url, file);
  let processed = 0, rejected = 0, history: Row[] = [], current: Row[] = [];
  const flush = async () => { await upsert("assessment_history", history, ["source", "account_number", "roll_year"], historyColumns); await upsert("assessment_units", current, ["source", "municipality_code", "matricule"], assessmentColumns); history = []; current = []; await checkpoint(key, "running", processed, rejected, { sha256, latestYear: latest }); };
  await checkpoint(key, "running", 0, 0, { sha256, latestYear: latest });
  await streamCsv(file, async r => {
    processed++; if (!r.folio) { rejected++; return; }
    const address = [r.to_civic_number, r.street_name].filter(Boolean).join(" ");
    const landValue = number(r.current_land_value), buildingValue = number(r.current_improvement_value), total = landValue === null || buildingValue === null ? null : landValue + buildingValue;
    if (r.tax_assessment_year) history.push({ source: key, account_number: r.folio, roll_year: number(r.tax_assessment_year), address, city: "Vancouver", province: "BC", land_value: landValue, building_value: buildingValue, total_value: total });
    else rejected++; // No annual assessment observation exists; retain current published physical details below.
    if (Number(r.tax_assessment_year) === latest || (!r.tax_assessment_year && Number(r.report_year) === latest)) current.push({ source: key, municipality_code: "vancouver", municipality_name: "Vancouver", province: "BC", roll_year: number(r.tax_assessment_year), matricule: r.folio, address, loose_address_key: importedAddressKey(address), year_built: number(r.year_built), year_built_estimated: false, lot_number: [r.lot, r.plan].filter(Boolean).join(" ") || null, land_value: landValue, building_value: buildingValue, total_value: total, land_use: text(r.zoning_district), attributes: physicalAttributes(key, r) });
    if (history.length + current.length >= 2000) { await flush(); if (processed % 100000 === 0) console.log(JSON.stringify({ key, processed, rejected })); }
  });
  if (!processed || rejected === processed) throw new Error("Vancouver CSV schema unrecognized");
  await flush();
  const actual = Number((await query("SELECT count(*) AS count FROM assessment_history WHERE source=$1", [key]))[0].count);
  await register(key, "assessment_history", { name: "Vancouver property tax and assessment history", url: "https://opendata.vancouver.ca/explore/dataset/property-tax-report/", licence: "Open Government Licence – Vancouver", attribution: "Contains information licensed under the Open Government Licence – Vancouver." }, "BC", actual);
  await checkpoint(key, "complete", processed, rejected, { sha256, latestYear: latest, hostedRows: actual }, processed);
  console.log(JSON.stringify({ key, status: "complete", processed, rejected, hosted: actual }));
}
async function nationalAddresses() {
  const key = "national_address_register", archive = option("nar-file", path.join(cache, "nar-202606.zip"));
  const enumerate = spawn("python3", ["-c", "import json,sys,zipfile; print(json.dumps([i.filename for i in zipfile.ZipFile(sys.argv[1]).infolist() if i.filename.endswith('.csv')]))", archive], { stdio: ["ignore", "pipe", "inherit"] });
  let listing = ""; for await (const chunk of enumerate.stdout) listing += String(chunk);
  const files = JSON.parse(listing) as string[];
  // All locations precede addresses; the two source tables retain their natural IDs.
  files.sort((a, b) => a.startsWith("Locations/") === b.startsWith("Locations/") ? a.localeCompare(b) : a.startsWith("Locations/") ? -1 : 1);
  const completed = new Set((await query("SELECT file_key FROM property_import_files WHERE dataset_key=$1 AND status='complete'", [key])).map(r => String(r.file_key)));
  const provinceCodes: Record<string, string> = { "10": "NL", "11": "PE", "12": "NS", "13": "NB", "24": "QC", "35": "ON", "46": "MB", "47": "SK", "48": "AB", "59": "BC", "60": "YT", "61": "NT", "62": "NU" };
  const addressColumns = ["address_id", "location_id", "civic_number", "unit", "address", "mailing_address", "street_key", "mailing_street_key", "city", "city_fr", "mailing_city", "city_key", "city_fr_key", "mailing_city_key", "province", "postal_code", "building_usage"];
  const locationColumns = ["location_id", "latitude", "longitude", "blockface_latitude", "blockface_longitude", "csduid", "eruid", "feduid"];
  await checkpoint(key, "running", completed.size, 0, { completedFiles: completed.size, totalFiles: files.length }, files.length);
  for (const file of files) {
    if (completed.has(file)) continue;
    const locations = file.startsWith("Locations/"); let processed = 0, rejected = 0, batch: Row[] = [];
    const child = spawn("python3", [path.join(import.meta.dirname, "read-nar.py"), archive, file], { stdio: ["ignore", "pipe", "inherit"] });
    const finished = new Promise<number | null>((resolve, reject) => { child.once("exit", resolve); child.once("error", reject); });
    try {
      for await (const line of jsonLines(child.stdout)) {
        const r = JSON.parse(line) as Record<string, string>; processed++;
        let record: Row;
        if (locations) record = { location_id: r.LOC_GUID, latitude: number(r.BG_LATITUDE), longitude: number(r.BG_LONGITUDE), blockface_latitude: number(r.BF_REPPOINT_LATITUDE), blockface_longitude: number(r.BF_REPPOINT_LONGITUDE), csduid: text(r.CSD_CODE), eruid: text(r.ER_CODE), feduid: text(r.FED_CODE) };
        else {
          const civic = `${r.CIVIC_NO || ""}${r.CIVIC_NO_SUFFIX || ""}`, province = provinceCodes[r.PROV_CODE];
          const street = (name: string, type: string, direction: string) => province === "QC" ? [civic, type, name, direction].filter(Boolean).join(" ") : [civic, name, type, direction].filter(Boolean).join(" ");
          const address = street(r.OFFICIAL_STREET_NAME, r.OFFICIAL_STREET_TYPE, r.OFFICIAL_STREET_DIR), mailingAddress = street(r.MAIL_STREET_NAME, r.MAIL_STREET_TYPE, r.MAIL_STREET_DIR);
          record = { address_id: r.ADDR_GUID, location_id: r.LOC_GUID, civic_number: civic || null, unit: text(r.APT_NO_LABEL), address, mailing_address: mailingAddress, street_key: streetKey(address), mailing_street_key: streetKey(mailingAddress), city: text(r.CSD_ENG_NAME), city_fr: text(r.CSD_FRE_NAME), mailing_city: text(r.MAIL_MUN_NAME), city_key: cityKey(r.CSD_ENG_NAME ?? ""), city_fr_key: cityKey(r.CSD_FRE_NAME ?? ""), mailing_city_key: cityKey(r.MAIL_MUN_NAME ?? ""), province, postal_code: text(r.MAIL_POSTAL_CODE), building_usage: text(r.BU_USE) };
        }
        if (!record[locations ? "location_id" : "address_id"]) { rejected++; continue; }
        batch.push(record);
        if (batch.length >= 5000) { await upsert(locations ? "national_locations" : "national_addresses", batch, [locations ? "location_id" : "address_id"], locations ? locationColumns : addressColumns); batch = []; if (processed % 100000 === 0) console.log(JSON.stringify({ key, file, processed, rejected })); }
      }
      if (await finished !== 0) throw new Error(`NAR archive member failed CRC/parse validation: ${file}`);
      if (!processed) throw new Error(`Unexpected empty NAR member: ${file}`);
      await upsert(locations ? "national_locations" : "national_addresses", batch, [locations ? "location_id" : "address_id"], locations ? locationColumns : addressColumns);
      await query("INSERT INTO property_import_files(dataset_key,file_key,status,row_count) VALUES($1,$2,'complete',$3) ON CONFLICT(dataset_key,file_key) DO UPDATE SET status='complete',row_count=EXCLUDED.row_count,error=NULL,updated_at=now()", [key, file, processed - rejected]);
      completed.add(file);
      await checkpoint(key, "running", completed.size, rejected, { completedFiles: completed.size, totalFiles: files.length }, files.length);
      console.log(JSON.stringify({ key, file, status: "complete", records: processed - rejected, completedFiles: completed.size, totalFiles: files.length }));
    } catch (error) { child.kill("SIGTERM"); throw error; }
  }
  const counts = await query("SELECT (SELECT count(*) FROM national_addresses) AS addresses, (SELECT count(*) FROM national_locations) AS locations");
  await register(key, "national_addresses", { name: "National Address Register, June 2026", url: "https://www150.statcan.gc.ca/n1/pub/46-26-0002/462600022022001-eng.htm", licence: "Statistics Canada Open Licence; includes information under Open Government Licence – Yukon", attribution: "Source: Statistics Canada, National Address Register, June 2026. Adapted under the Statistics Canada Open Licence. Contains information licensed under the Open Government Licence – Yukon." }, "CA", Number(counts[0].addresses));
  await checkpoint(key, "complete", completed.size, 0, { completedFiles: completed.size, totalFiles: files.length, ...counts[0] }, files.length, "2026-06-26T00:00:00Z");
}
const torontoSources = {
  parcels: { key: "toronto_parcels", table: "toronto_parcels", url: "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/1acaa8b0-f235-4df6-8305-02025ccdeb07/resource/23d1f792-018f-4069-ac5d-443e932e1b78/download/property-boundaries-4326.csv", page: "https://open.toronto.ca/dataset/property-boundaries/" },
  wards: { key: "toronto_wards", table: "municipal_wards", url: "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/5e7a8234-f805-43ac-820f-03d7c360b588/resource/737b29e0-8329-4260-b6af-21555ab24f28/download/city-wards-data-4326.geojson", page: "https://open.toronto.ca/dataset/city-wards/" },
  zoning: { key: "toronto_zoning", table: "toronto_zoning_polygons", url: "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/34927e44-fc11-4336-a8aa-a0dfb27658b7/resource/d75fa1ed-cd04-4a0b-bb6d-2b928ffffa6e/download/zoning-area-4326.geojson", page: "https://open.toronto.ca/dataset/zoning-by-law/" },
  development: { key: "toronto_development_sites", table: "development_application_sites", url: "https://ckan0.cf.opendata.inter.prod-toronto.ca/datastore/dump/8907d8ed-c515-4ce9-b674-9f8c6eefcf0d", page: "https://open.toronto.ca/dataset/development-applications/" },
};
async function torontoData(kind: keyof typeof torontoSources) {
  const feed = torontoSources[kind]; if (!feed) throw new Error("Unknown Toronto layer");
  const file = path.join(cache, `toronto-${kind}.${kind === "parcels" || kind === "development" ? "csv" : "geojson"}`);
  const sha256 = await download(feed.url, file); let processed = 0, rejected = 0, batch: Row[] = [];
  const conflict = kind === "parcels" ? ["parcel_id"] : kind === "wards" ? ["city", "ward_code"] : kind === "zoning" ? ["feature_id"] : ["source", "source_record_id"];
  const columns = kind === "parcels" ? ["parcel_id", "lot_area_m2", "geojson", "min_lng", "max_lng", "min_lat", "max_lat"] : kind === "wards" ? ["city", "ward_code", "ward_name", "geojson", "min_lng", "max_lng", "min_lat", "max_lat"] : kind === "zoning" ? ["feature_id", "zone_code", "zone_category", "geojson", "min_lng", "max_lng", "min_lat", "max_lat"] : ["source", "source_record_id", "application_number", "application_type", "status", "address", "description", "date_submitted", "ward_number", "ward_name", "application_url", "lat", "lng"];
  await checkpoint(feed.key, "running", 0, 0, { sha256 });
  const add = async (r: Row | null) => {
    processed++; if (!r) { rejected++; return; } batch.push(r);
    if (batch.length >= (kind === "development" ? 2000 : 200)) { await upsert(feed.table, batch, conflict, columns); batch = []; await checkpoint(feed.key, "running", processed, rejected, { sha256 }); if (processed % 20000 === 0) console.log(JSON.stringify({ key: feed.key, processed, rejected })); }
  };
  if (kind === "parcels" || kind === "development") await streamCsv(file, async r => {
    if (kind === "parcels") {
      const p = parseParcelRow(r); await add(p ? { parcel_id: p.parcelId, lot_area_m2: p.lotAreaM2, geojson: p.geometry, min_lng: p.bbox.minLng, max_lng: p.bbox.maxLng, min_lat: p.bbox.minLat, max_lat: p.bbox.maxLat } : null);
    } else {
      const e = number(r.x), n = number(r.y), point = e !== null && n !== null ? mtm10ToLatLng(e, n) : null;
      const valid = point && isWithinToronto(point) ? point : null;
      const id = text(r["application#"]) ?? text(r.application_number);
      await add(id ? { source: "toronto", source_record_id: r._id, application_number: id, application_type: text(r.application_type), status: text(r.status), address: [r.street_num, r.street_name, r.street_type, r.street_direction].filter(Boolean).join(" "), description: text(r.description), date_submitted: iso(r.date_submitted), ward_number: text(r.ward_number), ward_name: text(r.ward_name), application_url: text(r.application_url), lat: valid?.lat ?? null, lng: valid?.lng ?? null } : null);
    }
  });
  else {
    const fc = JSON.parse(await fs.readFile(file, "utf8")) as { type: string; features: { id?: string | number; geometry: AreaGeometry; properties: Row }[] };
    if (fc.type !== "FeatureCollection" || !fc.features?.length) throw new Error("Unrecognized GeoJSON");
    if (kind === "wards" && fc.features.length !== 25) throw new Error("Expected the official 25 Toronto wards");
    for (const f of fc.features) {
      const p = f.properties, g = f.geometry;
      if (!g || !["Polygon", "MultiPolygon"].includes(g.type)) { await add(null); continue; }
      const b = bboxOfGeometry(g), shape = { geojson: g, min_lng: b.minLng, max_lng: b.maxLng, min_lat: b.minLat, max_lat: b.maxLat };
      const code = kind === "wards" ? String(p.AREA_SHORT_CODE ?? p.AREA_LONG_CODE ?? "") : text(p.ZN_ZONE) ?? text(p.GEN_ZONE1) ?? text(p.GEN_ZONE) ?? text(p.ZONE_LABEL);
      const id = String(p._id ?? p.OBJECTID ?? f.id ?? createHash("sha256").update(JSON.stringify(g)).digest("hex"));
      await add(code ? { ...shape, ...(kind === "wards" ? { city: "Toronto", ward_code: code, ward_name: text(p.AREA_NAME) ?? text(p.AREA_DESC) } : { feature_id: id, zone_code: code, zone_category: text(p.GEN_ZONE) ?? text(p.ZN_STRING) }) } : null);
    }
  }
  if (!processed || rejected === processed) throw new Error("No valid Toronto source records");
  await upsert(feed.table, batch, conflict, columns);
  const actual = Number((await query(`SELECT count(*) AS count FROM ${feed.table}`))[0].count);
  await register(feed.key, feed.table, { name: `Toronto ${kind}`, url: feed.page, licence: "Open Government Licence – Toronto", attribution: "Contains information licensed under the Open Government Licence – Toronto." }, "Toronto, ON", actual);
  await checkpoint(feed.key, "complete", processed, rejected, { sha256, hostedRows: actual }, processed);
  console.log(JSON.stringify({ key: feed.key, status: "complete", processed, rejected, hosted: actual }));
}
async function main() {
  if (mode === "status") { console.log(JSON.stringify(await query("SELECT * FROM property_import_runs ORDER BY key"), null, 2)); return; }
  if (!write) throw new Error("Use --write to authorize additive database imports");
  if (mode === "migrate") {
    const schema = await fs.readFile(new URL("./schema.sql", import.meta.url), "utf8");
    for (const statement of schema.replace(/^\s*--.*$/gm, "").split(";").map(s => s.trim()).filter(Boolean)) await query(statement);
    console.log("Additive open-data tables and indexes ready"); return;
  }
  if (mode === "quebec") return quebec();
  if (mode === "census-boundaries") return censusBoundaries();
  if (mode === "census-boundary-archive") return censusBoundaryArchive();
  if (mode === "census-profiles") return censusProfiles();
  if (mode === "ns-details") return novaScotiaDetails();
  if (mode === "vancouver-tax") return vancouverTax();
  if (mode === "national-addresses") return nationalAddresses();
  if (mode === "toronto") { for (const kind of option("feeds", "wards,zoning,development,parcels").split(",")) await torontoData(kind as keyof typeof torontoSources); return; }
  if (mode === "csv") { for (const key of option("feeds", Object.keys(csvFeeds).join(",")).split(",")) { try { await csvFeed(key); } catch (error) { const message = error instanceof Error ? error.message : "Import failed"; await query("UPDATE property_import_runs SET status='failed',error=$2,updated_at=now() WHERE key=$1", [key, message]); console.error(JSON.stringify({ key, error: message })); } } return; }
  if (mode === "municipal") {
    for (const key of option("feeds", Object.keys(feeds).join(",")).split(",")) {
      try { await socrataFeed(key); }
      catch (error) { const message = error instanceof Error ? error.message : "Import failed"; await query("UPDATE property_import_runs SET status='failed',error=$2,updated_at=now() WHERE key=$1", [key, message]); console.error(JSON.stringify({ key, error: message })); }
    }
    return;
  }
  throw new Error("Modes: status, migrate, municipal, quebec, csv, census-boundaries");
}
main().catch(async error => {
  const message = error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g, "[redacted]") : "Import failed";
  if (activeKey) await query("UPDATE property_import_runs SET status='failed',error=$2,updated_at=now() WHERE key=$1", [activeKey, message]).catch(() => undefined);
  console.error(message); process.exitCode = 1;
});

/** Bounded stream consumption: pausing for a database batch also pauses the child. */
async function* jsonLines(input: Readable, maxRecordBytes = 2_000_000): AsyncGenerator<string> {
  const decoder = new TextDecoder(); let buffer = "";
  for await (const chunk of input) {
    buffer += decoder.decode(chunk as Buffer, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      if (line.trim()) yield line;
    }
    if (buffer.length > maxRecordBytes) throw new Error("Oversized JSON source record");
  }
  buffer += decoder.decode(); if (buffer.trim()) yield buffer;
}
