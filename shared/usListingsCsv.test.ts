import { describe, expect, it } from "vitest";
import {
  csvRowsToRecords,
  deriveUsListingActivity,
  mapHomeHarvestCsvRecord,
  parseCsv,
} from "./usListingsCsv";

const HEADER =
  "property_url,mls,mls_id,status,style,street,unit,city,state,zip_code,beds,full_baths,half_baths,sqft,year_built,list_price,list_date,latitude,longitude,hoa_fee,days_on_mls,primary_photo";

describe("parseCsv", () => {
  it("parses quoted fields with commas, escaped quotes, and newlines", () => {
    const rows = parseCsv('a,"b,1","say ""hi""","line1\nline2"\nc,d,e,f');
    expect(rows).toEqual([
      ["a", "b,1", 'say "hi"', "line1\nline2"],
      ["c", "d", "e", "f"],
    ]);
  });

  it("handles CRLF line endings and missing trailing newline", () => {
    const rows = parseCsv("a,b\r\nc,d");
    expect(rows).toEqual([["a", "b"], ["c", "d"]]);
  });
});

describe("csvRowsToRecords", () => {
  it("keys rows by lowercased trimmed headers and drops blank rows", () => {
    const records = csvRowsToRecords([
      [" City ", "List_Price"],
      ["Buffalo", "100000"],
      ["", " "],
    ]);
    expect(records).toEqual([{ city: "Buffalo", list_price: "100000" }]);
  });
});

describe("deriveUsListingActivity", () => {
  it("treats FOR_SALE, blank, and unknown statuses as active", () => {
    expect(deriveUsListingActivity("FOR_SALE").isActive).toBe(true);
    expect(deriveUsListingActivity("").isActive).toBe(true);
    expect(deriveUsListingActivity("COMING_SOON").isActive).toBe(true);
  });

  it("treats sold, off-market, and pending statuses as inactive", () => {
    expect(deriveUsListingActivity("SOLD")).toMatchObject({ isActive: false, isSold: true });
    expect(deriveUsListingActivity("Off Market")).toMatchObject({ isActive: false, isOffMarket: true });
    expect(deriveUsListingActivity("PENDING")).toMatchObject({ isActive: false, isUnderContract: true });
    expect(deriveUsListingActivity("under-contract").isActive).toBe(false);
  });
});

describe("mapHomeHarvestCsvRecord", () => {
  const sampleCsv = [
    HEADER,
    'https://www.realtor.com/p/1,WNY,B123,FOR_SALE,SINGLE_FAMILY,123 Main St,Unit 2,Buffalo,ny,14201,3,1,1,1500,1950,250000.0,2026-05-01,42.9,-78.87,55,12,https://img.example/1.jpg',
  ].join("\n");

  it("maps a HomeHarvest CSV row end-to-end", () => {
    const records = csvRowsToRecords(parseCsv(sampleCsv));
    const scrapedAt = new Date("2026-06-01T00:00:00Z");
    const mapped = mapHomeHarvestCsvRecord(records[0], 0, scrapedAt);
    expect(mapped).toMatchObject({
      source: "homeharvest",
      sourceId: "B123",
      sourceUrl: "https://www.realtor.com/p/1",
      streetAddress: "123 Main St Unit 2",
      formattedAddress: "123 Main St Unit 2, Buffalo, NY, 14201",
      city: "Buffalo",
      state: "NY",
      postalCode: "14201",
      lat: 42.9,
      lng: -78.87,
      propertyType: "SINGLE_FAMILY",
      beds: 3,
      baths: 1.5,
      sqft: 1500,
      yearBuilt: 1950,
      listPrice: 250000,
      estHoa: 55,
      daysOnMarket: 12,
      status: "FOR_SALE",
      isActive: true,
      scrapedAt,
    });
    expect(mapped?.listDate?.toISOString().slice(0, 10)).toBe("2026-05-01");
    expect(mapped?.raw.primary_photo).toBe("https://img.example/1.jpg");
  });

  it("skips rows without list_price or city", () => {
    expect(mapHomeHarvestCsvRecord({ city: "Buffalo", list_price: "" }, 0)).toBeNull();
    expect(mapHomeHarvestCsvRecord({ city: "", list_price: "100000" }, 0)).toBeNull();
    expect(mapHomeHarvestCsvRecord({ city: "Buffalo", list_price: "not-a-number" }, 0)).toBeNull();
  });

  it("falls back to mls-index key when mls_id is missing", () => {
    const mapped = mapHomeHarvestCsvRecord({ city: "Buffalo", list_price: "100000", mls: "WNY" }, 7);
    expect(mapped?.sourceId).toBe("WNY-7");
    const noMls = mapHomeHarvestCsvRecord({ city: "Buffalo", list_price: "100000" }, 3);
    expect(noMls?.sourceId).toBe("HH-3");
  });

  it("marks pending rows inactive while preserving the raw status text", () => {
    const mapped = mapHomeHarvestCsvRecord(
      { city: "Buffalo", list_price: "100000", status: "PENDING" },
      0,
    );
    expect(mapped?.status).toBe("PENDING");
    expect(mapped?.isActive).toBe(false);
  });

  it("combines full and half baths and tolerates missing numerics", () => {
    const mapped = mapHomeHarvestCsvRecord(
      { city: "Buffalo", list_price: "100000", half_baths: "1" },
      0,
    );
    expect(mapped?.baths).toBe(0.5);
    expect(mapped?.beds).toBeNull();
    expect(mapped?.sqft).toBeNull();
    const noBaths = mapHomeHarvestCsvRecord({ city: "Buffalo", list_price: "100000" }, 0);
    expect(noBaths?.baths).toBeNull();
  });
});
