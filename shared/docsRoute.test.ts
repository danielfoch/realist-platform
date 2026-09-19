import { describe, expect, it } from "vitest";
import {
  classifyDocument,
  docsRouteInputSchema,
  listClosingChecklists,
  listDocClasses,
  missingForClosing,
  suggestDocFilename,
} from "./docsRoute";

const OFFER_LETTER = `
AGREEMENT OF PURCHASE AND SALE
OREA Form 100
The Buyer agrees to purchase the property municipally known as 10 Queen Street West.
This offer to purchase is submitted for the seller's consideration.
`;

const INSPECTION_SNIPPET = `
PROPERTY INSPECTION REPORT
Home inspection performed by a licensed inspector.
Visible deficiencies: roof flashing, basement moisture.
`;

const MORTGAGE_SNIPPET = `
MORTGAGE COMMITMENT
The lender hereby issues this commitment letter confirming loan approval
subject to standard conditions.
`;

describe("docs.route classifier fixtures", () => {
  it("classifies an offer letter as offer at high confidence", () => {
    const result = classifyDocument({
      filename: "APS-10-Queen.pdf",
      textContent: OFFER_LETTER,
      dealId: "deal-1",
    });
    expect(result.docClass).toBe("offer");
    expect(result.confidence).toBe("high");
    expect(result.target.resolved).toBe(true);
    expect(result.warnings.join(" ")).toMatch(/Did not extract party names/);
  });

  it("classifies an inspection snippet", () => {
    const result = classifyDocument({
      filename: "inspection-123.pdf",
      textContent: INSPECTION_SNIPPET,
      analysisId: "an-1",
    });
    expect(result.docClass).toBe("inspection_report");
    expect(["high", "medium"]).toContain(result.confidence);
  });

  it("classifies a mortgage commitment snippet", () => {
    const result = classifyDocument({
      filename: "mortgage-commitment.pdf",
      textContent: MORTGAGE_SNIPPET,
      mlsNumber: "C1234567",
    });
    expect(result.docClass).toBe("mortgage_commitment");
    expect(result.confidence).toBe("high");
    expect(result.suggestedFilename).toMatch(/mortgage/);
  });

  it("stays low-confidence other without inventing facts from weak text", () => {
    const result = classifyDocument({
      filename: "scan.pdf",
      textContent: "Please see attached. Thanks, Jane.",
    });
    expect(result.docClass).toBe("other");
    expect(result.confidence).toBe("low");
    expect(result.target.resolved).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/Jane/);
    expect(result.warnings.join(" ")).toMatch(/purchase price/);
  });

  it("does not treat base64-only PDF as high confidence", () => {
    const result = classifyDocument({
      filename: "unknown.pdf",
      mimeType: "application/pdf",
      base64: "JVBERi0xLjQ=",
      dealId: "deal-9",
    });
    expect(result.confidence).toBe("low");
    expect(result.warnings.join(" ")).toMatch(/does not OCR/);
  });

  it("keeps P0 dealId-only input valid at the schema boundary", () => {
    expect(docsRouteInputSchema.safeParse({ dealId: "deal-1" }).success).toBe(true);
    expect(docsRouteInputSchema.safeParse({}).success).toBe(false);
  });
});

describe("closing checklist", () => {
  it("subtracts present classes including this job's proposal", () => {
    expect(missingForClosing(["offer", "insurance"], "financing")).toEqual([
      "mortgage_commitment",
      "id_document",
    ]);
  });

  it("lists P5 classes and stage maps", () => {
    expect(listDocClasses().map((item) => item.docClass)).toContain("waiver_notice");
    expect(listClosingChecklists().find((row) => row.stage === "offer")?.expected).toEqual(["offer"]);
  });

  it("names files from provided identifiers only", () => {
    expect(suggestDocFilename({ docClass: "offer", mlsNumber: "C1234567" })).toBe("offer-C1234567.pdf");
    expect(suggestDocFilename({ docClass: "other", filename: "Seller Scan.PDF" })).toBe("Seller-Scan.PDF");
  });
});
