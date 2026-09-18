import zlib from "zlib";
import { describe, expect, it } from "vitest";
import type { BuyHoldInputs } from "@shared/schema";
import { calculateBuyHoldAnalysis } from "@shared/buyHoldAnalysis";
import { buildProFormaCsv, buildProFormaSheets, buildProFormaWorkbook } from "./proFormaWorkbook";
import { buildXlsx, cellRef, columnLetter, crc32, XLSX_STYLE } from "./xlsx";

const inputs: BuyHoldInputs = {
  purchasePrice: 750_000,
  closingCosts: 22_500,
  downPaymentPercent: 20,
  interestRate: 5.5,
  amortizationYears: 25,
  loanTermYears: 5,
  monthlyRent: 4200,
  vacancyPercent: 5,
  propertyTax: 7500,
  insurance: 3600,
  utilities: 150,
  maintenancePercent: 5,
  managementPercent: 5,
  capexReservePercent: 5,
  otherExpenses: 50,
  rentGrowthPercent: 2,
  expenseInflationPercent: 2,
  appreciationPercent: 3,
  holdingPeriodYears: 7,
  sellingCostsPercent: 5,
  isCmhcMliSelect: false,
  cmhcMliPoints: 0,
};

/** Minimal ZIP reader: walks the central directory and inflates each entry. */
function unzip(buffer: Buffer): Map<string, Buffer> {
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(eocd).toBeGreaterThan(0);
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const files = new Map<string, Buffer>();
  for (let i = 0; i < count; i += 1) {
    expect(buffer.readUInt32LE(offset)).toBe(0x02014b50);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = zlib.inflateRawSync(buffer.subarray(dataStart, dataStart + compressedSize));
    expect(data.length).toBe(size);
    expect(crc32(data)).toBe(crc);
    files.set(name, data);
    offset += 46 + nameLength;
  }
  return files;
}

describe("xlsx writer", () => {
  it("names columns the way spreadsheets do", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnLetter)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"]);
    expect(cellRef(1, 5)).toBe("B6");
    expect(cellRef(1, 5, true)).toBe("$B$6");
  });

  it("matches the reference CRC-32", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });

  it("writes a well-formed package with escaped text and formulas", () => {
    const files = unzip(buildXlsx([{
      name: "Bad/Name:*?",
      rows: [[{ value: "Rent & <fees>" }, { formula: 'IF(A2>1,"a&b",0)', value: 1, style: XLSX_STYLE.currency }]],
    }]));

    expect([...files.keys()]).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]);
    const sheet = files.get("xl/worksheets/sheet1.xml")!.toString("utf8");
    expect(sheet).toContain("Rent &amp; &lt;fees&gt;");
    // Control characters are illegal in XML 1.0 and would make Excel refuse the file.
    const dirty = unzip(buildXlsx([{ name: "S", rows: [[{ value: `a${String.fromCharCode(0, 8, 11, 31)}b\tc` }]] }]));
    expect(dirty.get("xl/worksheets/sheet1.xml")!.toString("utf8")).toContain(">ab\tc<");
    expect(sheet).toContain('<f>IF(A2&gt;1,&quot;a&amp;b&quot;,0)</f><v>1</v>');
    expect(files.get("xl/workbook.xml")!.toString("utf8")).toContain('name="Bad Name   "');
    // Every style index used by the model must exist in the style table.
    const xfCount = Number(/<cellXfs count="(\d+)"/.exec(files.get("xl/styles.xml")!.toString("utf8"))![1]);
    expect(Math.max(...Object.values(XLSX_STYLE))).toBeLessThan(xfCount);
  });
});

describe("pro forma workbook", () => {
  const engine = calculateBuyHoldAnalysis(inputs);
  const [summary, assumptions, proForma] = buildProFormaSheets(inputs, { title: "123 Main St, Hamilton, ON" });

  it("has the three sheets, with one Pro Forma column per projected year", () => {
    expect([summary.name, assumptions.name, proForma.name]).toEqual(["Summary", "Assumptions", "Pro Forma"]);
    expect(proForma.rows[0]!.length).toBe(1 + engine.yearlyProjections.length);
    expect(proForma.freeze).toEqual({ cols: 1, rows: 1 });
  });

  it("stores inputs as editable values (percent as fractions) and everything else as formulas", () => {
    const value = (row: number) => assumptions.rows[row]![1]!;
    expect(value(5)).toMatchObject({ value: 750_000, style: XLSX_STYLE.inputCurrency });
    expect(value(7)).toMatchObject({ value: 0.2, style: XLSX_STYLE.inputPercent });
    expect(value(8).value).toBeCloseTo(0.055, 10);
    expect(value(33).formula).toBe("B6-B33"); // loan = price − down payment
    expect(value(33).value).toBe(600_000);

    const formulaCells = proForma.rows.flatMap((row) => (row ?? []).slice(1)).filter(Boolean);
    expect(formulaCells.length).toBeGreaterThan(200);
    expect(formulaCells.filter((cell) => !cell!.formula).length).toBe(1); // only the literal "Year 1"
  });

  it("caches the engine's numbers so previews agree with realist.ca", () => {
    const yearSeven = (row: number) => proForma.rows[row]![7]!.value as number;
    const y7 = engine.yearlyProjections[6];
    expect(yearSeven(1)).toBeCloseTo(y7.grossRent, 6);
    expect(yearSeven(12)).toBeCloseTo(y7.noi, 6);
    expect(yearSeven(14)).toBeCloseTo(y7.cashFlow, 6);
    expect(yearSeven(18)).toBeCloseTo(y7.loanBalance, 6);
    expect(yearSeven(21)).toBeCloseTo(y7.totalReturn, 6);

    expect(summary.rows[5]![1]!.value).toBeCloseTo(engine.capRate / 100, 10);
    expect(summary.rows[11]![1]!.value).toBeCloseTo((engine.irr ?? 0) / 100, 10);
    expect(summary.rows[11]![1]!.formula).toBe("IFERROR(IRR(B15:B25),0)");
  });

  it("puts the sale in the exit year of the IRR cash-flow column and nothing after it", () => {
    const flow = (year: number) => summary.rows[14 + year]![1]!.value as number;
    const y7 = engine.yearlyProjections[6];
    expect(flow(0)).toBe(-engine.totalCashInvested);
    expect(flow(6)).toBeCloseTo(engine.yearlyProjections[5].cashFlow, 6);
    expect(flow(7)).toBeCloseTo(y7.cashFlow + y7.propertyValue * 0.95 - y7.loanBalance, 6);
    expect(flow(8)).toBe(0);
  });

  it("zips to a real .xlsx and handles edge cases without throwing", () => {
    const files = unzip(buildProFormaWorkbook(inputs, { title: "Test & <deal>", viewUrl: "https://realist.ca/v/abc" }));
    expect(files.size).toBe(8);
    expect(files.get("xl/workbook.xml")!.toString("utf8")).toContain('fullCalcOnLoad="1"');

    for (const edge of [{ interestRate: 0 }, { downPaymentPercent: 100 }, { holdingPeriodYears: 15 }, { monthlyRent: 0 }]) {
      expect(() => buildProFormaWorkbook({ ...inputs, ...edge }, { title: "edge" })).not.toThrow();
    }
  });

  it("exports the pro forma as CSV", () => {
    const lines = buildProFormaCsv(inputs).trim().split("\n");
    expect(lines[0]).toBe(["Line item", ...engine.yearlyProjections.map((y) => `Year ${y.year}`)].join(","));
    expect(lines.find((line) => line.startsWith("Cash flow,"))).toBe(
      ["Cash flow", ...engine.yearlyProjections.map((y) => Math.round(y.cashFlow))].join(","),
    );
  });
});
