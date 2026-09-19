/**
 * Minimal, dependency-free .xlsx writer — just enough SpreadsheetML for the
 * downloadable underwriting model: multiple sheets, inline strings, numbers,
 * live formulas (with cached values so previewers show numbers before a
 * recalculation), a small fixed style table, column widths and frozen panes.
 *
 * Why hand-rolled: the npm `xlsx` build is unmaintained (known CVEs, fixes only
 * ship from the vendor CDN) and exceljs pulls in ~20 MB for features we do not
 * use. An .xlsx is a ZIP of a handful of XML parts; Node's zlib does the rest.
 */
import zlib from "zlib";

// ---------- styles ----------

/** Indexes into the cellXfs table written by stylesXml(). */
export const XLSX_STYLE = {
  default: 0,
  title: 1,
  section: 2,
  currency: 3,
  percent: 4,
  integer: 5,
  inputCurrency: 6,
  inputPercent: 7,
  inputInteger: 8,
  label: 9,
  totalCurrency: 10,
  ratio: 11,
  note: 12,
  header: 13,
  totalPercent: 14,
  /** Same muted italic as `note`, but overflows into empty neighbours instead of wrapping. */
  caption: 15,
} as const;
export type XlsxStyle = (typeof XLSX_STYLE)[keyof typeof XLSX_STYLE];

export interface XlsxCell {
  /** Literal value, or the cached result when `formula` is set. */
  value?: string | number | null;
  /** Formula without the leading "=". */
  formula?: string;
  style?: XlsxStyle;
}

export interface XlsxSheet {
  name: string;
  /** Dense rows; `null` leaves a cell (or a whole row) empty. */
  rows: Array<Array<XlsxCell | null> | null>;
  columnWidths?: number[];
  /** Freeze the first `cols` columns and `rows` rows. */
  freeze?: { cols: number; rows: number };
}

// ---------- helpers ----------

export function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function cellRef(col: number, row: number, absolute = false): string {
  return absolute ? `$${columnLetter(col)}$${row + 1}` : `${columnLetter(col)}${row + 1}`;
}

function escapeXml(value: string): string {
  return value
    // XML 1.0 forbids most control characters outright.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Excel caps sheet names at 31 chars and bans []:*?/\ */
function safeSheetName(name: string): string {
  return name.replace(/[\[\]:*?/\\]/g, " ").slice(0, 31) || "Sheet";
}

// ---------- XML parts ----------

function cellXml(cell: XlsxCell, col: number, row: number): string {
  const ref = cellRef(col, row);
  const style = cell.style ? ` s="${cell.style}"` : "";
  if (cell.formula) {
    const cached = typeof cell.value === "number" && Number.isFinite(cell.value) ? `<v>${cell.value}</v>` : "";
    return `<c r="${ref}"${style}><f>${escapeXml(cell.formula)}</f>${cached}</c>`;
  }
  if (typeof cell.value === "number") {
    return Number.isFinite(cell.value) ? `<c r="${ref}"${style}><v>${cell.value}</v></c>` : "";
  }
  if (cell.value == null || cell.value === "") return style ? `<c r="${ref}"${style}/>` : "";
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(cell.value))}</t></is></c>`;
}

function sheetXml(sheet: XlsxSheet): string {
  const cols = sheet.columnWidths?.length
    ? `<cols>${sheet.columnWidths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";
  let pane = "";
  if (sheet.freeze && (sheet.freeze.cols > 0 || sheet.freeze.rows > 0)) {
    const { cols: c, rows: r } = sheet.freeze;
    const activePane = c > 0 && r > 0 ? "bottomRight" : c > 0 ? "topRight" : "bottomLeft";
    pane = `<pane${c > 0 ? ` xSplit="${c}"` : ""}${r > 0 ? ` ySplit="${r}"` : ""} topLeftCell="${cellRef(c, r)}" activePane="${activePane}" state="frozen"/>`;
  }
  const rows = sheet.rows
    .map((row, r) => {
      if (!row) return "";
      const cells = row.map((cell, c) => (cell ? cellXml(cell, c, r) : "")).join("");
      return cells ? `<row r="${r + 1}">${cells}</row>` : "";
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rows}</sheetData></worksheet>`;
}

function stylesXml(): string {
  // Financial-model convention: blue text on pale yellow = an input you may change.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;$&quot;#,##0;[Red]\\-&quot;$&quot;#,##0"/><numFmt numFmtId="165" formatCode="0.00%"/><numFmt numFmtId="166" formatCode="0.00&quot;x&quot;"/></numFmts>
<fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF1F4FD8"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF7F7F7F"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF8DC"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="3"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color auto="1"/></top><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="16">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="3" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="165" fontId="3" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="1" fontId="3" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>
<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function workbookXml(sheets: XlsxSheet[]): string {
  const entries = sheets
    .map((sheet, i) => `<sheet name="${escapeXml(safeSheetName(sheet.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("");
  // fullCalcOnLoad: spreadsheet apps recompute every formula on open, so the
  // cached values are only ever a fallback for non-calculating previewers.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${entries}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
}

function workbookRelsXml(sheets: XlsxSheet[]): string {
  const rels = sheets
    .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function contentTypesXml(sheets: XlsxSheet[]): string {
  const overrides = sheets
    .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`;
}

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

// ---------- ZIP container ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function zipFiles(files: Array<{ name: string; data: Buffer }>, now = new Date()): Buffer {
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const compressed = zlib.deflateRawSync(file.data);
    const crc = crc32(file.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30); // extra
    central.writeUInt16LE(0, 32); // comment
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

// ---------- public API ----------

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function buildXlsx(sheets: XlsxSheet[]): Buffer {
  if (!sheets.length) throw new Error("buildXlsx: at least one sheet is required");
  const part = (name: string, xml: string) => ({ name, data: Buffer.from(xml, "utf8") });
  return zipFiles([
    part("[Content_Types].xml", contentTypesXml(sheets)),
    part("_rels/.rels", ROOT_RELS_XML),
    part("xl/workbook.xml", workbookXml(sheets)),
    part("xl/_rels/workbook.xml.rels", workbookRelsXml(sheets)),
    part("xl/styles.xml", stylesXml()),
    ...sheets.map((sheet, i) => part(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sheet))),
  ]);
}
