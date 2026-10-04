import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { crc32 } from "./archive";
import { excelDate, parseOttawaPermits } from "./ottawa-permits";
import { OTTAWA_PERMIT_FILES, validOttawaPermitItem } from "../ottawa-permit-sources";

function zip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [], directory: Buffer[] = []; let offset = 0;
  for (const [path, value] of Object.entries(files)) {
    const name = Buffer.from(path), raw = Buffer.from(value), packed = deflateRawSync(raw), local = Buffer.alloc(30), central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8, 8); local.writeUInt16LE(name.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(8, 10); central.writeUInt32LE(crc32(raw), 16); central.writeUInt32LE(packed.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, name, packed); directory.push(central, name); offset += local.length + name.length + packed.length;
  }
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 10); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...directory, end]);
}
const escape = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;");
function row(n: number, values: string[], formulaColumn = -1): string {
  return `<row r="${n}">${values.map((v, i) => `<c r="${String.fromCharCode(65 + i)}${n}" t="inlineStr">${i === formulaColumn ? "<f>1+1</f>" : ""}<is><t>${escape(v)}</t></is></c>`).join("")}</row>`;
}
function workbook(options: { rows?: string[][]; extraColumn?: boolean; formula?: boolean; missingHeader?: boolean; period?: string; merge?: boolean; external?: boolean; unsafe?: boolean } = {}): Buffer {
  const headers = ["STREET ADDRESS", "POSTAL CODE", "WARD", "ISSUED DATE", "BUILDING TYPE", "COMMUNITY", "DESCRIPTION", "D.U.", "VALUE", "SQUARE METRES", "PERMIT NUMBER"];
  const data = options.rows ?? [["99 Fourth Ave", "K1S2L1", "17", "37831", "Office", "Old Ottawa", "Cancelled: Revision to an older permit", "0", "0", "0", "REV-A03-004231"]];
  if (options.extraColumn) { headers.splice(5, 0, "DEV CHARGES"); data.forEach(r => r.splice(5, 0, "999")); }
  if (options.missingHeader) headers[0] = "REPLACED ADDRESS";
  const worksheet = `${options.unsafe ? '<!DOCTYPE x [<!ENTITY remote SYSTEM "https://example.com/secret">]>' : ""}<worksheet><sheetData>${row(2, [options.period ?? "2026-JUL-01 TO 2026-JUL-31"])}${row(9, headers)}${data.map((r, i) => row(10 + i, r, options.formula ? 8 : -1)).join("")}${row(20, ["TOTAL", "", "", "", "", "", "", "12", "30000"])}</sheetData>${options.merge ? '<mergeCells><mergeCell ref="A10:A11"/></mergeCells>' : ""}</worksheet>`;
  return zip({ "xl/workbook.xml": '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="July 2026" r:id="rId1"/></sheets></workbook>', "xl/_rels/workbook.xml.rels": `<Relationships><Relationship Id="rId1" Target="${options.external ? "https://example.com/data" : "worksheets/sheet1.xml"}"${options.external ? ' TargetMode="External"' : ""}/></Relationships>`, "xl/worksheets/sheet1.xml": worksheet });
}
describe("Ottawa permit report ingestion", () => {
  it("binds the fixed official Excel item and explicit city open-data policy", () => {
    const f = OTTAWA_PERMIT_FILES[1], item = { id: f.item, owner: "open.ouvert@ottawa.ca", orgId: "G6F8XLCl5KtAlZ2G", access: "public", type: "Microsoft Excel", name: f.name, title: f.title, url: null, licenseInfo: "<p>https://ottawa.ca/en/city-hall/open-transparent-and-accountable-government/open-data</p>" };
    expect(validOttawaPermitItem(item, f)).toBe(true);
    for (const change of [{ owner: "third-party" }, { id: "other" }, { access: "private" }, { name: "other.xlsx" }, { licenseInfo: "" }, { licenseInfo: "non-commercial only" }]) expect(validOttawaPermitItem({ ...item, ...change }, f)).toBe(false);
  });
  it("keeps an older issued date and cancelled description separate from reporting month", () => {
    const p = parseOttawaPermits(workbook(), OTTAWA_PERMIT_FILES[1]);
    expect(p.records).toHaveLength(1); expect(p.reportingPeriods).toEqual(["2026-07"]);
    expect(p.records[0]).toMatchObject({ publishedIssuedDate: "2003-07-29", reportingPeriodStart: "2026-07-01", reportingPeriodEnd: "2026-07-31", publishedWorkValueCAD: 0, publishedWorkAreaUnit: "square_metres" });
    expect(p.records[0].description).toContain("Cancelled");
  });
  it("maps measures by headers after the development-charge column is added", () => {
    const p = parseOttawaPermits(workbook({ extraColumn: true, rows: [["99 Fourth Ave", "", "17", "46200", "Office", "Old Ottawa", "Renovation", "1", "125000", "125", "CON-2026-123456"]] }), OTTAWA_PERMIT_FILES[1]);
    expect(p.records[0]).toMatchObject({ publishedDwellingUnits: 1, publishedWorkValueCAD: 125000, publishedWorkArea: 125 });
    expect(JSON.stringify(p)).not.toContain("999");
  });
  it("preserves malformed source numbers as unknown with original text", () => {
    const p = parseOttawaPermits(workbook({ rows: [["99 Fourth Ave", "", "17", "46200", "Office", "Old Ottawa", "Renovation", "0", "13.000.00", ",", "CON-2026-123456"]] }), OTTAWA_PERMIT_FILES[1]);
    expect(p.records[0]).toMatchObject({ publishedWorkValueCAD: null, publishedWorkArea: null, unparsedMeasures: { VALUE: "13.000.00", "SQUARE METRES": "," } });
  });
  it("retains separate address observations and only repeats explicitly merged cells", () => {
    const first = ["99 Fourth Ave", "", "17", "46200", "Office", "Old Ottawa", "Renovation", "0", "10", "1", "CON-2026-123456"];
    const second = [...first]; second[0] = "";
    const merged = parseOttawaPermits(workbook({ rows: [first, second], merge: true }), OTTAWA_PERMIT_FILES[1]);
    expect(merged.records).toHaveLength(2); expect(merged.records[1].address).toBe("99 Fourth Ave"); expect(merged.records[1].OBJECTID).not.toBe(merged.records[0].OBJECTID);
    const unmerged = parseOttawaPermits(workbook({ rows: [first, second] }), OTTAWA_PERMIT_FILES[1]); expect(unmerged.records[1].address).toBeNull();
  });
  it("rejects changed schema, missing periods, external links, formulas and XML entities", () => {
    for (const options of [{ missingHeader: true }, { period: "unknown" }, { external: true }, { formula: true }, { unsafe: true }]) expect(() => parseOttawaPermits(workbook(options), OTTAWA_PERMIT_FILES[1])).toThrow();
  });
  it("handles calendar dates without local-time shifts or Excel's fictitious leap day", () => {
    expect(excelDate("46024.7")).toBe("2026-01-02"); expect(excelDate("1")).toBe("1900-01-01"); expect(excelDate("60")).toBeNull(); expect(excelDate("1", true)).toBe("1904-01-02");
  });
  it("keeps legacy square-foot measures and excludes contractor fields", () => {
    const headers = ["ST #", "ROAD", "PC", "WARD", "PLAN", "LOT", "CONTRACTOR", "BLG TYPE", "MUNICIPALITY", "DESCRIPTION", "D.U.", "VALUE", "FT2", "PERMIT#", "APPL. TYPE", "ISSUED DATE"];
    const records = Array.from({ length: 8 }, (_, i) => {
      const serial = (Date.UTC(2024, i, 2) - Date.UTC(1899, 11, 30)) / 86400000;
      return row(i + 2, ["232", "Calvington Ave", "", "Ward 4", "", "", "PRIVATE CONTRACTOR FIELD", "Single", "Kanata", "Finish basement", "0", "23008.69", "495.13", `240000${i}`, "Construction", String(serial)]);
    });
    const bytes = zip({ "xl/workbook.xml": '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Permits" r:id="rId1"/></sheets></workbook>', "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>', "xl/worksheets/sheet1.xml": `<worksheet><sheetData>${row(1, headers)}${records.join("")}</sheetData></worksheet>` });
    const parsed = parseOttawaPermits(bytes, OTTAWA_PERMIT_FILES[0]);
    expect(parsed.reportingPeriods).toHaveLength(8); expect(parsed.records[0]).toMatchObject({ address: "232 Calvington Ave", publishedWorkArea: 495.13, publishedWorkAreaUnit: "square_feet", publishedIssuedDate: "2024-01-02" });
    expect(JSON.stringify(parsed)).not.toContain("PRIVATE CONTRACTOR FIELD");
  });
});
