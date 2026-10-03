import { XMLParser, XMLValidator } from "fast-xml-parser";
import { zipEntries } from "./archive";
import { OTTAWA_PERMIT_FILES, type OttawaPermitFile } from "../ottawa-permit-sources";
import { number, text, type Row } from "../model";

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", removeNSPrefix: true, parseTagValue: false, parseAttributeValue: false, trimValues: false, isArray: name => ["sheet", "Relationship", "si", "r", "row", "c", "mergeCell"].includes(name) });
function xml(bytes: Buffer): Row {
  const value = bytes.toString("utf8");
  if (bytes.length > 40_000_000 || /<!DOCTYPE|<!ENTITY/i.test(value) || XMLValidator.validate(value) !== true) throw new Error("Unsupported workbook XML");
  return xmlParser.parse(value) as Row;
}
function object(v: unknown): Row { return v && typeof v === "object" && !Array.isArray(v) ? v as Row : {}; }
function list(v: unknown): Row[] { return Array.isArray(v) ? v.map(object) : []; }
function stringValue(v: unknown): string { return typeof v === "string" ? v : typeof object(v)["#text"] === "string" ? object(v)["#text"] as string : ""; }
function richString(v: unknown): string { const r = object(v); return stringValue(r.t) + list(r.r).map(x => stringValue(x.t)).join(""); }
const clean = (v: string): string => v.replace(/\s+/g, " ").trim();
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export function excelDate(v: string, date1904 = false): string | null {
  const serial = number(v);
  if (serial === null || serial < 1 || serial > 100_000 || !Number.isFinite(serial)) return null;
  // Preserve the published calendar date, including Excel's 1900 leap-year convention.
  if (!date1904 && Math.floor(serial) === 60) return null; // Excel's fictitious February 29, 1900.
  const days = !date1904 && serial < 60 ? Math.floor(serial) + 1 : Math.floor(serial);
  const date = new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30) + days * 86_400_000);
  return date.toISOString().slice(0, 10);
}
function periodDate(value: string): string {
  const m = value.match(/^(20\d\d)-([A-Z]{3})-(\d{2})$/);
  if (!m || !MONTHS.includes(m[2])) throw new Error("Unknown permit reporting period");
  const date = `${m[1]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, "0")}-${m[3]}`;
  if (new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date) throw new Error("Invalid reporting date");
  return date;
}
interface Cell { value: string; formula: boolean; }
interface WorksheetRow { row: number; cells: Record<string, Cell>; }
export interface OttawaPermitParsed { records: Row[]; reportingPeriods: string[]; }
export const OTTAWA_PERMIT_FIELDS = ["OBJECTID", "permitNumber", "address", "postalCode", "publishedWard", "community", "description", "buildingType", "applicationType", "publishedDwellingUnits", "publishedWorkValueCAD", "publishedWorkArea", "publishedWorkAreaUnit", "unparsedMeasures", "publishedIssuedDate", "sourceItemId", "sourceSheet", "sourceRow", "reportingPeriodStart", "reportingPeriodEnd"];

/** Parse only property fields from the two fixed public files; never evaluate a formula. */
export function parseOttawaPermits(bytes: Buffer, file: OttawaPermitFile): OttawaPermitParsed {
  const entries = zipEntries(bytes);
  const read = (name: string) => { const entry = entries.get(name); if (!entry) throw new Error("Workbook part missing"); return xml(entry()); };
  const workbook = object(read("xl/workbook.xml").workbook);
  const date1904 = ["1", "true"].includes(String(object(workbook.workbookPr)["@date1904"]));
  const shared = entries.has("xl/sharedStrings.xml") ? list(object(read("xl/sharedStrings.xml").sst).si).map(richString) : [];
  const relationships = list(object(read("xl/_rels/workbook.xml.rels").Relationships).Relationship);
  const sheets = list(object(workbook.sheets).sheet);
  if (!sheets.length || sheets.length > 40 || shared.length > 150_000) throw new Error("Workbook bound exceeded");
  const records: Row[] = [], periods = new Set<string>();
  for (const sheet of sheets) {
    const name = String(sheet["@name"]), rel = relationships.find(x => x["@Id"] === sheet["@id"]);
    const target = text(rel?.["@Target"]);
    if (!target || rel?.["@TargetMode"] === "External" || !/^\/?(?:xl\/)?worksheets\/sheet\d+\.xml$/.test(target)) throw new Error("Unknown worksheet relationship");
    const path = target.startsWith("/") ? target.slice(1) : target.startsWith("xl/") ? target : "xl/" + target;
    const worksheet = object(read(path).worksheet);
    const rawRows = list(object(object(worksheet).sheetData).row);
    if (rawRows.length > 20_000) throw new Error("Worksheet row bound exceeded");
    const rows: WorksheetRow[] = rawRows.map(r => {
      const row = Number(r["@r"]), cells: Record<string, Cell> = {};
      if (!Number.isInteger(row) || row < 1) throw new Error("Invalid worksheet row");
      for (const c of list(r.c)) {
        const ref = String(c["@r"]), match = ref.match(/^([A-Z]{1,3})(\d+)$/);
        if (!match || Number(match[2]) !== row || cells[match[1]]) throw new Error("Invalid worksheet cell");
        let value = stringValue(c.v);
        if (c["@t"] === "s") {
          const i = Number(value); if (!/^\d+$/.test(value) || i >= shared.length) throw new Error("Invalid shared string"); value = shared[i];
        } else if (c["@t"] === "inlineStr") value = richString(c.is);
        cells[match[1]] = { value: value.trim(), formula: c.f !== undefined };
      }
      return { row, cells };
    });
    const header = rows.slice(0, 15).find(r => Object.values(r.cells).some(c => ["PERMIT NUMBER", "PERMIT#"].includes(c.value)));
    if (!header) {
      // The 2024 workbook also contains explicitly labelled summary-statistics tabs.
      if (!rows.slice(0, 5).some(r => Object.values(r.cells).some(c => /ISSUED PERMIT STATISTICS/.test(c.value)))) throw new Error("Unknown permit worksheet");
      continue;
    }
    const columns = Object.fromEntries(Object.entries(header.cells).map(([k, v]) => [clean(v.value), k]));
    const legacy = columns["ST #"] !== undefined;
    const required = legacy ? ["ST #", "ROAD", "PC", "WARD", "BLG TYPE", "MUNICIPALITY", "DESCRIPTION", "D.U.", "VALUE", "FT2", "PERMIT#", "APPL. TYPE", "ISSUED DATE"] : ["STREET ADDRESS", "POSTAL CODE", "WARD", "BUILDING TYPE", "COMMUNITY", "DESCRIPTION", "D.U.", "VALUE", "SQUARE METRES", "PERMIT NUMBER", "ISSUED DATE"];
    if (!required.every(k => columns[k]) || required.some(k => header.cells[columns[k]].formula)) throw new Error("Permit worksheet schema changed");
    // Repeat values only where the workbook explicitly merges that property column.
    // Unpublished addresses/communities (including master plans) are never filled down.
    const rowIndex = new Map(rows.map(r => [r.row, r]));
    for (const merge of list(object(object(worksheet).mergeCells).mergeCell)) {
      const m = String(merge["@ref"]).match(/^([A-Z]{1,3})(\d+):([A-Z]{1,3})(\d+)$/);
      if (!m || m[1] !== m[3] || !required.some(k => columns[k] === m[1])) continue;
      const first = Number(m[2]), last = Number(m[4]);
      if (last < first || last - first > 100) throw new Error("Merged-cell bound exceeded");
      const cell = rowIndex.get(first)?.cells[m[1]];
      if (!cell) continue;
      for (let i = first + 1; i <= last; i++) {
        const r = rowIndex.get(i); if (!r) continue;
        if (r.cells[m[1]]?.value) throw new Error("Conflicting merged-cell value");
        r.cells[m[1]] = cell;
      }
    }
    let start: string | null = null, end: string | null = null;
    if (legacy) {
      if (name !== "Permits" || !file.legacyMonths.length) throw new Error("Unexpected legacy sheet");
      file.legacyMonths.forEach(m => periods.add(m));
    } else {
      const ranges = rows.slice(0, 8).flatMap(r => Object.values(r.cells).map(c => c.value.match(/\b(20\d\d-[A-Z]{3}-\d{2}) TO (20\d\d-[A-Z]{3}-\d{2})\b/))).filter(x => x !== null);
      if (ranges.length !== 1) throw new Error("Reporting period missing or ambiguous");
      start = periodDate(ranges[0]![1]); end = periodDate(ranges[0]![2]);
      if (start.slice(0, 7) !== end.slice(0, 7) || !file.years.some(y => y === Number(start!.slice(0, 4))) || start.slice(8) !== "01" || new Date(end + "T00:00:00Z").getUTCDate() !== new Date(Number(end.slice(0, 4)), Number(end.slice(5, 7)), 0).getDate() || periods.has(start.slice(0, 7))) throw new Error("Reporting period changed or duplicated");
      periods.add(start.slice(0, 7));
    }
    let count = 0;
    for (const r of rows.filter(r => r.row > header.row)) {
      const raw = (key: string) => r.cells[columns[key]]?.value ?? "";
      const value = (key: string) => clean(raw(key));
      const permit = value(legacy ? "PERMIT#" : "PERMIT NUMBER");
      if (!permit) continue; // Blank rows and the separately labelled footer totals.
      if (!/^[A-Z0-9][A-Z0-9-]{3,60}$/i.test(permit) || required.some(k => r.cells[columns[k]]?.formula)) throw new Error("Invalid permit observation");
      const address = legacy ? clean(`${value("ST #")} ${value("ROAD")}`) : raw("STREET ADDRESS").split(/\r?\n/).map(clean).filter(Boolean).join("\n");
      const issued = excelDate(value("ISSUED DATE"), date1904);
      if (!issued) throw new Error("Permit issued date missing");
      if (legacy && !file.legacyMonths.some(m => m === issued.slice(0, 7))) throw new Error("Legacy reporting scope changed");
      const unparsed: Row = {};
      const numeric = (key: string) => { const n = number(value(key)); if (value(key) && n === null) unparsed[key] = value(key); return n; };
      records.push({ OBJECTID: `${file.item}:${name}:${r.row}`, permitNumber: permit, address: address || null, postalCode: value(legacy ? "PC" : "POSTAL CODE") || null, publishedWard: value("WARD") || null, community: value(legacy ? "MUNICIPALITY" : "COMMUNITY") || null, description: value("DESCRIPTION") || null, buildingType: value(legacy ? "BLG TYPE" : "BUILDING TYPE") || null, applicationType: legacy ? value("APPL. TYPE") || null : null, publishedDwellingUnits: numeric("D.U."), publishedWorkValueCAD: numeric("VALUE"), publishedWorkArea: numeric(legacy ? "FT2" : "SQUARE METRES"), publishedWorkAreaUnit: legacy ? "square_feet" : "square_metres", unparsedMeasures: unparsed, publishedIssuedDate: issued, sourceItemId: file.item, sourceSheet: name, sourceRow: r.row, reportingPeriodStart: start ?? issued.slice(0, 7) + "-01", reportingPeriodEnd: end ?? new Date(Date.UTC(Number(issued.slice(0, 4)), Number(issued.slice(5, 7)), 0)).toISOString().slice(0, 10) });
      count++;
    }
    if (!count || legacy && !file.legacyMonths.every(m => records.some(r => r.sourceSheet === name && String(r.reportingPeriodStart).slice(0, 7) === m))) throw new Error("Empty or incomplete permit report; preserve last good snapshot");
  }
  if (!records.length || records.length > 50_000) throw new Error("Permit observation bound exceeded");
  return { records, reportingPeriods: [...periods].sort() };
}

export function validOttawaPermitRecords(records: Row[], periods: string[]): boolean {
  const validDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  const measures: Record<string, string> = { "D.U.": "publishedDwellingUnits", VALUE: "publishedWorkValueCAD", FT2: "publishedWorkArea", "SQUARE METRES": "publishedWorkArea" };
  return periods.length > 0 && periods.length <= 36 && new Set(periods).size === periods.length && periods.every(p => /^202[4-6]-(0[1-9]|1[0-2])$/.test(p)) && records.every(r => {
    const unparsed = object(r.unparsedMeasures);
    return Object.keys(r).length === OTTAWA_PERMIT_FIELDS.length && Object.keys(r).every(k => OTTAWA_PERMIT_FIELDS.includes(k)) && OTTAWA_PERMIT_FILES.some(f => f.item === r.sourceItemId) && Number.isInteger(r.sourceRow) && Number(r.sourceRow) > 1 && r.OBJECTID === `${r.sourceItemId}:${r.sourceSheet}:${r.sourceRow}` && typeof r.permitNumber === "string" && (typeof r.address === "string" || r.address === null) && (typeof r.community === "string" || r.community === null) && validDate(r.publishedIssuedDate) && ["square_feet", "square_metres"].includes(String(r.publishedWorkAreaUnit)) && validDate(r.reportingPeriodStart) && validDate(r.reportingPeriodEnd) && periods.includes(String(r.reportingPeriodStart).slice(0, 7)) && ["publishedDwellingUnits", "publishedWorkValueCAD", "publishedWorkArea"].every(k => r[k] === null || typeof r[k] === "number" && Number.isFinite(r[k])) && r.unparsedMeasures !== null && typeof r.unparsedMeasures === "object" && !Array.isArray(r.unparsedMeasures) && Object.entries(unparsed).every(([k, v]) => k in measures && typeof v === "string" && v.length < 200 && r[measures[k]] === null);
  });
}
