import { describe, expect, it } from "vitest";
import {
  mapCoaRow,
  summarizeVarianceHistory,
  isApproved,
  isRefused,
  type CoaApplication,
} from "./coaApplications";

// Keys are the datastore-dump field IDs lower-cased by the importer, so the
// "reference_file#" hash and the misspelled "c_of_a_descision" read as-is.
// Rows are verbatim from the live CKAN dumps (2026-07).

describe("mapCoaRow", () => {
  it("maps a closed minor-variance row, assembling a suffix-direction address", () => {
    const r = mapCoaRow({
      "sys_id": "5274640",
      "application_type": "MV",
      "in_date": "2023-05-26T00:00:00",
      "ward_number": "15",
      "ward_name": "Don Valley West",
      "street_num": "200",
      "street_name": "KEEWATIN",
      "street_type": "AVE",
      "street_direction": " ",
      "reference_file#": "A0312/23NY",
      "description": "Proposal to expand underground parking through the addition of tandem parking spaces.",
      "hearing_date": "2023-10-26",
      "c_of_a_descision": "Approved",
      "statusdesc": "Closed",
      "finaldate": "2023-11-16T00:00:00",
    })!;
    expect(r.referenceFile).toBe("A0312/23NY");
    expect(r.applicationType).toBe("MV");
    expect(r.decision).toBe("Approved");
    expect(r.address).toBe("200 KEEWATIN AVE"); // blank direction dropped
    expect(r.looseAddressKey).toBe("200 keewatin ave");
    expect(r.wardNumber).toBe("15");
    expect(r.wardName).toBe("Don Valley West");
    expect(r.inDate).toBe("2023-05-26"); // ISO time suffix stripped
    expect(r.hearingDate).toBe("2023-10-26");
    expect(r.finalDate).toBe("2023-11-16");
  });

  it("keeps a trailing street direction as a suffix", () => {
    const r = mapCoaRow({
      "reference_file#": "A1010/22TEY",
      "street_num": "1925",
      "street_name": "GERRARD",
      "street_type": "ST",
      "street_direction": "E",
    })!;
    expect(r.address).toBe("1925 GERRARD ST E");
    // The shared loose key expands "st" -> "saint" (a Québec convention). It's
    // odd for Toronto but harmless: the listing address runs through the same
    // function, so both sides collide on the same key and still match.
    expect(r.looseAddressKey).toBe("1925 gerrard saint e");
  });

  it("reads ward from the active resource's WARD column when WARD_NUMBER is absent", () => {
    const r = mapCoaRow({
      "reference_file#": "B0028/25NY",
      "application_type": "CO",
      "work_type": "Sever Lot",
      "ward": "18",
      "street_num": "244",
      "street_name": "HOMEWOOD",
      "street_type": "AVE",
    })!;
    expect(r.applicationType).toBe("CO");
    expect(r.workType).toBe("Sever Lot");
    expect(r.wardNumber).toBe("18");
  });

  it("returns null when the file number is missing", () => {
    expect(mapCoaRow({ street_num: "1", street_name: "MAIN", street_type: "ST" })).toBeNull();
  });
});

describe("decision classification (real decision strings, 2026-07)", () => {
  it("treats every 'approved' variant as approved", () => {
    for (const d of ["Approved", "approved", "Approved with Conditions", "conditional approval"]) {
      expect(isApproved(d)).toBe(true);
      expect(isRefused(d)).toBe(false);
    }
  });
  it("classifies refusals and leaves withdrawn/deferred as neither", () => {
    expect(isRefused("Refused")).toBe(true);
    expect(isApproved("Withdrawn")).toBe(false);
    expect(isRefused("Withdrawn")).toBe(false);
    expect(isApproved("Deferred")).toBe(false);
    expect(isApproved(null)).toBe(false);
  });
});

describe("summarizeVarianceHistory", () => {
  const app = (over: Partial<CoaApplication>): CoaApplication => ({
    referenceFile: over.referenceFile ?? "X",
    sysId: null,
    applicationType: over.applicationType ?? "MV",
    subType: null,
    workType: null,
    status: null,
    decision: over.decision ?? null,
    ombDecision: over.ombDecision ?? null,
    address: null,
    looseAddressKey: null,
    wardNumber: null,
    wardName: null,
    zoningReview: null,
    zoningDesignation: null,
    description: null,
    inDate: over.inDate ?? null,
    hearingDate: over.hearingDate ?? null,
    finalDate: null,
    numberOfLotsCreated: null,
    applicationUrl: null,
  });

  it("counts types, outcomes, appeals and picks the most recent by date", () => {
    const s = summarizeVarianceHistory([
      app({ referenceFile: "A1/20", applicationType: "MV", decision: "Approved", hearingDate: "2020-05-01" }),
      app({ referenceFile: "A2/23", applicationType: "MV", decision: "Refused", hearingDate: "2023-09-01" }),
      app({ referenceFile: "B1/21", applicationType: "CO", decision: "Approved with Conditions", ombDecision: "Appeal Allowed", hearingDate: "2021-01-01" }),
    ]);
    expect(s.total).toBe(3);
    expect(s.minorVariances).toBe(2);
    expect(s.consents).toBe(1);
    expect(s.approved).toBe(2); // Approved + Approved with Conditions
    expect(s.refused).toBe(1);
    expect(s.withOmbAppeal).toBe(1);
    expect(s.mostRecent?.referenceFile).toBe("A2/23"); // latest hearing date
    expect(s.mostRecent?.date).toBe("2023-09-01");
  });

  it("returns a null mostRecent for an empty history", () => {
    const s = summarizeVarianceHistory([]);
    expect(s.total).toBe(0);
    expect(s.mostRecent).toBeNull();
  });
});
