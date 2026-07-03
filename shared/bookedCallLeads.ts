/**
 * Booked-call lead funnel — pure helpers.
 *
 * The funnel: a visitor (signed in or not) asks to talk to a financing
 * specialist about a deal, or requests a coaching call. We store the lead
 * with its context (source page, underwriting/analysis snapshot), an admin
 * works it new → contacted → booked, and a qualified financing lead is
 * flipped to the BLD Financial contact (status "flipped").
 *
 * Delivery to BLD is env-driven and STUBBED until wired — see
 * server/bldLeadDestination.ts. Nothing in this module performs I/O.
 */
import { z } from "zod";

// ─── Intents & statuses ──────────────────────────────────────────────────────

export const BOOKED_CALL_INTENTS = ["financing", "coaching"] as const;
export type BookedCallIntent = (typeof BOOKED_CALL_INTENTS)[number];

/** Pipeline: new → contacted → booked → flipped (handed to BLD). */
export const BOOKED_CALL_LEAD_STATUSES = ["new", "contacted", "booked", "flipped"] as const;
export type BookedCallLeadStatus = (typeof BOOKED_CALL_LEAD_STATUSES)[number];

export function isBookedCallLeadStatus(value: unknown): value is BookedCallLeadStatus {
  return typeof value === "string" && (BOOKED_CALL_LEAD_STATUSES as readonly string[]).includes(value);
}

// ─── Deal snapshot ───────────────────────────────────────────────────────────

/**
 * Small, allowlisted snapshot of the deal at CTA time — enough for the
 * financing call to be concrete without persisting a multi-MB result_json.
 * `.strict()` rejects unknown keys so callers can't smuggle arbitrary blobs.
 */
export const dealSnapshotSchema = z
  .object({
    address: z.string().trim().max(200).optional(),
    city: z.string().trim().max(80).optional(),
    purchasePrice: z.number().finite().nonnegative().optional(),
    units: z.number().int().min(0).max(200).optional(),
    verdict: z.string().trim().max(160).optional(),
    toolName: z.string().trim().max(60).optional(),
    /** Labelled headline numbers, e.g. { "Condo exit profit": 412000 }. */
    keyMetrics: z
      .record(z.union([z.string().max(160), z.number()]))
      .refine((obj) => Object.keys(obj).length <= 12, "Too many key metrics")
      .optional(),
  })
  .strict();
export type DealSnapshot = z.infer<typeof dealSnapshotSchema>;

// ─── Lead creation request ───────────────────────────────────────────────────

export const bookedCallLeadRequestSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(120),
  email: z.string().trim().email("Please enter a valid email").max(254),
  phone: z.string().trim().max(30).optional(),
  intent: z.enum(BOOKED_CALL_INTENTS).default("financing"),
  /** Page the CTA sat on, e.g. /tools/multiplex-underwriter. */
  sourcePage: z.string().trim().max(200).optional(),
  /** multiplex_underwritings.id when the CTA sits on an underwriter result. */
  underwritingId: z.string().trim().max(64).optional(),
  /** property_analyses.id when the CTA sits on an analyzer result. */
  analysisId: z.string().trim().max(64).optional(),
  dealSnapshot: dealSnapshotSchema.optional(),
  message: z.string().trim().max(2000).optional(),
});
export type BookedCallLeadRequest = z.infer<typeof bookedCallLeadRequestSchema>;

// ─── BLD destination payload ─────────────────────────────────────────────────

/** Fields the destination payload is built from (subset of the DB row). */
export interface BldPayloadLead {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  intent: string;
  status: string;
  sourcePage?: string | null;
  underwritingId?: string | null;
  analysisId?: string | null;
  dealSnapshot?: unknown;
  message?: string | null;
  createdAt?: Date | string | null;
}

export type BldLeadEvent = "created" | "flipped";

/**
 * The exact JSON a configured BLD destination receives. Deliberately excludes
 * internal admin notes and forwarding bookkeeping — contact info + deal
 * context only.
 */
export function buildBldLeadPayload(lead: BldPayloadLead, event: BldLeadEvent) {
  return {
    source: "realist.ca",
    event,
    leadId: lead.id,
    intent: lead.intent,
    status: lead.status,
    contact: {
      fullName: lead.fullName,
      email: lead.email,
      phone: lead.phone || null,
    },
    context: {
      sourcePage: lead.sourcePage || null,
      underwritingId: lead.underwritingId || null,
      analysisId: lead.analysisId || null,
      dealSnapshot: lead.dealSnapshot ?? null,
    },
    message: lead.message || null,
    submittedAt: lead.createdAt ? new Date(lead.createdAt).toISOString() : null,
  };
}
export type BldLeadPayload = ReturnType<typeof buildBldLeadPayload>;
