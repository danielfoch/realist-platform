import { describe, expect, it } from "vitest";
import {
  assertExpectedFill,
  collectProvidedScalars,
  fieldAccuracy,
  fillForm,
  FormFillError,
  listFormMaps,
  rejectIfInvented,
  requiredCompletion,
} from "./index";

const hamiltonProperty = {
  address: "123 King St W",
  city: "Hamilton",
  province: "ON",
  postalCode: "L8P 4R3",
};

const completeApsInput = {
  formId: "orea-100",
  property: hamiltonProperty,
  listing: { mlsNumber: "X1234567" },
  parties: {
    buyer: { name: "Alex Buyer", email: "alex@example.com", phone: "4165550101" },
    seller: { name: "Sam Seller", email: "sam@example.com" },
    buyerBroker: { brokerage: "Buyer Realty Inc." },
    sellerBroker: { brokerage: "Seller Realty Ltd." },
  },
  facts: {
    purchasePrice: 750000,
    depositAmount: 25000,
    depositHeldBy: "Listing brokerage",
    closingDate: "2026-11-15",
    offerDate: "2026-09-20",
  },
};

describe("form registry", () => {
  it("lists the v1 Ontario / OREA set", () => {
    const ids = listFormMaps().map((form) => form.formId);
    expect(ids).toEqual([
      "orea-100",
      "orea-101",
      "orea-105",
      "orea-200",
      "orea-300",
      "orea-320",
      "orea-400",
    ]);
    expect(listFormMaps().every((form) => form.mapConfidence === "draft")).toBe(true);
  });
});

describe("fill engine", () => {
  it("fills APS fields from structured input and leaves signatures blank", () => {
    const result = fillForm(completeApsInput);
    assertExpectedFill(result, {
      values: {
        buyer_1_name: "Alex Buyer",
        seller_1_name: "Sam Seller",
        property_address: "123 King St W",
        property_city: "Hamilton",
        mls_number: "X1234567",
        purchase_price: 750000,
        deposit_amount: 25000,
        completion_date: "2026-11-15",
        buyer_brokerage: "Buyer Realty Inc.",
      },
      missingKeys: ["buyer_1_signature", "seller_1_signature", "buyer_1_initials", "seller_1_initials"],
    });
    expect(result.draft).toBe(true);
    expect(result.specialistId).toBe("realist.forms");
    expect(result.values.buyer_1_signature).toBeUndefined();
    expect(requiredCompletion(result)).toBeLessThan(100);
  });

  it("does not invent purchase price from list price", () => {
    const result = fillForm({
      formId: "orea-100",
      property: hamiltonProperty,
      listing: { mlsNumber: "X1234567", listPrice: 799000 },
      parties: { buyer: { name: "Alex Buyer" }, seller: { name: "Sam Seller" } },
    });
    expect(result.values.purchase_price).toBeUndefined();
    expect(result.missingFields.some((item) => item.key === "purchase_price")).toBe(true);
    expect(result.values.mls_number).toBe("X1234567");
  });

  it("maps listing listPrice only onto listing agreements", () => {
    const result = fillForm({
      formId: "orea-200",
      property: hamiltonProperty,
      listing: { listPrice: 799000 },
      parties: { seller: { firstName: "Sam", lastName: "Seller" } },
    });
    expect(result.values.list_price).toBe(799000);
    expect(result.values.seller_1_name).toBe("Sam Seller");
    expect(result.values.purchase_price).toBeUndefined();
  });

  it("honours overrides and never auto-fills initials from a name", () => {
    const result = fillForm({
      ...completeApsInput,
      overrides: { buyer_1_initials: "AB" },
    });
    expect(result.values.buyer_1_initials).toBe("AB");
    expect(result.fields.find((field) => field.key === "buyer_1_initials")?.source).toBe("override");
    expect(result.values.seller_1_initials).toBeUndefined();
  });

  it("rejects an unknown form id", () => {
    expect(() => fillForm({ formId: "orea-999" })).toThrow(FormFillError);
  });

  it("fills schedule A without inventing additional terms", () => {
    const result = fillForm({
      formId: "orea-400",
      property: { address: "123 King St W" },
      parties: { buyer: { name: "Alex Buyer" } },
      facts: { scheduleLetter: "A", agreementDate: "2026-09-20" },
    });
    expect(result.values.schedule_letter).toBe("A");
    expect(result.values.additional_terms).toBeUndefined();
    expect(result.values.property_address).toBe("123 King St W");
  });
});

describe("eval harness", () => {
  it("scores fieldAccuracy and rejects invented values", () => {
    const result = fillForm(completeApsInput);
    const accuracy = fieldAccuracy(result, {
      buyer_1_name: "Alex Buyer",
      purchase_price: 750000,
    });
    expect(accuracy.ratio).toBe(1);
    expect(accuracy.mismatches).toEqual([]);

    const provided = collectProvidedScalars(completeApsInput);
    expect(rejectIfInvented(result, provided).ok).toBe(true);

    const invented = {
      ...result,
      fields: [...result.fields, { key: "purchase_price", value: 1, source: "hallucination" }],
      values: { ...result.values, purchase_price: 1 },
    };
    const rejected = rejectIfInvented(invented, provided);
    expect(rejected.ok).toBe(false);
  });
});
