import { describe, expect, it } from "vitest";
import {
  BOOKED_CALL_INTENTS,
  BOOKED_CALL_LEAD_STATUSES,
  bookedCallLeadRequestSchema,
  buildBldLeadPayload,
  dealSnapshotSchema,
  isBookedCallLeadStatus,
} from "./bookedCallLeads";

describe("isBookedCallLeadStatus", () => {
  it("accepts every pipeline status", () => {
    for (const status of BOOKED_CALL_LEAD_STATUSES) {
      expect(isBookedCallLeadStatus(status)).toBe(true);
    }
  });

  it("rejects unknown values and non-strings", () => {
    expect(isBookedCallLeadStatus("qualified")).toBe(false);
    expect(isBookedCallLeadStatus("")).toBe(false);
    expect(isBookedCallLeadStatus(null)).toBe(false);
    expect(isBookedCallLeadStatus(3)).toBe(false);
  });
});

describe("bookedCallLeadRequestSchema", () => {
  const valid = {
    fullName: "Dana Investor",
    email: "dana@example.com",
  };

  it("accepts a minimal lead and defaults intent to financing", () => {
    const parsed = bookedCallLeadRequestSchema.parse(valid);
    expect(parsed.intent).toBe("financing");
    expect(parsed.fullName).toBe("Dana Investor");
  });

  it("trims whitespace on name and email", () => {
    const parsed = bookedCallLeadRequestSchema.parse({
      fullName: "  Dana Investor  ",
      email: "  dana@example.com  ",
    });
    expect(parsed.fullName).toBe("Dana Investor");
    expect(parsed.email).toBe("dana@example.com");
  });

  it("rejects a missing or invalid email", () => {
    expect(bookedCallLeadRequestSchema.safeParse({ fullName: "Dana" }).success).toBe(false);
    expect(bookedCallLeadRequestSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("only accepts known intents", () => {
    for (const intent of BOOKED_CALL_INTENTS) {
      expect(bookedCallLeadRequestSchema.safeParse({ ...valid, intent }).success).toBe(true);
    }
    expect(bookedCallLeadRequestSchema.safeParse({ ...valid, intent: "sales" }).success).toBe(false);
  });

  it("accepts full deal context", () => {
    const parsed = bookedCallLeadRequestSchema.parse({
      ...valid,
      phone: "555-123-4567",
      sourcePage: "/tools/multiplex-underwriter",
      underwritingId: "uw-123",
      analysisId: "an-456",
      message: "Closing in 60 days",
      dealSnapshot: {
        address: "123 Logan Ave",
        city: "Toronto",
        purchasePrice: 1_200_000,
        units: 6,
        verdict: "best hold",
        toolName: "multiplex-underwriter",
        keyMetrics: { "Condo exit profit": 412_000, DSCR: 1.21 },
      },
    });
    expect(parsed.dealSnapshot?.address).toBe("123 Logan Ave");
    expect(parsed.underwritingId).toBe("uw-123");
  });

  it("rejects an oversized message", () => {
    expect(
      bookedCallLeadRequestSchema.safeParse({ ...valid, message: "x".repeat(2001) }).success
    ).toBe(false);
  });
});

describe("dealSnapshotSchema", () => {
  it("rejects unknown keys so callers cannot smuggle arbitrary blobs", () => {
    expect(dealSnapshotSchema.safeParse({ address: "123 Logan Ave", resultJson: {} }).success).toBe(false);
  });

  it("caps keyMetrics at 12 entries", () => {
    const keyMetrics = Object.fromEntries(
      Array.from({ length: 13 }, (_, i) => [`metric_${i}`, i])
    );
    expect(dealSnapshotSchema.safeParse({ keyMetrics }).success).toBe(false);
    expect(
      dealSnapshotSchema.safeParse({
        keyMetrics: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`metric_${i}`, i])),
      }).success
    ).toBe(true);
  });

  it("rejects negative purchase prices", () => {
    expect(dealSnapshotSchema.safeParse({ purchasePrice: -1 }).success).toBe(false);
  });
});

describe("buildBldLeadPayload", () => {
  const lead = {
    id: "lead-1",
    fullName: "Dana Investor",
    email: "dana@example.com",
    phone: "555-123-4567",
    intent: "financing",
    status: "flipped",
    sourcePage: "/tools/multiplex-underwriter",
    underwritingId: "uw-123",
    analysisId: null,
    dealSnapshot: { address: "123 Logan Ave" },
    message: "Closing in 60 days",
    notes: "INTERNAL: pre-approved elsewhere, push hard",
    createdAt: new Date("2026-07-03T12:00:00Z"),
  };

  it("includes contact and deal context", () => {
    const payload = buildBldLeadPayload(lead, "flipped");
    expect(payload).toMatchObject({
      source: "realist.ca",
      event: "flipped",
      leadId: "lead-1",
      intent: "financing",
      contact: { fullName: "Dana Investor", email: "dana@example.com", phone: "555-123-4567" },
      context: {
        sourcePage: "/tools/multiplex-underwriter",
        underwritingId: "uw-123",
        analysisId: null,
        dealSnapshot: { address: "123 Logan Ave" },
      },
      message: "Closing in 60 days",
      submittedAt: "2026-07-03T12:00:00.000Z",
    });
  });

  it("never leaks internal admin notes or forwarding bookkeeping", () => {
    const payload = buildBldLeadPayload(lead, "created");
    const json = JSON.stringify(payload);
    expect(json).not.toContain("INTERNAL");
    expect(json).not.toContain("notes");
    expect(json).not.toContain("forwarded");
  });

  it("normalizes missing optionals to null", () => {
    const payload = buildBldLeadPayload(
      { id: "lead-2", fullName: "A B", email: "a@b.co", intent: "coaching", status: "new" },
      "created"
    );
    expect(payload.contact.phone).toBeNull();
    expect(payload.context.sourcePage).toBeNull();
    expect(payload.context.dealSnapshot).toBeNull();
    expect(payload.message).toBeNull();
    expect(payload.submittedAt).toBeNull();
  });
});
